const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1); // Trust Nginx/Cloudflare for rate limiting

const server = http.createServer(app);
server.timeout = 1800000; // 30 minutes for huge video uploads
server.keepAliveTimeout = 1800000;
server.headersTimeout = 1800000;
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
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
app.use(helmet());
app.use(compression());
app.use(cookieParser());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Rate Limiting ───────────────────────────────────────────────────────────
const { authLimiter, apiLimiter } = require('./middleware/rateLimit');
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

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

app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
