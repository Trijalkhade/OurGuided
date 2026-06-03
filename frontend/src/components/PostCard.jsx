import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiHeart, FiMessageCircle, FiBookmark, FiTrash2, FiEyeOff, FiPlus, FiList, FiX, FiShare2, FiFlag } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { API } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import { useAuthGate } from '../context/AuthGateContext';
import useFeedback from '../utils/useFeedback';
import { renderLinkedContent } from '../utils/linkify.jsx';
import ImageModal from './ImageModal';
import { LikersModal, CommentsModal } from './PostAnalytics';
import toast from 'react-hot-toast';
import AvatarWithFallback from './Avatar';

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

/* ── Add-to-Playlist modal ─────────────────────────────────────── */
const PlaylistModal = ({ postId, onClose }) => {
  const [playlists, setPlaylists]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [adding, setAdding]         = useState(null);

  React.useEffect(() => {
    API.get('/playlists')
      .then(r => setPlaylists(r.data))
      .catch(() => toast.error('Failed to load playlists'))
      .finally(() => setLoading(false));
  }, []);

  // Escape key to close
  React.useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const addToPlaylist = async (playlistId) => {
    setAdding(playlistId);
    try {
      await API.post(`/playlists/${playlistId}/add`, { post_id: postId });
      toast.success('Added to playlist!');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add');
    } finally { setAdding(null); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 360 }}>
        <div className="modal-header">
          <h3><FiList size={15} style={{ marginRight: 6 }}/>Add to Playlist</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><FiX/></button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}><div className="spinner" style={{ margin: '0 auto' }}/></div>
        ) : playlists.length === 0 ? (
          <p style={{ color: 'var(--text3)', padding: '1rem 0', fontSize: '0.875rem' }}>
            No playlists yet — create one from the Playlists page.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 280, overflowY: 'auto' }}>
            {playlists.map(pl => (
              <button
                key={pl.playlist_id}
                onClick={() => addToPlaylist(pl.playlist_id)}
                disabled={adding === pl.playlist_id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem', background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s', fontSize: '0.875rem', fontFamily: 'inherit',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--accentbg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg3)'}
              >
                <span style={{ fontWeight: 600 }}>{pl.title}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                  {pl.item_count} post{pl.item_count !== 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Report Modal ──────────────────────────────────────────────── */
const REPORT_REASONS = [
  { value: 'not_interested', label: 'Not interested', icon: '😐' },
  { value: 'spam', label: 'Spam', icon: '🚫' },
  { value: 'offensive', label: 'Offensive content', icon: '⚠️' },
  { value: 'misleading', label: 'Misleading', icon: '🤔' },
  { value: 'other', label: 'Other', icon: '📝' },
];

const ReportModal = ({ postId, onClose, onReport }) => {
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleReport = async (reason) => {
    setSubmitting(true);
    try {
      await API.post('/engagement/report', { postId, reason });
      toast.success('Post hidden from your feed');
      if (onReport) onReport(postId);
      onClose();
    } catch {
      toast.error('Failed to report');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 340 }}>
        <div className="modal-header">
          <h3><FiFlag size={15} style={{ marginRight: 6 }}/>Report / Hide Post</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><FiX/></button>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text3)', marginBottom: '0.6rem' }}>
          This post will be hidden from your feed.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {REPORT_REASONS.map(r => (
            <button
              key={r.value}
              onClick={() => handleReport(r.value)}
              disabled={submitting}
              className="report-reason-btn"
            >
              <span>{r.icon}</span> {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── PostCard ──────────────────────────────────────────────────── */
const PostCard = ({ post, onDelete, onUnsave, onReport, postRef, videoRef, readOnly = false }) => {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const { requireAuth } = useAuthGate();
  const { onTap, onSuccess, onLikeSuccess, onDeleteSuccess } = useFeedback();
  const cardRef = useRef(null);

  const [liked,      setLiked]      = useState(Number(post.user_liked) > 0);
  const [likeCount,  setLikeCount]  = useState(Number(post.like_count) || 0);
  const [commentCount] = useState(Number(post.comment_count) || 0);
  const [saved,      setSaved]      = useState(Boolean(post.user_saved));
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showLikers,   setShowLikers]   = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const [lightboxOpen,  setLightboxOpen]  = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Forward card ref to parent for engagement tracking
  useEffect(() => {
    if (cardRef.current && postRef) {
      postRef(post.post_id, cardRef.current);
    }
  }, [post.post_id, postRef]);

  const allImages = [
    ...(post.image ? [post.image] : []),
    ...(Array.isArray(post.extra_images) ? post.extra_images : []),
  ];

  const handleLike = async () => {
    if (readOnly) { requireAuth('like this post'); return; }
    onTap();
    try {
      const { data } = await API.post(`/posts/${post.post_id}/like`);
      setLiked(data.liked);
      setLikeCount(prev => Math.max(0, data.liked ? prev + 1 : prev - 1));
      if (data.liked) onLikeSuccess();
    } catch {
      toast.error('Failed to like');
    }
  };

  const handleSave = async () => {
    if (readOnly) { requireAuth('save this post'); return; }
    onTap();
    try {
      const { data } = await API.post(`/posts/${post.post_id}/watchlist`);
      setSaved(data.saved);
      if (data.saved) onSuccess();
      toast.success(data.saved ? 'Saved to watchlist' : 'Removed from watchlist');
      if (!data.saved && onUnsave) onUnsave(post.post_id);
    } catch { toast.error('Failed to save'); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this post?')) return;
    onTap();
    try {
      await API.delete(`/posts/${post.post_id}`);
      onDeleteSuccess();
      toast.success('Post deleted');
      if (onDelete) onDelete(post.post_id);
    } catch { toast.error('Failed to delete'); }
  };

  // ── Share handler ──
  const handleShare = async () => {
    if (readOnly) { requireAuth('share this post'); return; }
    const shareUrl = `${window.location.origin}/post/${post.post_id}`;
    let method = 'copy_link';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Check this out on OurGuided', url: shareUrl });
        method = 'web_share';
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied!');
      }
      // Record share event (fire-and-forget)
      API.post('/engagement/share', { postId: post.post_id, method }).catch(() => {});
    } catch (err) {
      // User cancelled share dialog — not an error
      if (err.name !== 'AbortError') {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied!');
        API.post('/engagement/share', { postId: post.post_id, method: 'copy_link' }).catch(() => {});
      }
    }
  };

  // ── Profile click tracker ──
  const handleProfileClick = useCallback(() => {
    if (!readOnly && post.user_id) {
      API.post('/engagement/profile-click', {
        postId: post.post_id,
        authorId: post.user_id
      }).catch(() => {});
    }
  }, [post.post_id, post.user_id, readOnly]);

  const isOwn = user?.user_id === post.user_id;
  const displayName = post.is_anonymous && !isOwn
    ? 'Anonymous'
    : post.first_name
      ? `${post.first_name} ${post.last_name || ''}`.trim()
      : (post.username || 'Unknown');

  const timeAgo = post.post_date
    ? formatDistanceToNow(new Date(post.post_date), { addSuffix: true })
    : '';

  const renderImages = () => {
    if (!allImages.length) return null;
    if (allImages.length === 1) {
      return <img src={allImages[0]} className="post-img-single" alt="Post image" onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}/>;
    }
    const count = allImages.length;
    const displayImages = allImages.slice(0, 6);
    const remainder = count - 6;
    const gridClass = count === 2 ? 'g2' : count === 3 ? 'g3' : count === 4 ? 'g4' : 'g5plus';
    return (
      <div className={`post-img-grid ${gridClass}`}>
        {displayImages.map((src, i) => (
          <div key={i} className="gi" onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}>
            <img src={src} alt={`Image ${i + 1}`}/>
            {i === 5 && remainder > 0 && <div className="gi-overlay">+{remainder}</div>}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="post-card" ref={cardRef}>
        <div className="post-header">
          {post.is_anonymous && !isOwn ? (
            <AvatarWithFallback photo={null} username="?" />
          ) : (
            <Link to={`/profile/${post.user_id}`} onClick={handleProfileClick}>
              <AvatarWithFallback photo={post.photo} username={displayName} />
            </Link>
          )}
          <div className="post-header-info">
            {post.is_anonymous && !isOwn ? (
              <div className="post-user-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Anonymous <span className="anon-label"><FiEyeOff size={10}/> hidden</span>
              </div>
            ) : (
              <Link to={`/profile/${post.user_id}`} className="post-user-name" onClick={handleProfileClick}>{displayName}</Link>
            )}
            <div className="post-date">{timeAgo}</div>
          </div>
          {isOwn && (
            <button className="btn btn-ghost btn-sm" onClick={handleDelete} title="Delete post">
              <FiTrash2 size={14}/>
            </button>
          )}
        </div>

        {post.category && <span className="post-category-tag">{post.category}</span>}
        {post.content && <div className="post-content">{renderLinkedContent(post.content)}</div>}

        {post.tags && (
          <div className="post-tags">
            {post.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
              <span key={tag} className="tag tag-link"
                onClick={() => navigate(`/feed?tag=${encodeURIComponent(tag)}`)}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {post.media_type === 'image' && allImages.length > 0 && (
          <div style={{ overflow: 'hidden' }}>{renderImages()}</div>
        )}
        {post.media_type === 'video' && post.video && (
          post.video.match(/\.(mp4|webm|mov|m4v)(\?|$)/i) ? (
            <video controls className="post-img-single" style={{ cursor: 'default', maxHeight: 420 }}
              ref={el => { if (el && videoRef) videoRef(post.post_id, el); }}>
              <source src={post.video}/>
            </video>
          ) : (
            <iframe src={getEmbedUrl(post.video)} title="Video"
              style={{ width: '100%', height: '340px', border: 'none', display: 'block' }} allowFullScreen/>
          )
        )}

        {/* ── Action bar ── */}
        <div className="post-actions">
          {/* Split like button: left=toggle, right=view likers */}
          <div className={`action-btn action-btn-split${liked ? ' liked' : ''}`}>
            <button
              className="icon-part"
              onClick={handleLike}
              aria-label={liked ? 'Unlike' : 'Like'}
              title={liked ? 'Unlike' : 'Like'}
            >
              <FiHeart size={15}/>
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

          {/* Split comment button: left=navigate to post, right=quick preview modal */}
          <div className="action-btn action-btn-split">
            {readOnly ? (
              <button
                className="icon-part"
                onClick={() => requireAuth('comment on this post')}
                aria-label="Go to comments"
                title="View full post"
              >
                <FiMessageCircle size={15}/>
              </button>
            ) : (
              <Link
                to={`/post/${post.post_id}`}
                className="icon-part"
                aria-label="Go to comments"
                title="View full post"
              >
                <FiMessageCircle size={15}/>
              </Link>
            )}
            <button
              className="count-part"
              onClick={() => readOnly ? requireAuth('view comments') : setShowComments(true)}
              title={`${commentCount} comment${commentCount !== 1 ? 's' : ''} — quick preview`}
              aria-label="Preview comments"
            >
              {commentCount}
            </button>
          </div>

          <div className="post-actions-right">
            <button
              className="action-btn"
              onClick={handleShare}
              title="Share post"
              aria-label="Share post"
            >
              <FiShare2 size={15}/>
            </button>
            <button
              className="action-btn"
              onClick={() => readOnly ? requireAuth('add to playlist') : setShowPlaylistModal(true)}
              title="Add to playlist"
              aria-label="Add to playlist"
            >
              <FiPlus size={15}/>
            </button>
            <button
              className={`action-btn${saved ? ' saved' : ''}`}
              onClick={handleSave}
              title={saved ? 'Remove from watchlist' : 'Save to watchlist'}
              aria-label={saved ? 'Remove from watchlist' : 'Save to watchlist'}
            >
              <FiBookmark size={15}/>
            </button>
            {!isOwn && !readOnly && (
              <button
                className="action-btn"
                onClick={() => setShowReportModal(true)}
                title="Report / Hide post"
                aria-label="Report or hide post"
              >
                <FiFlag size={14}/>
              </button>
            )}
          </div>
        </div>
      </div>

      {lightboxOpen && allImages.length > 0 && (
        <ImageModal images={allImages} startIndex={lightboxIndex} onClose={() => setLightboxOpen(false)}/>
      )}
      {showPlaylistModal && (
        <PlaylistModal postId={post.post_id} onClose={() => setShowPlaylistModal(false)}/>
      )}
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
      {showReportModal && (
        <ReportModal
          postId={post.post_id}
          onClose={() => setShowReportModal(false)}
          onReport={onReport}
        />
      )}
    </>
  );
};

export default PostCard;
