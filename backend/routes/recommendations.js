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

/** Build feature vectors for multiple users efficiently (Batch) */
async function buildUserVectorsBatch(conn, userIds) {
  if (!userIds || userIds.length === 0) return {};
  const ph = userIds.map(() => '?').join(',');

  // Group by user
  const userMap = {};
  for (const uid of userIds) {
    userMap[uid] = {
      userId: uid, tagMap: {}, catMap: {}, skillMap: {}, certNames: [], eduTypes: [],
      knowledge: 0, streakDays: 0, streakFactor: 0, learningCore: 1,
      quizAvg: 50, quizCount: 0, age: 20
    };
  }

  // Execute all queries concurrently
  const [
    [interests], [skills], [likedTags], [ownTags], [certs], [edu], [study], [quiz], [profile]
  ] = await Promise.all([
    conn.query(`SELECT ui.user_id, c.name FROM user_interests ui JOIN categories c ON ui.category_id=c.category_id WHERE ui.user_id IN (${ph})`, userIds),
    conn.query(`SELECT us.user_id, s.skill_name FROM user_skills us JOIN skills s ON us.skill_id=s.skill_id WHERE us.user_id IN (${ph})`, userIds),
    conn.query(`SELECT l.user_id, pt.tag, COUNT(*) AS cnt FROM likes l JOIN post_tags pt ON l.post_id=pt.post_id JOIN posts p ON l.post_id=p.post_id WHERE l.user_id IN (${ph}) AND p.is_deleted=FALSE GROUP BY l.user_id, pt.tag`, userIds),
    conn.query(`SELECT p.user_id, pt.tag, COUNT(*) AS cnt FROM posts p JOIN post_tags pt ON p.post_id=pt.post_id WHERE p.user_id IN (${ph}) AND p.is_deleted=FALSE GROUP BY p.user_id, pt.tag`, userIds),
    conn.query(`SELECT uc.user_id, c.certification_name FROM user_certifications uc JOIN certifications c ON uc.certification_id=c.certification_id WHERE uc.user_id IN (${ph})`, userIds),
    conn.query(`SELECT ue.user_id, et.type FROM user_education ue JOIN education_type et ON ue.type_id=et.type_id WHERE ue.user_id IN (${ph})`, userIds),
    conn.query(`SELECT user_id, COALESCE(total_knowledge,0) AS tk, COALESCE(streak_days,0) AS sd, COALESCE(streak_factor,0) AS sf, COALESCE(learning_core,1) AS lc FROM study_streak WHERE user_id IN (${ph})`, userIds),
    conn.query(`SELECT user_id, AVG(percentage) AS avg_pct, COUNT(*) AS cnt FROM quiz_attempts WHERE user_id IN (${ph}) GROUP BY user_id`, userIds),
    conn.query(`SELECT user_id, TIMESTAMPDIFF(YEAR, dob, CURDATE()) AS age FROM user_profile WHERE user_id IN (${ph})`, userIds)
  ]);

  for (const r of interests) userMap[r.user_id].catMap[r.name.toLowerCase()] = (userMap[r.user_id].catMap[r.name.toLowerCase()] || 0) + 3;
  for (const r of skills)    userMap[r.user_id].skillMap[r.skill_name.toLowerCase()] = 1;
  for (const r of likedTags) userMap[r.user_id].tagMap[r.tag.toLowerCase()] = (userMap[r.user_id].tagMap[r.tag.toLowerCase()] || 0) + r.cnt * 2;
  for (const r of ownTags)   userMap[r.user_id].tagMap[r.tag.toLowerCase()] = (userMap[r.user_id].tagMap[r.tag.toLowerCase()] || 0) + r.cnt * 3;
  for (const r of certs)     userMap[r.user_id].certNames.push(r.certification_name.toLowerCase());
  for (const r of edu)       userMap[r.user_id].eduTypes.push(r.type.toLowerCase());
  
  for (const r of study) {
    userMap[r.user_id].knowledge = parseFloat(r.tk || 0);
    userMap[r.user_id].streakDays = parseInt(r.sd || 0);
    userMap[r.user_id].streakFactor = parseInt(r.sf || 0);
    userMap[r.user_id].learningCore = parseFloat(r.lc || 1);
  }
  for (const r of quiz) {
    userMap[r.user_id].quizAvg = parseFloat(r.avg_pct || 50);
    userMap[r.user_id].quizCount = parseInt(r.cnt || 0);
  }
  for (const r of profile) {
    if (r.age) userMap[r.user_id].age = parseInt(r.age);
  }

  return userMap;
}

/** Build a feature vector for a single user */
async function buildUserVector(conn, userId) {
  const map = await buildUserVectorsBatch(conn, [userId]);
  return map[userId];
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
   XGBoost-Lite (Gradient Boosted Decision Trees Mock)
   In a production system, you would train a model offline and load
   the tree structure here. This is a pre-trained mock ensemble.
══════════════════════════════════════════════════════════════════ */
function xgboostPredict(features) {
  let logOdds = 0.0; // Base prediction (logit)

  // Tree 1: Category Match & Engagement
  if (features.categoryMatch > 0) {
    if (features.engagementRate > 0.05) logOdds += 1.2;
    else logOdds += 0.5;
  } else {
    if (features.engagementRate > 0.1) logOdds += 0.3;
    else logOdds -= 0.8;
  }

  // Tree 2: Recency and Cold Start
  if (features.ageHours < 24) {
    if (features.isColdStart) logOdds += 0.8; // Cold start exploration boost
    else logOdds += 0.4;
  } else if (features.ageHours > 168) {
    logOdds -= 0.6; // Older than a week penalty
  }

  // Tree 3: Connection / Mutual Follows
  if (features.isConnection) {
    logOdds += 1.5;
  }

  // Tree 4: Tag & Skill Overlap (Semantic Similarity Proxy)
  if (features.tagSkillOverlap > 2) {
    logOdds += 1.0;
  } else if (features.tagSkillOverlap > 0) {
    logOdds += 0.4;
  }
  
  // Tree 5: Difficulty Match
  if (features.difficultyMatch) {
    logOdds += 0.5;
  }

  // Convert log odds to probability (Sigmoid function)
  return 1 / (1 + Math.exp(-logOdds));
}

/* ══════════════════════════════════════════════════════════════════
   FEATURE EXTRACTION & SCORING (ML Pipeline Stage 2)
══════════════════════════════════════════════════════════════════ */
function extractFeaturesAndScore(post, uVec, connectedUsers) {
  const postTags = (post.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  const postCat  = (post.category || '').toLowerCase();
  
  // 1. Category Match
  let categoryMatch = uVec.catMap[postCat] || 0;

  // 2. Tag & Skill Overlap
  let tagSkillOverlap = 0;
  for (const tag of postTags) {
    if (uVec.tagMap[tag]) tagSkillOverlap += uVec.tagMap[tag];
    if (uVec.skillMap[tag]) tagSkillOverlap += 3;
  }
  for (const cert of uVec.certNames) {
    if (postTags.some(t => cert.includes(t) || t.includes(cert))) tagSkillOverlap += 2;
  }

  // 3. Engagement Rate
  const engagementRate = (post.like_count || 0) / ((post.comment_count || 0) + 10);

  // 4. Recency
  const ageHours = (Date.now() - new Date(post.post_date).getTime()) / 3600000;

  // 5. Connection
  const isConnection = connectedUsers.has(post.user_id);

  // 6. Cold Start
  const isColdStart = (post.like_count === 0 && ageHours < 24);
  
  // 7. Difficulty Match
  let difficultyMatch = false;
  if (uVec.knowledge > 100 && postTags.includes('advanced')) difficultyMatch = true;
  if (uVec.knowledge < 20  && postTags.includes('beginner')) difficultyMatch = true;

  const features = {
    categoryMatch,
    tagSkillOverlap,
    engagementRate,
    ageHours,
    isConnection,
    isColdStart,
    difficultyMatch
  };

  return xgboostPredict(features);
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

    // FETCH CANDIDATES: Latest + Collaborative Filtering
    const [candidateIds] = await conn.query(`
      (SELECT post_id FROM posts WHERE is_pending=FALSE AND is_deleted=FALSE ORDER BY post_date DESC LIMIT 300)
      UNION
      (SELECT p.post_id FROM posts p JOIN likes l ON p.post_id=l.post_id 
       WHERE l.user_id IN (
         SELECT l2.user_id FROM likes l1 JOIN likes l2 ON l1.post_id=l2.post_id 
         WHERE l1.user_id=? AND l2.user_id!=?
       ) AND p.is_pending=FALSE AND p.is_deleted=FALSE LIMIT 200)
    `, [userId, userId]);
    
    if (candidateIds.length === 0) {
      return res.json({ posts: [], has_more: false });
    }
    
    const ids = candidateIds.map(c => c.post_id);
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
       WHERE p.post_id IN (${ids.join(',')})
       GROUP BY p.post_id`,
      [userId, userId]
    );

    // Convert author photos and images
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

    // SCORE & RANK
    const scored = candidates.map(p => ({ ...p, _score: extractFeaturesAndScore(p, uVec, connectedUsers) }));
    scored.sort((a, b) => b._score - a._score || new Date(b.post_date) - new Date(a.post_date));

    // RE-RANKING: Diversity & Anti-Fatigue
    const finalFeed = [];
    const recentAuthors = [];
    const recentCategories = [];

    // Apply sliding window diversity filter
    while (scored.length > 0) {
      let bestIdx = 0;
      
      // Look at top 10 items in the queue to find the best one that doesn't violate diversity
      for (let i = 0; i < Math.min(10, scored.length); i++) {
        const p = scored[i];
        const authorCount = recentAuthors.filter(a => a === p.user_id).length;
        const catCount = recentCategories.filter(c => c === p.category).length;
        
        // Allowed max 2 from same author, 3 from same category in the recent sliding window
        if (authorCount < 2 && catCount < 3) {
          bestIdx = i;
          break;
        }
      }
      
      const p = scored.splice(bestIdx, 1)[0];
      finalFeed.push(p);
      
      recentAuthors.push(p.user_id);
      if (recentAuthors.length > 5) recentAuthors.shift(); // sliding window of 5
      
      recentCategories.push(p.category);
      if (recentCategories.length > 8) recentCategories.shift(); // sliding window of 8
    }

    // Paginate
    const offset = (page - 1) * limit;
    const page_posts = finalFeed.slice(offset, offset + limit);

    // Remove internal score
    page_posts.forEach(p => delete p._score);

    res.json({ posts: page_posts, has_more: (offset + page_posts.length) < finalFeed.length });
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

    // Get candidate users (excluding current user initially)
    const [users] = await conn.execute(
      `SELECT u.user_id, u.username,
              COALESCE(ui.first_name,'') AS first_name,
              COALESCE(ui.last_name,'') AS last_name,
              COALESCE(ui.photo,'') AS photo,
              up.is_expert, up.total_knowledge
       FROM users u
       LEFT JOIN user_info ui ON u.user_id=ui.user_id
       LEFT JOIN user_profile up ON u.user_id=up.user_id
       WHERE u.user_id != ?
       LIMIT 200`,
       [userId]
    );

    // Get current user to ensure they are clustered
    const [[currentUser]] = await conn.execute(
      `SELECT u.user_id, u.username,
              COALESCE(ui.first_name,'') AS first_name,
              COALESCE(ui.last_name,'') AS last_name,
              COALESCE(ui.photo,'') AS photo,
              up.is_expert, up.total_knowledge
       FROM users u
       LEFT JOIN user_info ui ON u.user_id=ui.user_id
       LEFT JOIN user_profile up ON u.user_id=up.user_id
       WHERE u.user_id = ?`,
       [userId]
    );

    if (currentUser) {
      users.push(currentUser);
    }

    // Build vectors for all users efficiently in one batch
    const userIds = users.map(u => u.user_id);
    const vectorMap = await buildUserVectorsBatch(conn, userIds);

    const vectors = users.map(u => ({ ...u, ...vectorMap[u.user_id] }));

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
