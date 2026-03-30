const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    console.log('✅ Database connected successfully!');
    await conn.end();
  } catch (err) {
    console.error('❌ DB Error:', err.message);
  }
}
test();