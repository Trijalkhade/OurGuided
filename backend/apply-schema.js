const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const sql = fs.readFileSync('schema.sql', 'utf8');
  
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'your_db_password_here',
    database: process.env.DB_NAME || 'DBMS',
    multipleStatements: true
  });
  
  try {
    const [result] = await pool.query(sql);
    console.log('✅ Schema applied successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error applying schema:', err.message);
    process.exit(1);
  }
}
main();
