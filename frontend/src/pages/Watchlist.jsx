import React, { useState, useEffect } from 'react';
import { API } from '../context/AuthContext';
import PostCard from '../components/PostCard.jsx';
import toast from 'react-hot-toast';
import { FiBookmark } from 'react-icons/fi';

const Watchlist = () => {
  const [posts, setPosts]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await API.get('/posts/watchlist');
        setPosts(data);
      } catch { toast.error('Failed to load watchlist'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleRemove = (postId) => setPosts(prev => prev.filter(p => p.post_id !== postId));

  if (loading) return (
    <div className="feed-container">
      <div className="loading-screen" style={{ height: '50vh' }}><div className="spinner" /></div>
    </div>
  );

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
