const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'your_db_password_here',
    database: process.env.DB_NAME || 'DBMS'
  });

  try {
    console.log('Running migrations...');

    // 1. Add columns (ignore if they exist)
    const alters = [
      "ALTER TABLE users ADD COLUMN role ENUM('user','moderator','admin') NOT NULL DEFAULT 'user'",
      "ALTER TABLE user_profile ADD COLUMN updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP",
      "ALTER TABLE user_info ADD COLUMN photo_url TEXT DEFAULT NULL",
      "ALTER TABLE user_info ADD COLUMN updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP",
      "ALTER TABLE posts ADD COLUMN image_url TEXT DEFAULT NULL",
      "ALTER TABLE posts ADD COLUMN like_count INT DEFAULT 0",
      "ALTER TABLE posts ADD COLUMN comment_count INT DEFAULT 0",
      "ALTER TABLE notifications MODIFY COLUMN type ENUM('new_skill','quiz','streak','connection','system','moderation') NOT NULL"
    ];

    for (const sql of alters) {
      try {
        await pool.query(sql);
        console.log(`✅ ${sql.substring(0, 50)}...`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
          console.log(`⏩ Skipped (already exists): ${sql.substring(0, 50)}...`);
        } else {
          console.log(`✅ Note on ${sql.substring(0, 50)}: ${err.message}`);
        }
      }
    }

    // 2. Drop the old invalid constraint
    try {
      await pool.query("ALTER TABLE user_profile DROP CHECK user_profile_chk_1");
      console.log('✅ Dropped old dob CHECK constraint');
    } catch(err) {
      // ignore if doesn't exist
    }

    // 3. Create new tables
    const newTables = [
      `CREATE TABLE IF NOT EXISTS moderation_logs (
          log_id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, post_id INT,
          content TEXT NOT NULL, content_type ENUM('post','comment','quiz') NOT NULL DEFAULT 'post',
          is_hate_speech BOOLEAN DEFAULT FALSE, confidence DECIMAL(3,2) DEFAULT 0,
          reasons JSON, detection_details JSON, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
          FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS token_blacklist (
          id INT AUTO_INCREMENT PRIMARY KEY, token_hash CHAR(64) NOT NULL,
          user_id INT NOT NULL, expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE INDEX idx_token_hash (token_hash), FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS login_attempts (
          id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL, ip_address VARCHAR(45) NOT NULL,
          user_agent VARCHAR(500), success BOOLEAN NOT NULL DEFAULT FALSE,
          attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS account_locks (
          user_id INT PRIMARY KEY, locked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          lock_reason ENUM('brute_force','suspicious_activity','manual') NOT NULL,
          unlock_at TIMESTAMP NOT NULL, FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS audit_log (
          log_id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id INT, action VARCHAR(50) NOT NULL,
          target_type VARCHAR(30), target_id INT, ip_address VARCHAR(45),
          user_agent VARCHAR(500), details JSON, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS email_change_log (
          id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, old_email VARCHAR(255) NOT NULL,
          new_email VARCHAR(255) NOT NULL, changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          ip_address VARCHAR(45), FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS rate_limit_counters (
          user_id INT NOT NULL, action_type VARCHAR(30) NOT NULL, window_start TIMESTAMP NOT NULL,
          count INT NOT NULL DEFAULT 1, PRIMARY KEY (user_id, action_type, window_start),
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )`
    ];

    for (const sql of newTables) {
      await pool.query(sql);
    }
    console.log('✅ New security tables created successfully');

    // 4. Backfill materialized counters
    try {
      console.log('Backfilling like_count and comment_count on posts table...');
      await pool.query(`
        UPDATE posts p 
        SET 
          like_count = (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id), 
          comment_count = (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id AND is_deleted = FALSE)
      `);
      console.log('✅ Materialized counters backfilled successfully');
    } catch(err) {
      console.log('✅ Note on backfilling counters: ' + err.message);
    }

    console.log('Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}
migrate();
