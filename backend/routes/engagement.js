const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../middleware/auth');
const { resolvePostId, resolveUserId } = require('../utils/dbHelpers');

/* ══════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════ */

/** Detect device type from User-Agent header */
function detectDeviceType(ua) {
  if (!ua) return 'desktop';
  ua = ua.toLowerCase();
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  if (/ipad|tablet|playbook|silk/i.test(ua)) return 'tablet';
  return 'desktop';
}

/** Derive time-of-day bucket from hour (0–23) */
function getTimeBucket(hour) {
  if (hour >= 5 && hour < 12)  return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/* ══════════════════════════════════════════════════════════════════
   POST /api/engagement/batch
   Accepts arrays of passive engagement events in one call.
   Body: {
     impressions:      [{ postId, clientHour }],
     watchTimes:       [{ postId, seconds }],
     scrollDepths:     [{ postId, depthPct }],
     videoCompletions: [{ postId, completionPct }]
   }
══════════════════════════════════════════════════════════════════ */
router.post('/batch', auth, async (req, res) => {
  const userId = req.user.user_id;
  const { impressions, watchTimes, scrollDepths, videoCompletions } = req.body;
  const deviceType = detectDeviceType(req.headers['user-agent']);

  // Defense in depth: cap batch sizes to prevent write amplification attacks
  const MAX_PER_ARRAY = 50;
  const MAX_TOTAL = 200;
  const arrays = [impressions, watchTimes, scrollDepths, videoCompletions].filter(Array.isArray);
  const totalItems = arrays.reduce((sum, arr) => sum + arr.length, 0);
  if (totalItems > MAX_TOTAL || arrays.some(arr => arr.length > MAX_PER_ARRAY)) {
    return res.status(400).json({ message: `Batch too large. Max ${MAX_PER_ARRAY} items per type, ${MAX_TOTAL} total.` });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // ── Impressions (UPSERT — keep first impression, don't overwrite) ──
    if (Array.isArray(impressions) && impressions.length > 0) {
      for (const imp of impressions) {
        const postId = await resolvePostId(imp.postId);
        if (!postId) continue;
        const timeBucket = getTimeBucket(Number(imp.clientHour) || 0);
        await conn.execute(
          `INSERT INTO post_impressions (user_id, post_id, device_type, time_bucket)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE impression_at = impression_at`,
          [userId, postId, deviceType, timeBucket]
        );
      }
    }

    // ── Watch Times (UPSERT — always take the MAX seconds) ──
    if (Array.isArray(watchTimes) && watchTimes.length > 0) {
      for (const wt of watchTimes) {
        const postId = await resolvePostId(wt.postId);
        if (!postId) continue;
        const seconds = Math.max(0, Math.round(Number(wt.seconds) || 0));
        if (seconds <= 0) continue;
        await conn.execute(
          `INSERT INTO post_watch_time (user_id, post_id, seconds)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE seconds = GREATEST(seconds, VALUES(seconds))`,
          [userId, postId, seconds]
        );
      }
    }

    // ── Scroll Depths (UPSERT — always take the MAX depth) ──
    if (Array.isArray(scrollDepths) && scrollDepths.length > 0) {
      for (const sd of scrollDepths) {
        const postId = await resolvePostId(sd.postId);
        if (!postId) continue;
        const depthPct = Math.min(100, Math.max(0, Math.round(Number(sd.depthPct) || 0)));
        if (depthPct <= 0) continue;
        await conn.execute(
          `INSERT INTO post_scroll_depth (user_id, post_id, depth_pct)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE depth_pct = GREATEST(depth_pct, VALUES(depth_pct))`,
          [userId, postId, depthPct]
        );
      }
    }

    // ── Video Completions (UPSERT — always take the MAX %) ──
    if (Array.isArray(videoCompletions) && videoCompletions.length > 0) {
      for (const vc of videoCompletions) {
        const postId = await resolvePostId(vc.postId);
        if (!postId) continue;
        const completionPct = Math.min(100, Math.max(0, Math.round(Number(vc.completionPct) || 0)));
        if (completionPct <= 0) continue;
        await conn.execute(
          `INSERT INTO post_video_completion (user_id, post_id, completion_pct)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE completion_pct = GREATEST(completion_pct, VALUES(completion_pct))`,
          [userId, postId, completionPct]
        );
      }
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn?.rollback();
    console.error('ENGAGEMENT BATCH ERROR:', err.message);
    res.status(500).json({ message: 'Failed to record engagement' });
  } finally {
    if (conn) conn.release();
  }
});

/* ══════════════════════════════════════════════════════════════════
   POST /api/engagement/share
   Body: { postId, method? }
   method: 'copy_link' | 'web_share' | 'other'
══════════════════════════════════════════════════════════════════ */
router.post('/share', auth, async (req, res) => {
  const userId = req.user.user_id;
  const { postId: rawPostId, method } = req.body;
  if (!rawPostId) return res.status(400).json({ message: 'postId required' });

  const postId = await resolvePostId(rawPostId);
  if (!postId) return res.status(404).json({ message: 'Post not found' });

  const validMethods = ['copy_link', 'web_share', 'other'];
  const shareMethod = validMethods.includes(method) ? method : 'copy_link';

  try {
    await db.execute(
      `INSERT INTO post_shares (user_id, post_id, method) VALUES (?, ?, ?)`,
      [userId, postId, shareMethod]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('SHARE EVENT ERROR:', err.message);
    res.status(500).json({ message: 'Failed to record share' });
  }
});

/* ══════════════════════════════════════════════════════════════════
   POST /api/engagement/profile-click
   Body: { postId, authorId }
══════════════════════════════════════════════════════════════════ */
router.post('/profile-click', auth, async (req, res) => {
  const userId = req.user.user_id;
  const { postId: rawPostId, authorId: rawAuthorId } = req.body;
  if (!rawPostId || !rawAuthorId) return res.status(400).json({ message: 'postId and authorId required' });

  const postId   = await resolvePostId(rawPostId);
  const authorId = await resolveUserId(rawAuthorId);
  if (!postId)   return res.status(404).json({ message: 'Post not found' });
  if (!authorId) return res.status(404).json({ message: 'Author not found' });

  try {
    await db.execute(
      `INSERT INTO post_profile_clicks (user_id, post_id, author_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE clicked_at = CURRENT_TIMESTAMP`,
      [userId, postId, authorId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PROFILE CLICK ERROR:', err.message);
    res.status(500).json({ message: 'Failed to record profile click' });
  }
});

/* ══════════════════════════════════════════════════════════════════
   POST /api/engagement/report
   Body: { postId, reason? }
   reason: 'spam' | 'offensive' | 'misleading' | 'not_interested' | 'other'
══════════════════════════════════════════════════════════════════ */
router.post('/report', auth, async (req, res) => {
  const userId = req.user.user_id;
  const { postId: rawPostId, reason } = req.body;
  if (!rawPostId) return res.status(400).json({ message: 'postId required' });

  const postId = await resolvePostId(rawPostId);
  if (!postId) return res.status(404).json({ message: 'Post not found' });

  const validReasons = ['spam', 'offensive', 'misleading', 'not_interested', 'other'];
  const reportReason = validReasons.includes(reason) ? reason : 'not_interested';

  try {
    await db.execute(
      `INSERT INTO post_reports (user_id, post_id, reason, is_hidden)
       VALUES (?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), is_hidden = TRUE, reported_at = CURRENT_TIMESTAMP`,
      [userId, postId, reportReason]
    );
    res.json({ ok: true, hidden: true });
  } catch (err) {
    console.error('REPORT EVENT ERROR:', err.message);
    res.status(500).json({ message: 'Failed to report post' });
  }
});

/* ══════════════════════════════════════════════════════════════════
   POST /api/engagement/repeat-view
   Body: { postId }
══════════════════════════════════════════════════════════════════ */
router.post('/repeat-view', auth, async (req, res) => {
  const userId = req.user.user_id;
  const { postId: rawPostId } = req.body;
  if (!rawPostId) return res.status(400).json({ message: 'postId required' });

  const postId = await resolvePostId(rawPostId);
  if (!postId) return res.status(404).json({ message: 'Post not found' });

  try {
    await db.execute(
      `INSERT INTO post_repeat_views (user_id, post_id, view_count)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE view_count = view_count + 1, last_view = CURRENT_TIMESTAMP`,
      [userId, postId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('REPEAT VIEW ERROR:', err.message);
    res.status(500).json({ message: 'Failed to record repeat view' });
  }
});

/* ══════════════════════════════════════════════════════════════════
   GET /api/engagement/comment-length/:userId
   Returns avg comment length per category for a given user.
   Used internally by the recommendation engine.
══════════════════════════════════════════════════════════════════ */
router.get('/comment-length/:userId', auth, async (req, res) => {
  const targetUserId = await resolveUserId(req.params.userId);
  if (!targetUserId) return res.status(404).json({ message: 'User not found' });

  try {
    const [rows] = await db.execute(
      `SELECT p.category,
              AVG(CHAR_LENGTH(c.content)) AS avg_length,
              COUNT(*) AS comment_count
       FROM comments c
       JOIN posts p ON c.post_id = p.post_id
       WHERE c.user_id = ? AND c.is_deleted = FALSE AND p.category IS NOT NULL
       GROUP BY p.category`,
      [targetUserId]
    );
    res.json(rows);
  } catch (err) {
    console.error('COMMENT LENGTH ERROR:', err.message);
    res.status(500).json({ message: 'Failed to get comment length data' });
  }
});

/* ══════════════════════════════════════════════════════════════════
   GET /api/engagement/hidden-posts
   Returns list of post_ids hidden by the current user.
   Used by frontend to filter feed client-side.
══════════════════════════════════════════════════════════════════ */
router.get('/hidden-posts', auth, async (req, res) => {
  const userId = req.user.user_id;
  try {
    const [rows] = await db.execute(
      `SELECT p.public_id AS post_id
       FROM post_reports r
       JOIN posts p ON r.post_id = p.post_id
       WHERE r.user_id = ? AND r.is_hidden = TRUE`,
      [userId]
    );
    res.json(rows.map(r => r.post_id));
  } catch (err) {
    console.error('HIDDEN POSTS ERROR:', err.message);
    res.status(500).json({ message: 'Failed to get hidden posts' });
  }
});

module.exports = router;
