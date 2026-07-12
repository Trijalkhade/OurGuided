import React, { useState, useEffect } from 'react';
import { API } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiShield, FiZap } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import * as cache from '../utils/cache';

const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";

const Moderation = () => {
  const { user }          = useAuth();

  const cachedQueue   = cache.get('moderation:queue');
  const cachedProfile = cache.get(`profile:${user.user_id}`);

  const [posts, setPosts] = useState(cachedQueue ? cachedQueue.data : []);
  const [profile, setProfile] = useState(cachedProfile ? cachedProfile.data : null);
  const [loading, setLoading] = useState(!cachedQueue || !cachedProfile);

  const [jobStatus, setJobStatus] = useState(null);
  const [training, setTraining] = useState(false);

  const fetchJobStatus = async () => {
    try {
      const { data } = await API.get('/admin/recommendations/status');
      if (data.success) {
        setJobStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch training status', err);
    }
  };

  useEffect(() => {
    const load = async (silent = false) => {
      try {
        const [pRes, uRes] = await Promise.all([
          API.get('/posts/pending'),
          cachedProfile && !cachedProfile.stale
            ? Promise.resolve({ data: cachedProfile.data })
            : API.get(`/users/${user.user_id}`),
        ]);
        setPosts(pRes.data);
        setProfile(uRes.data);
        cache.set('moderation:queue', pRes.data, 'moderation');
        cache.set(`profile:${user.user_id}`, uRes.data, 'profile_own');
      } catch (err) {
        if (err.response?.status === 403) {
          setProfile({ is_expert: false });
        } else {
          if (!silent) toast.error('Failed to load moderation queue');
        }
      } finally { setLoading(false); }
    };
    if (cachedQueue && cachedProfile) {
      load(true); // silent revalidate
    } else {
      load();
    }
    fetchJobStatus();
  }, [user]);

  useEffect(() => {
    let interval;
    if (jobStatus?.status === 'running') {
      interval = setInterval(fetchJobStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [jobStatus?.status]);

  const startTraining = async () => {
    setTraining(true);
    try {
      const { data } = await API.post('/admin/recommendations/train');
      if (data.success) {
        toast.success('Recommendation model training started!');
        fetchJobStatus();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start training');
    } finally {
      setTraining(false);
    }
  };

  const approve = async (postId) => {
    try {
      await API.post(`/posts/${postId}/approve`);
      setPosts(prev => prev.filter(p => p.post_id !== postId));
      cache.invalidate('moderation:queue');
      toast.success('Post approved and published');
    } catch { toast.error('Failed to approve'); }
  };

  const reject = async (postId) => {
    if (!window.confirm('Reject and permanently delete this post?')) return;
    try {
      await API.delete(`/posts/${postId}/reject`);
      setPosts(prev => prev.filter(p => p.post_id !== postId));
      cache.invalidate('moderation:queue');
      toast.success('Post rejected');
    } catch { toast.error('Failed to reject'); }
  };

  if (loading) return (
    <div className="feed-container">
      <div className="loading-screen" style={{ height: '50vh' }}><div className="spinner" /></div>
    </div>
  );

  if (!profile?.is_expert) return (
    <div className="feed-container">
      <div className="empty-state" style={{ paddingTop: '4rem' }}>
        <FiShield size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
        <h3>Expert Access Required</h3>
        <p>Only verified experts can access the moderation queue.</p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>Earn 100+ points and request expert status from your profile.</p>
      </div>
    </div>
  );

  return (
    <div className="feed-container">
      <div className="page-header">
        <h2><FiShield style={{ display: 'inline', marginRight: 8 }} />Moderation Queue</h2>
        <p>{posts.length} post{posts.length !== 1 ? 's' : ''} awaiting review</p>
      </div>

      {/* Recommendation Engine Panel */}
      <div className="mod-card" style={{ marginBottom: '1.5rem', background: 'var(--accent-bg-light)', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <FiZap style={{ color: 'var(--accent)' }} /> Recommendation System Training
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text3)', margin: '0.4rem 0 0.8rem 0' }}>
          Train the personalized feed models on historical user interaction data on-demand.
        </p>

        {jobStatus && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text2)', background: 'var(--bg3)', padding: '0.65rem 0.85rem', borderRadius: 8, marginBottom: '0.8rem', border: '1px solid var(--border)' }}>
            <div><strong>Status:</strong> <span style={{ textTransform: 'capitalize', color: jobStatus.status === 'completed' ? 'var(--success)' : jobStatus.status === 'running' ? 'var(--accent)' : jobStatus.status === 'failed' ? 'var(--danger)' : 'var(--text)' }}>{jobStatus.status}</span></div>
            {jobStatus.status === 'running' && (
              <div style={{ marginTop: '0.2rem' }}>
                Processing: {jobStatus.users_processed} users / {jobStatus.posts_scored} posts scored...
              </div>
            )}
            {jobStatus.status === 'completed' && jobStatus.completed_at && (
              <div style={{ marginTop: '0.2rem', color: 'var(--text3)' }}>
                Last trained: {new Date(jobStatus.completed_at).toLocaleString()} ({jobStatus.users_processed} users, {jobStatus.posts_scored} posts scored)
              </div>
            )}
            {jobStatus.status === 'failed' && jobStatus.error_message && (
              <div style={{ marginTop: '0.2rem', color: 'var(--danger)' }}>
                Error: {jobStatus.error_message}
              </div>
            )}
          </div>
        )}

        <button
          className="btn btn-primary btn-sm"
          style={{ width: 'auto', padding: '0.42rem 1rem' }}
          onClick={startTraining}
          disabled={training || jobStatus?.status === 'running'}
        >
          {training || jobStatus?.status === 'running' ? 'Training in Progress...' : 'Start Training Now'}
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="empty-state">
          <FiCheck size={40} style={{ color: 'var(--success)', opacity: 0.5, marginBottom: '1rem' }} />
          <h3>All clear!</h3>
          <p>No posts pending moderation right now.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {posts.map(post => {
            const displayName = post.is_anonymous ? 'Anonymous' : post.first_name
              ? `${post.first_name} ${post.last_name || ''}`.trim() : post.username;

            return (
              <div key={post.post_id} className="mod-card">
                <div className="mod-card-header">
                  <div className="avatar" style={{ width: 36, height: 36, fontSize: '0.85rem', flexShrink: 0 }}>
                    {displayName[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{displayName}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', fontFamily: 'Space Mono, monospace' }}>
                      {post.post_date ? formatDistanceToNow(new Date(post.post_date), { addSuffix: true }) : ''}
                      {post.category && <> · {post.category}</>}
                    </div>
                  </div>
                </div>

                {post.content && (
                  <div style={{ padding: '0.75rem 0', fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text2)', borderTop: '1px solid var(--border)', marginTop: '0.75rem' }}>
                    {post.content}
                  </div>
                )}

                {post.tags && (
                  <div className="post-tags" style={{ padding: 0, marginBottom: '0.75rem' }}>
                    {post.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                      <span key={tag} className="tag">#{tag}</span>
                    ))}
                  </div>
                )}

                {post.media_type === 'image' && post.image && (
                  <img src={post.image} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 10, marginBottom: '0.75rem' }} />
                )}

                <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                  <button
                    className="btn btn-sm"
                    style={{ flex: 1, background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' }}
                    onClick={() => approve(post.post_id)}
                  >
                    <FiCheck size={14} /> Approve & Publish
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => reject(post.post_id)}
                  >
                    <FiX size={14} /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Moderation;
