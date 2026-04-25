const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

/* ── GET /search/:query ── */
router.get('/search/:query', auth, async (req, res) => {
  try {
    const q = `%${req.params.query}%`;
    const [users] = await db.execute(
      `SELECT u.user_id, u.username, ui.first_name, ui.last_name, ui.photo, up.is_expert
       FROM users u
       LEFT JOIN user_info ui    ON u.user_id=ui.user_id
       LEFT JOIN user_profile up ON u.user_id=up.user_id
       WHERE u.username LIKE ? OR ui.first_name LIKE ? OR ui.last_name LIKE ?
       LIMIT 20`, [q, q, q]);
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── GET /leaderboard ── */
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.user_id, u.username,
              COALESCE(ui.first_name,'') AS first_name, COALESCE(ui.last_name,'') AS last_name,
              up.total_knowledge, up.core_level, up.is_expert,
              ss.streak_days, ss.streak_factor
       FROM users u
       LEFT JOIN user_info ui    ON u.user_id=ui.user_id
       LEFT JOIN user_profile up ON u.user_id=up.user_id
       LEFT JOIN study_streak ss ON u.user_id=ss.user_id
       ORDER BY up.total_knowledge DESC LIMIT 20`);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── GET /:id ── */
router.get('/:id', auth, async (req, res) => {
  try {
    const userId = req.params.id;
    const [[user]] = await db.execute(
      `SELECT u.user_id, u.username, u.email, u.join_date,
              ui.first_name, ui.middle_name, ui.last_name, ui.photo,
              up.dob, up.bio, up.core_level, up.total_knowledge, up.badges,
              up.knowledge_today, up.is_expert, up.is_private,
              TIMESTAMPDIFF(YEAR, up.dob, CURDATE()) AS age
       FROM users u
       LEFT JOIN user_info ui    ON u.user_id=ui.user_id
       LEFT JOIN user_profile up ON u.user_id=up.user_id
       WHERE u.user_id=?`, [userId]);

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.photo) user.photo = `data:image/jpeg;base64,${user.photo.toString('base64')}`;

    const [phones] = await db.execute(
      'SELECT phone_id, phone_no, about FROM user_phone WHERE user_id=?', [userId]);
    const [skills] = await db.execute(
      `SELECT s.skill_id, s.skill_name FROM user_skills us
       JOIN skills s ON us.skill_id=s.skill_id WHERE us.user_id=?`, [userId]);
    const [certifications] = await db.execute(
      `SELECT c.certification_id, c.certification_name, c.issued_by,
              uc.certified_level, uc.certificate_url, uc.issued_date, uc.expiry_date, uc.certificate_img
       FROM user_certifications uc JOIN certifications c ON uc.certification_id=c.certification_id
       WHERE uc.user_id=?`, [userId]);
    certifications.forEach(c => {
      if (c.certificate_img) c.certificate_img = c.certificate_img.toString('base64');
    });
    const [education] = await db.execute(
      `SELECT et.type, ue.institution, ue.score
       FROM user_education ue JOIN education_type et ON ue.type_id=et.type_id
       WHERE ue.user_id=?`, [userId]);
    const [[{ count: post_count }]] = await db.execute(
      'SELECT COUNT(*) AS count FROM posts WHERE user_id=? AND is_pending=FALSE AND is_deleted=FALSE', [userId]);
    const [interests] = await db.execute(
      `SELECT c.category_id, c.name, c.icon FROM user_interests ui
       JOIN categories c ON ui.category_id=c.category_id WHERE ui.user_id=?`, [userId]);
    const [[studyStats]] = await db.execute(
      'SELECT streak_days, streak_factor, total_knowledge, multiplier, learning_core FROM study_streak WHERE user_id=?',
      [userId]).catch(() => [[null]]);

    res.json({ ...user, phones, skills, certifications, education, post_count, interests, study_stats: studyStats || null });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── PUT /profile/update ── */
router.put('/profile/update', auth, upload.single('photo'), async (req, res) => {
  const { bio, first_name, middle_name, last_name, dob } = req.body;
  const userId = req.user.user_id;
  const photo = req.file ? req.file.buffer : null;

  const { isBufferSafeImage } = require('../utils/security');
  if (photo && !isBufferSafeImage(photo)) {
    return res.status(400).json({ message: 'Invalid photo format detected' });
  }
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.execute(`INSERT IGNORE INTO user_profile (user_id,dob) VALUES (?,'2000-01-01')`, [userId]);
    await conn.execute(
      `UPDATE user_profile SET bio=COALESCE(?,bio), dob=COALESCE(?,dob) WHERE user_id=?`,
      [bio || null, dob || null, userId]);

    await conn.execute(`INSERT IGNORE INTO user_info (user_id,first_name,last_name) VALUES (?,  '','')`, [userId]);
    const [[existing]] = await conn.execute('SELECT first_name, last_name FROM user_info WHERE user_id=?', [userId]);
    const fn = first_name || existing.first_name;
    const ln = last_name || existing.last_name;
    if (!fn || !ln) return res.status(400).json({ message: 'First and Last name required' });

    await conn.execute(
      `UPDATE user_info SET first_name=?, middle_name=?, last_name=?, photo=COALESCE(?,photo) WHERE user_id=?`,
      [fn, middle_name || null, ln, photo, userId]);

    await conn.commit();
    res.json({ message: 'Profile updated' });
  } catch (err) { await conn?.rollback(); res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── POST /phones ── */
router.post('/phones', auth, async (req, res) => {
  const { phone_no, about } = req.body;
  if (!phone_no) return res.status(400).json({ message: 'Phone number required' });
  try {
    const [r] = await db.execute('INSERT INTO user_phone (user_id,phone_no,about) VALUES (?,?,?)',
      [req.user.user_id, phone_no, about || null]);
    res.status(201).json({ phone_id: r.insertId, phone_no, about });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/phones/:id', auth, async (req, res) => {
  try {
    const [r] = await db.execute('DELETE FROM user_phone WHERE phone_id=? AND user_id=?', [req.params.id, req.user.user_id]);
    if (!r.affectedRows) return res.status(403).json({ message: 'Not authorized or phone not found' });
    res.json({ message: 'Phone deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── POST /skills ── */
router.post('/skills', auth, async (req, res) => {
  const { skill_name } = req.body;
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [skill] = await conn.execute(
      `INSERT INTO skills (skill_name) VALUES (?) ON DUPLICATE KEY UPDATE skill_id=LAST_INSERT_ID(skill_id)`,
      [skill_name]);
    const skillId = skill.insertId;
    await conn.execute('INSERT IGNORE INTO user_skills (user_id,skill_id) VALUES (?,?)',
      [req.user.user_id, skillId]);
    await conn.commit();
    res.status(201).json({ skill_id: skillId, skill_name });
  } catch (err) { await conn?.rollback(); res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

router.delete('/skills/:id', auth, async (req, res) => {
  try {
    await db.execute('DELETE FROM user_skills WHERE skill_id=? AND user_id=?',
      [req.params.id, req.user.user_id]);
    res.json({ message: 'Skill deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── POST /certifications ── */
router.post('/certifications', auth, upload.single('certificate_img'), async (req, res) => {
  const { certification_name, certificate_url, certified_level } = req.body;
  const certificate_img = req.file ? req.file.buffer : null;

  const { isBufferSafeImage } = require('../utils/security');
  if (certificate_img && !isBufferSafeImage(certificate_img)) {
    return res.status(400).json({ message: 'Invalid certificate image format detected' });
  }
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [cert] = await conn.execute(
      `INSERT INTO certifications (certification_name) VALUES (?) ON DUPLICATE KEY UPDATE certification_id=LAST_INSERT_ID(certification_id)`,
      [certification_name]);
    await conn.execute(
      `INSERT INTO user_certifications (user_id,certification_id,certified_level,certificate_url,certificate_img)
       VALUES (?,?,?,?,?)`,
      [req.user.user_id, cert.insertId, certified_level || null, certificate_url || null, certificate_img]);
    await conn.commit();
    res.status(201).json({ certification_id: cert.insertId, certification_name });
  } catch (err) { await conn?.rollback(); res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── POST /education ── */
router.post('/education', auth, async (req, res) => {
  const { type, institution, score } = req.body;
  if (!type || !institution || !score)
    return res.status(400).json({ message: 'Missing fields' });
  try {
    const [[typeRow]] = await db.execute('SELECT type_id FROM education_type WHERE type=?', [type]);
    if (!typeRow) return res.status(400).json({ message: 'Invalid education type' });
    await db.execute(
      `INSERT INTO user_education (user_id,type_id,institution,score) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE institution=VALUES(institution), score=VALUES(score)`,
      [req.user.user_id, typeRow.type_id, institution, score]);
    res.json({ message: 'Education saved' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── POST /request-expert ── */
router.post('/request-expert', auth, async (req, res) => {
  // For now, auto-grant expert if total_knowledge >= 100
  try {
    const [[profile]] = await db.execute(
      'SELECT total_knowledge FROM user_profile WHERE user_id=?', [req.user.user_id]);
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    if (parseFloat(profile.total_knowledge) < 100)
      return res.status(403).json({ message: 'You need at least 100 knowledge points to become an expert' });
    await db.execute('UPDATE user_profile SET is_expert=TRUE WHERE user_id=?', [req.user.user_id]);
    res.json({ message: 'Expert status granted! You can now create quizzes.', is_expert: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
