const db = require('../db');

// Helper for formatting photo urls
exports.formatPhoto = (photo_url) => {
  if (photo_url) return photo_url;
  return null;
};

// Helper to process a post's images consistently
exports.processImages = (post) => {
  if (!post) return null;
  
  // Handle User Photo
  post.photo = post.photo_url || null;
  delete post.photo_url;

  // Handle Main Post Image
  post.image = post.image_url || null;
  delete post.image_url;

  // Handle Thumbnail (feed-optimized version)
  post.thumbnail = post.thumbnail_url || null;
  delete post.thumbnail_url;

  post.user_saved = (post.user_saved || 0) > 0;
  post.extra_images = post.extra_images || [];

  // Replace internal PKs with public_ids in API output
  if (post.user_public_id) {
    post.user_id = post.user_public_id;
    delete post.user_public_id;
  }
  if (post.post_public_id) {
    post.post_id = post.post_public_id;
    delete post.post_public_id;
  }

  // Strip author info for anonymous posts
  if (post.is_anonymous) {
    post.username = 'Anonymous';
    post.first_name = '';
    post.last_name = '';
    post.photo = null;
  }

  return post;
};

// Shared SQL for fetching posts with embedded counts
// Returns { sql, params } — callers MUST pass params to conn.execute()
// Includes LEFT JOIN on post_reports so callers can filter hidden posts
// with: AND pr_hide.report_id IS NULL
exports.buildPostSelect = (userId) => {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Invalid userId for buildPostSelect');
  }
  return {
    sql: `
    SELECT p.post_id, p.public_id AS post_public_id, p.user_id, u.public_id AS user_public_id,
           p.text AS content, p.post_date, p.category,
           p.media_type, p.image_url, p.thumbnail_url, p.video_url AS video, p.is_anonymous,
           GROUP_CONCAT(DISTINCT pt.tag ORDER BY pt.tag) AS tags,
           u.username,
           COALESCE(ui.first_name,'') AS first_name,
           COALESCE(ui.last_name,'')  AS last_name,
           ui.photo_url,
           p.like_count,
           (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id AND user_id = ?) AS user_liked,
           p.comment_count,
           (SELECT COUNT(*) FROM user_watch WHERE post_id = p.post_id AND user_id = ?) AS user_saved,
           COALESCE(up.is_private, 0) AS is_private
    FROM posts p
    INNER JOIN users u     ON p.user_id  = u.user_id
    LEFT  JOIN user_info ui ON p.user_id = ui.user_id
    LEFT  JOIN user_profile up ON p.user_id = up.user_id
    LEFT  JOIN post_tags pt ON p.post_id = pt.post_id
    LEFT  JOIN post_reports pr_hide ON pr_hide.post_id = p.post_id AND pr_hide.user_id = ? AND pr_hide.is_hidden = TRUE`,
    params: [id, id, id],
  };
};

// ── UUID Resolvers ──────────────────────────────────────────────────────────
const { LRUCache } = require('lru-cache');
const uuidCache = new LRUCache({ max: 10000, ttl: 5 * 60 * 1000 }); // 5 minutes TTL

// Resolve a public_id (UUID) to an internal user_id (integer)
exports.resolveUserId = async (id) => {
  if (!id) return null;
  const cacheKey = `user_id_by_pub:${id}`;
  if (uuidCache.has(cacheKey)) return uuidCache.get(cacheKey);

  const [rows] = await db.execute('SELECT user_id FROM users WHERE public_id = ?', [id]);
  const val = rows.length ? rows[0].user_id : null;
  if (val) uuidCache.set(cacheKey, val);
  return val;
};

// Resolve a public_id (UUID) to an internal post_id (integer)
exports.resolvePostId = async (id) => {
  if (!id) return null;
  const cacheKey = `post_id_by_pub:${id}`;
  if (uuidCache.has(cacheKey)) return uuidCache.get(cacheKey);

  const [rows] = await db.execute('SELECT post_id FROM posts WHERE public_id = ?', [id]);
  const val = rows.length ? rows[0].post_id : null;
  if (val) uuidCache.set(cacheKey, val);
  return val;
};

// Get user's public_id from internal user_id
exports.getUserPublicId = async (userId) => {
  if (!userId) return null;
  const cacheKey = `user_pub_by_id:${userId}`;
  if (uuidCache.has(cacheKey)) return uuidCache.get(cacheKey);

  const [rows] = await db.execute('SELECT public_id FROM users WHERE user_id = ?', [userId]);
  const val = rows.length ? rows[0].public_id : null;
  if (val) uuidCache.set(cacheKey, val);
  return val;
};

// Get post's public_id from internal post_id
exports.getPostPublicId = async (postId) => {
  if (!postId) return null;
  const cacheKey = `post_pub_by_id:${postId}`;
  if (uuidCache.has(cacheKey)) return uuidCache.get(cacheKey);

  const [rows] = await db.execute('SELECT public_id FROM posts WHERE post_id = ?', [postId]);
  const val = rows.length ? rows[0].public_id : null;
  if (val) uuidCache.set(cacheKey, val);
  return val;
};
