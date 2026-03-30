const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../middleware/auth');

/* ── GET / — list all categories with post counts ── */
router.get('/', auth, async (req, res) => {
  try {
    const [cats] = await db.execute(
      `SELECT c.category_id, c.name, c.icon, c.description,
              (SELECT COUNT(*) FROM posts p WHERE p.category=c.name AND p.is_pending=FALSE) AS post_count,
              (SELECT COUNT(*) FROM quizzes q WHERE q.category=c.name AND q.is_published=TRUE) AS quiz_count
       FROM categories c ORDER BY c.category_id`);
    res.json(cats);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── GET /interests — get current user's interests ── */
router.get('/interests', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT c.category_id, c.name, c.icon
       FROM user_interests ui JOIN categories c ON ui.category_id=c.category_id
       WHERE ui.user_id=?`, [req.user.user_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── POST /interests — set user interests (replaces all) ── */
router.post('/interests', auth, async (req, res) => {
  const { category_ids } = req.body; // array of ints
  if (!Array.isArray(category_ids))
    return res.status(400).json({ message: 'category_ids must be an array' });

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    await conn.execute('DELETE FROM user_interests WHERE user_id=?', [req.user.user_id]);
    for (const cid of category_ids) {
      await conn.execute('INSERT IGNORE INTO user_interests (user_id,category_id) VALUES (?,?)',
        [req.user.user_id, cid]);
    }
    await conn.commit();
    res.json({ message: 'Interests updated' });
  } catch (err) { await conn?.rollback(); res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── GET /recommended — posts matching user interests ── */
router.get('/recommended', auth, async (req, res) => {
  const userId = req.user.user_id;
  try {
    const [interests] = await db.execute(
      `SELECT c.name FROM user_interests ui JOIN categories c ON ui.category_id=c.category_id WHERE ui.user_id=?`,
      [userId]);

    let posts;
    if (interests.length) {
      const names = interests.map(i => i.name);
      const placeholders = names.map(() => '?').join(',');
      [posts] = await db.query(
        `SELECT p.post_id, p.user_id, p.text AS content, p.post_date, p.category,
                p.media_type, p.small_img, p.video_url AS video, p.is_anonymous,
                GROUP_CONCAT(DISTINCT pt.tag) AS tags,
                u.username, COALESCE(ui.first_name,'') AS first_name, COALESCE(ui.last_name,'') AS last_name,
                (SELECT COUNT(*) FROM likes WHERE post_id=p.post_id) AS like_count,
                (SELECT COUNT(*) FROM likes WHERE post_id=p.post_id AND user_id=?) AS user_liked,
                (SELECT COUNT(*) FROM comments WHERE post_id=p.post_id) AS comment_count,
                (SELECT COUNT(*) FROM user_watch WHERE post_id=p.post_id AND user_id=?) AS user_saved
         FROM posts p
         INNER JOIN users u    ON p.user_id=u.user_id
         LEFT  JOIN user_info ui ON p.user_id=ui.user_id
         LEFT  JOIN post_tags pt ON p.post_id=pt.post_id
         WHERE p.category IN (${placeholders}) AND p.is_pending=FALSE
         GROUP BY p.post_id ORDER BY p.post_date DESC LIMIT 20`,
        [userId, userId, ...names]);
    } else {
      // Fall back to latest posts
      [posts] = await db.query(
        `SELECT p.post_id, p.user_id, p.text AS content, p.post_date, p.category,
                p.media_type, p.small_img, p.video_url AS video, p.is_anonymous,
                GROUP_CONCAT(DISTINCT pt.tag) AS tags,
                u.username, COALESCE(ui.first_name,'') AS first_name, COALESCE(ui.last_name,'') AS last_name,
                (SELECT COUNT(*) FROM likes WHERE post_id=p.post_id) AS like_count,
                (SELECT COUNT(*) FROM likes WHERE post_id=p.post_id AND user_id=?) AS user_liked,
                (SELECT COUNT(*) FROM comments WHERE post_id=p.post_id) AS comment_count,
                (SELECT COUNT(*) FROM user_watch WHERE post_id=p.post_id AND user_id=?) AS user_saved
         FROM posts p
         INNER JOIN users u      ON p.user_id=u.user_id
         LEFT  JOIN user_info ui ON p.user_id=ui.user_id
         LEFT  JOIN post_tags pt ON p.post_id=pt.post_id
         WHERE p.is_pending=FALSE
         GROUP BY p.post_id ORDER BY p.post_date DESC LIMIT 20`,
        [userId, userId]);
    }

    // Convert images
    for (const p of posts) {
      if (p.small_img) { p.image = `data:image/jpeg;base64,${p.small_img.toString('base64')}`; }
      delete p.small_img;
    }

    res.json({ posts, interests: interests.map(i => i.name) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
