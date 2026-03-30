const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../middleware/auth');

/* GET /settings */
router.get('/settings', auth, async (req, res) => {
  try {
    const [[row]] = await db.execute(
      `SELECT notify_email, notify_whatsapp, notify_new_skills, notify_quizzes,
              notify_streaks, is_private, is_expert, whatsapp_number
       FROM user_profile WHERE user_id=?`, [req.user.user_id]);
    res.json(row || {});
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* PUT /settings */
router.put('/settings', auth, async (req, res) => {
  const { notify_email, notify_whatsapp, notify_new_skills,
          notify_quizzes, notify_streaks, is_private, whatsapp_number } = req.body;
  try {
    await db.execute(
      `UPDATE user_profile SET
         notify_email=COALESCE(?,notify_email), notify_whatsapp=COALESCE(?,notify_whatsapp),
         notify_new_skills=COALESCE(?,notify_new_skills), notify_quizzes=COALESCE(?,notify_quizzes),
         notify_streaks=COALESCE(?,notify_streaks), is_private=COALESCE(?,is_private),
         whatsapp_number=COALESCE(?,whatsapp_number)
       WHERE user_id=?`,
      [notify_email??null, notify_whatsapp??null, notify_new_skills??null,
       notify_quizzes??null, notify_streaks??null, is_private??null,
       whatsapp_number??null, req.user.user_id]);
    res.json({ message: 'Settings updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* GET / — paginated inbox */
router.get('/', auth, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 15;
  const offset = (page - 1) * limit;
  try {
    const [rows] = await db.execute(
      `SELECT notification_id, type, title, message, is_read, created_at
       FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      [req.user.user_id]);
    const [[{ total }]] = await db.execute(
      'SELECT COUNT(*) AS total FROM notifications WHERE user_id=?', [req.user.user_id]);
    res.json({ notifications: rows, total, page, has_more: (offset + rows.length) < total });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* GET /unread-count */
router.get('/unread-count', auth, async (req, res) => {
  try {
    const [[{ cnt }]] = await db.execute(
      'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id=? AND is_read=FALSE',
      [req.user.user_id]);
    res.json({ count: cnt });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* POST /mark-read */
router.post('/mark-read', auth, async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read=TRUE WHERE user_id=?', [req.user.user_id]);
    res.json({ message: 'All marked as read' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* DELETE /:id — delete single notification */
router.delete('/:id', auth, async (req, res) => {
  try {
    const [r] = await db.execute(
      'DELETE FROM notifications WHERE notification_id=? AND user_id=?',
      [req.params.id, req.user.user_id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

async function createNotification(userId, type, title, message) {
  try {
    await db.execute('INSERT INTO notifications (user_id,type,title,message) VALUES (?,?,?,?)',
      [userId, type, title, message || null]);
  } catch (err) { console.error('Notification error:', err.message); }
}
module.exports = router;
module.exports.createNotification = createNotification;