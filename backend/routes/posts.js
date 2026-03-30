const express = require('express');
const router  = express.Router();
const db      = require('../db');
const upload  = require('../middleware/upload');
const auth    = require('../middleware/auth');

/* ── helper ── */
function convertImage(post) {
  if (post.small_img) {
    post.image = `data:image/jpeg;base64,${post.small_img.toString('base64')}`;
  } else { post.image = null; }
  delete post.small_img;
  return post;
}

async function enrichPost(conn, post, userId) {
  convertImage(post);
  // Convert author profile photo from Buffer to base64 data URL
  if (post.photo && Buffer.isBuffer(post.photo)) {
    post.photo = `data:image/jpeg;base64,${post.photo.toString('base64')}`;
  } else if (!post.photo || post.photo === '') {
    post.photo = null;
  }
  const [[lk]] = await conn.execute('SELECT COUNT(*) AS c FROM likes WHERE post_id=?', [post.post_id]);
  const [[ul]] = await conn.execute('SELECT COUNT(*) AS c FROM likes WHERE post_id=? AND user_id=?', [post.post_id, userId]);
  const [[cm]] = await conn.execute('SELECT COUNT(*) AS c FROM comments WHERE post_id=?', [post.post_id]);
  const [[wl]] = await conn.execute('SELECT COUNT(*) AS c FROM user_watch WHERE post_id=? AND user_id=?', [post.post_id, userId]);
  post.like_count    = lk.c;
  post.user_liked    = ul.c;
  post.comment_count = cm.c;
  post.user_saved    = wl.c > 0;
  // Fetch extra images
  const [imgs] = await conn.execute(
    'SELECT image FROM post_images WHERE post_id=? ORDER BY sort_order', [post.post_id]);
  post.extra_images = imgs.map(r => `data:image/jpeg;base64,${r.image.toString('base64')}`);
  return post;
}

const POST_SELECT = `
  SELECT p.post_id, p.user_id, p.text AS content, p.post_date, p.category,
         p.media_type, p.small_img, p.video_url AS video, p.is_anonymous,
         GROUP_CONCAT(DISTINCT pt.tag ORDER BY pt.tag) AS tags,
         u.username,
         COALESCE(ui.first_name,'') AS first_name,
         COALESCE(ui.last_name,'')  AS last_name,
         COALESCE(ui.photo,'')      AS photo
  FROM posts p
  INNER JOIN users u    ON p.user_id = u.user_id
  LEFT  JOIN user_info ui ON p.user_id = ui.user_id
  LEFT  JOIN post_tags pt ON p.post_id = pt.post_id`;

/* ── GET /feed ── */
router.get('/feed', auth, async (req, res) => {
  const page   = parseInt(req.query.page)     || 1;
  const cat    = req.query.category           || null;
  const limit  = 10;
  const offset = (page - 1) * limit;
  const userId = req.user.user_id;
  let conn;
  try {
    conn = await db.getConnection();
    let where = 'WHERE p.is_pending = FALSE';
    const params = [];
    if (cat) { where += ' AND p.category = ?'; params.push(cat); }

    const [posts] = await conn.query(
      `${POST_SELECT} ${where}
       GROUP BY p.post_id ORDER BY p.post_date DESC LIMIT ${limit} OFFSET ${offset}`, params);
    for (const p of posts) await enrichPost(conn, p, userId);
    res.json(posts);
  } catch (err) { console.error('FEED ERROR:', err.message); res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── GET /user/:id ── */
router.get('/user/:id', auth, async (req, res) => {
  const userId    = req.user.user_id;
  const profileId = req.params.id;
  let conn;
  try {
    conn = await db.getConnection();
    const [posts] = await conn.query(
      `${POST_SELECT} WHERE p.user_id = ? AND p.is_pending = FALSE
       GROUP BY p.post_id ORDER BY p.post_date DESC LIMIT 50`, [profileId]);
    for (const p of posts) await enrichPost(conn, p, userId);
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── GET /watchlist ── */
router.get('/watchlist', auth, async (req, res) => {
  const userId = req.user.user_id;
  let conn;
  try {
    conn = await db.getConnection();
    const [posts] = await conn.query(
      `${POST_SELECT}
       INNER JOIN user_watch uw ON uw.post_id = p.post_id AND uw.user_id = ?
       GROUP BY p.post_id ORDER BY uw.watch_date DESC LIMIT 50`, [userId]);
    for (const p of posts) await enrichPost(conn, p, userId);
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── GET /pending (admin/expert moderation) ── */
router.get('/pending', auth, async (req, res) => {
  const userId = req.user.user_id;
  let conn;
  try {
    conn = await db.getConnection();
    const [[expert]] = await conn.execute(
      'SELECT is_expert FROM user_profile WHERE user_id=?', [userId]);
    if (!expert?.is_expert)
      return res.status(403).json({ message: 'Expert access required' });
    const [posts] = await conn.query(
      `${POST_SELECT} WHERE p.is_pending = TRUE
       GROUP BY p.post_id ORDER BY p.post_date DESC`);
    for (const p of posts) await enrichPost(conn, p, userId);
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── GET /tag/:tag — all posts with a tag ── */
router.get('/tag/:tag', auth, async (req, res) => {
  const userId = req.user.user_id;
  const tag    = req.params.tag;
  const page   = parseInt(req.query.page) || 1;
  const limit  = 10;
  const offset = (page - 1) * limit;
  let conn;
  try {
    conn = await db.getConnection();
    const [posts] = await conn.query(
      `SELECT p.post_id, p.user_id, p.text AS content, p.post_date, p.category,
              p.media_type, p.small_img, p.video_url AS video, p.is_anonymous,
              GROUP_CONCAT(DISTINCT pt2.tag ORDER BY pt2.tag) AS tags,
              u.username, COALESCE(ui.first_name,'') AS first_name,
              COALESCE(ui.last_name,'') AS last_name, COALESCE(ui.photo,'') AS photo
       FROM posts p
       INNER JOIN post_tags pt  ON pt.post_id = p.post_id AND pt.tag = ?
       INNER JOIN users u       ON p.user_id  = u.user_id
       LEFT  JOIN user_info ui  ON p.user_id  = ui.user_id
       LEFT  JOIN post_tags pt2 ON p.post_id  = pt2.post_id
       WHERE p.is_pending = FALSE
       GROUP BY p.post_id ORDER BY p.post_date DESC LIMIT ${limit} OFFSET ${offset}`,
      [tag]);
    for (const p of posts) await enrichPost(conn, p, userId);
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── GET /search — full-text search across posts ── */
router.get('/search', auth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const userId = req.user.user_id;
  const like   = `%${q}%`;
  let conn;
  try {
    conn = await db.getConnection();
    const [posts] = await conn.query(
      `SELECT p.post_id, p.user_id, p.text AS content, p.post_date, p.category,
              p.media_type, p.small_img, p.video_url AS video, p.is_anonymous,
              GROUP_CONCAT(DISTINCT pt.tag ORDER BY pt.tag) AS tags,
              u.username, COALESCE(ui.first_name,'') AS first_name,
              COALESCE(ui.last_name,'') AS last_name, COALESCE(ui.photo,'') AS photo
       FROM posts p
       INNER JOIN users u      ON p.user_id = u.user_id
       LEFT  JOIN user_info ui ON p.user_id = ui.user_id
       LEFT  JOIN post_tags pt ON p.post_id = pt.post_id
       WHERE p.is_pending = FALSE
         AND (p.text LIKE ? OR pt.tag LIKE ? OR p.category LIKE ?)
       GROUP BY p.post_id ORDER BY p.post_date DESC LIMIT 20`,
      [like, like, like]);
    for (const p of posts) await enrichPost(conn, p, userId);
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── GET /:id ── */
router.get('/:id', auth, async (req, res) => {
  const userId = req.user.user_id;
  let conn;
  try {
    conn = await db.getConnection();
    const [posts] = await conn.query(
      `${POST_SELECT} WHERE p.post_id=? GROUP BY p.post_id`, [req.params.id]);
    if (!posts.length) return res.status(404).json({ message: 'Post not found' });
    const post = await enrichPost(conn, posts[0], userId);
    const [comments] = await conn.execute(
      `SELECT c.comment_id, c.user_id, c.content, c.dated AS comment_date,
              u.username,
              COALESCE(ui.first_name,'') AS first_name,
              COALESCE(ui.last_name,'')  AS last_name
       FROM comments c
       INNER JOIN users u      ON c.user_id=u.user_id
       LEFT  JOIN user_info ui ON c.user_id=ui.user_id
       WHERE c.post_id=? ORDER BY c.dated ASC`, [req.params.id]);
    post.comments = comments;
    res.json(post);
  } catch (err) { console.error('POST DETAIL:', err.message); res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── POST / (create post) ── */
router.post('/', auth, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'images', maxCount: 5 }]), async (req, res) => {
  const { content, tags, video, category, is_anonymous } = req.body;
  const mainImage   = req.files?.image?.[0]?.buffer   || null;
  const extraImages = req.files?.images?.map(f => f.buffer) || [];

  if (!content && !mainImage && !video)
    return res.status(400).json({ message: 'Post must contain text or media' });

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO posts (user_id,text,media_type,small_img,video_url,category,is_anonymous,is_pending)
       VALUES (?,?,?,?,?,?,?,FALSE)`,
      [req.user.user_id, content || '', mainImage ? 'image' : video ? 'video' : 'none',
       mainImage, video || null, category || null, is_anonymous === 'true' ? 1 : 0]);
    const postId = result.insertId;

    // Extra images
    for (let i = 0; i < extraImages.length; i++) {
      await conn.execute('INSERT INTO post_images (post_id,image,sort_order) VALUES (?,?,?)',
        [postId, extraImages[i], i]);
    }

    // Tags
    if (tags) {
      for (const t of tags.split(',').map(s => s.trim()).filter(Boolean)) {
        await conn.execute('INSERT IGNORE INTO post_tags (post_id,tag) VALUES (?,?)', [postId, t]);
      }
    }
    await conn.commit();
    res.status(201).json({ post_id: postId });
  } catch (err) { await conn?.rollback(); console.error('CREATE POST:', err.message); res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── DELETE /:id ── */
router.delete('/:id', auth, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    const [r] = await conn.execute('DELETE FROM posts WHERE post_id=? AND user_id=?',
      [req.params.id, req.user.user_id]);
    if (!r.affectedRows) return res.status(403).json({ message: 'Not authorized' });
    res.json({ message: 'Post deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── POST /:id/approve (expert moderation) ── */
router.post('/:id/approve', auth, async (req, res) => {
  const userId = req.user.user_id;
  let conn;
  try {
    conn = await db.getConnection();
    const [[expert]] = await conn.execute('SELECT is_expert FROM user_profile WHERE user_id=?', [userId]);
    if (!expert?.is_expert) return res.status(403).json({ message: 'Expert access required' });
    await conn.execute('UPDATE posts SET is_pending=FALSE WHERE post_id=?', [req.params.id]);
    res.json({ message: 'Post approved' });
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── POST /:id/reject (expert moderation) ── */
router.delete('/:id/reject', auth, async (req, res) => {
  const userId = req.user.user_id;
  let conn;
  try {
    conn = await db.getConnection();
    const [[expert]] = await conn.execute('SELECT is_expert FROM user_profile WHERE user_id=?', [userId]);
    if (!expert?.is_expert) return res.status(403).json({ message: 'Expert access required' });
    await conn.execute('DELETE FROM posts WHERE post_id=?', [req.params.id]);
    res.json({ message: 'Post rejected' });
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── POST /:id/like ── */
router.post('/:id/like', auth, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    const [existing] = await conn.execute('SELECT 1 FROM likes WHERE user_id=? AND post_id=?',
      [req.user.user_id, req.params.id]);
    if (existing.length) {
      await conn.execute('DELETE FROM likes WHERE user_id=? AND post_id=?', [req.user.user_id, req.params.id]);
      return res.json({ liked: false });
    }
    await conn.execute('INSERT INTO likes (user_id,post_id) VALUES (?,?)', [req.user.user_id, req.params.id]);
    res.json({ liked: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── POST /:id/watchlist ── */
router.post('/:id/watchlist', auth, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    const [existing] = await conn.execute('SELECT 1 FROM user_watch WHERE user_id=? AND post_id=?',
      [req.user.user_id, req.params.id]);
    if (existing.length) {
      await conn.execute('DELETE FROM user_watch WHERE user_id=? AND post_id=?',
        [req.user.user_id, req.params.id]);
      return res.json({ saved: false });
    }
    await conn.execute('INSERT INTO user_watch (user_id,post_id) VALUES (?,?)',
      [req.user.user_id, req.params.id]);
    res.json({ saved: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

/* ── POST /:id/comment ── */
router.post('/:id/comment', auth, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: 'Comment required' });
  let conn;
  try {
    conn = await db.getConnection();
    const [r] = await conn.execute('INSERT INTO comments (user_id,post_id,content) VALUES (?,?,?)',
      [req.user.user_id, req.params.id, content]);
    res.status(201).json({ comment_id: r.insertId });
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
});

module.exports = router;