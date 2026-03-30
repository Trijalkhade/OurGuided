import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiZap, FiCalendar, FiStar } from 'react-icons/fi';

const medals = ['🥇', '🥈', '🥉'];

const Leaderboard = () => {
  const { user }          = useAuth();
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await API.get('/users/leaderboard');
        setLeaders(data);
      } catch { toast.error('Failed to load leaderboard'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return (
    <div className="feed-container">
      <div className="loading-screen" style={{ height: '50vh' }}><div className="spinner" /></div>
    </div>
  );

  return (
    <div className="feed-container">
      <div className="page-header">
        <h2>🏆 Leaderboard</h2>
        <p>Top learners ranked by total knowledge points</p>
      </div>

      {leaders.length === 0 ? (
        <div className="empty-state">
          <h3>No data yet</h3>
          <p>Start studying to appear on the leaderboard!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {leaders.map((u, idx) => {
            const isMe = Number(u.user_id) === Number(user?.user_id);
            const displayName = u.first_name
              ? `${u.first_name} ${u.last_name || ''}`.trim()
              : u.username;

            return (
              <Link
                key={u.user_id}
                to={`/profile/${u.user_id}`}
                style={{ textDecoration: 'none' }}
              >
                <div className={`lb-row ${isMe ? 'lb-me' : ''}`}>
                  <div className="lb-rank">
                    {idx < 3 ? medals[idx] : <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', color: 'var(--text3)' }}>#{idx + 1}</span>}
                  </div>

                  <div className="avatar" style={{ width: 42, height: 42, fontSize: '1rem', flexShrink: 0 }}>
                    {displayName[0]?.toUpperCase()}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {displayName}
                      {u.is_expert && <span style={{ fontSize: '0.7rem', color: '#b45309' }}>⭐ Expert</span>}
                      {isMe && <span style={{ fontSize: '0.7rem', color: 'var(--accent2)', fontFamily: 'Space Mono, monospace' }}>(you)</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)', fontFamily: 'Space Mono, monospace' }}>@{u.username}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--accent2)' }}>
                        {Number(u.total_knowledge || 0).toFixed(1)}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text3)', fontFamily: 'Space Mono, monospace', textTransform: 'uppercase', letterSpacing: 0.5 }}>pts</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent3)' }}>
                        {u.streak_days ?? 0}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text3)', fontFamily: 'Space Mono, monospace', textTransform: 'uppercase', letterSpacing: 0.5 }}>streak</div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
