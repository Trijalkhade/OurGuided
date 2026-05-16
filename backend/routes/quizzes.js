const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../middleware/auth');
const { createNotification } = require('./notifications');
const moderationService = require('../utils/moderationService');
const { globalActionLimiter } = require('../middleware/rateLimit');

/* ── GET /   — list published quizzes ── */
router.get('/', auth, async (req, res) => {
  const { category, difficulty } = req.query;
  let where = 'WHERE q.is_published = TRUE AND q.is_deleted = FALSE';
  const params = [];
  if (category)   { where += ' AND q.category = ?';   params.push(category); }
  if (difficulty) { where += ' AND q.difficulty = ?'; params.push(difficulty); }

  try {
    const [quizzes] = await db.query(
      `SELECT q.quiz_id, q.title, q.description, q.category, q.difficulty, q.created_at,
              u.username AS creator,
              COALESCE(ui.first_name,'') AS first_name,
              COALESCE(ui.last_name,'')  AS last_name,
              up.is_expert,
              (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id=q.quiz_id) AS question_count,
              (SELECT COUNT(*) FROM quiz_attempts  WHERE quiz_id=q.quiz_id) AS attempt_count,
              (SELECT COUNT(*) FROM quiz_attempts  WHERE quiz_id=q.quiz_id AND user_id=?) AS user_attempted
       FROM quizzes q
       INNER JOIN users u       ON q.creator_id = u.user_id
       LEFT  JOIN user_info ui  ON q.creator_id = ui.user_id
       LEFT  JOIN user_profile up ON q.creator_id = up.user_id
       ${where}
       ORDER BY q.created_at DESC`,
      [req.user.user_id, ...params]);
    res.json(quizzes);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── GET /my — quizzes created by current user ── */
router.get('/my', auth, async (req, res) => {
  try {
    const [quizzes] = await db.execute(
      `SELECT q.*,
              (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id=q.quiz_id) AS question_count,
              (SELECT COUNT(*) FROM quiz_attempts  WHERE quiz_id=q.quiz_id) AS attempt_count
       FROM quizzes q WHERE q.creator_id=? AND q.is_deleted = FALSE ORDER BY q.created_at DESC`, [req.user.user_id]);
    res.json(quizzes);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── GET /:id — full quiz with questions (no answers revealed) ── */
router.get('/:id', auth, async (req, res) => {
  try {
    const [[quiz]] = await db.execute(
      `SELECT q.*, u.username AS creator,
              COALESCE(ui.first_name,'') AS first_name, COALESCE(ui.last_name,'') AS last_name,
              up.is_expert
       FROM quizzes q
       INNER JOIN users u       ON q.creator_id=u.user_id
       LEFT  JOIN user_info ui  ON q.creator_id=ui.user_id
       LEFT  JOIN user_profile up ON q.creator_id=up.user_id
       WHERE q.quiz_id=? AND q.is_deleted = FALSE`, [req.params.id]);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    const [questions] = await db.execute(
      'SELECT question_id, question_text, points, sort_order FROM quiz_questions WHERE quiz_id=? ORDER BY sort_order',
      [req.params.id]);

    for (const q of questions) {
      const [options] = await db.execute(
        'SELECT option_id, option_text, sort_order FROM quiz_options WHERE question_id=? ORDER BY sort_order',
        [q.question_id]);
      q.options = options;
    }

    quiz.questions = questions;

    // Check if already attempted
    const [[attempt]] = await db.execute(
      'SELECT attempt_id, score, total_points, percentage FROM quiz_attempts WHERE user_id=? AND quiz_id=? ORDER BY completed_at DESC LIMIT 1',
      [req.user.user_id, req.params.id]);
    quiz.user_attempt = attempt || null;

    res.json(quiz);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── POST / — create quiz (experts only) ── */
router.post('/', auth, globalActionLimiter, async (req, res) => {
  const userId = req.user.user_id;
  const { title, description, category, difficulty, questions } = req.body;

  if (!title || !questions?.length)
    return res.status(400).json({ message: 'Title and at least one question are required' });

  let conn;
  try {
    conn = await db.getConnection();
    // Verify expert
    const [[profile]] = await conn.execute('SELECT is_expert FROM user_profile WHERE user_id=?', [userId]);
    if (!profile?.is_expert)
      return res.status(403).json({ message: 'Only verified experts can create quizzes' });

    await conn.beginTransaction();
    const [r] = await conn.execute(
      'INSERT INTO quizzes (creator_id,title,description,category,difficulty,is_published) VALUES (?,?,?,?,?,TRUE)',
      [userId, title, description || null, category || null, difficulty || 'Beginner']);
    const quizId = r.insertId;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const [qr] = await conn.execute(
        'INSERT INTO quiz_questions (quiz_id,question_text,points,sort_order) VALUES (?,?,?,?)',
        [quizId, q.question_text, q.points || 1, i]);
      const qId = qr.insertId;
      for (let j = 0; j < (q.options || []).length; j++) {
        const opt = q.options[j];
        await conn.execute(
          'INSERT INTO quiz_options (question_id,option_text,is_correct,sort_order) VALUES (?,?,?,?)',
          [qId, opt.option_text, opt.is_correct ? 1 : 0, j]);
      }
    }
    await conn.commit();
    conn.release();

    // Background hate speech detection and user notifications
    (async () => {
      try {
        // Combine all quiz content (Title + Desc + Questions + All Options) for deep scan
        const quizContent = `
          TITLE: ${title}
          DESCRIPTION: ${description || ''}
          QUESTIONS: ${questions.map(q => `
            Q: ${q.question_text}
            OPTIONS: ${(q.options || []).map(opt => opt.option_text).join(' | ')}
          `).join('\n')}
        `;
        
        await moderationService.queueForDetection({
          type: 'quiz',
          id: quizId,
          userId: userId,
          content: quizContent
        });

        // Notify only followers who have quiz notifications enabled
        const [[creatorInfo]] = await db.execute(
          `SELECT COALESCE(ui.first_name, u.username) AS name
           FROM users u LEFT JOIN user_info ui ON u.user_id = ui.user_id
           WHERE u.user_id = ?`, [userId]);
        const creatorName = creatorInfo?.name || 'Someone';

        const [followers] = await db.execute(
          `SELECT f.follower_id
           FROM follows f
           JOIN user_profile up ON f.follower_id = up.user_id
           WHERE f.following_id = ? AND up.notify_quizzes = TRUE`,
          [userId]);
        for (const f of followers) {
          await createNotification(
            f.follower_id, 'quiz', 'New Quiz Published!',
            `${creatorName} published a new quiz. Test your knowledge now!`
          );
        }
      } catch (e) { 
        console.error('Quiz background processing failed:', e); 
      }
    })();

    res.status(201).json({ quiz_id: quizId, message: 'Quiz created!' });
  } catch (err) { await conn?.rollback(); res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── POST /:id/submit — submit attempt ── */
router.post('/:id/submit', auth, async (req, res) => {
  const userId  = req.user.user_id;
  const quizId  = req.params.id;
  const { answers } = req.body; // [{ question_id, option_id }]

  if (!answers?.length) return res.status(400).json({ message: 'No answers provided' });

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // Fetch correct answers
    const [questions] = await conn.execute(
      `SELECT qq.question_id, qq.points,
              (SELECT option_id FROM quiz_options WHERE question_id=qq.question_id AND is_correct=TRUE LIMIT 1) AS correct_option
       FROM quiz_questions qq WHERE qq.quiz_id=?`, [quizId]);

    let score = 0;
    let total = questions.reduce((s, q) => s + (q.points || 1), 0);
    const results = [];

    for (const q of questions) {
      const userAnswer = answers.find(a => Number(a.question_id) === Number(q.question_id));
      const isCorrect  = userAnswer && Number(userAnswer.option_id) === Number(q.correct_option);
      if (isCorrect) score += (q.points || 1);
      results.push({ question_id: q.question_id, correct_option: q.correct_option, is_correct: isCorrect });
    }

    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const [ar] = await conn.execute(
      'INSERT INTO quiz_attempts (user_id,quiz_id,score,total_points,percentage) VALUES (?,?,?,?,?)',
      [userId, quizId, score, total, pct]);

    for (const a of answers) {
      const q = questions.find(q => Number(q.question_id) === Number(a.question_id));
      if (q) {
        const isCorr = Number(a.option_id) === Number(q.correct_option);
        await conn.execute(
          'INSERT IGNORE INTO quiz_attempt_answers (attempt_id,question_id,option_id,is_correct) VALUES (?,?,?,?)',
          [ar.insertId, a.question_id, a.option_id, isCorr ? 1 : 0]);
      }
    }

    await conn.commit();
    res.json({ attempt_id: ar.insertId, score, total_points: total, percentage: pct, results });
  } catch (err) { await conn?.rollback(); res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── DELETE /:id — delete own quiz ── */
router.delete('/:id', auth, async (req, res) => {
  try {
    const [r] = await db.execute('DELETE FROM quizzes WHERE quiz_id=? AND creator_id=?',
      [req.params.id, req.user.user_id]);
    if (!r.affectedRows) return res.status(403).json({ message: 'Not authorized' });
    res.json({ message: 'Quiz deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── GET /:id/leaderboard ── */
router.get('/:id/leaderboard', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.public_id AS user_id, u.username,
              COALESCE(ui.first_name,'') AS first_name, COALESCE(ui.last_name,'') AS last_name,
              MAX(qa.percentage) AS best_pct, MAX(qa.score) AS best_score
       FROM quiz_attempts qa
       INNER JOIN users u      ON qa.user_id=u.user_id
       LEFT  JOIN user_info ui ON qa.user_id=ui.user_id
       WHERE qa.quiz_id=?
       GROUP BY qa.user_id ORDER BY best_pct DESC, best_score DESC LIMIT 20`,
      [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
