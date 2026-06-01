import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthGate } from '../context/AuthGateContext';
import { useAuth, API } from '../context/AuthContext';
import toast from 'react-hot-toast';

/* ── Random Name Generator ───────────────────────────────────── */
const FIRST_NAMES = [
  'Arjun', 'Priya', 'Rohan', 'Ananya', 'Vikram', 'Sneha', 'Karan', 'Meera',
  'Dev', 'Ishita', 'Aditya', 'Kavya', 'Rahul', 'Neha', 'Akash', 'Riya',
  'Siddharth', 'Pooja', 'Nikhil', 'Divya', 'Harsh', 'Tanya', 'Amit', 'Simran',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Kumar', 'Singh', 'Verma', 'Gupta', 'Reddy', 'Nair',
  'Joshi', 'Rao', 'Das', 'Mehta', 'Shah', 'Khan', 'Mishra', 'Iyer',
  'Kulkarni', 'Desai', 'Pillai', 'Chopra', 'Bhat', 'Menon', 'Thakur', 'Saxena',
];

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateUsername(first, last) {
  const num = Math.floor(100 + Math.random() * 900);
  return `${first.toLowerCase()}${last.toLowerCase().charAt(0)}${num}`;
}

/* ── Top 3 most popular category IDs ─────────────────────────── */
// We'll fetch from /api/categories/public and pick top 3 by post_count
// Fallback: IDs 1, 4, 5 (Real Talk, Life Hacks, Youth & Education)
const FALLBACK_INTERESTS = [1, 4, 5];

const AuthGateModal = () => {
  const { isOpen, actionLabel, closeGate } = useAuthGate();
  const { register } = useAuth();
  const navigate = useNavigate();
  const modalRef = useRef(null);

  const [mode, setMode] = useState('signup'); // 'signup' | 'login'
  const [loading, setLoading] = useState(false);
  const [generatedFirstName, setGeneratedFirstName] = useState('');
  const [generatedLastName, setGeneratedLastName] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [topInterests, setTopInterests] = useState(FALLBACK_INTERESTS);

  const [form, setForm] = useState({
    email: '',
    password: '',
    dob: '',
  });

  // Generate random identity on open
  useEffect(() => {
    if (isOpen) {
      const fn = randomPick(FIRST_NAMES);
      const ln = randomPick(LAST_NAMES);
      setGeneratedFirstName(fn);
      setGeneratedLastName(ln);
      setGeneratedUsername(generateUsername(fn, ln));
      setMode('signup');
      setForm({ email: '', password: '', dob: '' });

      // Fetch top 3 categories by post count
      API.get('/categories/public')
        .then(res => {
          const sorted = [...res.data].sort((a, b) => (b.post_count || 0) - (a.post_count || 0));
          const top3 = sorted.slice(0, 3).map(c => c.category_id);
          if (top3.length > 0) setTopInterests(top3);
        })
        .catch(() => { /* use fallback */ });
    }
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') closeGate(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, closeGate]);

  if (!isOpen) return null;

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.dob) {
      return toast.error('Please fill in all fields');
    }
    if (form.password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setLoading(true);
    try {
      await register({
        username: generatedUsername,
        email: form.email,
        password: form.password,
        first_name: generatedFirstName,
        last_name: generatedLastName,
        dob: form.dob,
      });
      // Save top interests
      if (topInterests.length > 0) {
        try { await API.post('/categories/interests', { category_ids: topInterests }); } catch { }
      }
      toast.success('Welcome to OurGuided! 🎉');
      closeGate();
      navigate('/feed');
    } catch (err) {
      toast.error((err.response?.data?.message) || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      return toast.error('Please fill in all fields');
    }
    setLoading(true);
    try {
      const { data } = await API.post('/auth/login', { email: form.email, password: form.password });
      localStorage.setItem('user', JSON.stringify(data));
      toast.success('Welcome back!');
      closeGate();
      window.location.reload(); // Reload to reinitialize auth state
    } catch (err) {
      toast.error((err.response?.data?.message) || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-gate-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeGate(); }}>
      <div className="auth-gate-modal" ref={modalRef}>
        <button className="auth-gate-close" onClick={closeGate} aria-label="Close">
          <img src="/close_button.png" alt="Close" />
        </button>

        <div className="auth-gate-header">
          <div className="auth-gate-logo">OurGuided</div>
          {mode === 'signup' ? (
            <p className="auth-gate-prompt">
              <strong>Sign up</strong> to {actionLabel || 'join the conversation'}
            </p>
          ) : (
            <p className="auth-gate-prompt">
              <strong>Sign in</strong> to {actionLabel || 'continue where you left off'}
            </p>
          )}
        </div>

        {mode === 'signup' ? (
          <form className="auth-gate-form" onSubmit={handleSignup}>
            {/* Show auto-generated identity */}
            <div style={{
              background: 'var(--accentbg)',
              border: '1px solid var(--accentbg2)',
              borderRadius: 'var(--r)',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.82rem',
              color: 'var(--text2)',
              lineHeight: 1.6,
            }}>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>Your profile:</span>{' '}
              {generatedFirstName} {generatedLastName} · @{generatedUsername}
              <br />
              <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                You can change your name & username anytime in settings
              </span>
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                placeholder="you@example.com"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input
                type="password"
                placeholder="Min 6 characters"
                required
                minLength={6}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Date of Birth *</label>
              <input
                type="date"
                required
                min="1945-01-01"
                max="2012-12-31"
                value={form.dob}
                onChange={e => setForm({ ...form, dob: e.target.value })}
              />
            </div>
            <div className="auth-gate-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating account…' : 'Join OurGuided →'}
              </button>
            </div>
          </form>
        ) : (
          <form className="auth-gate-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="auth-gate-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </div>
          </form>
        )}

        <div className="auth-gate-switch">
          {mode === 'signup' ? (
            <>Already have an account?<button onClick={() => setMode('login')}>Sign in</button></>
          ) : (
            <>New here?<button onClick={() => setMode('signup')}>Create account</button></>
          )}
        </div>

        <div className="auth-gate-divider">or coming soon</div>
        <div className="auth-gate-social">
          <button disabled title="Coming soon">🔵 Google</button>
          <button disabled title="Coming soon">🟣 Discord</button>
        </div>
      </div>
    </div>
  );
};

export default AuthGateModal;
