const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const timeout = require('connect-timeout');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  const { execSync } = require('child_process');
  try {
    execSync('osascript -e \'display alert "CRITICAL ERROR: JWT_SECRET is missing in .env file. The server will now terminate." as critical\'');
  } catch (e) {
    console.error('CRITICAL ERROR: JWT_SECRET is missing in .env file.');
  }
  process.exit(1);
}

const app = express();
// CHECK 11: Set trust proxy to exact proxy count (Nginx + Cloudflare = 2)
app.set('trust proxy', 2);

const server = http.createServer(app);
// keepAlive / headers timeouts only — per-route timeout middleware handles request limits
server.keepAliveTimeout = 65000;  // slightly above Nginx's 60s
server.headersTimeout   = 70000;
const PORT = process.env.PORT || 5000;

// ── Socket.io ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', methods: ['GET', 'POST'], credentials: true }
});

io.use((socket, next) => {
  // Read token from cookie header (sent via withCredentials)
  const cookieHeader = socket.handshake.headers?.cookie || '';
  const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
  const token = tokenMatch?.[1] || socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    socket.userId = decoded.user_id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.userId}`);
  socket.on('disconnect', () => { });
});

// Export io for use in notification helpers
module.exports.io = io;

// Initialize Birthday Scheduler
const { initBirthdayScheduler } = require('./utils/birthdayScheduler');
initBirthdayScheduler();

// Initialize Moderation Service
const moderationService = require('./utils/moderationService');
moderationService.startBackgroundModeration();

process.on('uncaughtException', (err) => console.error('UNCAUGHT EXCEPTION:', err?.stack || err));
process.on('unhandledRejection', (reason, promise) => console.error('UNHANDLED REJECTION:', reason));

// ── Security & Performance Middleware ────────────────────────────────────────
// 1. CORS first — reject invalid origins immediately (preflight = 0 CPU)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// 2. Timeout — start the clock early
app.use(timeout('30s'));
app.use((req, res, next) => {
  if (!req.timedout) next();
});

// 3. Security headers — CHECK 13, 14, 20
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "*.cloudfront.net", "*.amazonaws.com"],
      connectSrc: ["'self'", "wss:", process.env.FRONTEND_URL || 'http://localhost:5173'],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    }
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Permissions-Policy header (CHECK 20)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// 4. Cookie parsing — needed for auth
app.use(cookieParser());

// 5. Body parsing — 1mb default, auth routes only need 2kb
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// CHECK 10: Removed /uploads static serving — all media is served from S3/CDN now

// ── Rate Limiting ───────────────────────────────────────────────────────────
const { authLimiter, apiLimiter, resetLimiter } = require('./middleware/rateLimit');
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', resetLimiter);
app.use('/api/auth/reset-password', resetLimiter);

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/connections', require('./routes/connections'));
app.use('/api/study', require('./routes/study'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/playlists', require('./routes/playlists'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/search', require('./routes/search'));
app.use('/api/engagement', require('./routes/engagement'));
app.use('/api/growth', require('./routes/growth'));
app.use('/api/admin', require('./routes/admin'));

const db = require('./db');
app.get('/api/health', async (req, res) => {
  try {
    await db.execute('SELECT 1');
    res.json({ status: 'OK', db: 'connected', timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', db: 'disconnected', timestamp: new Date() });
  }
});

app.use((err, req, res, next) => {
  // CHECK 8: Never leak internal error details to clients
  console.error('[ERROR]', err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
  // Force close after 10s
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
