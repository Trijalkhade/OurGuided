const db = require('../db');

/**
 * ADMIN AUTH MIDDLEWARE
 * ─────────────────────
 * Verifies the authenticated user has 'admin' or 'moderator' role.
 * Must be used AFTER the auth middleware (req.user must exist).
 * 
 * Usage:
 *   router.get('/admin-only', auth, requireAdmin, handler);
 *   router.get('/mod-or-admin', auth, requireModerator, handler);
 */

/**
 * Requires the user to have the 'admin' role.
 */
async function requireAdmin(req, res, next) {
  try {
    const [[user]] = await db.execute(
      'SELECT role FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    req.user.role = user.role;
    next();
  } catch (err) {
    console.error('[ADMIN AUTH] Role check failed:', err.message);
    return res.status(500).json({ message: 'Authorization check failed' });
  }
}

/**
 * Requires the user to have 'admin' or 'moderator' role.
 */
async function requireModerator(req, res, next) {
  try {
    const [[user]] = await db.execute(
      'SELECT role FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({ message: 'Moderator or admin access required' });
    }
    req.user.role = user.role;
    next();
  } catch (err) {
    console.error('[ADMIN AUTH] Role check failed:', err.message);
    return res.status(500).json({ message: 'Authorization check failed' });
  }
}

module.exports = { requireAdmin, requireModerator };
