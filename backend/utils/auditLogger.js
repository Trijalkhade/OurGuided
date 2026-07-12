const db = require('../db');

/**
 * AUDIT LOGGER
 * ────────────
 * Centralized audit trail for all security-sensitive operations.
 * Writes to the `audit_log` table for forensic analysis.
 * 
 * Usage:
 *   const { logAudit } = require('../utils/auditLogger');
 *   await logAudit(userId, 'login', { target_type: 'user', ip: req.ip, userAgent: req.headers['user-agent'] });
 */

const { LRUCache } = require('lru-cache');
const blacklistCache = new LRUCache({ max: 50000, ttl: 7 * 24 * 60 * 60 * 1000 });

// Load initially and every hour
async function loadBlacklist() {
  try {
    const [rows] = await db.execute('SELECT token_hash FROM token_blacklist WHERE expires_at > NOW()');
    rows.forEach(r => blacklistCache.set(r.token_hash, true));
  } catch (err) {
    console.error('[AUDIT] Failed to load token blacklist:', err.message);
  }
}
loadBlacklist();
setInterval(loadBlacklist, 3600000); // 1 hour

/**
 * Log a security-sensitive action to the audit trail.
 * Fire-and-forget — never throws, never blocks the caller.
 * 
 * @param {number|null} userId - The user performing the action (null for anonymous/system)
 * @param {string} action - Action name: 'login', 'login_failed', 'password_change', 'account_delete', 'role_change', 'post_delete', 'logout', 'token_blacklist'
 * @param {object} opts - Optional details
 * @param {string} [opts.target_type] - 'user', 'post', 'quiz', 'comment'
 * @param {number} [opts.target_id] - ID of the target entity
 * @param {string} [opts.ip] - IP address
 * @param {string} [opts.userAgent] - User-Agent header
 * @param {object} [opts.details] - Additional JSON details
 */
async function logAudit(userId, action, opts = {}) {
  try {
    await db.execute(
      `INSERT INTO audit_log (user_id, action, target_type, target_id, ip_address, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        action,
        opts.target_type || null,
        opts.target_id || null,
        opts.ip || null,
        opts.userAgent ? opts.userAgent.substring(0, 500) : null,
        opts.details ? JSON.stringify(opts.details) : null,
      ]
    );
  } catch (err) {
    // Never throw — audit failures should not break business logic
    console.error('[AUDIT] Failed to log:', action, err.message);
  }
}

/**
 * Log a login attempt (success or failure) to the login_attempts table.
 * Also checks for brute-force and returns whether the account should be locked.
 * 
 * @param {string} email
 * @param {string} ip
 * @param {string} userAgent
 * @param {boolean} success
 * @returns {Promise<{shouldLock: boolean, failedCount: number}>}
 */
async function logLoginAttempt(email, ip, userAgent, success) {
  const MAX_FAILED_ATTEMPTS = 10; // Lock after 10 failures in window
  const LOCK_WINDOW_MINUTES = 30;

  try {
    await db.execute(
      `INSERT INTO login_attempts (email, ip_address, user_agent, success) VALUES (?, ?, ?, ?)`,
      [email, ip, userAgent ? userAgent.substring(0, 500) : null, success]
    );

    if (success) {
      return { shouldLock: false, failedCount: 0 };
    }

    // Count recent failed attempts for this email
    const [[{ cnt }]] = await db.execute(
      `SELECT COUNT(*) AS cnt FROM login_attempts 
       WHERE email = ? AND success = FALSE 
       AND attempted_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [email, LOCK_WINDOW_MINUTES]
    );

    return { shouldLock: cnt >= MAX_FAILED_ATTEMPTS, failedCount: cnt };
  } catch (err) {
    console.error('[AUDIT] Login attempt logging failed:', err.message);
    return { shouldLock: false, failedCount: 0 };
  }
}

/**
 * Check if an account is currently locked.
 * @param {number} userId
 * @returns {Promise<{locked: boolean, unlock_at: Date|null, reason: string|null}>}
 */
async function isAccountLocked(userId) {
  try {
    const [[lock]] = await db.execute(
      `SELECT locked_at, lock_reason, unlock_at FROM account_locks WHERE user_id = ? AND unlock_at > NOW()`,
      [userId]
    );
    if (lock) {
      return { locked: true, unlock_at: lock.unlock_at, reason: lock.lock_reason };
    }
    return { locked: false, unlock_at: null, reason: null };
  } catch (err) {
    console.error('[AUDIT] Account lock check failed:', err.message);
    return { locked: false, unlock_at: null, reason: null };
  }
}

/**
 * Lock an account after brute-force detection.
 * @param {number} userId
 * @param {string} reason - 'brute_force', 'suspicious_activity', 'manual'
 * @param {number} lockMinutes - How long to lock (default 30)
 */
async function lockAccount(userId, reason = 'brute_force', lockMinutes = 30) {
  try {
    const unlockAt = new Date(Date.now() + lockMinutes * 60 * 1000);
    await db.execute(
      `INSERT INTO account_locks (user_id, lock_reason, unlock_at) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE locked_at = NOW(), lock_reason = VALUES(lock_reason), unlock_at = VALUES(unlock_at)`,
      [userId, reason, unlockAt]
    );
    console.warn(`[SECURITY] Account ${userId} locked for ${lockMinutes}min — reason: ${reason}`);
  } catch (err) {
    console.error('[AUDIT] Account lock failed:', err.message);
  }
}

/**
 * Log an email change for forensic tracking.
 * @param {number} userId
 * @param {string} oldEmail
 * @param {string} newEmail
 * @param {string} ip
 */
async function logEmailChange(userId, oldEmail, newEmail, ip) {
  try {
    await db.execute(
      `INSERT INTO email_change_log (user_id, old_email, new_email, ip_address) VALUES (?, ?, ?, ?)`,
      [userId, oldEmail, newEmail, ip || null]
    );
  } catch (err) {
    console.error('[AUDIT] Email change logging failed:', err.message);
  }
}

/**
 * Blacklist a JWT token (e.g., on logout or password change).
 * @param {string} token - The raw JWT string
 * @param {number} userId
 */
async function blacklistToken(token, userId) {
  try {
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Decode to get expiry
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.execute(
      `INSERT IGNORE INTO token_blacklist (token_hash, user_id, expires_at) VALUES (?, ?, ?)`,
      [tokenHash, userId, expiresAt]
    );
    blacklistCache.set(tokenHash, true);
  } catch (err) {
    console.error('[AUDIT] Token blacklist failed:', err.message);
  }
}

/**
 * Check if a token has been blacklisted.
 * @param {string} token - The raw JWT string
 * @returns {Promise<boolean>}
 */
async function isTokenBlacklisted(token) {
  try {
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    if (blacklistCache.has(tokenHash)) return true;

    // Fallback to DB just in case cache missed between syncs
    const [[result]] = await db.execute(
      `SELECT id FROM token_blacklist WHERE token_hash = ? LIMIT 1`,
      [tokenHash]
    );
    if (result) {
      blacklistCache.set(tokenHash, true);
      return true;
    }
    return false;
  } catch (err) {
    console.error('[AUDIT] Token blacklist check failed:', err.message);
    return false; // Fail open — don't block requests if blacklist check fails
  }
}

/**
 * Check and increment a database rate limit counter for a specific user and action.
 * @param {number} userId 
 * @param {string} actionType 
 * @param {number} windowMinutes 
 * @param {number} maxAttempts 
 * @returns {Promise<boolean>} True if allowed, False if rate limited
 */
async function checkRateLimit(userId, actionType, windowMinutes, maxAttempts) {
  try {
    const windowStart = new Date(Math.floor(Date.now() / (windowMinutes * 60000)) * (windowMinutes * 60000));
    const query = `
      INSERT INTO rate_limit_counters (user_id, action_type, window_start, count) 
      VALUES (?, ?, ?, 1) 
      ON DUPLICATE KEY UPDATE count = count + 1
    `;
    await db.execute(query, [userId, actionType, windowStart]);

    const [[{ count }]] = await db.execute(
      `SELECT count FROM rate_limit_counters WHERE user_id = ? AND action_type = ? AND window_start = ?`,
      [userId, actionType, windowStart]
    );

    return count <= maxAttempts;
  } catch (err) {
    console.error('[RATE LIMIT] DB error:', err.message);
    return true; // Fail open so we don't break the app if the DB is under load
  }
}

module.exports = {
  logAudit,
  logLoginAttempt,
  isAccountLocked,
  lockAccount,
  logEmailChange,
  blacklistToken,
  isTokenBlacklisted,
  checkRateLimit,
};
