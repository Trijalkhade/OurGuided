import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const LandingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ posts: 0, users: 0, quizzes: 0 });

  // Redirect logged-in users to feed
  useEffect(() => {
    if (user) navigate('/feed', { replace: true });
  }, [user, navigate]);

  // Fetch public stats
  useEffect(() => {
    axios.get('/api/posts/public/stats')
      .then(res => setStats(res.data))
      .catch(() => { /* use defaults */ });
  }, []);

  const scrollToFeed = () => {
    const el = document.getElementById('live-feed');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ overflowX: 'hidden' }}>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-orb landing-orb-1" />
        <div className="landing-orb landing-orb-2" />
        <div className="landing-orb landing-orb-3" />

        <div className="hero-badge">
          <span className="hero-badge-dot" />
          {stats.users > 0 ? `${stats.users}+ people are already here` : 'A new kind of platform'}
        </div>

        <h1 className="hero-title">
          Your feed should<br />
          <span className="highlight">make you smarter</span>,<br />
          not dumber.
        </h1>

        <p className="hero-subtitle">
          Meet professionals, question the system, and consume posts that pack real knowledge
          into every scroll — not reels and selfies. Stop watching tutorials. Start building.
        </p>

        <div className="hero-ctas">
          <button className="hero-btn-primary" onClick={scrollToFeed}>
            See what people are talking about →
          </button>
          <button className="hero-btn-secondary" onClick={() => navigate('/register')}>
            Join Now — it's free
          </button>
        </div>
      </section>

      {/* ── Interactive Bubbles ───────────────────────────── */}
      <FeatureBubbles />

      {/* ── Stats ────────────────────────────────────────── */}
      <section className="landing-stats">
        <div className="stat-item">
          <div className="stat-number">{stats.posts || '—'}+</div>
          <div className="stat-label">Knowledge Posts</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.users || '—'}+</div>
          <div className="stat-label">Active Minds</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.quizzes || '—'}+</div>
          <div className="stat-label">Community Quizzes</div>
        </div>
      </section>

      {/* ── Rewards CTA ──────────────────────────────────── */}
      <section className="landing-rewards">
        <h2 className="landing-rewards-title">
          🏆 Top voices win real rewards
        </h2>
        <p className="landing-rewards-sub">
          The best contributors on OurGuided don't just earn respect — they win
          actual prizes. Climb the leaderboard, share quality content, and unlock:
        </p>
        <div className="rewards-badges">
          <span className="reward-badge">💰 Cash Prizes</span>
          <span className="reward-badge">🎧 Earbuds</span>
          <span className="reward-badge">📱 iPhones</span>
          <span className="reward-badge">🎁 And more</span>
        </div>
        <button
          className="hero-btn-primary"
          onClick={() => navigate('/register')}
          style={{ display: 'inline-flex' }}
        >
          Start earning now →
        </button>
      </section>

      {/* ── Live Feed Preview ────────────────────────────── */}
      <section className="landing-feed-section" id="live-feed">
        <h2 className="landing-feed-title">
          See what's trending right now
        </h2>
        <p className="landing-feed-sub">
          Real posts from real people — no login required to browse
        </p>

        <div className="landing-feed-list">
          <PublicFeedPreview />
        </div>

        <div className="landing-feed-fade">
          <p>Want to see more? Join the conversation.</p>
          <button className="hero-btn-primary" onClick={() => navigate('/browse')}>
            Browse Full Feed →
          </button>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className="landing-cta">
        <h2 className="landing-cta-title">
          Stop scrolling.<br />
          <span style={{ background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Start learning.
          </span>
        </h2>
        <p className="landing-cta-sub">
          Join a community where every post makes you smarter. No algorithms, no brainrot, no bs.
        </p>
        <div className="landing-cta-buttons">
          <button className="hero-btn-primary" onClick={() => navigate('/register')}>
            Create Free Account
          </button>
          <button className="hero-btn-secondary" onClick={() => navigate('/login')}>
            I already have an account
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        © {new Date().getFullYear()} OurGuided. All rights reserved.
      </footer>
    </div>
  );
};


/* ── Interactive Feature Bubbles ──────────────────────────────── */
const BUBBLE_DATA = [
  { emoji: '💰', text: 'Win real cash & prizes', color: 'rgba(245, 158, 11, 0.25)', border: 'rgba(245, 158, 11, 0.5)' },
  { emoji: '🧠', text: 'Actually learn something', color: 'rgba(124, 58, 237, 0.25)', border: 'rgba(124, 58, 237, 0.5)' },
  { emoji: '🚫', text: 'No doomscrolling', color: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.45)' },
  { emoji: '💬', text: 'Real opinions only', color: 'rgba(59, 91, 250, 0.25)', border: 'rgba(59, 91, 250, 0.5)' },
  { emoji: '🏆', text: 'Leaderboard → iPhones', color: 'rgba(16, 185, 129, 0.25)', border: 'rgba(16, 185, 129, 0.5)' },
  { emoji: '🔥', text: 'NEET paper leaked?', color: 'rgba(251, 146, 60, 0.25)', border: 'rgba(251, 146, 60, 0.5)' },
  { emoji: '⚡', text: 'Build, don\'t watch', color: 'rgba(6, 182, 212, 0.25)', border: 'rgba(6, 182, 212, 0.5)' },
  { emoji: '🎯', text: 'Knowledge > Clout', color: 'rgba(168, 85, 247, 0.25)', border: 'rgba(168, 85, 247, 0.5)' },
  { emoji: '🛡️', text: 'Zero algorithm bs', color: 'rgba(99, 102, 241, 0.2)', border: 'rgba(99, 102, 241, 0.45)' },
  { emoji: '🧪', text: 'Quiz battles', color: 'rgba(236, 72, 153, 0.25)', border: 'rgba(236, 72, 153, 0.5)' },
  { emoji: '👥', text: 'Meet real pros', color: 'rgba(34, 211, 238, 0.2)', border: 'rgba(34, 211, 238, 0.45)' },
  { emoji: '📈', text: 'Your feed = growth', color: 'rgba(74, 222, 128, 0.2)', border: 'rgba(74, 222, 128, 0.45)' },
  { emoji: '🎧', text: 'Win earbuds too', color: 'rgba(192, 132, 252, 0.25)', border: 'rgba(192, 132, 252, 0.5)' },
  { emoji: '🗣️', text: 'Question everything', color: 'rgba(251, 191, 36, 0.2)', border: 'rgba(251, 191, 36, 0.45)' },
];

const FeatureBubbles = () => {
  const containerRef = React.useRef(null);
  const bubblesRef = React.useRef([]);
  const mouseRef = React.useRef({ x: -9999, y: -9999 });
  const rafRef = React.useRef(null);
  const [ripples, setRipples] = React.useState([]);

  // Initialize bubble physics state
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Initialize bubbles with random positions & velocities
    bubblesRef.current = BUBBLE_DATA.map((_, i) => ({
      x: 60 + Math.random() * (w - 120),
      y: 40 + Math.random() * (h - 80),
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      width: 0, height: 0, // measured after mount
    }));

    // Measure bubble elements
    const els = container.querySelectorAll('.bubble-item');
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      bubblesRef.current[i].width = r.width;
      bubblesRef.current[i].height = r.height;
    });

    // Physics loop
    const tick = () => {
      const cRect = container.getBoundingClientRect();
      const cw = cRect.width;
      const ch = cRect.height;
      const mx = mouseRef.current.x - cRect.left;
      const my = mouseRef.current.y - cRect.top;
      const els = container.querySelectorAll('.bubble-item');

      bubblesRef.current.forEach((b, i) => {
        // Mouse repulsion
        const dx = b.x + b.width / 2 - mx;
        const dy = b.y + b.height / 2 - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const repelRadius = 150;

        if (dist < repelRadius && dist > 1) {
          const force = (repelRadius - dist) / repelRadius * 2.5;
          b.vx += (dx / dist) * force;
          b.vy += (dy / dist) * force;
        }

        // Bubble-bubble collision (soft repulsion)
        bubblesRef.current.forEach((other, j) => {
          if (i === j) return;
          const ox = (b.x + b.width / 2) - (other.x + other.width / 2);
          const oy = (b.y + b.height / 2) - (other.y + other.height / 2);
          const od = Math.sqrt(ox * ox + oy * oy);
          const minDist = (b.width + other.width) / 2 * 0.85;
          if (od < minDist && od > 1) {
            const push = (minDist - od) / minDist * 0.4;
            b.vx += (ox / od) * push;
            b.vy += (oy / od) * push;
          }
        });

        // Drift
        b.x += b.vx;
        b.y += b.vy;

        // Friction
        b.vx *= 0.97;
        b.vy *= 0.97;

        // Gentle random nudge
        b.vx += (Math.random() - 0.5) * 0.06;
        b.vy += (Math.random() - 0.5) * 0.06;

        // Boundary bounce
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) * 0.5; }
        if (b.x + b.width > cw) { b.x = cw - b.width; b.vx = -Math.abs(b.vx) * 0.5; }
        if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) * 0.5; }
        if (b.y + b.height > ch) { b.y = ch - b.height; b.vy = -Math.abs(b.vy) * 0.5; }

        // Apply transform
        if (els[i]) {
          els[i].style.transform = `translate(${b.x}px, ${b.y}px)`;
        }
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // Track mouse
  const handleMouseMove = (e) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseLeave = () => {
    mouseRef.current = { x: -9999, y: -9999 };
  };

  // Click ripple
  const handleClick = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const id = Date.now();
    setRipples(prev => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 800);

    // Push all bubbles away from click point
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    bubblesRef.current.forEach(b => {
      const dx = (b.x + b.width / 2) - cx;
      const dy = (b.y + b.height / 2) - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 250 && dist > 1) {
        const force = (250 - dist) / 250 * 6;
        b.vx += (dx / dist) * force;
        b.vy += (dy / dist) * force;
      }
    });
  };

  return (
    <section
      className="bubble-section"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Ripple effects */}
      {ripples.map(r => (
        <span key={r.id} className="bubble-ripple" style={{ left: r.x, top: r.y }} />
      ))}

      {BUBBLE_DATA.map((b, i) => (
        <div
          key={i}
          className="bubble-item"
          style={{
            background: b.color,
            borderColor: b.border,
          }}
        >
          <span className="bubble-emoji">{b.emoji}</span>
          <span className="bubble-text">{b.text}</span>
        </div>
      ))}
    </section>
  );
};


/* ── Inline Public Feed Preview ──────────────────────────────── */
const PublicFeedPreview = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/posts/public')
      .then(res => setPosts(res.data.slice(0, 5)))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />
        ))}
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '3rem 0' }}>
        No posts yet — be the first to create one!
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {posts.map(post => (
        <PreviewCard key={post.post_id} post={post} />
      ))}
    </div>
  );
};

/* ── Minimal Preview Card ────────────────────────────────────── */
const PreviewCard = ({ post }) => {
  const displayName = post.is_anonymous
    ? 'Anonymous'
    : post.first_name
      ? `${post.first_name} ${post.last_name || ''}`.trim()
      : (post.username || 'Unknown');

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '1.25rem 1.5rem',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
        }}>
          {post.is_anonymous ? '?' : (displayName[0] || '?').toUpperCase()}
        </div>
        <div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.88rem' }}>{displayName}</div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem' }}>
            {post.category || 'Post'}
          </div>
        </div>
      </div>
      {post.content && (
        <div style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: '0.88rem',
          lineHeight: 1.6,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {post.content}
        </div>
      )}
      <div style={{
        display: 'flex', gap: '1.2rem', marginTop: '0.75rem',
        color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem',
      }}>
        <span>❤️ {post.like_count || 0}</span>
        <span>💬 {post.comment_count || 0}</span>
        {post.tags && <span>🏷️ {post.tags.split(',')[0]}</span>}
      </div>
    </div>
  );
};

export default LandingPage;
