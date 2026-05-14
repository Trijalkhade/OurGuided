const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { sendEmail } = require('../utils/notifier');
const { formatPhoto, resolveUserId, getUserPublicId } = require('../utils/dbHelpers');

// Check connection status with another user
router.get('/status/:userId', auth, async (req, res) => {
  const currentUserId = req.user.user_id;
  const targetUserId = await resolveUserId(req.params.userId);
  if (!targetUserId) return res.status(404).json({ message: 'User not found' });
  let conn;
  try {
    conn = await db.getConnection();

    // Check if there's any connection between the two users
    const [followsMe] = await conn.execute(
      `SELECT * FROM follows WHERE follower_id = ? AND following_id = ?`,
      [targetUserId, currentUserId]
    );
    const [iFollow] = await conn.execute(
      `SELECT * FROM follows WHERE follower_id = ? AND following_id = ?`,
      [currentUserId, targetUserId]
    );

    let status = 'none';
    if (followsMe.length > 0 && iFollow.length > 0) {
      status = 'accepted';
    } else if (iFollow.length > 0) {
      status = 'pending_sent';
    } else if (followsMe.length > 0) {
      status = 'pending_received';
    }

    const targetPublicId = req.params.userId;
    const currentPublicId = await getUserPublicId(currentUserId);

    res.json({
      status,
      connection_id: targetPublicId,
      user_id: currentPublicId,
      connected_user_id: targetPublicId
    });
  } catch (err) {
    console.error('STATUS CHECK ERROR:', err.message);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// Get all connections (mutual followers)
router.get('/my-connections', auth, async (req, res) => {
  const userId = req.user.user_id;
  let conn;
  try {
    conn = await db.getConnection();
    const [connections] = await conn.execute(
      `SELECT u.public_id AS connection_id,
              u.public_id AS connected_user_id,
              'accepted' AS status,
              u.username,
              COALESCE(ui.first_name, '') AS first_name,
              COALESCE(ui.last_name, '') AS last_name,
              COALESCE(ui.photo, '') AS photo,
              COALESCE(up.bio, '') AS bio
       FROM follows f1
       INNER JOIN follows f2 ON f1.following_id = f2.follower_id AND f1.follower_id = f2.following_id
       INNER JOIN users u ON u.user_id = f1.following_id
       LEFT JOIN user_info ui ON ui.user_id = f1.following_id
       LEFT JOIN user_profile up ON up.user_id = f1.following_id
       WHERE f1.follower_id = ?
       ORDER BY f1.follow_date DESC`,
      [userId]
    );
    for (const c of connections) { c.photo = formatPhoto(c.photo); }
    res.json(connections);
  } catch (err) {
    console.error('GET CONNECTIONS ERROR:', err.message);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// Get connection requests (followers who I don't follow back)
router.get('/requests', auth, async (req, res) => {
  const userId = req.user.user_id;
  let conn;
  try {
    conn = await db.getConnection();
    const [requests] = await conn.execute(
      `SELECT u.public_id AS connection_id, 
              u.public_id AS user_id, 
              'pending' AS status,
              u.username,
              COALESCE(ui.first_name, '') AS first_name,
              COALESCE(ui.last_name, '') AS last_name,
              COALESCE(ui.photo, '') AS photo
       FROM follows f1
       LEFT JOIN follows f2 ON f1.follower_id = f2.following_id AND f1.following_id = f2.follower_id
       INNER JOIN users u ON f1.follower_id = u.user_id
       LEFT JOIN user_info ui ON f1.follower_id = ui.user_id
       WHERE f1.following_id = ? AND f2.follower_id IS NULL
       ORDER BY f1.follow_date DESC`,
      [userId]
    );
    for (const r of requests) { r.photo = formatPhoto(r.photo); }
    res.json(requests);
  } catch (err) {
    console.error('GET REQUESTS ERROR:', err.message);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// Send connection request (follow)
router.post('/request/:userId', auth, async (req, res) => {
  const fromUserId = req.user.user_id;
  const toUserId = await resolveUserId(req.params.userId);
  if (!toUserId) return res.status(404).json({ message: 'User not found' });

  if (fromUserId == toUserId) {
    return res.status(400).json({ message: 'Cannot connect with yourself' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // Check if request already exists
    const [existing] = await conn.execute(
      'SELECT * FROM follows WHERE follower_id = ? AND following_id = ?',
      [fromUserId, toUserId]
    );

    if (existing.length > 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Request already sent' });
    }

    await conn.execute(
      'INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)',
      [fromUserId, toUserId]
    );

    await conn.commit();

    // Send Email Notification (fire-and-forget, outside transaction)
    try {
      const [recipients] = await db.execute(
        `SELECT u.email, ui.first_name, up.notify_email 
         FROM users u
         LEFT JOIN user_info ui ON u.user_id = ui.user_id
         LEFT JOIN user_profile up ON u.user_id = up.user_id
         WHERE u.user_id = ?`,
        [toUserId]
      );
      const [senders] = await db.execute(
        `SELECT u.username, ui.first_name 
         FROM users u 
         LEFT JOIN user_info ui ON u.user_id = ui.user_id 
         WHERE u.user_id = ?`,
        [fromUserId]
      );
      if (recipients.length > 0 && senders.length > 0) {
        const recipient = recipients[0];
        const sender = senders[0];
        const senderName = sender.first_name || sender.username;
        if (recipient.notify_email !== 0) {
          sendEmail(
            recipient.email,
            `OurGuided: ${senderName} sent you a connection request!`,
            `${senderName} wants to connect with you on OurGuided. Head over to your connections to accept or view their profile.`
          );
        }
      }
    } catch (notificationError) {
      console.error('Failed to send connection email:', notificationError.message);
    }

    res.status(201).json({ message: 'Connection request sent' });
  } catch (err) {
    await conn?.rollback();
    console.error('REQUEST ERROR:', err.message);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// Accept connection request (follow back)
router.post('/accept/:connectionId', auth, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    const currentUserId = req.user.user_id;
    const targetUserId = await resolveUserId(req.params.connectionId);
    if (!targetUserId) return res.status(404).json({ message: 'User not found' });

    // Follow them back
    await conn.execute(
      'INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)',
      [currentUserId, targetUserId]
    );

    const targetPublicId = req.params.connectionId;
    const currentPublicId = await getUserPublicId(currentUserId);
    const returnedConnection = { connection_id: targetPublicId, user_id: targetPublicId, connected_user_id: currentPublicId };

    // Fetch the other user's public info (the requester) to return to the frontend
    const [userRows] = await conn.execute(
      `SELECT u.public_id AS user_id, u.username, COALESCE(ui.first_name, '') AS first_name,
              COALESCE(ui.last_name, '') AS last_name, COALESCE(ui.photo, '') AS photo,
              COALESCE(up.bio, '') AS bio
       FROM users u
       LEFT JOIN user_info ui ON ui.user_id = u.user_id
       LEFT JOIN user_profile up ON up.user_id = u.user_id
       WHERE u.user_id = ? LIMIT 1`,
      [targetUserId]
    );

    const userInfo = userRows[0] || null;
    if (userInfo) userInfo.photo = formatPhoto(userInfo.photo);

    res.json({ message: 'Connection accepted', connection: returnedConnection, user: userInfo });
  } catch (err) {
    console.error('ACCEPT ERROR:', err.message);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// Reject connection request (remove their follow)
router.delete('/reject/:connectionId', auth, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    const currentUserId = req.user.user_id;
    const targetUserId = await resolveUserId(req.params.connectionId);
    if (!targetUserId) return res.status(404).json({ message: 'User not found' });
    await conn.execute(
      'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
      [targetUserId, currentUserId]
    );
    res.json({ message: 'Connection request rejected' });
  } catch (err) {
    console.error('REJECT ERROR:', err.message);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// Remove connection (unfollow both logically)
router.delete('/remove/:userId', auth, async (req, res) => {
  const userId = req.user.user_id;
  const targetUserId = await resolveUserId(req.params.userId);
  if (!targetUserId) return res.status(404).json({ message: 'User not found' });
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    await conn.execute(
      'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
      [userId, targetUserId]
    );
    await conn.execute(
      'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
      [targetUserId, userId]
    );
    await conn.commit();
    res.json({ message: 'Connection removed' });
  } catch (err) {
    await conn?.rollback();
    console.error('REMOVE ERROR:', err.message);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;