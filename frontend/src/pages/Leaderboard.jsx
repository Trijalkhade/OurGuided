import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiZap, FiCalendar, FiStar } from 'react-icons/fi';
import * as cache from '../utils/cache';

const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";

const medals = ['🥇', '🥈', '🥉'];

import { SkelLeaderboard } from '../components/Skeleton.jsx';

const Leaderboard = () => {
  const { user }          = useAuth();
  const cached = cache.get('leaderboard');
  const [leaders, setLeaders] = useState(cached ? cached.data : []);
  const [loading, setLoading] = useState(!cached);

  // 🚀 SEO CONTENT FOR GOOGLE
  if (isPrerender) {
    return (
      <div>
        <h1>Most Active Voices on OurGuided</h1>
        <p>The people contributing the most real knowledge, honest opinions, and practical wisdom to the OurGuided community.</p>
      </div>
    );
  }

  useEffect(() => {
    const load = async (silent = false) => {
      try {
        const { data } = await API.get('/users/leaderboard');
        setLeaders(data);
        cache.set('leaderboard', data, 'leaderboard');
      } catch { if (!silent) toast.error('Failed to load leaderboard'); }
      finally { setLoading(false); }
    };
    if (cached) {
      load(true); // silent revalidate
    } else {
      load();
    }
  }, []);

  if (loading) return <SkelLeaderboard />;

  return (
    <div className="feed-container">
      <div className="page-header">
        <h2>🏆 Top Voices</h2>
        <p>The people putting in the most real talk and useful knowledge</p>
      </div>

      {leaders.length === 0 ? (
        <div className="empty-state">
          <h3>No one on the board yet</h3>
          <p>Be the first to post something worth reading.</p>
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
                      {u.is_expert && <span style={{ fontSize: '0.7rem', color: 'var(--medal-bronze)' }}>⭐ Expert</span>}
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
