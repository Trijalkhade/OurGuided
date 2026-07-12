const db = require('./db');
const bcrypt = require('bcrypt');
const fs = require('fs');
const crypto = require('crypto');

async function run() {
  const hash = await bcrypt.hash('Password123!', 10);
  let csvContent = "email,password\n";
  let valuesUsers = [];
  
  for(let i=1; i<=2000; i++) {
    const num = String(i).padStart(4, '0');
    const email = `loadtest${num}@test.com`;
    const username = `loadtest${num}`;
    const password = 'Password123!';
    csvContent += `${email},${password}\n`;
    
    valuesUsers.push([username, email, hash, crypto.randomUUID(), '127.0.0.1', 'loadtest_device']);
  }
  
  fs.writeFileSync('users.csv', csvContent);
  console.log("users.csv created with 2000 users");
  
  try {
      const conn = await db.getConnection();
      console.log("Inserting users...");
      await conn.query('INSERT IGNORE INTO users (username, email, password, public_id, registration_ip, registration_device_id) VALUES ?', [valuesUsers]);
      
      const [rows] = await conn.query('SELECT user_id FROM users WHERE username LIKE "loadtest%"');
      let uids = rows.map(r => r.user_id);
      
      if (uids.length > 0) {
          let infoData = uids.map(id => [id, 'Load', 'Test']);
          let profileData = uids.map(id => [id, '2000-01-01']);
          
          await conn.query('INSERT IGNORE INTO user_info (user_id, first_name, last_name) VALUES ?', [infoData]);
          await conn.query('INSERT IGNORE INTO user_profile (user_id, dob) VALUES ?', [profileData]);
      }
      
      console.log("Test users created in database successfully!");
      conn.release();
  } catch (err) {
      console.error("DB Error:", err);
  }
  process.exit();
}

run();
