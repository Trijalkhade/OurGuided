import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAuthGate } from '../context/AuthGateContext';
import PostCard from '../components/PostCard.jsx';
import { SkelFeed } from '../components/Skeleton.jsx';
import axios from 'axios';

const CATEGORIES = [
  'Real Talk', 'Experiments & Ideas', 'Loopholes & Fixes', 'Life Hacks',
  'Youth & Education', 'Health & Body', 'Earth & Hands', 'Economy & Power',
];

const PublicFeed = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState('');

  // Redirect logged-in users to the real feed
  useEffect(() => {
    if (user) navigate('/feed', { replace: true });
  }, [user, navigate]);

  // Fetch public posts
  useEffect(() => {
    setLoading(true);
    axios.get('/api/posts/public')
      .then(res => {
        setPosts(res.data);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const filteredPosts = catFilter
    ? posts.filter(p => p.category === catFilter)
    : posts;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '0.25rem' }}>
          Browse the Feed
        </h2>
        <p style={{ color: 'var(--text3)', fontSize: '0.88rem' }}>
          See what the community is talking about — sign up to join in
        </p>
      </div>

      {/* Category filter */}
      <div className="feed-filter-strip" style={{ marginBottom: '1rem' }}>
        <button
          className={`media-btn ${!catFilter ? 'selected' : ''}`}
          onClick={() => setCatFilter('')}
        >
          All
        </button>
        {CATEGORIES.slice(0, 6).map(c => (
          <button
            key={c}
            className={`media-btn ${catFilter === c ? 'selected' : ''}`}
            onClick={() => setCatFilter(catFilter === c ? '' : c)}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <SkelFeed />
      ) : filteredPosts.length === 0 ? (
        <div className="empty-state">
          <h3>{catFilter ? 'No posts in this category yet' : 'No posts yet'}</h3>
          <p>Be the first to share something!</p>
        </div>
      ) : (
        <>
          {filteredPosts.map(post => (
            <PostCard key={post.post_id} post={post} readOnly />
          ))}

          {/* CTA at bottom */}
          <div style={{
            textAlign: 'center',
            padding: '2.5rem 1rem',
            marginTop: '1rem',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Want to see more?
            </h3>
            <p style={{ color: 'var(--text3)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Sign up to unlock the full feed, post your own content, and join the conversation.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: 'auto', padding: '0.75rem 2rem' }}
              onClick={() => navigate('/register')}
            >
              Join OurGuided — it's free
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PublicFeed;
