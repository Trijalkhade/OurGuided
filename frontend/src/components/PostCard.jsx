import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiHeart, FiMessageCircle, FiBookmark, FiTrash2, FiEyeOff, FiPlus, FiList, FiX } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { API } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import useFeedback from '../hooks/useFeedback';
import ImageModal from './ImageModal';
import toast from 'react-hot-toast';

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
          <button className="btn btn-ghost btn-sm" onClick={onClose}><FiX/></button>
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

/* ── PostCard ──────────────────────────────────────────────────── */
const PostCard = ({ post, onDelete, onUnsave }) => {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const { onTap, onSuccess, onLikeSuccess, onDeleteSuccess } = useFeedback();

  const [liked,      setLiked]      = useState(Number(post.user_liked) > 0);
  const [likeCount,  setLikeCount]  = useState(Number(post.like_count));
  const [saved,      setSaved]      = useState(Boolean(post.user_saved));
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  const [lightboxOpen,  setLightboxOpen]  = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const allImages = [
    ...(post.image ? [post.image] : []),
    ...(Array.isArray(post.extra_images) ? post.extra_images : []),
  ];

  const handleLike = async () => {
    onTap(); // Haptic feedback immediately
    try {
      const { data } = await API.post(`/posts/${post.post_id}/like`);
      setLiked(data.liked);
      setLikeCount(prev => data.liked ? prev + 1 : prev - 1);
      if (data.liked) onLikeSuccess(); // Beep + chime on successful like
    } catch { 
      toast.error('Failed to like'); 
    }
  };

  const handleSave = async () => {
    onTap(); // Haptic feedback immediately
    try {
      const { data } = await API.post(`/posts/${post.post_id}/watchlist`);
      setSaved(data.saved);
      if (data.saved) onSuccess(); // Feedback on success
      toast.success(data.saved ? 'Saved to watchlist' : 'Removed from watchlist');
      if (!data.saved && onUnsave) onUnsave(post.post_id);
    } catch { toast.error('Failed to save'); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this post?')) return;
    onTap();
    try {
      await API.delete(`/posts/${post.post_id}`);
      onDeleteSuccess(); // Scrape sound for delete
      toast.success('Post deleted');
      if (onDelete) onDelete(post.post_id);
    } catch { toast.error('Failed to delete'); }
  };

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
    const displayImages = allImages.slice(0, 5);
    const remainder = count - 5;
    const gridClass = count === 2 ? 'g2' : count === 3 ? 'g3' : count === 4 ? 'g4' : 'g5plus';
    return (
      <div className={`post-img-grid ${gridClass}`}>
        {displayImages.map((src, i) => (
          <div key={i} className="gi" onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}>
            <img src={src} alt={`Image ${i + 1}`}/>
            {i === 4 && remainder > 0 && <div className="gi-overlay">+{remainder}</div>}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="post-card">
        <div className="post-header">
          {post.is_anonymous && !isOwn ? (
            <div className="avatar">?</div>
          ) : (
            <Link to={`/profile/${post.user_id}`}>
              <div className="avatar">
                {post.photo
                  ? <img src={post.photo} alt={displayName}/>
                  : displayName[0]?.toUpperCase() || '?'
                }
              </div>
            </Link>
          )}
          <div className="post-header-info">
            {post.is_anonymous && !isOwn ? (
              <div className="post-user-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Anonymous <span className="anon-label"><FiEyeOff size={10}/> hidden</span>
              </div>
            ) : (
              <Link to={`/profile/${post.user_id}`} className="post-user-name">{displayName}</Link>
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
        {post.content && <div className="post-content">{post.content}</div>}

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
          post.video.endsWith('.mp4') || post.video.endsWith('.webm') ? (
            <video controls className="post-img-single" style={{ cursor: 'default', maxHeight: 360 }}>
              <source src={post.video}/>
            </video>
          ) : (
            <iframe src={getEmbedUrl(post.video)} title="Video"
              style={{ width: '100%', height: '340px', border: 'none', display: 'block' }} allowFullScreen/>
          )
        )}

        <div className="post-actions">
          <button className={`action-btn${liked ? ' liked' : ''}`} onClick={handleLike} aria-label="Like">
            <FiHeart size={15}/> {likeCount}
          </button>
          <Link to={`/post/${post.post_id}`} className="action-btn" aria-label="Comments">
            <FiMessageCircle size={15}/> {Number(post.comment_count) || 0}
          </Link>
          <div className="post-actions-right">
            <button
              className="action-btn"
              onClick={() => setShowPlaylistModal(true)}
              title="Add to playlist"
              aria-label="Add to playlist"
            >
              <FiPlus size={15}/>
            </button>
            <button
              className={`action-btn${saved ? ' saved' : ''}`}
              onClick={handleSave}
              title={saved ? 'Remove from watchlist' : 'Save to watchlist'}
            >
              <FiBookmark size={15}/>
            </button>
          </div>
        </div>
      </div>

      {lightboxOpen && allImages.length > 0 && (
        <ImageModal images={allImages} startIndex={lightboxIndex} onClose={() => setLightboxOpen(false)}/>
      )}
      {showPlaylistModal && (
        <PlaylistModal postId={post.post_id} onClose={() => setShowPlaylistModal(false)}/>
      )}
    </>
  );
};

export default PostCard;
