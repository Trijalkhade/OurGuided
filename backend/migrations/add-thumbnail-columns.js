/**
 * Migration: Add thumbnail_url columns for image optimization
 * 
 * Run: node migrations/add-thumbnail-columns.js
 * 
 * Safe to run multiple times — uses IF NOT EXISTS / column check.
 */
const db = require('../db');
require('dotenv').config();

async function migrate() {
  let conn;
  try {
    conn = await db.getConnection();
    
    // Check if column already exists in posts table
    const [postsCols] = await conn.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND COLUMN_NAME = 'thumbnail_url'`
    );
    
    if (postsCols.length === 0) {
      await conn.execute('ALTER TABLE posts ADD COLUMN thumbnail_url TEXT DEFAULT NULL AFTER image_url');
      console.log('✅ Added thumbnail_url to posts table');
    } else {
      console.log('ℹ  posts.thumbnail_url already exists, skipping');
    }

    // Check if column already exists in post_images table
    const [imgCols] = await conn.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'post_images' AND COLUMN_NAME = 'thumbnail_url'`
    );
    
    if (imgCols.length === 0) {
      await conn.execute('ALTER TABLE post_images ADD COLUMN thumbnail_url TEXT DEFAULT NULL AFTER image_url');
      console.log('✅ Added thumbnail_url to post_images table');
    } else {
      console.log('ℹ  post_images.thumbnail_url already exists, skipping');
    }

    console.log('\n✅ Migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    process.exit(0);
  }
}

migrate();
