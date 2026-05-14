import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiHeart, FiMessageCircle, FiX } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { API } from '../context/AuthContext';
import toast from 'react-hot-toast';
import AvatarWithFallback, { getInitial, buildFullName } from './Avatar';



/* ── Escape-key + scroll-lock hook ────────────────────────────── */
function useModalBehaviour(onClose) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handler);
    };
  }, [onClose]);
}

/* ══════════════════════════════════════════════════════════════
   LIKERS MODAL
══════════════════════════════════════════════════════════════ */
export const LikersModal = ({ postId, onClose }) => {
  const [likers, setLikers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleClose = useCallback(onClose, [onClose]);
  useModalBehaviour(handleClose);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    API.get(`/posts/${postId}/likers`)
      .then(res => {
        if (!cancelled) setLikers(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          toast.error('Failed to load likers');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [postId]);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="People who liked this post"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal analytics-modal">
        <div className="modal-header">
          <h3><FiHeart size={15} style={{ marginRight: 6, color: '#f43f5e', verticalAlign: 'middle' }} />Likes</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close likers"><FiX /></button>
        </div>

        {loading ? (
          <div className="analytics-modal-loading">
            <div className="spinner" />
          </div>
        ) : error ? (
          <div className="analytics-modal-empty">Could not load likers. Please try again.</div>
        ) : likers.length === 0 ? (
          <div className="analytics-modal-empty">No likes yet — be the first! ❤️</div>
        ) : (
          <div className="liker-list">
            {likers.map(liker => (
              <Link
                key={liker.user_id}
                to={`/profile/${liker.user_id}`}
                className="liker-row"
                onClick={onClose}
              >
                <AvatarWithFallback photo={liker.photo} username={liker.username} />
                <div className="liker-info">
                  <div className="liker-name">
                    {buildFullName(liker.first_name, liker.middle_name, liker.last_name, liker.username)}
                  </div>
                  <div className="liker-username">@{liker.username || 'unknown'}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   COMMENTS MODAL  (same size/style as LikersModal)
══════════════════════════════════════════════════════════════ */
export const CommentsModal = ({ postId, commentCount, onClose }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleClose = useCallback(onClose, [onClose]);
  useModalBehaviour(handleClose);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    // Fetch the full post detail which includes comments
    API.get(`/posts/${postId}`)
      .then(res => {
        if (!cancelled) {
          const c = res.data?.comments;
          setComments(Array.isArray(c) ? c : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          toast.error('Failed to load comments');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [postId]);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Post comments"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal analytics-modal">
        <div className="modal-header">
          <h3>
            <FiMessageCircle size={15} style={{ marginRight: 6, color: 'var(--accent)', verticalAlign: 'middle' }} />
            Comments {commentCount > 0 && <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: '0.85rem' }}>({commentCount})</span>}
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close comments"><FiX /></button>
        </div>

        {loading ? (
          <div className="analytics-modal-loading">
            <div className="spinner" />
          </div>
        ) : error ? (
          <div className="analytics-modal-empty">Could not load comments. Please try again.</div>
        ) : comments.length === 0 ? (
          <div className="analytics-modal-empty">No comments yet. Be the first! 💬</div>
        ) : (
          <div className="liker-list">
            {comments.map(c => {
              const name = buildFullName(c.first_name, '', c.last_name, c.username);
              return (
                <div key={c.comment_id} className="analytics-comment-row">
                  <Link to={`/profile/${c.user_id}`} onClick={onClose}>
                    <AvatarWithFallback 
                      photo={c.photo} 
                      username={c.username} 
                      style={{ width: 36, height: 36, fontSize: '0.82rem', flexShrink: 0 }} 
                    />
                  </Link>
                  <div className="analytics-comment-body">
                    <div className="analytics-comment-meta">
                      <Link to={`/profile/${c.user_id}`} className="liker-name" onClick={onClose}>{name}</Link>
                      <span className="liker-username" style={{ marginLeft: 6 }}>@{c.username || 'unknown'}</span>
                    </div>
                    <div className="analytics-comment-text">{c.content}</div>
                    {c.comment_date && (
                      <div className="analytics-comment-time">
                        {formatDistanceToNow(new Date(c.comment_date), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   POST ANALYTICS CARD  (used in profile grid)
══════════════════════════════════════════════════════════════ */
export const PostAnalyticsCard = ({ post }) => {
  const navigate = useNavigate();
  const [showLikers, setShowLikers] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const handleCardClick = useCallback(() => {
    navigate(`/post/${post.post_id}`);
  }, [navigate, post.post_id]);

  const handleLikeClick = useCallback((e) => {
    e.stopPropagation();
    setShowLikers(true);
  }, []);

  const handleCommentClick = useCallback((e) => {
    e.stopPropagation();
    setShowComments(true);
  }, []);

  const likeCount = Number(post.like_count) || 0;
  const commentCount = Number(post.comment_count) || 0;

  return (
    <>
      <div
        className="post-analytics-card"
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        aria-label={`View post — ${likeCount} likes, ${commentCount} comments`}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleCardClick()}
      >
        {/* Thumbnail */}
        {post.image ? (
          <img src={post.image} className="thumb-img" alt="Post thumbnail" loading="lazy" />
        ) : post.media_type === 'video' ? (
          <div className="thumb-content">
            <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>📹</div>
            <span>Video Post</span>
          </div>
        ) : (
          <div className="thumb-content">
            <span>
              {post.content
                ? (post.content.length > 90 ? post.content.substring(0, 90) + '…' : post.content)
                : 'Text Post'}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="post-analytics-overlay" aria-hidden="true">
          <button
            className="stat-item stat-item-btn"
            onClick={handleLikeClick}
            title={`${likeCount} like${likeCount !== 1 ? 's' : ''} — click to see who`}
          >
            <FiHeart size={22} />
            <span className="count">{likeCount}</span>
            <span className="label">Likes</span>
          </button>

          <div className="analytics-overlay-divider" />

          <button
            className="stat-item stat-item-btn"
            onClick={handleCommentClick}
            title={`${commentCount} comment${commentCount !== 1 ? 's' : ''} — click to read`}
          >
            <FiMessageCircle size={22} />
            <span className="count">{commentCount}</span>
            <span className="label">Comments</span>
          </button>
        </div>
      </div>

      {showLikers && (
        <LikersModal postId={post.post_id} onClose={() => setShowLikers(false)} />
      )}
      {showComments && (
        <CommentsModal
          postId={post.post_id}
          commentCount={commentCount}
          onClose={() => setShowComments(false)}
        />
      )}
    </>
  );
};
