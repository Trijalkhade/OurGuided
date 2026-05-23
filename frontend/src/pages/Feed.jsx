import React, { useState, useEffect, useRef } from 'react';
import { useAuth, API } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import PostCard from '../components/PostCard.jsx';
import useFeedback from '../utils/useFeedback';
import { SkelFeed } from '../components/Skeleton.jsx';
import { FiImage, FiTag, FiSend, FiEyeOff, FiChevronDown, FiZap } from 'react-icons/fi';
import toast from 'react-hot-toast';

const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";

const CATEGORIES = [
  'Real Talk', 'Experiments & Ideas', 'Loopholes & Fixes', 'Life Hacks',
  'Youth & Education', 'Health & Body', 'Earth & Hands', 'Economy & Power',
];

// ── Module-level in-memory cache (no sessionStorage quota risk) ───────────────
// This survives React navigation within the same browser tab session.
let feedCache = null;

/* ── CreatePost ──────────────────────────────────────────────────────────────── */
const CreatePost = ({ onPostCreated }) => {
  const { user } = useAuth();
  const { onTap, onSuccess, onError, onCreateSuccess } = useFeedback();
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [category, setCategory] = useState('');
  const [isAnon, setIsAnon] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [loading, setLoading] = useState(false);

  const initials = (user && user.username ? user.username[0] : '?') && (user.username[0] || '?').toUpperCase();

  const handleSubmit = async () => {
    if (!content.trim() && imageFiles.length === 0 && !videoUrl.trim() && !videoFile)
      return toast.error('Add some media or text to post');
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
      if (videoFile) fd.append('video', videoFile);
      if (videoUrl.trim()) fd.append('video', videoUrl.trim());
      await API.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setContent(''); setTags(''); setImageFiles([]);
      setVideoUrl(''); setVideoFile(null); setCategory(''); setIsAnon(false); setShowExtra(false);
      onCreateSuccess();
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
          placeholder="What's on your mind? Share a real thought, a life hack, a truth, or call something out…"
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
            <label style={{ display: 'block', fontSize: '.7rem', color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '.3rem' }}>Images (up to 6)</label>
            <input type="file" accept="image/*" multiple onChange={e => setImageFiles(Array.from(e.target.files || []).slice(0, 6))} />
            {imageFiles.length > 0 && <div style={{ fontSize: '.76rem', color: 'var(--text3)', marginTop: '.25rem' }}>{imageFiles.length} image{imageFiles.length > 1 ? 's' : ''} selected</div>}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '.5rem' }}>
            <label style={{ display: 'block', fontSize: '.7rem', color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '.3rem' }}>Video (MP4)</label>
            <input type="file" accept="video/mp4,video/x-m4v,video/*" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
            {videoFile && <div style={{ fontSize: '.76rem', color: 'var(--text3)', marginTop: '.25rem' }}>Video selected: {videoFile.name}</div>}
          </div>
          <input placeholder="Or Video URL (YouTube)…" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
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

/* ── Feed ────────────────────────────────────────────────────────────────────── */
const Feed = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // ── Refs (ALL before any early return) ──────────────────────────────────────
  const stateRef          = useRef();
  const pendingScrollRef  = useRef(null);
  const isInitialMount    = useRef(true);

  // Determine return-visit once at mount. useRef ensures it's stable across re-renders.
  const isReturnVisit = useRef(
    sessionStorage.getItem('returning_from_post') === 'true' && feedCache !== null
  ).current;

  // ── State (ALL before any early return) ─────────────────────────────────────
  const [posts,     setPosts]     = useState(isReturnVisit ? feedCache.posts     : []);
  const [page,      setPage]      = useState(isReturnVisit ? feedCache.page       : 1);
  const [catFilter, setCatFilter] = useState(isReturnVisit ? feedCache.catFilter  : '');
  const [hasMore,   setHasMore]   = useState(isReturnVisit ? feedCache.hasMore    : true);
  const [useRec,    setUseRec]    = useState(isReturnVisit ? feedCache.useRec     : true);
  const [fetching,  setFetching]  = useState(!isReturnVisit);
  const [error,     setError]     = useState(false);

  stateRef.current = { posts, page, catFilter, hasMore, useRec };

  // ── fetchPosts (defined before effects that call it) ────────────────────────
  const fetchPosts = async (p = 1, cat = catFilter, rec = useRec) => {
    setFetching(true);
    setError(false);
    try {
      let data;
      if (rec && !cat) {
        const res = await API.get(`/recommendations/feed?page=${p}`);
        data = res.data.posts;
        setHasMore(res.data.has_more);
        setPosts(prev => p === 1 ? data : [...prev, ...data]);
      } else {
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
    } finally {
      setFetching(false);
    }
  };

  // ── Effects (ALL before any early return) ───────────────────────────────────

  // Auth redirect
  useEffect(() => {
    if (!loading && !user && !isPrerender) navigate('/login');
  }, [user, loading, navigate]);

  // Mount: restore from cache or do a fresh fetch
  useEffect(() => {
    if (isReturnVisit) {
      sessionStorage.removeItem('returning_from_post');
      const savedScroll = sessionStorage.getItem('feed_scroll');
      if (savedScroll) pendingScrollRef.current = parseInt(savedScroll, 10);
      return; // Posts are already in state from cache; [posts] effect will scroll
    }
    feedCache = null; // clear stale cache on a fresh visit
    fetchPosts(1, catFilter, useRec);
  }, []); // eslint-disable-line

  // Filter/mode changes (skip on initial mount — handled above)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setPage(1);
    fetchPosts(1, catFilter, useRec);
  }, [catFilter, useRec]); // eslint-disable-line

  // Scroll restoration: fires AFTER posts are rendered into the DOM.
  // Double-rAF ensures the browser has finished layout and paint before scrolling.
  useEffect(() => {
    if (pendingScrollRef.current !== null && posts.length > 0) {
      const target = pendingScrollRef.current;
      pendingScrollRef.current = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: target, behavior: 'instant' });
        });
      });
    }
  }, [posts]);

  // Continuously track scroll position + save posts to in-memory cache on unmount
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem('feed_scroll', window.scrollY.toString());
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Save to in-memory module cache (no sessionStorage quota risk)
      feedCache = stateRef.current;
    };
  }, []);

  // ── Early returns (AFTER all hooks — Rules of Hooks satisfied) ───────────────
  if (isPrerender) {
    return (
      <div>
        <h1>OurGuided — Where Real People Share Real Things</h1>
        <p>No jargon, no courses, no fake professionalism. Just honest knowledge, opinions, life hacks, and truths — shared freely by students, professionals, and everyday people.</p>
      </div>
    );
  }

  if (!user) return null;

  // ── Handlers ────────────────────────────────────────────────────────────────
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
