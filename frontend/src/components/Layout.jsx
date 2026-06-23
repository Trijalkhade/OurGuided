import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, API } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import useFeedback from '../utils/useFeedback';
import FeedbackWidget from './FeedbackWidget';
import GrowthRulerPanel from './GrowthRulerPanel';
const GrowthCelebrationModal = lazy(() => import('./GrowthCelebrationModal'));
import '../styles/growth.css';
import {
  FiHome, FiBookmark, FiUser, FiLogOut, FiSearch,
  FiUsers, FiBell, FiCompass, FiList, FiClock, FiMoon, FiSun,
  FiAward, FiShield, FiSettings, FiTrash2,
  FiInfo, FiLock, FiX
} from 'react-icons/fi';
import { RiQuestionLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

/*
 * Layout
 * ──────
 * Fixed top bar (logo + search + settings gear + avatar) spans full width.
 * Sidebar sits below the top bar on the left.
 * Settings gear → dropdown menu.
 * Avatar → navigates to own profile.
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
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  const handleLogout = async () => {
    setShowDropdown(false);
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
    const handler = () => {
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

  /* Close dropdown on outside click */
  useEffect(() => {
    const handle = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  /* Close dropdown on route change */
  useEffect(() => {
    setShowDropdown(false);
  }, [location.pathname]);

  const clearSearch = () => { setSearchQuery(''); setShowResults(false); };
  const hasResults = searchResults.users.length || searchResults.posts.length || searchResults.quizzes.length;

  // Use first_name initial for avatar, fallback to username
  const getInitial = () => {
    if (user?.first_name && user.first_name.length > 0) return user.first_name[0].toUpperCase();
    if (user?.username && user.username.length > 0) return user.username[0].toUpperCase();
    return '?';
  };

  const navClass = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`;

  /* Delete account handler */
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error('Please enter your password');
      return;
    }
    setDeleting(true);
    try {
      await API.delete('/users/account', { data: { password: deletePassword } });
      toast.success('Account deleted successfully');
      setShowDeleteModal(false);
      setShowDropdown(false);
      await logout();
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="layout">

      {/* ── FIXED TOP BAR — full width, immovable ────────────────────── */}
      <header className="topbar">
        {/* Left: Logo */}
        <div className="topbar-logo" onClick={() => navigate('/feed')} role="button" tabIndex={0}>
          OurGuided
        </div>

        {/* Center: Search */}
        <div className="topbar-search" ref={searchRef}>
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

        {/* Right: Settings gear + Profile avatar */}
        <div className="topbar-right">
          {/* Settings gear — opens dropdown */}
          <div className="topbar-settings-wrap" ref={dropdownRef}>
            <button
              className="topbar-icon-btn"
              onClick={() => { onTap(); setShowDropdown(prev => !prev); }}
              title="Settings"
              aria-label="Settings menu"
              aria-expanded={showDropdown}
            >
              <FiSettings size={20} />
            </button>

            {/* ── SETTINGS DROPDOWN ── */}
            {showDropdown && (
              <div className="settings-dropdown">
                {/* User info header */}
                <div className="dropdown-user-header">
                  <div className="dropdown-avatar">
                    {user && user.photo
                      ? <img src={user.photo} alt="" />
                      : getInitial()
                    }
                  </div>
                  <div className="dropdown-user-info">
                    <strong>{user?.first_name ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}` : user?.username}</strong>
                    <span>@{user?.username}</span>
                  </div>
                </div>

                {/* Button-style menu items in flow layout */}
                <div className="dropdown-buttons">
                  <button className="dropdown-btn" onClick={() => { onTap(); navigate(`/profile/${user?.user_id}`); }}>
                    <FiUser size={13} />My Profile
                  </button>
                  <button className="dropdown-btn" onClick={() => { onTap(); navigate('/profile/edit'); }}>
                    <FiSettings size={13} />Manage Account
                  </button>
                  <button className="dropdown-btn" onClick={() => { onTap(); navigate('/notifications'); }}>
                    <FiBell size={13} />Notifications
                    {unreadCount > 0 && <span className="dropdown-btn-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                  </button>
                </div>

                <div className="dropdown-buttons">
                  <button className="dropdown-btn" onClick={() => { onTap(); setShowAboutModal(true); setShowDropdown(false); }}>
                    <FiInfo size={13} />About
                  </button>
                  <button className="dropdown-btn" onClick={() => { onTap(); navigate('/privacy-policy'); }}>
                    <FiLock size={13} />Privacy Policy
                  </button>
                </div>

                <div className="dropdown-buttons">
                  <button className="dropdown-btn" onClick={() => { onTap(); toggleTheme(); }}>
                    {theme === 'dark' ? <FiSun size={13} /> : <FiMoon size={13} />}
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </button>
                  <button className="dropdown-btn" onClick={handleLogout}>
                    <FiLogOut size={13} />Logout
                  </button>
                </div>

                <div className="dropdown-buttons">
                  <button className="dropdown-btn danger" onClick={() => { onTap(); setShowDeleteModal(true); setShowDropdown(false); }}>
                    <FiTrash2 size={13} />Delete Account
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profile avatar — navigates to own profile */}
          <button
            className="topbar-avatar-btn"
            onClick={() => { onTap(); navigate(`/profile/${user?.user_id}`); }}
            title="My Profile"
            aria-label="Go to my profile"
          >
            <div className="topbar-avatar">
              {user && user.photo
                ? <img src={user.photo} alt="" />
                : getInitial()
              }
            </div>
          </button>
        </div>
      </header>

      {/* ── SIDEBAR — below top bar ──────────────────────────────────── */}
      <div className="sidebar">
        <div className="sidebar-scroll">
          <div className="nav-group-label">Main</div>
          <NavLink to="/feed" onClick={() => onTap()} className={navClass}><FiHome size={16} /> Feed</NavLink>
          <NavLink to="/explore" onClick={() => onTap()} className={navClass}><FiCompass size={16} /> Explore</NavLink>
          <NavLink to="/quizzes" onClick={() => onTap()} className={navClass}><RiQuestionLine size={16} /> Quizzes</NavLink>
          <NavLink to="/connections" onClick={() => onTap()} className={navClass}><FiUsers size={16} /> Connections</NavLink>

          <div className="nav-group-label" style={{ marginTop: '0.5rem' }}>You</div>
          <NavLink to="/watchlist" onClick={() => onTap()} className={navClass}><FiBookmark size={16} /> Watchlist</NavLink>
          <NavLink to="/playlists" onClick={() => onTap()} className={navClass}><FiList size={16} /> Playlists</NavLink>
          <NavLink to="/study" onClick={() => onTap()} className={navClass}><FiClock size={16} /> Usage</NavLink>

          <div className="nav-group-label" style={{ marginTop: '0.5rem' }}>Community</div>
          <NavLink to="/leaderboard" onClick={() => onTap()} className={navClass}><FiAward size={16} /> Top Voices</NavLink>
          <NavLink to="/moderation" onClick={() => onTap()} className={navClass}><FiShield size={16} /> Moderation</NavLink>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-copyright">
            &copy; {new Date().getFullYear()} OurGuided.<br />All rights reserved.
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT — below top bar, right of sidebar ────────── */}
      <div className="main-content">
        <Outlet />
      </div>

      {/* ── MOBILE BOTTOM NAV ────────────────────────────────────────── */}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <div className="mobile-nav-inner">
          <NavLink to="/feed" onClick={() => onTap()} className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}><FiHome size={22} />Feed</NavLink>
          <NavLink to="/explore" onClick={() => onTap()} className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}><FiCompass size={22} />Explore</NavLink>
          <NavLink to="/quizzes" onClick={() => onTap()} className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}><RiQuestionLine size={22} />Quizzes</NavLink>
          <NavLink to="/connections" onClick={() => onTap()} className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}><FiUsers size={22} />Connect</NavLink>
          <NavLink to="/notifications" onClick={() => onTap()} className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <FiBell size={22} />
              {unreadCount > 0 && <span className="mobile-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </span>
            Alerts
          </NavLink>
        </div>
      </nav>

      {/* ── ABOUT MODAL ──────────────────────────────────────────────── */}
      {showAboutModal && (
        <div className="modal-overlay" onClick={() => setShowAboutModal(false)}>
          <div className="about-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowAboutModal(false)} aria-label="Close">
              <FiX size={18} />
            </button>
            <div className="about-modal-logo">OurGuided</div>
            <p className="about-modal-version">Version 1.0.0</p>
            <div className="about-modal-divider" />
            <p className="about-modal-desc">
              A community-driven knowledge-sharing platform where real people share genuine experiences, skills, and insights.
            </p>
            <p className="about-modal-desc" style={{ marginTop: '0.5rem' }}>
              Built with ❤️ for learners, creators, and professionals who value authenticity over appearances.
            </p>
            <div className="about-modal-divider" />
            <p className="about-modal-footer">&copy; {new Date().getFullYear()} OurGuided. All rights reserved.</p>
          </div>
        </div>
      )}

      {/* ── DELETE ACCOUNT MODAL ─────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => { if (!deleting) { setShowDeleteModal(false); setDeletePassword(''); } }}>
          <div className="delete-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => { setShowDeleteModal(false); setDeletePassword(''); }} disabled={deleting} aria-label="Close">
              <FiX size={18} />
            </button>
            <div className="delete-modal-icon">
              <FiTrash2 size={28} />
            </div>
            <h3 className="delete-modal-title">Delete Account</h3>
            <p className="delete-modal-desc">
              This action is <strong>permanent</strong> and cannot be undone. All your posts, connections, and data will be removed.
            </p>
            <div className="form-group" style={{ marginTop: '1.25rem' }}>
              <label>Enter your password to confirm</label>
              <input
                type="password"
                placeholder="Your password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDeleteAccount()}
                disabled={deleting}
                autoFocus
              />
            </div>
            <div className="delete-modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => { setShowDeleteModal(false); setDeletePassword(''); }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-delete-confirm"
                onClick={handleDeleteAccount}
                disabled={deleting || !deletePassword}
              >
                {deleting ? 'Deleting…' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FEEDBACK WIDGET ──────────────────────────────────────────── */}
      <FeedbackWidget />

      {/* ── GROWTH JOURNEY — right-side ruler button + popup ─────────── */}
      <GrowthRulerPanel />

      {/* ── GROWTH CELEBRATION MODAL (lazy) ──────────────────────────── */}
      <Suspense fallback={null}>
        <GrowthCelebrationModal />
      </Suspense>

    </div>
  );
};

export default Layout;