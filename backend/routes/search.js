const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../middleware/auth');
const { formatPhoto } = require('../utils/dbHelpers');

/* GET /api/search?q=... — unified search across users, posts, quizzes */
router.get('/', auth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ users: [], posts: [], quizzes: [] });

  const like = `%${q}%`;
  let conn;
  try {
    conn = await db.getConnection();

    const [users, posts, quizzes] = await Promise.all([
      conn.execute(
        `SELECT u.public_id AS user_id, u.username, ui.first_name, ui.last_name, ui.photo, up.is_expert
         FROM users u
         LEFT JOIN user_info ui    ON u.user_id=ui.user_id
         LEFT JOIN user_profile up ON u.user_id=up.user_id
         WHERE u.username LIKE ? OR ui.first_name LIKE ? OR ui.last_name LIKE ?
         LIMIT 5`, [like, like, like]
      ).then(([rows]) => rows),

      conn.query(
        `SELECT p.public_id AS post_id, p.text AS content, p.category, p.post_date, u.username
         FROM posts p
         INNER JOIN users u ON p.user_id = u.user_id
         LEFT  JOIN post_tags pt ON p.post_id = pt.post_id
         WHERE p.is_pending = FALSE AND p.is_deleted = FALSE
           AND (p.text LIKE ? OR pt.tag LIKE ? OR p.category LIKE ?)
         GROUP BY p.post_id
         ORDER BY p.post_date DESC LIMIT 5`, [like, like, like]
      ).then(([rows]) => rows),

      conn.execute(
        `SELECT q.quiz_id, q.title, q.category, q.difficulty
         FROM quizzes q
         WHERE q.is_published = TRUE AND q.is_deleted = FALSE
           AND (q.title LIKE ? OR q.category LIKE ?)
         ORDER BY q.created_at DESC LIMIT 4`, [like, like]
      ).then(([rows]) => rows),
    ]);

    for (const u of users) {
      u.photo = formatPhoto(u.photo);
    }

    res.json({ users, posts, quizzes });
  } catch (err) {
    console.error('SEARCH ERROR:', err.message);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
