import React, { useState, useEffect } from 'react';
import { API } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiShield } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';

const Moderation = () => {
  const { user }          = useAuth();
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, uRes] = await Promise.all([
          API.get('/posts/pending'),
          API.get(`/users/${user.user_id}`),
        ]);
        setPosts(pRes.data);
        setProfile(uRes.data);
      } catch (err) {
        if (err.response?.status === 403) {
          setProfile({ is_expert: false });
        } else {
          toast.error('Failed to load moderation queue');
        }
      } finally { setLoading(false); }
    };
    load();
  }, [user]);

  const approve = async (postId) => {
    try {
      await API.post(`/posts/${postId}/approve`);
      setPosts(prev => prev.filter(p => p.post_id !== postId));
      toast.success('Post approved and published');
    } catch { toast.error('Failed to approve'); }
  };

  const reject = async (postId) => {
    if (!window.confirm('Reject and permanently delete this post?')) return;
    try {
      await API.delete(`/posts/${postId}/reject`);
      setPosts(prev => prev.filter(p => p.post_id !== postId));
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
        <p style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>Earn 100+ knowledge points and request expert status from your profile.</p>
      </div>
    </div>
  );

  return (
    <div className="feed-container">
      <div className="page-header">
        <h2><FiShield style={{ display: 'inline', marginRight: 8 }} />Moderation Queue</h2>
        <p>{posts.length} post{posts.length !== 1 ? 's' : ''} awaiting review</p>
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
                    style={{ flex: 1, background: 'rgba(5,150,105,0.1)', color: 'var(--success)', border: '1px solid rgba(5,150,105,0.3)' }}
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