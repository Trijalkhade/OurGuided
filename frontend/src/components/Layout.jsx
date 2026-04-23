import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, API } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import useFeedback from '../hooks/useFeedback';
import FeedbackWidget from './FeedbackWidget';
import {
  FiHome, FiBookmark, FiUser, FiLogOut, FiSearch,
  FiUsers, FiBell, FiCompass, FiList, FiClock, FiMoon, FiSun
} from 'react-icons/fi';
import { RiQuestionLine } from 'react-icons/ri';

/*
 * Layout
 * ──────
 * Sidebar is position:fixed + flex-column.
 * .sidebar-scroll  → nav links (scrollable if many)
 * .sidebar-footer  → user info + logout (ALWAYS visible, never scrolls away)
 */
const Layout = () => {
  const { user, logout, socket } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { onTap } = useFeedback();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], posts: [], quizzes: [] });
  const [showResults, setShowResults] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  /* Fetch initial unread count, then use socket for real-time updates */
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { data } = await API.get('/notifications/unread-count');
        setUnreadCount(data.count || 0);
      } catch { }
    };
    fetchCount();
  }, []);

  /* Socket-driven real-time notification updates */
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setUnreadCount(prev => prev + 1);
    };
    socket.on('new_notification', handler);
    return () => socket.off('new_notification', handler);
  }, [socket]);

  /* Debounced unified search */
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        try {
          const { data } = await API.get(`/search?q=${encodeURIComponent(searchQuery)}`);
          setSearchResults({
            users: (data.users || []).slice(0, 4),
            posts: (data.posts || []).slice(0, 4),
            quizzes: (data.quizzes || []).slice(0, 3),
          });
          setShowResults(true);
        } catch { }
      } else {
        setShowResults(false);
        setSearchResults({ users: [], posts: [], quizzes: [] });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /* Close search on outside click */
  useEffect(() => {
    const handle = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target))
        setShowResults(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const clearSearch = () => { setSearchQuery(''); setShowResults(false); };
  const hasResults = searchResults.users.length || searchResults.posts.length || searchResults.quizzes.length;
  const initials = user && user.username && user.username[0] ? user.username[0].toUpperCase() : '?';

  const navClass = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`;

  return (
    <div className="layout">

      {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
      <div className="sidebar">

        {/* scrollable nav area */}
        <div className="sidebar-scroll">
          <div className="sidebar-logo">
            <span style={{ fontWeight: 'bold', fontSize: '1.3rem', color: 'var(--text)' }}>OurGuided</span>
          </div>

          <div className="nav-group-label">Main</div>
          <NavLink to="/feed" onClick={() => onTap()} className={navClass}><FiHome size={16} /> Feed</NavLink>
          <NavLink to="/explore" onClick={() => onTap()} className={navClass}><FiCompass size={16} /> Explore</NavLink>
          <NavLink to="/quizzes" onClick={() => onTap()} className={navClass}><RiQuestionLine size={16} /> Quizzes</NavLink>
          <NavLink to="/connections" onClick={() => onTap()} className={navClass}><FiUsers size={16} /> Connections</NavLink>

          <div className="nav-group-label" style={{ marginTop: '0.5rem' }}>You</div>
          <NavLink to={`/profile/${user && user.user_id}`} onClick={() => onTap()} className={navClass}><FiUser size={16} /> Profile</NavLink>
          <NavLink to="/watchlist" onClick={() => onTap()} className={navClass}><FiBookmark size={16} /> Watchlist</NavLink>
          <NavLink to="/playlists" onClick={() => onTap()} className={navClass}><FiList size={16} /> Playlists</NavLink>
          <NavLink to="/study" onClick={() => onTap()} className={navClass}><FiBell size={16} style={{ opacity: 0.8 }} /> Usage</NavLink>

          <div className="nav-group-label" style={{ marginTop: '0.5rem' }}>Community</div>
          <NavLink to="/leaderboard" onClick={() => onTap()} className={navClass}>🏆 Leaderboard</NavLink>
          <NavLink to="/moderation" onClick={() => onTap()} className={navClass}>🛡️ Moderation</NavLink>
          <NavLink to="/notifications" onClick={() => onTap()} className={navClass}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <FiBell size={16} />
              {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
            </span>
            Notifications
          </NavLink>
        </div>

        {/* ── LOGOUT — always visible, never scrolls away ── */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar" style={{ width: 34, height: 34, fontSize: '0.82rem' }}>
              {user && user.photo
                ? <img src={user.photo} alt="" />
                : initials
              }
            </div>
            <div className="sidebar-user-info">
              <strong>{user && user.username}</strong>
              <span>@{user && user.username}</span>
            </div>
            <button
              className="logout-btn"
              onClick={() => { onTap(); toggleTheme(); }}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
              style={{ marginRight: '0.5rem' }}
            >
              {theme === 'dark' ? <FiSun size={17} /> : <FiMoon size={17} />}
            </button>
            <button
              className="logout-btn"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
            >
              <FiLogOut size={17} />
            </button>
          </div>
          <div className="sidebar-copyright">
            &copy; {new Date().getFullYear()} OurGuided.<br />All rights reserved.
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <div className="main-content">

        {/* Sticky top search bar */}
        <div className="search-bar" ref={searchRef}>
          <div className="search-input-wrap">
            <FiSearch size={15} />
            <input
              placeholder="Search users, posts, quizzes…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => hasResults && setShowResults(true)}
              aria-label="Search"
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={clearSearch} aria-label="Clear search">×</button>
            )}
          </div>

          {showResults && hasResults && (
            <div className="search-results">

              {searchResults.users.length > 0 && (
                <>
                  <div className="search-group-label">People</div>
                  {searchResults.users.map(u => (
                    <div key={u.user_id} className="search-result-item"
                      onClick={() => { navigate(`/profile/${u.user_id}`); clearSearch(); }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.78rem' }}>
                        {u.photo
                          ? <img src={u.photo} alt="" />
                          : ((u.first_name || u.username || '?')[0] || '?').toUpperCase()
                        }
                      </div>
                      <div>
                        <div className="name">{u.first_name} {u.last_name}</div>
                        <div className="handle">@{u.username}{u.is_expert ? ' ⭐' : ''}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {searchResults.posts.length > 0 && (
                <>
                  <div className="search-group-label">Posts</div>
                  {searchResults.posts.map(p => (
                    <div key={p.post_id} className="search-result-item"
                      onClick={() => { navigate(`/post/${p.post_id}`); clearSearch(); }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.75rem', background: 'var(--bg3)', color: 'var(--text2)' }}>📝</div>
                      <div>
                        <div className="name" style={{ fontSize: '0.85rem' }}>{p.content && p.content.slice ? p.content.slice(0, 55) : ''}{p.content && p.content.length > 55 ? '…' : ''}</div>
                        <div className="handle">{p.category || 'Post'} · by {p.username}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {searchResults.quizzes.length > 0 && (
                <>
                  <div className="search-group-label">Quizzes</div>
                  {searchResults.quizzes.map(q => (
                    <div key={q.quiz_id} className="search-result-item"
                      onClick={() => { navigate('/quizzes'); clearSearch(); }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.75rem', background: 'var(--bg3)', color: 'var(--text2)' }}>❓</div>
                      <div>
                        <div className="name" style={{ fontSize: '0.85rem' }}>{q.title}</div>
                        <div className="handle">{q.category} · {q.difficulty}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}

            </div>
          )}
        </div>

        <Outlet />
      </div>

      {/* ── MOBILE BOTTOM NAV ────────────────────────────────────────── */}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <div className="mobile-nav-inner">
          <NavLink to="/feed" onClick={() => onTap()} className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}><FiHome size={22} />Feed</NavLink>
          <NavLink to="/explore" onClick={() => onTap()} className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}><FiCompass size={22} />Explore</NavLink>
          <NavLink to="/quizzes" onClick={() => onTap()} className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}><RiQuestionLine size={22} />Quizzes</NavLink>
          <NavLink to="/connections" onClick={() => onTap()} className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}><FiUsers size={22} />Connect</NavLink>
          <NavLink to={`/profile/${user && user.user_id}`} onClick={() => onTap()} className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}><FiUser size={22} />Profile</NavLink>
          <button className="mobile-nav-item" onClick={handleLogout} aria-label="Logout"><FiLogOut size={22} />Logout</button>
        </div>
      </nav>

      {/* ── FEEDBACK WIDGET ──────────────────────────────────────────── */}
      <FeedbackWidget />

    </div>
  );
};

export default Layout;