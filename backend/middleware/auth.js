const jwt = require('jsonwebtoken');
const { isTokenBlacklisted } = require('../utils/auditLogger');

const authMiddleware = async (req, res, next) => {
  // HttpOnly cookie only — no Authorization header fallback (CSRF protection)
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ message: 'No token provided' });

  let decoded;
  try {
    // No fallback secret — JWT_SECRET must be set (server.js enforces this on startup)
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'ourguided',
      audience: 'ourguided-app',
    });

    // Check if token has been blacklisted (logout, password change, etc.)
    // Fail-closed: if blacklist check fails, reject the request (CHECK 17)
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return res.status(401).json({ message: 'Token has been revoked. Please log in again.' });
    }
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  req.user = decoded;
  req.token = token; // Store for potential blacklisting on logout
  next();
};

module.exports = authMiddleware;