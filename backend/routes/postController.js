const db = require('../db');
const { createNotification } = require('../routes/notifications');
const moderationService = require('../utils/moderationService');
const { processImages, buildPostSelect, formatPhoto, resolvePostId, resolveUserId, getPostPublicId, getUserPublicId } = require('../utils/dbHelpers');
const { uploadToS3 } = require('../utils/s3');

/* ── Helpers ── */

// Batch-fetch extra images for a list of posts — 1 query total instead of N
async function batchExtraImages(conn, posts) {
  if (!posts.length) return;
  const ids = posts.map(p => p.post_id);
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await conn.execute(
    `SELECT post_id, image, image_url FROM post_images WHERE post_id IN (${placeholders}) ORDER BY post_id, sort_order`,
    ids
  );
  const map = {};
  for (const r of rows) {
    if (!map[r.post_id]) map[r.post_id] = [];
    if (r.image_url) {
        map[r.post_id].push(r.image_url);
    } else if (r.image) {
        map[r.post_id].push(`data:image/jpeg;base64,${r.image.toString('base64')}`);
    }
  }
  for (const p of posts) {
    p.extra_images = map[p.post_id] || [];
  }
}

/* ── Controller Methods ── */

exports.getFeed = async (req, res) => {
  const page   = parseInt(req.query.page) || 1;
  const cat    = req.query.category       || null;
  const limit  = 10;
  const offset = (page - 1) * limit;
  const userId = req.user.user_id;
  let conn;
  try {
    conn = await db.getConnection();
    let where = 'WHERE p.is_deleted = FALSE AND p.is_pending = FALSE';
    const params = [];
    if (cat) { where += ' AND p.category = ?'; params.push(cat); }

    const [posts] = await conn.query(
      `${buildPostSelect(userId)} ${where}
       GROUP BY p.post_id ORDER BY p.post_date DESC LIMIT ${limit} OFFSET ${offset}`, params);

    await batchExtraImages(conn, posts);
    posts.forEach(processImages);
    res.json(posts);
  } catch (err) { console.error('FEED ERROR:', err.message); res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
};

exports.getUserPosts = async (req, res) => {
  const userId    = req.user.user_id;
  const profileId = await resolveUserId(req.params.id);
  if (!profileId) return res.status(404).json({ message: 'User not found' });
  let conn;
  try {
    conn = await db.getConnection();
    const [posts] = await conn.query(
      `${buildPostSelect(userId)}
       WHERE p.user_id = ? AND p.is_deleted = FALSE AND p.is_pending = FALSE
       GROUP BY p.post_id ORDER BY p.post_date DESC LIMIT 50`, [profileId]);

    await batchExtraImages(conn, posts);
    posts.forEach(processImages);
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
};

exports.getWatchlist = async (req, res) => {
  const userId = req.user.user_id;
  let conn;
  try {
    conn = await db.getConnection();
    const [posts] = await conn.query(
      `${buildPostSelect(userId)}
       INNER JOIN user_watch uw ON uw.post_id = p.post_id AND uw.user_id = ?
       WHERE p.is_deleted = FALSE
       GROUP BY p.post_id ORDER BY uw.watch_date DESC LIMIT 50`, [userId]);

    await batchExtraImages(conn, posts);
    posts.forEach(processImages);
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
};

exports.getPendingPosts = async (req, res) => {
  const userId = req.user.user_id;
  let conn;
  try {
    conn = await db.getConnection();
    const [[expert]] = await conn.execute(
      'SELECT is_expert FROM user_profile WHERE user_id=?', [userId]);
    if (!expert?.is_expert)
      return res.status(403).json({ message: 'Expert access required' });

    const [posts] = await conn.query(
      `${buildPostSelect(userId)} WHERE p.is_deleted = FALSE AND p.is_pending = TRUE
       GROUP BY p.post_id ORDER BY p.post_date DESC`);

    await batchExtraImages(conn, posts);
    posts.forEach(processImages);
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
};

exports.getPostsByTag = async (req, res) => {
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
              COALESCE(ui.last_name,'') AS last_name, COALESCE(ui.photo,'') AS photo,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id) AS like_count,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id AND user_id = ?) AS user_liked,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id AND is_deleted = FALSE) AS comment_count,
              (SELECT COUNT(*) FROM user_watch WHERE post_id = p.post_id AND user_id = ?) AS user_saved
       FROM posts p
       INNER JOIN post_tags pt  ON pt.post_id = p.post_id AND pt.tag = ?
       INNER JOIN users u       ON p.user_id  = u.user_id
       LEFT  JOIN user_info ui  ON p.user_id  = ui.user_id
       LEFT  JOIN post_tags pt2 ON p.post_id  = pt2.post_id
       WHERE p.is_pending = FALSE AND p.is_deleted = FALSE
       GROUP BY p.post_id ORDER BY p.post_date DESC LIMIT ${limit} OFFSET ${offset}`,
      [userId, userId, tag]);

    await batchExtraImages(conn, posts);
    posts.forEach(processImages);
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
};

exports.searchPosts = async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const userId = req.user.user_id;
  const like   = `%${q}%`;
  let conn;
  try {
    conn = await db.getConnection();
    const [posts] = await conn.query(
      `${buildPostSelect(userId)}
       WHERE p.is_pending = FALSE AND p.is_deleted = FALSE
         AND (p.text LIKE ? OR pt.tag LIKE ? OR p.category LIKE ?)
       GROUP BY p.post_id ORDER BY p.post_date DESC LIMIT 20`,
      [like, like, like]);

    await batchExtraImages(conn, posts);
    posts.forEach(processImages);
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
};

exports.getPostDetail = async (req, res) => {
  const userId = req.user.user_id;
  const postId = await resolvePostId(req.params.id);
  if (!postId) return res.status(404).json({ message: 'Post not found' });
  let conn;
  try {
    conn = await db.getConnection();
    const [posts] = await conn.query(
      `${buildPostSelect(userId)} WHERE p.post_id=? AND p.is_deleted = FALSE GROUP BY p.post_id`, [postId]);
    if (!posts.length) return res.status(404).json({ message: 'Post not found' });

    await batchExtraImages(conn, posts);
    const post = processImages(posts[0]);

    const [comments] = await conn.execute(
      `SELECT c.comment_id, c.user_id, u.public_id AS user_public_id, c.content, c.dated AS comment_date,
              u.username,
              COALESCE(ui.first_name,'') AS first_name,
              COALESCE(ui.last_name,'')  AS last_name
       FROM comments c
       INNER JOIN users u      ON c.user_id=u.user_id
       LEFT  JOIN user_info ui ON c.user_id=ui.user_id
       WHERE c.post_id=? AND c.is_deleted = FALSE ORDER BY c.dated ASC`, [postId]);
    // Replace internal user_id with public_id in comments
    for (const c of comments) {
      c.user_id = c.user_public_id;
      delete c.user_public_id;
    }
    post.comments = comments;
    res.json(post);
  } catch (err) { console.error('POST DETAIL:', err.message); res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
};

exports.createPost = async (req, res) => {
  const { content, tags, video, category, is_anonymous } = req.body;
  const mainImage   = req.files?.image?.[0]?.buffer   || null;
  const extraImages = req.files?.images?.map(f => f.buffer) || [];

  const { isBufferSafeImage } = require('../utils/security');
  if (mainImage && !isBufferSafeImage(mainImage))
    return res.status(400).json({ message: 'Invalid main image format detected' });
  
  for (const img of extraImages) {
    if (!isBufferSafeImage(img))
      return res.status(400).json({ message: 'One or more extra images have an invalid format' });
  }

  if (!content && !mainImage && !video)
    return res.status(400).json({ message: 'Post must contain text or media' });

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // 1. Upload Main Image to S3
    let s3ImageUrl = null;
    if (mainImage) {
      s3ImageUrl = await uploadToS3(mainImage, req.files.image[0].mimetype, 'posts');
    }

    const [result] = await conn.execute(
      `INSERT INTO posts (user_id,text,media_type,image_url,video_url,category,is_anonymous,is_pending)
       VALUES (?,?,?,?,?,?,?,FALSE)`,
      [req.user.user_id, content || '', mainImage ? 'image' : video ? 'video' : 'none',
       s3ImageUrl, video || null, category || null, is_anonymous === 'true' ? 1 : 0]);
    const postId = result.insertId;

    // 2. Upload Extra Images to S3
    for (let i = 0; i < extraImages.length; i++) {
      const extraUrl = await uploadToS3(extraImages[i], req.files.images[i].mimetype, 'posts/extra');
      await conn.execute('INSERT INTO post_images (post_id,image_url,sort_order) VALUES (?,?,?)',
        [postId, extraUrl, i]);
    }

    if (tags) {
      for (const t of tags.split(',').map(s => s.trim()).filter(Boolean)) {
        await conn.execute('INSERT IGNORE INTO post_tags (post_id,tag) VALUES (?,?)', [postId, t]);
      }
    }
    await conn.commit();

    // Fire-and-forget: follower notifications
    (async () => {
      try {
        const [followers] = await db.execute(
          `SELECT f.follower_id
           FROM follows f
           JOIN user_profile u ON f.follower_id = u.user_id
           WHERE f.following_id=? AND u.notify_new_skills=TRUE`,
          [req.user.user_id]);
        const chunkSize = 50;
        for (let i = 0; i < followers.length; i += chunkSize) {
          const chunk = followers.slice(i, i + chunkSize);
          await Promise.all(chunk.map(f =>
            createNotification(f.follower_id, 'new_skill', 'New Post Available', 'Someone you follow posted new content')
          ));
        }
      } catch (e) { console.error('Post notification failed:', e); }
    })();

    // Background moderation
    if (content) {
      moderationService.queueForDetection({
        type: 'post', id: postId, userId: req.user.user_id, content
      }).catch(e => console.error('Moderation queue failed:', e));
    }

    res.status(201).json({ post_id: await getPostPublicId(postId) });
  } catch (err) { await conn?.rollback(); console.error('CREATE POST:', err.message); res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
};

exports.deletePost = async (req, res) => {
  const postId = await resolvePostId(req.params.id);
  if (!postId) return res.status(404).json({ message: 'Post not found' });
  let conn;
  try {
    conn = await db.getConnection();
    const [r] = await conn.execute('DELETE FROM posts WHERE post_id=? AND user_id=?',
      [postId, req.user.user_id]);
    if (!r.affectedRows) return res.status(403).json({ message: 'Not authorized' });
    res.json({ message: 'Post deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
};

exports.approvePost = async (req, res) => {
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
};

exports.rejectPost = async (req, res) => {
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
};

exports.likePost = async (req, res) => {
  const postId = await resolvePostId(req.params.id);
  if (!postId) return res.status(404).json({ message: 'Post not found' });
  let conn;
  try {
    conn = await db.getConnection();
    const [existing] = await conn.execute('SELECT 1 FROM likes WHERE user_id=? AND post_id=?',
      [req.user.user_id, postId]);
    if (existing.length) {
      await conn.execute('DELETE FROM likes WHERE user_id=? AND post_id=?', [req.user.user_id, postId]);
      return res.json({ liked: false });
    }
    await conn.execute('INSERT INTO likes (user_id,post_id) VALUES (?,?)', [req.user.user_id, postId]);

    // Fire-and-forget notification
    (async () => {
      try {
        const [[post]] = await db.execute('SELECT user_id, text FROM posts WHERE post_id=?', [postId]);
        if (post.user_id !== req.user.user_id) {
          const snippet = (post.text || '').substring(0, 50) + (post.text.length > 50 ? '...' : '');
          await createNotification(
            post.user_id, 'connection', 'New Like!',
            `<strong>${req.user.name || 'Someone'}</strong> liked your post:<br><em>"${snippet}"</em>`
          );
        }
      } catch (e) { console.error('Like notification failed:', e); }
    })();

    res.json({ liked: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
};

exports.watchlistToggle = async (req, res) => {
  const postId = await resolvePostId(req.params.id);
  if (!postId) return res.status(404).json({ message: 'Post not found' });
  let conn;
  try {
    conn = await db.getConnection();
    const [existing] = await conn.execute('SELECT 1 FROM user_watch WHERE user_id=? AND post_id=?',
      [req.user.user_id, postId]);
    if (existing.length) {
      await conn.execute('DELETE FROM user_watch WHERE user_id=? AND post_id=?',
        [req.user.user_id, postId]);
      return res.json({ saved: false });
    }
    await conn.execute('INSERT INTO user_watch (user_id,post_id) VALUES (?,?)',
      [req.user.user_id, postId]);
    res.json({ saved: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
};

exports.commentOnPost = async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: 'Comment required' });
  const postId = await resolvePostId(req.params.id);
  if (!postId) return res.status(404).json({ message: 'Post not found' });
  let conn;
  try {
    conn = await db.getConnection();
    const [r] = await conn.execute('INSERT INTO comments (user_id,post_id,content) VALUES (?,?,?)',
      [req.user.user_id, postId, content]);

    // Background moderation
    moderationService.queueForDetection({
      type: 'comment', id: r.insertId, userId: req.user.user_id, content
    }).catch(e => console.error('Comment moderation queue failed:', e));

    // Fire-and-forget notification
    (async () => {
      try {
        const [[post]] = await db.execute('SELECT user_id FROM posts WHERE post_id=?', [postId]);
        if (post.user_id !== req.user.user_id) {
          const commentSnippet = content.substring(0, 60) + (content.length > 60 ? '...' : '');
          await createNotification(
            post.user_id, 'connection', 'New Comment',
            `<strong>${req.user.name || 'Someone'}</strong> commented on your post:<br><em>"${commentSnippet}"</em>`
          );
        }
      } catch (e) { console.error('Comment notification failed:', e); }
    })();

    res.status(201).json({ comment_id: r.insertId });
  } catch (err) { res.status(500).json({ message: err.message }); }
  finally { if (conn) conn.release(); }
};

exports.getPostLikers = async (req, res) => {
  const postId = await resolvePostId(req.params.id);
  if (!postId) return res.status(404).json({ message: 'Post not found' });
  let conn;
  try {
    conn = await db.getConnection();
    const [likers] = await conn.execute(
      `SELECT u.public_id AS user_id, u.username, 
              COALESCE(ui.first_name, '') AS first_name, 
              COALESCE(ui.middle_name, '') AS middle_name, 
              COALESCE(ui.last_name, '') AS last_name,
              COALESCE(ui.photo, '') AS photo
       FROM likes l
       JOIN users u ON l.user_id = u.user_id
       LEFT JOIN user_info ui ON u.user_id = ui.user_id
       WHERE l.post_id = ?`,
      [postId]
    );

    for (const l of likers) {
      l.photo = formatPhoto(l.photo);
      // Ensure username is never null to prevent frontend crashes
      if (!l.username) l.username = `user_${l.user_id}`;
    }

    res.json(likers);
  } catch (err) {
    console.error('GET LIKERS ERROR:', err.message);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) conn.release();
  }
};
