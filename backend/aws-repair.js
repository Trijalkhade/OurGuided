const db = require('./db');
require('dotenv').config();

async function repair() {
  console.log('--- OurGuided AWS Repair Utility ---');
  
  // 1. Check Environment
  const requiredEnv = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET', 'AWS_REGION'];
  const missing = requiredEnv.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error('❌ ERROR: Missing S3 keys in .env:', missing.join(', '));
    console.log('👉 ACTION: Open your .env file on AWS and add these keys!');
  } else {
    console.log('✅ Environment keys found.');
  }

  // 2. Fix Database Columns
  try {
    const [cols] = await db.execute('DESC posts');
    const hasImageUrl = cols.some(c => c.Field === 'image_url');
    
    if (!hasImageUrl) {
      console.log('⌛ Adding image_url columns to database...');
      await db.execute('ALTER TABLE user_info ADD COLUMN photo_url VARCHAR(500) AFTER photo');
      await db.execute('ALTER TABLE posts ADD COLUMN image_url VARCHAR(500) AFTER small_img');
      await db.execute('ALTER TABLE post_images ADD COLUMN image_url VARCHAR(500) AFTER image');
      console.log('✅ Columns added successfully.');
    } else {
      console.log('✅ Database columns already exist.');
    }
  } catch (e) {
    console.error('❌ Database error:', e.message);
  }

  // 3. Fix Password Resets Table
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        pin_hash CHAR(60) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Password resets table is ready.');
  } catch (e) {
    console.error('❌ Table error:', e.message);
  }

  console.log('------------------------------------');
  console.log('Repair finished. If no ❌ errors appeared, your server is ready.');
  process.exit(0);
}

repair();
