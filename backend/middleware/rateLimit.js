const rateLimit = require('express-rate-limit');

// Helper to check if the request comes from the load test IP
const skipLoadTestIP = (req) => {
  return process.env.LOAD_TEST_IP && req.ip && req.ip.includes(process.env.LOAD_TEST_IP);
};

// Auth endpoints — strict: 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: skipLoadTestIP,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { message: 'Too many attempts. Please try again after 15 minutes.' },
});

// General API — 100 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  skip: skipLoadTestIP,
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
  skip: skipLoadTestIP,
  keyGenerator: (req) => req.user?.user_id || req.ip,
  validate: false,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Wait! You are doing too much in a short time. Quality is better than quantity.' },
});

// DB-backed rate limiter for distributed/persistent limits
const dbRateLimiter = (actionType, windowMinutes = 15, maxAttempts = 5) => async (req, res, next) => {
  if (skipLoadTestIP(req)) return next();
  if (!req.user || !req.user.user_id) return next();
  const allowed = await checkRateLimit(req.user.user_id, actionType, windowMinutes, maxAttempts);
  if (!allowed) {
    return res.status(429).json({ message: 'Wait! You are doing too much in a short time. Quality is better than quantity.' });
  }
  next();
};

module.exports = { authLimiter, apiLimiter, globalActionLimiter, dbRateLimiter };
