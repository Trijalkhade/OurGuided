import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

const PublicLayout = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="public-topbar">
        <div className="public-topbar-logo" onClick={() => navigate('/')}>
          OurGuided
        </div>
        <div className="public-topbar-actions">
          <button className="public-btn-login" onClick={() => navigate('/login')}>
            Log In
          </button>
          <button className="public-btn-signup" onClick={() => navigate('/register')}>
            Sign Up Free
          </button>
        </div>
      </header>
      <main className="public-content">
        <Outlet />
      </main>
    </div>
  );
};

export default PublicLayout;
