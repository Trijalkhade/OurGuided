const jwt = require('jsonwebtoken');
const { isTokenBlacklisted } = require('../utils/auditLogger');

const authMiddleware = async (req, res, next) => {
  // Prefer HttpOnly cookie, fall back to Authorization header
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');

    // Check if token has been blacklisted (logout, password change, etc.)
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