const pool = require('../db');

async function migrate() {
  try {
    console.log('Running recommendation system migrations...');

    // 1. Alter posts table
    const alters = [
      "ALTER TABLE posts ADD COLUMN difficulty_level ENUM('beginner','intermediate','advanced') DEFAULT NULL",
      "ALTER TABLE posts ADD COLUMN estimated_read_time_seconds INT DEFAULT NULL"
    ];

    for (const sql of alters) {
      try {
        await pool.query(sql);
        console.log(`✅ ${sql}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`⏩ Skipped (already exists): ${sql.substring(0, 50)}...`);
        } else {
          console.log(`⚠️ Note: ${err.message}`);
        }
      }
    }

    // 2. Create tables (note: using feed_rank instead of rank)
    const tables = [
      `CREATE TABLE IF NOT EXISTS precomputed_feed (
          user_id INT NOT NULL,
          post_id INT NOT NULL,
          score FLOAT NOT NULL DEFAULT 0,
          feed_rank INT NOT NULL DEFAULT 0,
          is_explore BOOLEAN DEFAULT FALSE,
          computed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, post_id),
          INDEX idx_pf_serve (user_id, feed_rank),
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
          FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS model_weights (
          model_id INT AUTO_INCREMENT PRIMARY KEY,
          feature_name VARCHAR(100) NOT NULL,
          weight DOUBLE NOT NULL DEFAULT 0,
          version INT NOT NULL DEFAULT 1,
          trained_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_mw_version (version)
      )`,
      `CREATE TABLE IF NOT EXISTS user_clusters (
          user_id INT PRIMARY KEY,
          cluster_id INT NOT NULL DEFAULT 0,
          computed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS trending_posts (
          post_id INT PRIMARY KEY,
          trending_score FLOAT NOT NULL DEFAULT 0,
          period ENUM('6h','24h','7d') NOT NULL DEFAULT '24h',
          computed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS user_post_signals (
          user_id INT NOT NULL,
          post_id INT NOT NULL,
          watch_seconds INT DEFAULT 0,
          scroll_depth_pct TINYINT UNSIGNED DEFAULT 0,
          video_pct TINYINT UNSIGNED DEFAULT 0,
          is_liked BOOLEAN DEFAULT FALSE,
          is_saved BOOLEAN DEFAULT FALSE,
          is_shared BOOLEAN DEFAULT FALSE,
          is_commented BOOLEAN DEFAULT FALSE,
          profile_clicked BOOLEAN DEFAULT FALSE,
          repeat_views INT DEFAULT 0,
          is_reported BOOLEAN DEFAULT FALSE,
          impression_count INT DEFAULT 0,
          composite_score FLOAT DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, post_id),
          INDEX idx_ups_user (user_id),
          INDEX idx_ups_post (post_id)
      )`,
      `CREATE TABLE IF NOT EXISTS training_jobs (
          job_id INT AUTO_INCREMENT PRIMARY KEY,
          status ENUM('pending','running','completed','failed') DEFAULT 'pending',
          started_at TIMESTAMP NULL,
          completed_at TIMESTAMP NULL,
          users_processed INT DEFAULT 0,
          posts_scored INT DEFAULT 0,
          model_version INT DEFAULT 0,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const sql of tables) {
      await pool.query(sql);
    }
    console.log('✅ All recommendation system tables created successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
