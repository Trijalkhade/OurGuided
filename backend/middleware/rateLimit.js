const rateLimit = require('express-rate-limit');

// CHECK 11: Removed LOAD_TEST_IP bypass — use separate environment for load tests

// Auth endpoints — strict: 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { message: 'Too many attempts. Please try again after 15 minutes.' },
});

// Password reset — 5 requests per hour per IP (CHECK 16)
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { message: 'Too many password reset attempts. Please try again later.' },
});

// General API — 100 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { message: 'Too many requests. Please slow down.' },
});

const { checkRateLimit } = require('../utils/auditLogger');

// Unified Action Shield — 5 total create/update actions per 15 minutes per USER
const globalActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?.user_id || req.ip,
  validate: false,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Wait! You are doing too much in a short time. Quality is better than quantity.' },
});

// DB-backed rate limiter for distributed/persistent limits
const dbRateLimiter = (actionType, windowMinutes = 15, maxAttempts = 5) => async (req, res, next) => {
  if (!req.user || !req.user.user_id) return next();
  const allowed = await checkRateLimit(req.user.user_id, actionType, windowMinutes, maxAttempts);
  if (!allowed) {
    return res.status(429).json({ message: 'Wait! You are doing too much in a short time. Quality is better than quantity.' });
  }
  next();
};

module.exports = { authLimiter, apiLimiter, globalActionLimiter, dbRateLimiter, resetLimiter };
