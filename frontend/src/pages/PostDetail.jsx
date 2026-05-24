import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { API, useAuth } from '../context/AuthContext';
import { FiHeart, FiSend, FiBookmark, FiEyeOff, FiArrowLeft } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import ImageModal from '../components/ImageModal';
import { LikersModal } from '../components/PostAnalytics';
import toast from 'react-hot-toast';
import AvatarWithFallback from '../components/Avatar.jsx';
import * as cache from '../utils/cache';

function getEmbedUrl(url) {
  if (!url) return null;
  if (url.includes('youtube.com/watch')) {
    const id = url.split('v=')[1]?.split('&')[0];
    return id ? `https://www.youtube.com/embed/${id}` : url;
  }
  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split('?')[0];
    return id ? `https://www.youtube.com/embed/${id}` : url;
  }
  return url;
}

import { SkelPostDetail } from '../components/Skeleton.jsx';

const PostDetail = () => {
  const { id }    = useParams();
  const { user }  = useAuth();
  const navigate  = useNavigate();

  // Try cache for this post
  const cachedPost = cache.get(`post:${id}`);

  const [post, setPost]             = useState(cachedPost ? cachedPost.data : null);
  const [loading, setLoading]       = useState(!cachedPost);
  const [comment, setComment]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked]           = useState(cachedPost ? Number(cachedPost.data?.user_liked) > 0 : false);
  const [likeCount, setLikeCount]   = useState(cachedPost ? Number(cachedPost.data?.like_count) : 0);
  const [liking, setLiking]         = useState(false);
  const [saved, setSaved]           = useState(cachedPost ? Boolean(cachedPost.data?.user_saved) : false);
  const [showLikers, setShowLikers] = useState(false);

  /* Lightbox */
  const [lightboxOpen, setLightboxOpen]   = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    const fetchPost = async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { data } = await API.get(`/posts/${id}`);
        if (!data) { if (!silent) toast.error('Post not found'); return; }
        setPost(data);
        setLiked(Number(data.user_liked) > 0);
        setLikeCount(Number(data.like_count));
        setSaved(Boolean(data.user_saved));
        cache.set(`post:${id}`, data, 'post_detail');
      } catch { if (!silent) toast.error('Post not found'); }
      finally { setLoading(false); }
    };
    if (cachedPost) {
      fetchPost(true); // silent revalidate to get fresh comments
    } else {
      fetchPost();
    }
  }, [id]);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      const { data } = await API.post(`/posts/${id}/like`);
      setLiked(data.liked);
      setLikeCount(prev => data.liked ? prev + 1 : Math.max(prev - 1, 0));
      // Update cache in-place
      cache.update(`post:${id}`, p => p ? { ...p, user_liked: data.liked ? 1 : 0, like_count: data.liked ? Number(p.like_count) + 1 : Math.max(Number(p.like_count) - 1, 0) } : p);
    } catch { toast.error('Failed to update like'); }
    finally { setLiking(false); }
  };

  const handleSave = async () => {
    try {
      const { data } = await API.post(`/posts/${id}/watchlist`);
      setSaved(data.saved);
      cache.invalidate('watchlist');
      cache.update(`post:${id}`, p => p ? { ...p, user_saved: data.saved } : p);
      toast.success(data.saved ? 'Saved to watchlist' : 'Removed from watchlist');
    } catch { toast.error('Failed to save'); }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await API.post(`/posts/${id}/comment`, { content: comment });
      const { data } = await API.get(`/posts/${id}`);
      setPost(data);
      cache.set(`post:${id}`, data, 'post_detail');
      setComment('');
      toast.success('Comment added');
    } catch { toast.error('Failed to comment'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <SkelPostDetail />;

  if (!post) return (
    <div className="feed-container">
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.1rem' }}>
        <button
          onClick={() => {
            sessionStorage.setItem('returning_from_post', 'true');
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/feed');
            }
          }}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <FiArrowLeft size={14} /> Back
        </button>
      </div>
      <p style={{ padding: '2rem', color: 'var(--text3)' }}>Post not found</p>
    </div>
  );

  const isOwn = user?.user_id === post.user_id;
  const displayName = post.is_anonymous && !isOwn
    ? 'Anonymous'
    : post.first_name ? `${post.first_name} ${post.last_name || ''}`.trim() : post.username;

  /* All images for lightbox */
  const allImages = [
    ...(post.image ? [post.image] : []),
    ...(Array.isArray(post.extra_images) ? post.extra_images : []),
  ];

  return (
    <div className="feed-container">
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.1rem' }}>
        <button
          onClick={() => {
            sessionStorage.setItem('returning_from_post', 'true');
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/feed');
            }
          }}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <FiArrowLeft size={14} /> Back
        </button>
      </div>
      <div className="post-card" style={{ marginBottom: '1.5rem' }}>

        {/* Header */}
        <div className="post-header">
          {post.is_anonymous && !isOwn ? (
            <div className="avatar">?</div>
          ) : (
            <Link to={`/profile/${post.user_id}`}>
              <AvatarWithFallback photo={post.photo} username={displayName} />
            </Link>
          )}
          <div className="post-header-info">
            {post.is_anonymous && !isOwn ? (
              <div className="post-user-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Anonymous <span className="anon-label"><FiEyeOff size={10} /> hidden</span>
              </div>
            ) : (
              <Link to={`/profile/${post.user_id}`} className="post-user-name">{displayName}</Link>
            )}
            <div className="post-date">
              {post.post_date ? formatDistanceToNow(new Date(post.post_date), { addSuffix: true }) : ''}
            </div>
          </div>
        </div>

        {post.category && <span className="post-category-tag">{post.category}</span>}

        {post.content && (
          <div className="post-content" style={{ fontSize: '1rem', lineHeight: 1.7 }}>{post.content}</div>
        )}

        {post.tags && (
          <div className="post-tags">
            {post.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
              <span key={tag} className="tag">#{tag}</span>
            ))}
          </div>
        )}

        {/* Single image — clickable */}
        {post.media_type === 'image' && post.image && allImages.length === 1 && (
          <img
            src={post.image}
            alt="Post image"
            className="post-img-single"
            onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
          />
        )}

        {/* Multiple images — grid */}
        {post.media_type === 'image' && allImages.length > 1 && (
          <div className={`post-img-grid ${
            allImages.length === 2 ? 'g2' : allImages.length === 3 ? 'g3' : allImages.length === 4 ? 'g4' : 'g5plus'
          }`}>
            {allImages.slice(0, 6).map((src, i) => (
              <div key={i} className="gi" onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}>
                <img src={src} alt={`Image ${i + 1}`} />
                {i === 5 && allImages.length > 6 && (
                  <div className="gi-overlay">+{allImages.length - 6}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Video */}
        {post.media_type === 'video' && post.video && (
          post.video.endsWith('.mp4') || post.video.endsWith('.webm') ? (
            <video controls className="post-img-single" style={{ cursor: 'default', maxHeight: 400 }}>
              <source src={post.video} />
            </video>
          ) : (
            <iframe
              src={getEmbedUrl(post.video)} title="Embedded video"
              style={{ width: '100%', height: '400px', border: 'none', borderRadius: 8, display: 'block' }}
              allowFullScreen
            />
          )
        )}

        {/* Actions */}
        <div className="post-actions">
          <div className={`action-btn action-btn-split${liked ? ' liked' : ''}`}>
            <button
              className="icon-part"
              onClick={handleLike}
              disabled={liking}
              aria-label={liked ? 'Unlike' : 'Like'}
            >
              <FiHeart size={15} />
            </button>
            <button
              className="count-part"
              onClick={() => setShowLikers(true)}
              title={`${likeCount} like${likeCount !== 1 ? 's' : ''} — see who liked`}
              aria-label="View likers"
            >
              {likeCount}
            </button>
          </div>
          <span style={{ color: 'var(--text3)', fontSize: '0.82rem', marginLeft: '0.35rem' }}>
            {post.comments?.length || 0} comment{(post.comments?.length || 0) !== 1 ? 's' : ''}
          </span>
          <div className="post-actions-right">
            <button className={`action-btn${saved ? ' saved' : ''}`} onClick={handleSave} title="Save to watchlist">
              <FiBookmark size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="info-card">
        <h3>Comments</h3>
        <form className="comment-form" onSubmit={handleComment}>
          <div className="avatar" style={{ width: 36, height: 36, fontSize: '0.82rem' }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <input
            className="comment-input"
            placeholder="Write a comment…"
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting} style={{ width: 'auto' }}>
            <FiSend size={14} />
          </button>
        </form>

        <div className="divider" />

        {!post.comments?.length ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <p>No comments yet. Be the first!</p>
          </div>
        ) : (
          post.comments.map(c => {
            const cName = c.first_name ? `${c.first_name} ${c.last_name || ''}`.trim() : c.username;
            return (
              <div key={c.comment_id} className="comment">
                <Link to={`/profile/${c.user_id}`}>
                  <AvatarWithFallback
                    photo={c.photo}
                    username={cName}
                    style={{ width: 36, height: 36, fontSize: '0.82rem' }}
                  />
                </Link>
                <div className="comment-content">
                  <div className="comment-user">{cName}</div>
                  <div className="comment-text">{c.content}</div>
                  <div className="comment-time">
                    {c.comment_date ? formatDistanceToNow(new Date(c.comment_date), { addSuffix: true }) : ''}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Image lightbox */}
      {lightboxOpen && allImages.length > 0 && (
        <ImageModal
          images={allImages}
          startIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
      {showLikers && (
        <LikersModal postId={id} onClose={() => setShowLikers(false)} />
      )}
    </div>
  );
};

export default PostDetail;