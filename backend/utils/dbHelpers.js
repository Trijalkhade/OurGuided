const db = require('../db');

// Helper for formatting binary photo buffers to base64
exports.formatPhoto = (photo, photo_url) => {
  if (photo_url) return photo_url;
  if (!photo) return null;
  if (typeof photo === 'string' && (photo.startsWith('http') || photo.startsWith('data:'))) return photo;
  try {
    return `data:image/jpeg;base64,${photo.toString('base64')}`;
  } catch (e) {
    return null;
  }
};

// Helper to process a post's images consistently
exports.processImages = (post) => {
  if (!post) return null;
  
  // Handle User Photo
  post.photo = exports.formatPhoto(post.photo, post.photo_url);
  delete post.photo_url;

  // Handle Main Post Image
  if (post.image_url) {
    post.image = post.image_url;
  } else if (post.small_img) {
    post.image = `data:image/jpeg;base64,${post.small_img.toString('base64')}`;
  } else {
    post.image = null;
  }
  delete post.small_img;
  delete post.image_url;

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

  return post;
};

// Shared SQL for fetching posts with embedded counts
// Now selects public_ids alongside internal IDs for API responses
exports.buildPostSelect = (userId) => {
  return `
    SELECT p.post_id, p.public_id AS post_public_id, p.user_id, u.public_id AS user_public_id,
           p.text AS content, p.post_date, p.category,
           p.media_type, p.small_img, p.image_url, p.video_url AS video, p.is_anonymous,
           GROUP_CONCAT(DISTINCT pt.tag ORDER BY pt.tag) AS tags,
           u.username,
           COALESCE(ui.first_name,'') AS first_name,
           COALESCE(ui.last_name,'')  AS last_name,
           COALESCE(ui.photo,'')      AS photo,
           ui.photo_url,
           (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id) AS like_count,
           (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id AND user_id = ${Number(userId)}) AS user_liked,
           (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id AND is_deleted = FALSE) AS comment_count,
           (SELECT COUNT(*) FROM user_watch WHERE post_id = p.post_id AND user_id = ${Number(userId)}) AS user_saved
    FROM posts p
    INNER JOIN users u     ON p.user_id  = u.user_id
    LEFT  JOIN user_info ui ON p.user_id = ui.user_id
    LEFT  JOIN post_tags pt ON p.post_id = pt.post_id`;
};

// ── UUID Resolvers ──────────────────────────────────────────────────────────
// Resolve a public_id (UUID) to an internal user_id (integer)
exports.resolveUserId = async (id) => {
  if (!id) return null;
  // If it's already an integer, just return it
  if (!isNaN(id) && Number.isInteger(Number(id))) return Number(id);
  const [rows] = await db.execute('SELECT user_id FROM users WHERE public_id = ?', [id]);
  return rows.length ? rows[0].user_id : null;
};

// Resolve a public_id (UUID) to an internal post_id (integer)
exports.resolvePostId = async (id) => {
  if (!id) return null;
  // If it's already an integer, just return it
  if (!isNaN(id) && Number.isInteger(Number(id))) return Number(id);
  const [rows] = await db.execute('SELECT post_id FROM posts WHERE public_id = ?', [id]);
  return rows.length ? rows[0].post_id : null;
};

// Get user's public_id from internal user_id
exports.getUserPublicId = async (userId) => {
  const [rows] = await db.execute('SELECT public_id FROM users WHERE user_id = ?', [userId]);
  return rows.length ? rows[0].public_id : null;
};

// Get post's public_id from internal post_id
exports.getPostPublicId = async (postId) => {
  const [rows] = await db.execute('SELECT public_id FROM posts WHERE post_id = ?', [postId]);
  return rows.length ? rows[0].public_id : null;
};
