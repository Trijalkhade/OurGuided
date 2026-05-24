import React, { useState, useEffect } from 'react';
import { API } from '../context/AuthContext';
import PostCard from '../components/PostCard.jsx';
import toast from 'react-hot-toast';
import { FiBookmark } from 'react-icons/fi';
import { SkelWatchlist } from '../components/Skeleton.jsx';
import * as cache from '../utils/cache';

const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";
const Watchlist = () => {
  const cached = cache.get('watchlist');
  const [posts, setPosts]     = useState(cached ? cached.data : []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const load = async (silent = false) => {
      try {
        const { data } = await API.get('/posts/watchlist');
        setPosts(data);
        cache.set('watchlist', data, 'watchlist');
      } catch { if (!silent) toast.error('Failed to load watchlist'); }
      finally { setLoading(false); }
    };
    if (cached) {
      load(true); // silent revalidate
    } else {
      load();
    }
  }, []);

  const handleRemove = (postId) => {
    setPosts(prev => prev.filter(p => p.post_id !== postId));
    cache.invalidate('watchlist');
  };

  if (loading) return <SkelWatchlist />;

  return (
    <div className="feed-container">
      <div className="page-header">
        <h2><FiBookmark style={{ display: 'inline', marginRight: 8 }} />Watchlist</h2>
        <p>Posts you saved for later review</p>
      </div>

      {posts.length === 0 ? (
        <div className="empty-state">
          <FiBookmark size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <h3>Your watchlist is empty</h3>
          <p>Tap the bookmark icon on any post to save it here</p>
        </div>
      ) : (
        posts.map(post => (
          <PostCard
            key={post.post_id}
            post={post}
            onDelete={handleRemove}
            onUnsave={handleRemove}
          />
        ))
      )}
    </div>
  );
};

export default Watchlist;
