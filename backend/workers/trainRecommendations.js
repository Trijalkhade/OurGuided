const { parentPort } = require('worker_threads');
const pool = require('../db');

// In case it's run directly in CLI/testing (without parentPort)
const log = (msg) => {
  console.log(`[Worker] ${msg}`);
  if (parentPort) {
    parentPort.postMessage({ type: 'log', message: msg });
  }
};

const updateProgress = (users, posts) => {
  if (parentPort) {
    parentPort.postMessage({ type: 'progress', usersProcessed: users, postsScored: posts });
  }
};

// Logistic Regression helper functions
function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

async function trainModel() {
  let conn;
  try {
    conn = await pool.getConnection();
    log('Starting training job...');

    // Get job ID if provided
    let jobId = null;
    const [jobs] = await conn.execute(
      "SELECT job_id FROM training_jobs WHERE status='running' ORDER BY started_at DESC LIMIT 1"
    );
    if (jobs.length > 0) jobId = jobs[0].job_id;

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1: MATERIALIZE ENGAGEMENT SIGNALS
    // ──────────────────────────────────────────────────────────────────────────
    log('Aggregating raw engagement tables...');

    // Clear old signals
    await conn.execute("TRUNCATE TABLE user_post_signals");

    // Fetch all user-post interaction contexts
    // Likes
    await conn.execute(`
      INSERT INTO user_post_signals (user_id, post_id, is_liked)
      SELECT user_id, post_id, TRUE FROM likes
      ON DUPLICATE KEY UPDATE is_liked = TRUE
    `);
    // Watch times
    await conn.execute(`
      INSERT INTO user_post_signals (user_id, post_id, watch_seconds)
      SELECT user_id, post_id, seconds FROM post_watch_time
      ON DUPLICATE KEY UPDATE watch_seconds = GREATEST(watch_seconds, VALUES(watch_seconds))
    `);
    // Scroll depth
    await conn.execute(`
      INSERT INTO user_post_signals (user_id, post_id, scroll_depth_pct)
      SELECT user_id, post_id, depth_pct FROM post_scroll_depth
      ON DUPLICATE KEY UPDATE scroll_depth_pct = GREATEST(scroll_depth_pct, VALUES(scroll_depth_pct))
    `);
    // Video completions
    await conn.execute(`
      INSERT INTO user_post_signals (user_id, post_id, video_pct)
      SELECT user_id, post_id, completion_pct FROM post_video_completion
      ON DUPLICATE KEY UPDATE video_pct = GREATEST(video_pct, VALUES(video_pct))
    `);
    // Shares
    await conn.execute(`
      INSERT INTO user_post_signals (user_id, post_id, is_shared)
      SELECT user_id, post_id, TRUE FROM post_shares
      ON DUPLICATE KEY UPDATE is_shared = TRUE
    `);
    // Profile clicks
    await conn.execute(`
      INSERT INTO user_post_signals (user_id, post_id, profile_clicked)
      SELECT user_id, post_id, TRUE FROM post_profile_clicks
      ON DUPLICATE KEY UPDATE profile_clicked = TRUE
    `);
    // Repeat views
    await conn.execute(`
      INSERT INTO user_post_signals (user_id, post_id, repeat_views)
      SELECT user_id, post_id, view_count FROM post_repeat_views
      ON DUPLICATE KEY UPDATE repeat_views = GREATEST(repeat_views, VALUES(repeat_views))
    `);
    // Reports
    await conn.execute(`
      INSERT INTO user_post_signals (user_id, post_id, is_reported)
      SELECT user_id, post_id, TRUE FROM post_reports
      ON DUPLICATE KEY UPDATE is_reported = TRUE
    `);
    // Impressions
    await conn.execute(`
      INSERT INTO user_post_signals (user_id, post_id, impression_count)
      SELECT user_id, post_id, 1 FROM post_impressions
      ON DUPLICATE KEY UPDATE impression_count = impression_count + 1
    `);

    // Compute composite scores
    await conn.execute(`
      UPDATE user_post_signals
      SET composite_score = 
        (is_liked * 5.0) + 
        (is_saved * 4.0) + 
        (is_shared * 8.0) + 
        (is_commented * 3.0) + 
        (watch_seconds * 0.1) + 
        (scroll_depth_pct * 0.05) + 
        (profile_clicked * 2.0) + 
        (repeat_views * 1.5) - 
        (is_reported * 15.0)
    `);

    log('Finished materializing engagement signals.');

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 2: COMPUTE TRENDING POSTS
    // ──────────────────────────────────────────────────────────────────────────
    log('Calculating trending posts...');
    await conn.execute("TRUNCATE TABLE trending_posts");
    
    // Formula: (likes * 2 + comments * 3 + shares * 5) / (age_hours + 2)^1.5
    await conn.execute(`
      INSERT INTO trending_posts (post_id, trending_score, period)
      SELECT 
        p.post_id,
        ((p.like_count * 2.0) + (p.comment_count * 3.0) + (COALESCE(s.share_cnt, 0) * 5.0)) / 
        POWER(TIMESTAMPDIFF(HOUR, p.post_date, CURRENT_TIMESTAMP) + 2, 1.5) AS trending,
        '24h'
      FROM posts p
      LEFT JOIN (SELECT post_id, COUNT(*) AS share_cnt FROM post_shares GROUP BY post_id) s ON p.post_id = s.post_id
      WHERE p.is_deleted = FALSE AND p.is_pending = FALSE
      ORDER BY trending DESC
    `);
    log('Finished trending calculation.');

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: USER CLUSTERING (K-Means)
    // ──────────────────────────────────────────────────────────────────────────
    log('Starting User Clustering (K-Means)...');
    
    // Fetch all user profiles with total knowledge and streak info
    const [users] = await conn.execute(`
      SELECT u.user_id, COALESCE(up.total_knowledge, 0) AS tk, COALESCE(ss.streak_days, 0) AS sd
      FROM users u
      LEFT JOIN user_profile up ON u.user_id = up.user_id
      LEFT JOIN study_streak ss ON u.user_id = ss.user_id
    `);

    if (users.length > 0) {
      const k = Math.min(5, users.length);
      
      // Features: normalized total_knowledge and streak_days
      const vecs = users.map(u => [
        Math.min(parseFloat(u.tk) / 500, 1),
        Math.min(parseInt(u.sd) / 30, 1)
      ]);

      // Simple K-Means implementation
      let centroids = vecs.slice(0, k);
      let assignments = new Array(vecs.length).fill(0);

      for (let iter = 0; iter < 10; iter++) {
        // Assign clusters
        const newAssign = vecs.map(v => {
          let bestIdx = 0;
          let bestD = Infinity;
          centroids.forEach((c, ci) => {
            const d = Math.pow(v[0]-c[0], 2) + Math.pow(v[1]-c[1], 2);
            if (d < bestD) { bestD = d; bestIdx = ci; }
          });
          return bestIdx;
        });

        // Update centroids
        const sums = Array.from({ length: k }, () => [0, 0]);
        const counts = new Array(k).fill(0);
        newAssign.forEach((c, idx) => {
          sums[c][0] += vecs[idx][0];
          sums[c][1] += vecs[idx][1];
          counts[c]++;
        });
        centroids = centroids.map((c, ci) => {
          if (counts[ci] > 0) {
            return [sums[ci][0]/counts[ci], sums[ci][1]/counts[ci]];
          }
          return c;
        });

        if (JSON.stringify(newAssign) === JSON.stringify(assignments)) break;
        assignments = newAssign;
      }

      // Write clusters
      await conn.execute("TRUNCATE TABLE user_clusters");
      for (let i = 0; i < users.length; i++) {
        await conn.execute(
          "INSERT INTO user_clusters (user_id, cluster_id) VALUES (?, ?)",
          [users[i].user_id, assignments[i]]
        );
      }
    }
    log('Finished User Clustering.');

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: MODEL TRAINING (Logistic Regression)
    // ──────────────────────────────────────────────────────────────────────────
    log('Training Logistic Regression model weights...');

    // Fetch positive/negative samples from materialized signals
    const [samples] = await conn.execute(`
      SELECT 
        s.user_id, s.post_id, s.composite_score,
        IF(s.composite_score > 3.0, 1.0, 0.0) AS label,
        (SELECT COUNT(*) FROM user_interests ui JOIN categories c ON ui.category_id=c.category_id JOIN posts p ON p.post_id=s.post_id WHERE ui.user_id=s.user_id AND p.category=c.name) AS cat_match,
        (SELECT COUNT(*) FROM post_tags pt JOIN posts p ON p.post_id=s.post_id WHERE pt.post_id=s.post_id) AS tag_count
      FROM user_post_signals s
    `);

    // Default weights
    let w_bias = 0.0;
    let w_cat_match = 0.5;
    let w_tag_count = 0.1;

    if (samples.length > 0) {
      const lr = 0.1; // learning rate
      const epochs = 50;

      for (let epoch = 0; epoch < epochs; epoch++) {
        let grad_bias = 0;
        let grad_cat = 0;
        let grad_tag = 0;

        for (const s of samples) {
          const x_cat = parseFloat(s.cat_match) > 0 ? 1.0 : 0.0;
          const x_tag = parseFloat(s.tag_count);
          const z = w_bias + (w_cat_match * x_cat) + (w_tag_count * x_tag);
          const pred = sigmoid(z);
          const error = pred - parseFloat(s.label);

          grad_bias += error;
          grad_cat += error * x_cat;
          grad_tag += error * x_tag;
        }

        w_bias -= (lr / samples.length) * grad_bias;
        w_cat_match -= (lr / samples.length) * grad_cat;
        w_tag_count -= (lr / samples.length) * grad_tag;
      }
    }

    // Save weights
    await conn.execute("TRUNCATE TABLE model_weights");
    await conn.execute("INSERT INTO model_weights (feature_name, weight) VALUES ('bias', ?), ('category_match', ?), ('tag_count', ?)", [w_bias, w_cat_match, w_tag_count]);
    log(`Model weights trained. Bias: ${w_bias.toFixed(4)}, CatMatch: ${w_cat_match.toFixed(4)}, TagCount: ${w_tag_count.toFixed(4)}`);

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 5: PRE-COMPUTE FEEDS FOR ALL ACTIVE USERS
    // ──────────────────────────────────────────────────────────────────────────
    log('Pre-computing personalized feeds for all active users...');
    await conn.execute("TRUNCATE TABLE precomputed_feed");

    // Fetch all active users
    const [activeUsers] = await conn.execute("SELECT user_id FROM users");

    // Fetch all valid posts to score
    const [postsToScore] = await conn.execute(`
      SELECT post_id, category,
        (SELECT COUNT(*) FROM post_tags WHERE post_id=posts.post_id) AS tag_count
      FROM posts
      WHERE is_deleted = FALSE AND is_pending = FALSE
    `);

    // Fetch trending posts to use as exploration base
    const [trending] = await conn.execute("SELECT post_id FROM trending_posts ORDER BY trending_score DESC LIMIT 10");
    const trendingSet = new Set(trending.map(t => t.post_id));

    let usersProcessedCount = 0;
    let postsScoredCount = 0;

    for (const u of activeUsers) {
      const uId = u.user_id;

      // Get user interests
      const [interests] = await conn.execute(`
        SELECT LOWER(c.name) AS cat_name 
        FROM user_interests ui 
        JOIN categories c ON ui.category_id = c.category_id 
        WHERE ui.user_id = ?
      `, [uId]);
      const interestCats = new Set(interests.map(i => i.cat_name));

      // Score all posts
      const scoredPosts = postsToScore.map(p => {
        const x_cat = interestCats.has((p.category || '').toLowerCase()) ? 1.0 : 0.0;
        const x_tag = parseFloat(p.tag_count);
        const z = w_bias + (w_cat_match * x_cat) + (w_tag_count * x_tag);
        const score = sigmoid(z);
        return { post_id: p.post_id, score };
      });

      // Sort by score
      scoredPosts.sort((a, b) => b.score - a.score);

      // Epsilon-Greedy Exploration (15% rate)
      // Replace ~15% of high rank slots with trending items the user hasn't seen
      const finalFeed = [];
      const usedPostIds = new Set();
      
      let scoreIdx = 0;
      const totalSlots = Math.min(50, scoredPosts.length);

      for (let rank = 1; rank <= totalSlots; rank++) {
        // Trigger exploration with 15% probability and if trending items are available
        if (Math.random() < 0.15 && trending.length > 0) {
          // Find a trending post that isn't already used
          const expPost = trending.find(t => !usedPostIds.has(t.post_id));
          if (expPost) {
            finalFeed.push({ post_id: expPost.post_id, score: 0.99, is_explore: true });
            usedPostIds.add(expPost.post_id);
            continue;
          }
        }

        // Default to highest scored post
        while (scoreIdx < scoredPosts.length && usedPostIds.has(scoredPosts[scoreIdx].post_id)) {
          scoreIdx++;
        }
        if (scoreIdx < scoredPosts.length) {
          finalFeed.push({ post_id: scoredPosts[scoreIdx].post_id, score: scoredPosts[scoreIdx].score, is_explore: false });
          usedPostIds.add(scoredPosts[scoreIdx].post_id);
          scoreIdx++;
        }
      }

      // Write user's precomputed feed
      for (let rank = 0; rank < finalFeed.length; rank++) {
        const f = finalFeed[rank];
        await conn.execute(
          `INSERT INTO precomputed_feed (user_id, post_id, score, feed_rank, is_explore)
           VALUES (?, ?, ?, ?, ?)`,
          [uId, f.post_id, f.score, rank + 1, f.is_explore ? 1 : 0]
        );
      }

      usersProcessedCount++;
      postsScoredCount += finalFeed.length;
      updateProgress(usersProcessedCount, postsScoredCount);
    }

    // Update job status to completed
    if (jobId) {
      await conn.execute(
        "UPDATE training_jobs SET status='completed', completed_at=CURRENT_TIMESTAMP, users_processed=?, posts_scored=? WHERE job_id=?",
        [usersProcessedCount, postsScoredCount, jobId]
      );
    }

    log('Precomputed feeds successfully populated!');
    if (parentPort) {
      parentPort.postMessage({ type: 'done' });
    } else {
      process.exit(0);
    }

  } catch (err) {
    log(`❌ Model training error: ${err.stack || err.message}`);
    
    // Update job status to failed
    if (conn) {
      try {
        const [jobs] = await conn.execute("SELECT job_id FROM training_jobs WHERE status='running' ORDER BY started_at DESC LIMIT 1");
        if (jobs.length > 0) {
          await conn.execute(
            "UPDATE training_jobs SET status='failed', completed_at=CURRENT_TIMESTAMP, error_message=? WHERE job_id=?",
            [err.message, jobs[0].job_id]
          );
        }
      } catch (dbErr) {
        console.error('Failed to log failed job status in DB:', dbErr.message);
      }
    }

    if (parentPort) {
      parentPort.postMessage({ type: 'error', error: err.message });
    } else {
      process.exit(1);
    }
  } finally {
    if (conn) conn.release();
  }
}

// Automatically trigger training if run directly/spawning
trainModel();
