import React, { useState, useEffect } from 'react';
import { useAuth, API } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import PostCard from '../components/PostCard.jsx';
import useFeedback from '../utils/useFeedback';
import { SkelFeed } from '../components/Skeleton.jsx';
import { FiImage, FiTag, FiSend, FiEyeOff, FiChevronDown, FiZap } from 'react-icons/fi';
import toast from 'react-hot-toast';
const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";
const CATEGORIES = [
  'Engineering', 'Business', 'Life Skills', 'Psychology',
  'Teaching Skills', 'Health & Nutrition', 'Physical Fitness', 'Agriculture',
];

const CreatePost = ({ onPostCreated }) => {
  const { user } = useAuth();
  const { onTap, onSuccess, onError, onCreateSuccess } = useFeedback();
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [category, setCategory] = useState('');
  const [isAnon, setIsAnon] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [loading, setLoading] = useState(false);

  const initials = (user && user.username ? user.username[0] : '?') && (user.username[0] || '?').toUpperCase();

  const handleSubmit = async () => {
    if (!content.trim() && imageFiles.length === 0 && !videoUrl.trim())
      return toast.error('Add some content to post');
    onTap();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('content', content);
      fd.append('tags', tags);
      fd.append('is_anonymous', isAnon ? 'true' : 'false');
      if (category) fd.append('category', category);
      if (imageFiles.length > 0) {
        fd.append('image', imageFiles[0]);
        for (let i = 1; i < imageFiles.length; i++) fd.append('images', imageFiles[i]);
      }
      if (videoUrl.trim()) fd.append('video', videoUrl.trim());
      await API.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setContent(''); setTags(''); setImageFiles([]);
      setVideoUrl(''); setCategory(''); setIsAnon(false); setShowExtra(false);
      onCreateSuccess(); // Beep + chime on post created
      toast.success('Post created!');
      onPostCreated && onPostCreated();
    } catch (err) { 
      onError();
      toast.error((err.response && err.response.data && err.response.data.message) || 'Failed to create post'); 
    }
    finally { setLoading(false); }
  };

  return (
    <div className="create-post">
      <div className="create-post-top">
        <div className="avatar" style={{ flexShrink: 0 }}>
          {user && user.photo ? <img src={user.photo} alt={user.username} /> : initials}
        </div>
        <textarea className="post-input"
          placeholder="Share your knowledge, a skill, or a learning insight…"
          value={content} onChange={e => setContent(e.target.value)} rows={3} />
      </div>

      {showExtra && (
        <div style={{ marginTop: '.72rem', display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
            <FiTag size={13} style={{ color: 'var(--text3)', flexShrink: 0 }} />
            <input placeholder="Tags (comma separated)…" value={tags} onChange={e => setTags(e.target.value)}
              style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '.42rem .72rem', fontSize: '.85rem', color: 'var(--text)', outline: 'none' }} />
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '.42rem .72rem', fontSize: '.85rem', color: 'var(--text)', outline: 'none' }}>
            <option value="">No category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div>
            <label style={{ display: 'block', fontSize: '.7rem', color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '.3rem' }}>Images (up to 5)</label>
            <input type="file" accept="image/*" multiple onChange={e => setImageFiles(Array.from(e.target.files || []).slice(0, 5))} />
            {imageFiles.length > 0 && <div style={{ fontSize: '.76rem', color: 'var(--text3)', marginTop: '.25rem' }}>{imageFiles.length} image{imageFiles.length > 1 ? 's' : ''} selected</div>}
          </div>
          <input placeholder="Video URL (YouTube or .mp4)…" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '.42rem .72rem', fontSize: '.85rem', color: 'var(--text)', outline: 'none' }} />
        </div>
      )}

      <div className="create-post-actions">
        <div className="post-media-btns">
          <button className="media-btn" onClick={() => setShowExtra(v => !v)}>
            <FiImage size={13} /> Media &amp; Options
            <FiChevronDown size={12} style={{ transform: showExtra ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
          </button>
          <button className={`media-btn ${isAnon ? 'selected' : ''}`} onClick={() => setIsAnon(v => !v)}>
            <FiEyeOff size={13} /> {isAnon ? 'Anonymous ON' : 'Anonymous'}
          </button>
        </div>
        <button className="btn btn-primary" style={{ width: 'auto', padding: '.55rem 1.2rem' }}
          onClick={handleSubmit} disabled={loading}>
          <FiSend size={13} /> {loading ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
};

const Feed = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [catFilter, setCatFilter] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [useRec, setUseRec] = useState(true); // toggle recommended vs chronological
  const [fetching, setFetching] = useState(true);
  const [error, setError]       = useState(false);

  useEffect(() => {
    if (!loading && !user && !isPrerender) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  // 🚀 SEO CONTENT FOR GOOGLE
  if (isPrerender) {
    return (
      <div>
        <h1>Learn Real World Skills from Real People</h1>
        <p>Explore practical knowledge, experiences, and career insights shared by real users.</p>
      </div>
    );
  }

  if (!user) return null;

  const fetchPosts = async (p = 1, cat = catFilter, rec = useRec) => {
    setFetching(true);
    setError(false);
    try {
      let data;
      if (rec && !cat) {
        // Use recommendation engine
        const res = await API.get(`/recommendations/feed?page=${p}`);
        data = res.data.posts;
        setHasMore(res.data.has_more);
        setPosts(prev => p === 1 ? data : [...prev, ...data]);
      } else {
        // Fallback: chronological with optional category filter
        const params = new URLSearchParams({ page: p });
        if (cat) params.set('category', cat);
        const res = await API.get(`/posts/feed?${params}`);
        data = res.data;
        setHasMore(data.length === 10);
        setPosts(prev => p === 1 ? data : [...prev, ...data]);
      }
    } catch (err) { 
      console.error(err);
      setError(true);
      toast.error('Failed to load feed'); 
    }
    finally { setFetching(false); }
  };

  useEffect(() => { setPage(1); fetchPosts(1, catFilter, useRec); }, [catFilter, useRec]); // eslint-disable-line

  const handleDelete = (postId) => setPosts(prev => prev.filter(p => p.post_id !== postId));

  return (
    <div className="feed-container">

      <CreatePost onPostCreated={() => { setPage(1); fetchPosts(1, catFilter, useRec); }} />

      {/* Mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <button
          className={`media-btn ${useRec && !catFilter ? 'selected' : ''}`}
          onClick={() => { setCatFilter(''); setUseRec(true); }}
          title="Personalised recommendations"
        >
          <FiZap size={13} /> For You
        </button>
        <button
          className={`media-btn ${!useRec && !catFilter ? 'selected' : ''}`}
          onClick={() => { setCatFilter(''); setUseRec(false); }}
          title="Chronological feed"
        >
          Latest
        </button>
      </div>

      {/* Category filter strip */}
      <div className="feed-filter-strip">
        {CATEGORIES.slice(0, 6).map(c => (
          <button key={c}
            className={`media-btn ${catFilter === c ? 'selected' : ''}`}
            onClick={() => { setCatFilter(catFilter === c ? '' : c); setUseRec(false); }}>
            {c}
          </button>
        ))}
      </div>

      {fetching && posts.length === 0 ? (
        <SkelFeed />
      ) : error && posts.length === 0 ? (
        <div className="empty-state">
          <FiZap size={24} style={{ color: 'var(--danger)', marginBottom: '0.5rem' }} />
          <h3>Connection issues</h3>
          <p>We couldn't reach the server. Please check your connection.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchPosts(1, catFilter, useRec)} style={{ marginTop: '1rem' }}>
            Try Again
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <h3>No posts yet</h3>
          <p>Be the first to share something!</p>
        </div>
      ) : (
        <>
          {posts.map(post => (
            <PostCard key={post.post_id} post={post} onDelete={handleDelete} />
          ))}
          {hasMore && (
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => { const next = page + 1; setPage(next); fetchPosts(next, catFilter, useRec); }}
              disabled={fetching}
            >
              {fetching ? 'Loading more…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default Feed;
