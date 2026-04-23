const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../middleware/auth');

/* ══════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════ */

/** Cosine similarity between two sparse tag-frequency maps */
function cosineSim(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, ma = 0, mb = 0;
  for (const k of keys) {
    const av = a[k] || 0, bv = b[k] || 0;
    dot += av * bv; ma += av * av; mb += bv * bv;
  }
  if (!ma || !mb) return 0;
  return dot / (Math.sqrt(ma) * Math.sqrt(mb));
}

/** Build a feature vector for a user (for clustering & similarity) */
async function buildUserVector(conn, userId) {
  // Interests
  const [interests] = await conn.execute(
    `SELECT c.name FROM user_interests ui JOIN categories c ON ui.category_id=c.category_id WHERE ui.user_id=?`,
    [userId]
  );
  // Skills
  const [skills] = await conn.execute(
    `SELECT s.skill_name FROM user_skills us JOIN skills s ON us.skill_id=s.skill_id WHERE us.user_id=?`,
    [userId]
  );
  // Tags from liked posts
  const [likedTags] = await conn.execute(
    `SELECT pt.tag, COUNT(*) AS cnt FROM likes l
     JOIN post_tags pt ON l.post_id=pt.post_id
     JOIN posts p ON l.post_id=p.post_id
     WHERE l.user_id=? AND p.is_deleted=FALSE GROUP BY pt.tag`,
    [userId]
  );
  // Tags from own posts
  const [ownTags] = await conn.execute(
    `SELECT pt.tag, COUNT(*) AS cnt FROM posts p
     JOIN post_tags pt ON p.post_id=pt.post_id
     WHERE p.user_id=? AND p.is_deleted=FALSE GROUP BY pt.tag`,
    [userId]
  );
  // Certifications
  const [certs] = await conn.execute(
    `SELECT c.certification_name FROM user_certifications uc
     JOIN certifications c ON uc.certification_id=c.certification_id
     WHERE uc.user_id=?`,
    [userId]
  );
  // Education
  const [edu] = await conn.execute(
    `SELECT et.type FROM user_education ue JOIN education_type et ON ue.type_id=et.type_id WHERE ue.user_id=?`,
    [userId]
  );
  // Study stats
  const [[study]] = await conn.execute(
    `SELECT COALESCE(total_knowledge,0) AS tk, COALESCE(streak_days,0) AS sd,
            COALESCE(streak_factor,0) AS sf, COALESCE(learning_core,1) AS lc
     FROM study_streak WHERE user_id=?`,
    [userId]
  ).catch(() => [[{ tk:0, sd:0, sf:0, lc:1 }]]);
  // Quiz performance
  const [[quiz]] = await conn.execute(
    `SELECT AVG(percentage) AS avg_pct, COUNT(*) AS cnt FROM quiz_attempts WHERE user_id=?`,
    [userId]
  );
  // DOB / age
  const [[profile]] = await conn.execute(
    `SELECT TIMESTAMPDIFF(YEAR, dob, CURDATE()) AS age FROM user_profile WHERE user_id=?`,
    [userId]
  ).catch(() => [[{ age: 20 }]]);

  // Build tag map (liked=weight 2, own=weight 3)
  const tagMap = {};
  for (const r of likedTags) tagMap[r.tag.toLowerCase()] = (tagMap[r.tag.toLowerCase()] || 0) + r.cnt * 2;
  for (const r of ownTags)   tagMap[r.tag.toLowerCase()] = (tagMap[r.tag.toLowerCase()] || 0) + r.cnt * 3;

  // Category map
  const catMap = {};
  for (const r of interests) catMap[r.name.toLowerCase()] = (catMap[r.name.toLowerCase()] || 0) + 3;

  // Skill map
  const skillMap = {};
  for (const r of skills) skillMap[r.skill_name.toLowerCase()] = 1;

  return {
    userId,
    tagMap,
    catMap,
    skillMap,
    certNames: certs.map(c => c.certification_name.toLowerCase()),
    eduTypes:  edu.map(e => e.type.toLowerCase()),
    knowledge: parseFloat(study?.tk || 0),
    streakDays: parseInt(study?.sd || 0),
    streakFactor: parseInt(study?.sf || 0),
    learningCore: parseFloat(study?.lc || 1),
    quizAvg: parseFloat(quiz?.avg_pct || 50),
    quizCount: parseInt(quiz?.cnt || 0),
    age: parseInt(profile?.age || 20),
  };
}

/* ══════════════════════════════════════════════════════════════════
   K-MEANS CLUSTERING (pure JS, in-memory)
══════════════════════════════════════════════════════════════════ */
function clusterUsers(users, k = 5) {
  if (users.length <= k) {
    return users.map((u, i) => ({ ...u, cluster: i }));
  }

  // Convert each user to a numeric feature array
  // Collect all keys across all users
  const allTags  = new Set();
  const allCats  = new Set();
  const allSkills = new Set();
  users.forEach(u => {
    Object.keys(u.tagMap).forEach(t => allTags.add(t));
    Object.keys(u.catMap).forEach(c => allCats.add(c));
    Object.keys(u.skillMap).forEach(s => allSkills.add(s));
  });
  const tagKeys   = [...allTags];
  const catKeys   = [...allCats];
  const skillKeys = [...allSkills];

  function toVec(u) {
    const v = [];
    tagKeys.forEach(t => v.push(u.tagMap[t] || 0));
    catKeys.forEach(c => v.push(u.catMap[c] || 0));
    skillKeys.forEach(s => v.push(u.skillMap[s] || 0));
    // Normalised numeric features
    v.push(Math.min(u.knowledge / 500, 1));
    v.push(Math.min(u.streakDays / 365, 1));
    v.push(Math.min(u.quizAvg / 100, 1));
    v.push(Math.min(u.age / 60, 1));
    return v;
  }

  const vecs = users.map(toVec);
  const dim  = vecs[0].length;

  // Initialise centroids with k-means++ style (pick spread-out seeds)
  const centroids = [vecs[Math.floor(Math.random() * vecs.length)].slice()];
  while (centroids.length < k) {
    const dists = vecs.map(v => {
      const minD = Math.min(...centroids.map(c =>
        c.reduce((s, ci, i) => s + (ci - v[i]) ** 2, 0)
      ));
      return minD;
    });
    const total = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * total, idx = 0;
    for (let i = 0; i < dists.length; i++) { r -= dists[i]; if (r <= 0) { idx = i; break; } }
    centroids.push(vecs[idx].slice());
  }

  let assignments = new Array(vecs.length).fill(0);
  for (let iter = 0; iter < 20; iter++) {
    // Assign
    const newAssign = vecs.map(v => {
      let best = 0, bestD = Infinity;
      centroids.forEach((c, ci) => {
        const d = c.reduce((s, ci2, i) => s + (ci2 - v[i]) ** 2, 0);
        if (d < bestD) { bestD = d; best = ci; }
      });
      return best;
    });
    // Update centroids
    const sums = Array.from({ length: k }, () => new Array(dim).fill(0));
    const counts = new Array(k).fill(0);
    newAssign.forEach((cl, i) => {
      counts[cl]++;
      vecs[i].forEach((val, d) => { sums[cl][d] += val; });
    });
    centroids.forEach((c, ci) => {
      if (counts[ci] > 0) {
        c.forEach((_, d) => { c[d] = sums[ci][d] / counts[ci]; });
      }
    });
    if (JSON.stringify(newAssign) === JSON.stringify(assignments)) break;
    assignments = newAssign;
  }

  return users.map((u, i) => ({ ...u, cluster: assignments[i] }));
}

/* ══════════════════════════════════════════════════════════════════
   SCORE A POST AGAINST A USER VECTOR
══════════════════════════════════════════════════════════════════ */
function scorePost(post, uVec, connectedUsers) {
  let score = 0;

  const postTags = (post.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  const postCat  = (post.category || '').toLowerCase();

  // 1. Tag overlap with liked + own post tags (weight 4)
  for (const tag of postTags) {
    if (uVec.tagMap[tag]) score += uVec.tagMap[tag] * 4;
  }

  // 2. Category / interest match (weight 5)
  if (uVec.catMap[postCat]) score += uVec.catMap[postCat] * 5;

  // 3. Tag overlap with skills (weight 3)
  for (const tag of postTags) {
    if (uVec.skillMap[tag]) score += 3;
  }

  // 4. Tag overlap with cert names (weight 2)
  for (const cert of uVec.certNames) {
    if (postTags.some(t => cert.includes(t) || t.includes(cert))) score += 2;
  }

  // 5. Education type match (weight 1)
  if (uVec.eduTypes.some(e => postTags.includes(e) || postCat.includes(e))) score += 1;

  // 6. Connection authored this post (weight 6)
  if (connectedUsers.has(post.user_id)) score += 6;

  // 7. Knowledge-level difficulty match:
  //    High knowledge users get harder/advanced content boosted
  if (uVec.knowledge > 100 && postTags.includes('advanced')) score += 3;
  if (uVec.knowledge < 20  && postTags.includes('beginner'))  score += 3;

  // 8. Recency decay — posts older than 7 days get a small penalty
  const ageHours = (Date.now() - new Date(post.post_date).getTime()) / 3600000;
  if (ageHours < 24)  score += 5;
  else if (ageHours < 72)  score += 3;
  else if (ageHours < 168) score += 1;
  else score -= Math.min(Math.floor(ageHours / 168), 5); // -1 per week, max -5

  // 9. Engagement signal — popular posts get a boost
  score += Math.min(Math.log1p(post.like_count || 0), 3);
  score += Math.min(Math.log1p(post.comment_count || 0), 2);

  // 10. Streak / leaderboard bonus: active learners get more challenging content
  if (uVec.streakDays >= 7  && postTags.some(t => ['challenge','project','advanced'].includes(t))) score += 2;
  if (uVec.quizAvg > 75     && postTags.some(t => ['quiz','test','expert'].includes(t))) score += 2;

  return score;
}

/* ══════════════════════════════════════════════════════════════════
   GET /api/recommendations/feed
   Returns personalised post feed (≤30 posts) using full scoring
══════════════════════════════════════════════════════════════════ */
router.get('/feed', auth, async (req, res) => {
  const userId = req.user.user_id;
  const page   = parseInt(req.query.page) || 1;
  const limit  = 20;

  let conn;
  try {
    conn = await db.getConnection();

    // Build current user's vector
    const uVec = await buildUserVector(conn, userId);

    // Get connected users (for connection-feed boost)
    const [conns] = await conn.execute(
      `SELECT f1.following_id AS uid FROM follows f1
       INNER JOIN follows f2 ON f1.following_id=f2.follower_id AND f1.follower_id=f2.following_id
       WHERE f1.follower_id=?`,
      [userId]
    );
    const connectedUsers = new Set(conns.map(c => c.uid));

    // Fetch a candidate pool of recent posts (last 500 or so)
    const [candidates] = await conn.query(
      `SELECT p.post_id, p.user_id, p.text AS content, p.post_date, p.category,
              p.media_type, p.small_img, p.video_url AS video, p.is_anonymous,
              GROUP_CONCAT(DISTINCT pt.tag ORDER BY pt.tag) AS tags,
              u.username,
              COALESCE(ui.first_name,'') AS first_name,
              COALESCE(ui.last_name,'')  AS last_name,
              COALESCE(ui.photo,'')      AS photo,
              (SELECT COUNT(*) FROM likes WHERE post_id=p.post_id) AS like_count,
              (SELECT COUNT(*) FROM likes WHERE post_id=p.post_id AND user_id=?) AS user_liked,
              (SELECT COUNT(*) FROM comments WHERE post_id=p.post_id) AS comment_count,
              (SELECT COUNT(*) FROM user_watch WHERE post_id=p.post_id AND user_id=?) AS user_saved
       FROM posts p
       INNER JOIN users u ON p.user_id=u.user_id
       LEFT  JOIN user_info ui ON p.user_id=ui.user_id
       LEFT  JOIN post_tags pt ON p.post_id=pt.post_id
       WHERE p.is_pending=FALSE AND p.is_deleted=FALSE
       GROUP BY p.post_id
       ORDER BY p.post_date DESC
       LIMIT 500`,
      [userId, userId]
    );

    // Convert author photos and images (pure CPU, no extra queries)
    for (const p of candidates) {
      if (p.photo && Buffer.isBuffer(p.photo)) {
        p.photo = `data:image/jpeg;base64,${p.photo.toString('base64')}`;
      } else if (!p.photo || p.photo === '') {
        p.photo = null;
      }
      if (p.small_img) {
        p.image = `data:image/jpeg;base64,${p.small_img.toString('base64')}`;
      } else { p.image = null; }
      delete p.small_img;
      p.user_saved = p.user_saved > 0;
    }

    // Batch-fetch extra images in 1 query instead of N
    if (candidates.length) {
      const ids = candidates.map(p => p.post_id);
      const ph = ids.map(() => '?').join(',');
      const [extraImgs] = await conn.execute(
        `SELECT post_id, image FROM post_images WHERE post_id IN (${ph}) ORDER BY post_id, sort_order`, ids);
      const imgMap = {};
      for (const r of extraImgs) {
        if (!imgMap[r.post_id]) imgMap[r.post_id] = [];
        imgMap[r.post_id].push(`data:image/jpeg;base64,${r.image.toString('base64')}`);
      }
      for (const p of candidates) {
        p.extra_images = imgMap[p.post_id] || [];
      }
    }

    // Score each post
    const scored = candidates.map(p => ({ ...p, _score: scorePost(p, uVec, connectedUsers) }));

    // Sort by score desc, then by date as tiebreaker
    scored.sort((a, b) => b._score - a._score || new Date(b.post_date) - new Date(a.post_date));

    // Paginate
    const offset = (page - 1) * limit;
    const page_posts = scored.slice(offset, offset + limit);

    // Remove internal score
    page_posts.forEach(p => delete p._score);

    res.json({ posts: page_posts, has_more: (offset + page_posts.length) < scored.length });
  } catch (err) {
    console.error('RECOMMENDATIONS ERROR:', err.message);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

/* ══════════════════════════════════════════════════════════════════
   GET /api/recommendations/similar-users
   Returns users similar to current user (cluster-based + cosine sim)
══════════════════════════════════════════════════════════════════ */
router.get('/similar-users', auth, async (req, res) => {
  const userId = req.user.user_id;
  let conn;
  try {
    conn = await db.getConnection();

    // Get all users
    const [users] = await conn.execute(
      `SELECT u.user_id, u.username,
              COALESCE(ui.first_name,'') AS first_name,
              COALESCE(ui.last_name,'') AS last_name,
              COALESCE(ui.photo,'') AS photo,
              up.is_expert, up.total_knowledge
       FROM users u
       LEFT JOIN user_info ui ON u.user_id=ui.user_id
       LEFT JOIN user_profile up ON u.user_id=up.user_id
       LIMIT 200`
    );

    // Build vectors for all users (limit for performance)
    const vectors = [];
    for (const u of users) {
      const v = await buildUserVector(conn, u.user_id);
      vectors.push({ ...u, ...v });
    }

    // Run k-means clustering
    const clustered = clusterUsers(vectors, 5);

    // Find current user's cluster
    const myVec     = clustered.find(u => u.userId === userId);
    if (!myVec) return res.json([]);

    // Get users in same cluster, sorted by cosine similarity
    const sameCluster = clustered.filter(u => u.cluster === myVec.cluster && u.userId !== userId);
    const withSim = sameCluster.map(u => ({
      user_id:  u.user_id,
      username: u.username,
      first_name: u.first_name,
      last_name: u.last_name,
      photo:    Buffer.isBuffer(u.photo) ? `data:image/jpeg;base64,${u.photo.toString('base64')}` : (u.photo || null),
      is_expert: u.is_expert,
      total_knowledge: u.total_knowledge,
      cluster: u.cluster,
      similarity: cosineSim(
        { ...myVec.tagMap, ...myVec.catMap, ...myVec.skillMap },
        { ...u.tagMap,     ...u.catMap,     ...u.skillMap }
      ),
    }));
    withSim.sort((a, b) => b.similarity - a.similarity);

    res.json(withSim.slice(0, 10));
  } catch (err) {
    console.error('SIMILAR USERS ERROR:', err.message);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

/* ══════════════════════════════════════════════════════════════════
   GET /api/recommendations/knowledge-chart
   Returns monthly knowledge data for Jan–Dec 2026 + daily marks
══════════════════════════════════════════════════════════════════ */
router.get('/knowledge-chart', auth, async (req, res) => {
  const userId = req.user.user_id;
  const year   = parseInt(req.query.year) || new Date().getFullYear();
  try {
    // Monthly aggregation
    const [monthly] = await db.execute(
      `SELECT MONTH(session_date) AS month,
              SUM(knowledge_gained) AS knowledge,
              SUM(hours_studied) AS hours,
              COUNT(*) AS sessions
       FROM study_sessions
       WHERE user_id=? AND YEAR(session_date)=? AND end_time IS NOT NULL
       GROUP BY MONTH(session_date)
       ORDER BY month`,
      [userId, year]
    );

    // Daily data for current year
    const [daily] = await db.execute(
      `SELECT session_date AS date,
              SUM(knowledge_gained) AS knowledge,
              SUM(hours_studied) AS hours
       FROM study_sessions
       WHERE user_id=? AND YEAR(session_date)=? AND end_time IS NOT NULL
       GROUP BY session_date
       ORDER BY session_date`,
      [userId, year]
    );

    // Cumulative knowledge by month
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = monthly.find(r => r.month === i + 1);
      return {
        month: i + 1,
        label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
        knowledge: parseFloat(m?.knowledge || 0),
        hours:     parseFloat(m?.hours || 0),
        sessions:  parseInt(m?.sessions || 0),
      };
    });

    // Running cumulative
    let cum = 0;
    const cumulative = months.map(m => {
      cum += m.knowledge;
      return { ...m, cumulative: parseFloat(cum.toFixed(4)) };
    });

    res.json({ monthly: cumulative, daily, year });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
