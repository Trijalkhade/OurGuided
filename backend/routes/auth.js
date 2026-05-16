const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const { sendEmail } = require('../utils/notifier');
const { createNotification } = require('./notifications');
const { getUserPublicId } = require('../utils/dbHelpers');

// Cookie options for JWT token
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

// Register
router.post('/register', async (req, res) => {
  const { username, email, password, first_name, last_name, dob, device_id } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required' });
  }

  const conn = await db.getConnection();
  try {
    // Device limit check: Max 10 accounts per device
    if (device_id) {
      const [existing] = await conn.execute(
        'SELECT COUNT(*) as count FROM users WHERE registration_device_id = ?',
        [device_id]
      );
      if (existing[0].count >= 10) {
        return res.status(403).json({ message: 'Account limit reached for this device (Max 10).' });
      }
    }

    await conn.beginTransaction();

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await conn.execute(
      'INSERT INTO users (username, email, password, registration_ip, registration_device_id) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashed, req.ip, device_id || null]
    );

    // Honeypot check: If nickname is filled, it's a bot
    if (req.body.nickname) {
      console.warn(`Bot detected: Honeypot filled by ${req.ip}`);
      await conn.rollback();
      return res.status(200).json({ token: 'bot_detected', user_id: 0, message: 'Welcome!' });
    }
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

    // Send Welcome Email
    const firstName = first_name || username;
    const welcomeBody = `Hi ${firstName},

Welcome to OurGuided! We're thrilled to have you join our community of learners and experts.

OurGuided is designed to help you track your progress, master new skills, and connect with peers who share your interests.

Here are a few things you can do to get started:
1. Complete your profile and add your interests.
2. Share an interesting post on useful survival skills.
3. Explore the feed to find quality learning content.

Learn. Guide. Grow.
The OurGuided Team`;

    // Fire and forget so we don't slow down the response
    sendEmail(email, 'Welcome to OurGuided!', welcomeBody).catch(e => console.error('Welcome email failed:', e));
    createNotification(userId, 'system', 'Welcome!', 'Welcome to OurGuided! Start your learning journey today.').catch(e => console.error('Welcome notif failed:', e));

    const token = jwt.sign({ user_id: userId, username }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '7d' });
    res.cookie('token', token, COOKIE_OPTIONS);
    // Fetch the auto-generated public_id for the new user
    const [[{ public_id: publicId }]] = await conn.execute('SELECT public_id FROM users WHERE user_id = ?', [userId]);
    res.status(201).json({ user_id: publicId, username, email });
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

    res.cookie('token', token, COOKIE_OPTIONS);
    const publicId = await getUserPublicId(user.user_id);
    res.json({ user_id: publicId, username: user.username, email: user.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get current user (validate token)
router.get('/me', auth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT public_id AS user_id, username, email FROM users WHERE user_id = ?', [req.user.user_id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Forgot Password — send 6-digit PIN via email
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const [rows] = await db.execute('SELECT user_id, username FROM users WHERE email = ?', [email]);
    // Always return success to prevent email enumeration
    if (!rows.length) return res.json({ message: 'If that email exists, a reset PIN has been sent.' });

    const user = rows[0];
    const pin = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit PIN
    const pinHash = await bcrypt.hash(pin, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Invalidate any previous unused resets for this user
    await db.execute('UPDATE password_resets SET used = TRUE WHERE user_id = ? AND used = FALSE', [user.user_id]);

    // Insert new reset
    await db.execute(
      'INSERT INTO password_resets (user_id, pin_hash, expires_at) VALUES (?, ?, ?)',
      [user.user_id, pinHash, expiresAt]
    );

    // Send email with PIN
    const emailBody = `Your OurGuided password reset PIN is:\n\n${pin}\n\nThis PIN expires in 15 minutes. If you didn't request this, ignore this email.`;
    sendEmail(email, 'OurGuided: Password Reset PIN', emailBody).catch(e => console.error('Reset email failed:', e));

    res.json({ message: 'If that email exists, a reset PIN has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

// Reset Password — verify PIN and update password
router.post('/reset-password', async (req, res) => {
  const { email, pin, newPassword } = req.body;
  if (!email || !pin || !newPassword) {
    return res.status(400).json({ message: 'Email, PIN, and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    const [users] = await db.execute('SELECT user_id FROM users WHERE email = ?', [email]);
    if (!users.length) return res.status(400).json({ message: 'Invalid email or PIN' });

    const userId = users[0].user_id;

    // Find valid (unused, non-expired) reset
    const [resets] = await db.execute(
      'SELECT id, pin_hash FROM password_resets WHERE user_id = ? AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    if (!resets.length) return res.status(400).json({ message: 'PIN expired or invalid. Request a new one.' });

    const validPin = await bcrypt.compare(pin, resets[0].pin_hash);
    if (!validPin) return res.status(400).json({ message: 'Invalid PIN' });

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password = ? WHERE user_id = ?', [hashedPassword, userId]);

    // Mark reset as used
    await db.execute('UPDATE password_resets SET used = TRUE WHERE id = ?', [resets[0].id]);

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

// Logout — clear the HttpOnly cookie
router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ message: 'Logged out' });
});

module.exports = router;