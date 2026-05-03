import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiHeart, FiMessageCircle, FiX } from 'react-icons/fi';
import { API } from '../context/AuthContext';
import toast from 'react-hot-toast';

export const LikersModal = ({ postId, onClose }) => {
  const [likers, setLikers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get(`/posts/${postId}/likers`)
      .then(res => setLikers(res.data))
      .catch(() => toast.error('Failed to load likers'))
      .finally(() => setLoading(false));
  }, [postId]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3>Likers</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><FiX /></button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : likers.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>
            No likes yet
          </div>
        ) : (
          <div className="liker-list">
            {likers.map(liker => (
              <Link key={liker.user_id} to={`/profile/${liker.user_id}`} className="liker-row" onClick={onClose}>
                <div className="avatar">
                  {liker.photo ? (
                    <img src={liker.photo} alt={liker.username} />
                  ) : (
                    liker.username[0].toUpperCase()
                  )}
                </div>
                <div className="liker-info">
                  <div className="liker-name">
                    {`${liker.first_name || ''} ${liker.middle_name ? liker.middle_name + ' ' : ''}${liker.last_name || ''}`.trim() || liker.username}
                  </div>
                  <div className="liker-username">@{liker.username}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const PostAnalyticsCard = ({ post, onPostClick }) => {
  const [showLikers, setShowLikers] = useState(false);

  const handleLikeClick = (e) => {
    e.stopPropagation();
    setShowLikers(true);
  };

  return (
    <>
      <div className="post-analytics-card" onClick={() => onPostClick(post.post_id)}>
        {post.image ? (
          <img src={post.image} className="thumb-img" alt="Post thumbnail" />
        ) : post.media_type === 'video' ? (
          <div className="thumb-content">
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📹</div>
            Video Post
          </div>
        ) : (
          <div className="thumb-content">
            {post.content ? (
              post.content.length > 80 ? post.content.substring(0, 80) + '...' : post.content
            ) : (
              'Text Post'
            )}
          </div>
        )}

        <div className="post-analytics-overlay">
          <div className="stat-item" onClick={handleLikeClick}>
            <FiHeart size={20} />
            <span className="count">{post.like_count || 0}</span>
            <span className="label">Likes</span>
          </div>
          <div className="stat-item">
            <FiMessageCircle size={20} />
            <span className="count">{post.comment_count || 0}</span>
            <span className="label">Comments</span>
          </div>
        </div>
      </div>

      {showLikers && (
        <LikersModal postId={post.post_id} onClose={() => setShowLikers(false)} />
      )}
    </>
  );
};
