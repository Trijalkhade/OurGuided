require('dotenv').config();
const db = require('./db');

async function runMigration() {
  console.log('🚀 Starting Engagement Tables Migration...');
  
  try {
    // 1. Watch Time
    await db.query(`CREATE TABLE IF NOT EXISTS post_watch_time (
      user_id INT NOT NULL, post_id INT NOT NULL, seconds INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
    )`);
    await db.query('CREATE INDEX idx_watch_time_post ON post_watch_time(post_id)').catch(()=>{});
    console.log('✅ post_watch_time');

    // 2. Impressions
    await db.query(`CREATE TABLE IF NOT EXISTS post_impressions (
      user_id INT NOT NULL, post_id INT NOT NULL,
      impression_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      device_type ENUM('mobile','desktop','tablet') DEFAULT 'desktop',
      time_bucket ENUM('morning','afternoon','evening','night') DEFAULT 'morning',
      PRIMARY KEY (user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
    )`);
    await db.query('CREATE INDEX idx_impressions_post ON post_impressions(post_id)').catch(()=>{});
    console.log('✅ post_impressions');

    // 3. Scroll Depth
    await db.query(`CREATE TABLE IF NOT EXISTS post_scroll_depth (
      user_id INT NOT NULL, post_id INT NOT NULL,
      depth_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
    )`);
    console.log('✅ post_scroll_depth');

    // 4. Video Completion
    await db.query(`CREATE TABLE IF NOT EXISTS post_video_completion (
      user_id INT NOT NULL, post_id INT NOT NULL,
      completion_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
    )`);
    console.log('✅ post_video_completion');

    // 5. Shares
    await db.query(`CREATE TABLE IF NOT EXISTS post_shares (
      share_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL, post_id INT NOT NULL,
      method ENUM('copy_link','web_share','other') DEFAULT 'copy_link',
      shared_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
    )`);
    await db.query('CREATE INDEX idx_shares_user_post ON post_shares(user_id, post_id)').catch(()=>{});
    console.log('✅ post_shares');

    // 6. Profile Clicks
    await db.query(`CREATE TABLE IF NOT EXISTS post_profile_clicks (
      user_id INT NOT NULL, post_id INT NOT NULL, author_id INT NOT NULL,
      clicked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(user_id) ON DELETE CASCADE
    )`);
    console.log('✅ post_profile_clicks');

    // 7. Reports
    await db.query(`CREATE TABLE IF NOT EXISTS post_reports (
      report_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL, post_id INT NOT NULL,
      reason ENUM('spam','offensive','misleading','not_interested','other') DEFAULT 'not_interested',
      is_hidden BOOLEAN DEFAULT TRUE,
      reported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_report_user_post (user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
    )`);
    console.log('✅ post_reports');

    // 8. Repeat Views
    await db.query(`CREATE TABLE IF NOT EXISTS post_repeat_views (
      user_id INT NOT NULL, post_id INT NOT NULL,
      view_count INT NOT NULL DEFAULT 1,
      first_view TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_view TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
    )`);
    console.log('✅ post_repeat_views');

    console.log('\n🎉 All 8 engagement tables created successfully!');
    process.exit(0);
  } catch(e) {
    console.error('❌ MIGRATION FAILED:', e.message);
    process.exit(1);
  }
}

runMigration();
