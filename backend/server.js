const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

process.on('uncaughtException',   (err)           => console.error('UNCAUGHT EXCEPTION:', err?.stack || err));
process.on('unhandledRejection',  (reason, promise) => console.error('UNHANDLED REJECTION:', reason));

app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/posts',       require('./routes/posts'));
app.use('/api/connections', require('./routes/connections'));
app.use('/api/study',       require('./routes/study'));
app.use('/api/quizzes',     require('./routes/quizzes'));
app.use('/api/categories',  require('./routes/categories'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/playlists',   require('./routes/playlists'));
app.use('/api/recommendations', require('./routes/recommendations'));

app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
