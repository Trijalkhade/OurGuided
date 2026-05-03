const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../middleware/auth');
const { processImages } = require('../utils/dbHelpers');

/* GET / — my playlists */
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT pl.playlist_id, pl.title, pl.description, pl.is_public, pl.created_at,
              (SELECT COUNT(*) FROM playlist_items WHERE playlist_id=pl.playlist_id) AS item_count
       FROM playlists pl WHERE pl.user_id=? ORDER BY pl.created_at DESC`,
      [req.user.user_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* GET /public/:userId — public playlists of a user */
router.get('/public/:userId', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT pl.playlist_id, pl.title, pl.description, pl.created_at,
              (SELECT COUNT(*) FROM playlist_items WHERE playlist_id=pl.playlist_id) AS item_count
       FROM playlists pl WHERE pl.user_id=? AND pl.is_public=TRUE ORDER BY pl.created_at DESC`,
      [req.params.userId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* GET /:id — playlist with posts */
router.get('/:id', auth, async (req, res) => {
  try {
    const [[playlist]] = await db.execute(
      'SELECT * FROM playlists WHERE playlist_id=?', [req.params.id]);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
    if (!playlist.is_public && playlist.user_id !== req.user.user_id)
      return res.status(403).json({ message: 'Private playlist' });

    const [items] = await db.execute(
      `SELECT p.post_id, p.text AS content, p.post_date, p.category,
              p.media_type, p.small_img, p.video_url AS video, p.is_anonymous,
              u.username, COALESCE(ui.first_name,'') AS first_name,
              COALESCE(ui.last_name,'') AS last_name,
              pi2.sort_order, pi2.added_at
       FROM playlist_items pi2
       JOIN posts p ON pi2.post_id=p.post_id
       JOIN users u ON p.user_id=u.user_id
       LEFT JOIN user_info ui ON p.user_id=ui.user_id
       WHERE pi2.playlist_id=? ORDER BY pi2.sort_order, pi2.added_at`,
      [req.params.id]);

    items.forEach(p => {
      processImages(p);
    });

    res.json({ ...playlist, items });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* POST / — create playlist */
router.post('/', auth, async (req, res) => {
  const { title, description, is_public } = req.body;
  if (!title) return res.status(400).json({ message: 'Title required' });
  try {
    const [r] = await db.execute(
      'INSERT INTO playlists (user_id,title,description,is_public) VALUES (?,?,?,?)',
      [req.user.user_id, title, description || null, is_public !== false ? 1 : 0]);
    res.status(201).json({ playlist_id: r.insertId, title });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* POST /:id/add — add post to playlist */
router.post('/:id/add', auth, async (req, res) => {
  const { post_id } = req.body;
  if (!post_id) return res.status(400).json({ message: 'post_id required' });
  try {
    const [[pl]] = await db.execute('SELECT user_id FROM playlists WHERE playlist_id=?', [req.params.id]);
    if (!pl || pl.user_id !== req.user.user_id)
      return res.status(403).json({ message: 'Not your playlist' });
    await db.execute('INSERT IGNORE INTO playlist_items (playlist_id,post_id) VALUES (?,?)',
      [req.params.id, post_id]);
    res.json({ message: 'Added' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* DELETE /:id/remove/:postId — remove post from playlist */
router.delete('/:id/remove/:postId', auth, async (req, res) => {
  try {
    const [[pl]] = await db.execute('SELECT user_id FROM playlists WHERE playlist_id=?', [req.params.id]);
    if (!pl || pl.user_id !== req.user.user_id)
      return res.status(403).json({ message: 'Not your playlist' });
    await db.execute('DELETE FROM playlist_items WHERE playlist_id=? AND post_id=?',
      [req.params.id, req.params.postId]);
    res.json({ message: 'Removed' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* DELETE /:id — delete playlist */
router.delete('/:id', auth, async (req, res) => {
  try {
    const [r] = await db.execute('DELETE FROM playlists WHERE playlist_id=? AND user_id=?',
      [req.params.id, req.user.user_id]);
    if (!r.affectedRows) return res.status(403).json({ message: 'Not authorized' });
    res.json({ message: 'Playlist deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;