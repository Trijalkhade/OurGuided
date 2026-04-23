import React, { useState, useEffect } from 'react';
import { API } from '../context/AuthContext';
import PostCard from '../components/PostCard.jsx';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { SkelExplore, SkelFeed } from '../components/Skeleton.jsx';

const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";
const Explore = () => {
  const [categories, setCategories]       = useState([]);
  const [selected, setSelected]           = useState(null);
  const [posts, setPosts]                 = useState([]);
  const [interests, setInterests]         = useState([]);
  const [loadingCats, setLoadingCats]     = useState(true);
  const [loadingPosts, setLoadingPosts]   = useState(false);
  const [errorCats, setErrorCats]         = useState(false);
  const [errorPosts, setErrorPosts]       = useState(false);
  const [savingInterests, setSavingInterests] = useState(false);
  const [activeTab, setActiveTab]         = useState('recommended');

  // 🚀 SEO CONTENT FOR GOOGLE
  if (isPrerender) {
    return (
      <div>
        <h1>Explore Skills and Knowledge</h1>
        <p>Discover real-world skills shared by professionals and students.</p>
      </div>
    );
  }

  const load = async () => {
    setLoadingCats(true);
    setErrorCats(false);
    try {
      const [catRes, recRes] = await Promise.all([
        API.get('/categories'),
        API.get('/categories/recommended'),
      ]);
      setCategories(catRes.data);
      setPosts(recRes.data.posts || []);
      setInterests((recRes.data.interests || []).map(n => {
        const cat = catRes.data.find(c => c.name === n);
        return cat ? cat.category_id : null;
      }).filter(Boolean));
    } catch { 
      setErrorCats(true);
      toast.error('Failed to load explore'); 
    }
    finally { setLoadingCats(false); }
  };

  useEffect(() => {
    load();
  }, []);

  const loadCategory = async (catName) => {
    setSelected(catName);
    setActiveTab('category');
    setLoadingPosts(true);
    setErrorPosts(false);
    try {
      const { data } = await API.get(`/posts/feed?category=${encodeURIComponent(catName)}`);
      setPosts(data);
    } catch { 
      setErrorPosts(true);
      toast.error('Failed to load category'); 
    }
    finally { setLoadingPosts(false); }
  };

  const loadRecommended = async () => {
    setSelected(null);
    setActiveTab('recommended');
    setLoadingPosts(true);
    setErrorPosts(false);
    try {
      const { data } = await API.get('/categories/recommended');
      setPosts(data.posts || []);
    } catch { 
      setErrorPosts(true);
      toast.error('Failed to load recommendations'); 
    }
    finally { setLoadingPosts(false); }
  };

  const toggleInterest = (catId) => {
    setInterests(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]);
  };

  const saveInterests = async () => {
    setSavingInterests(true);
    try {
      await API.post('/categories/interests', { category_ids: interests });
      toast.success('Interests updated! Recommendations refreshed.');
      await loadRecommended();
    } catch { toast.error('Failed to save interests'); }
    finally { setSavingInterests(false); }
  };

  if (loadingCats) return <SkelExplore />;

  if (errorCats) return (
    <div className="explore-page">
      <div className="empty-state" style={{ marginTop: '5rem' }}>
        <h3>Failed to load Explore</h3>
        <p>Something went wrong while fetching categories.</p>
        <button className="btn btn-primary" onClick={load} style={{ width: 'auto', marginTop: '1rem' }}>
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="explore-page">
      <div className="page-header">
        <h2>Explore</h2>
        <p>Browse skills by category and personalise your learning path</p>
      </div>

      {/* Category Grid */}
      <div className="category-grid">
        {categories.map(cat => (
          <button
            key={cat.category_id}
            className={`category-card ${selected === cat.name ? 'active' : ''}`}
            onClick={() => loadCategory(cat.name)}
          >
            <span className="cat-icon">{cat.icon}</span>
            <span className="cat-name">{cat.name}</span>
            <span className="cat-count">{cat.post_count} posts · {cat.quiz_count} quizzes</span>
          </button>
        ))}
      </div>

      {/* Interest Selector */}
      <div className="interest-card">
        <div className="interest-card-header">
          <div>
            <h3>Your Interests</h3>
            <p>Select categories to personalise your feed</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveInterests} disabled={savingInterests}>
            {savingInterests ? 'Saving…' : 'Save Interests'}
          </button>
        </div>
        <div className="interest-chips">
          {categories.map(cat => (
            <button
              key={cat.category_id}
              className={`interest-chip ${interests.includes(cat.category_id) ? 'selected' : ''}`}
              onClick={() => toggleInterest(cat.category_id)}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button className={`tab ${activeTab === 'recommended' ? 'active' : ''}`} onClick={loadRecommended}>
          ✨ Recommended
        </button>
        {selected && (
          <button className={`tab ${activeTab === 'category' ? 'active' : ''}`}>
            {(categories.find(c => c.name === selected) || {}).icon} {selected}
          </button>
        )}
      </div>

      {/* Posts */}
      {loadingPosts ? (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <SkelFeed />
        </div>
      ) : errorPosts ? (
        <div className="empty-state">
          <h3>Failed to load category</h3>
          <p>Please try again.</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <h3>No posts yet in this category</h3>
          <p>Be the first to share knowledge here!</p>
        </div>
      ) : (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {posts.map(post => <PostCard key={post.post_id} post={post} />)}
        </div>
      )}
    </div>
  );
};

export default Explore;
