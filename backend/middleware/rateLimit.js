const rateLimit = require('express-rate-limit');

// Auth endpoints — strict: 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again after 15 minutes.' },
});

// General API — 100 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
});

// Unified Action Shield — 5 total create/update actions per 15 minutes per USER
const globalActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?.user_id || req.ip,
  validate: { default: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Wait! You are doing too much in a short time. Quality is better than quantity.' },
});

module.exports = { authLimiter, apiLimiter, globalActionLimiter };
