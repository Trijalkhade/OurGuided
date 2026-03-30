const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  const { username, email, password, first_name, last_name, dob } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await conn.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashed]
    );
    const userId = result.insertId;

    // Create user_info
    await conn.execute(
      'INSERT INTO user_info (user_id, first_name, last_name) VALUES (?, ?, ?)',
      [userId, first_name || '', last_name || '']
    );

    // Create user_profile — use provided dob or safe default
    const safeDob = dob || '2000-01-01';
    await conn.execute(
      'INSERT INTO user_profile (user_id, dob) VALUES (?, ?)',
      [userId, safeDob]
    );

    await conn.commit();

    const token = jwt.sign({ user_id: userId, username }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '7d' });
    res.status(201).json({ token, user_id: userId, username, email });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Username or email already exists', error: err.message });
    }
    console.error(err);
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ message: 'Invalid credentials' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { user_id: user.user_id, username: user.username },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '7d' }
    );

    res.json({ token, user_id: user.user_id, username: user.username, email: user.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get current user (validate token)
router.get('/me', auth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT user_id, username, email FROM users WHERE user_id = ?', [req.user.user_id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;