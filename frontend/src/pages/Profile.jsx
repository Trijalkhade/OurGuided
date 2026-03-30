import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth, API } from '../context/AuthContext';
import PostCard from '../components/PostCard.jsx';
import {
  FiEdit, FiAward, FiBook, FiCode,
  FiUserPlus, FiUserCheck, FiUserX
} from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";
/*
 * Profile Page
 * ─────────────
 * Changes from original:
 * 1. "Contact" section (phones) REMOVED — no UI, data stays in DB / EditProfile only
 * 2. "Study" tab and all study/gamification stats REMOVED from UI
 * 3. Stats bar shows: Posts · Skills · Certs (removed "Knowledge" stat)
 * 4. Profile photo rendered properly with consistent avatar sizing & fallback
 * 5. Clean edu rows with type badge, institution, score
 */
const Profile = () => {
  const { id }    = useParams();
  const { user }  = useAuth();

  const [profile, setProfile]         = useState(null);
  const [posts, setPosts]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('posts');
  const [newSkill, setNewSkill]       = useState('');
  const [showSkillInput, setShowSkillInput] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('none');
  const [connectionLoading, setConnectionLoading] = useState(false);

  const isOwn = user?.user_id === Number(id);

  // 🚀 SEO CONTENT FOR GOOGLE
  if (isPrerender) {
    return (
      <div>
        <h1>User Profiles and Skills</h1>
        <p>Explore profiles of users sharing real-world experiences and knowledge.</p>
      </div>
    );
  }

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data }      = await API.get(`/users/${id}`);
      const { data: postsData } = await API.get(`/posts/user/${id}`);
      setProfile(data);
      setPosts(postsData);

      if (!isOwn) {
        const { data: connData } = await API.get(`/connections/status/${id}`);
        setConnectionStatus(connData.status);
      }
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    const onConnUpdated = () => fetchProfile();
    window.addEventListener('connectionsUpdated', onConnUpdated);
    return () => window.removeEventListener('connectionsUpdated', onConnUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isOwn]);

  /* Skills */
  const addSkill = async () => {
    if (!newSkill.trim()) return;
    try {
      const { data } = await API.post('/users/skills', { skill_name: newSkill });
      setProfile(prev => ({ ...prev, skills: [...(prev.skills || []), data] }));
      setNewSkill('');
      setShowSkillInput(false);
      toast.success('Skill added!');
    } catch { toast.error('Failed to add skill'); }
  };

  const removeSkill = async (skillId) => {
    try {
      await API.delete(`/users/skills/${skillId}`);
      setProfile(prev => ({ ...prev, skills: prev.skills.filter(s => s.skill_id !== skillId) }));
    } catch { toast.error('Failed to remove skill'); }
  };

  /* Connections */
  const handleSendRequest = async () => {
    setConnectionLoading(true);
    try {
      await API.post(`/connections/request/${id}`);
      setConnectionStatus('pending_sent');
      toast.success('Connection request sent!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send request'); }
    finally { setConnectionLoading(false); }
  };

  const handleRemoveConnection = async () => {
    if (!window.confirm('Remove this connection?')) return;
    setConnectionLoading(true);
    try {
      await API.delete(`/connections/remove/${id}`);
      setConnectionStatus('none');
      toast.success('Connection removed');
    } catch { toast.error('Failed to remove connection'); }
    finally { setConnectionLoading(false); }
  };

  if (loading) return (
    <div className="profile-container">
      <div className="loading-screen" style={{ height: '50vh' }}><div className="spinner" /></div>
    </div>
  );

  if (!profile) return (
    <div className="profile-container"><p style={{ padding: '2rem', color: 'var(--text3)' }}>Profile not found</p></div>
  );

  const displayName =
    `${profile.first_name || ''} ${profile.middle_name ? profile.middle_name + ' ' : ''}${profile.last_name || ''}`.trim()
    || profile.username;

  return (
    <div className="profile-container">

      {/* ── HEADER CARD ── */}
      <div className="profile-header-card">
        <div className="profile-cover-band" />

        <div className="profile-top">
          {/* Profile avatar — always visible, correct ratio */}
          <div className="profile-avatar">
            {profile.photo
              ? <img src={profile.photo} alt={displayName} />
              : displayName[0]?.toUpperCase() || '?'
            }
          </div>

          <div className="profile-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 className="profile-name">{displayName}</h1>
              {profile.is_expert && <span className="expert-badge">⭐ Expert</span>}
              {profile.core_level > 0 && (
                <span className="level-badge">Lv {Number(profile.core_level).toFixed(1)}</span>
              )}
            </div>
            <div className="profile-username">@{profile.username}</div>
            {profile.bio && <div className="profile-bio">{profile.bio}</div>}
          </div>

          {/* Edit / Connect button */}
          {isOwn ? (
            <Link to="/profile/edit" className="btn btn-secondary btn-sm">
              <FiEdit size={14} /> Edit
            </Link>
          ) : (
            <button
              className={`btn btn-sm ${connectionStatus === 'accepted' ? 'btn-danger' : 'btn-primary'}`}
              onClick={connectionStatus === 'accepted' ? handleRemoveConnection : handleSendRequest}
              disabled={connectionLoading || connectionStatus === 'pending_sent'}
              style={{ width: 'auto' }}
            >
              {connectionStatus === 'accepted'      && <><FiUserX size={14} /> Remove</>}
              {connectionStatus === 'pending_sent'  && <><FiUserCheck size={14} /> Request Sent</>}
              {connectionStatus === 'pending_received' && <>Pending…</>}
              {connectionStatus === 'none'          && <><FiUserPlus size={14} /> Connect</>}
            </button>
          )}
        </div>

        {/* Stats — Posts · Skills · Certs only (no gamification numbers) */}
        <div className="profile-stats">
          <div className="stat">
            <div className="stat-value">{profile.post_count ?? 0}</div>
            <div className="stat-label">Posts</div>
          </div>
          <div className="stat">
            <div className="stat-value">{profile.skills?.length ?? 0}</div>
            <div className="stat-label">Skills</div>
          </div>
          <div className="stat">
            <div className="stat-value">{profile.certifications?.length ?? 0}</div>
            <div className="stat-label">Certs</div>
          </div>
          <div className="stat">
            <div className="stat-value">{profile.education?.length ?? 0}</div>
            <div className="stat-label">Education</div>
          </div>
        </div>

        {/* Badges */}
        {profile.badges && (
          <div className="profile-badges">
            {String(profile.badges).split(',').map(b => b.trim()).filter(Boolean).map(b => (
              <span key={b} className="badge">🏅 {b}</span>
            ))}
          </div>
        )}

        <div className="joined-date">
          Joined {profile.join_date
            ? formatDistanceToNow(new Date(profile.join_date), { addSuffix: true })
            : 'recently'}
        </div>
      </div>

      {/* ── TABS — no Study tab, no Contact section ── */}
      <div className="tabs">
        <button className={`tab${activeTab === 'posts'     ? ' active' : ''}`} onClick={() => setActiveTab('posts')}>Posts</button>
        <button className={`tab${activeTab === 'skills'    ? ' active' : ''}`} onClick={() => setActiveTab('skills')}>Skills & Certs</button>
        <button className={`tab${activeTab === 'education' ? ' active' : ''}`} onClick={() => setActiveTab('education')}>Education</button>
      </div>

      {/* ── POSTS ── */}
      {activeTab === 'posts' && (
        posts.length === 0
          ? <div className="empty-state"><h3>No posts yet</h3><p>Share something to get started!</p></div>
          : posts.map(post => (
            <PostCard
              key={post.post_id}
              post={post}
              onDelete={pid => setPosts(prev => prev.filter(p => p.post_id !== pid))}
            />
          ))
      )}

      {/* ── SKILLS & CERTIFICATIONS ── */}
      {activeTab === 'skills' && (
        <>
          {/* Skills */}
          <div className="info-card">
            <h3><FiCode size={12} />Skills</h3>
            {(!profile.skills || profile.skills.length === 0) ? (
              <p style={{ color: 'var(--text3)', fontSize: '0.875rem' }}>No skills added yet.</p>
            ) : (
              <div className="skill-chips">
                {profile.skills.map(s => (
                  <div key={s.skill_id} className="skill-chip">
                    {s.skill_name}
                    {isOwn && (
                      <button className="remove-btn" onClick={() => removeSkill(s.skill_id)} aria-label={`Remove ${s.skill_name}`}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {isOwn && (
              <div style={{ marginTop: '1rem' }}>
                {showSkillInput ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      className="comment-input"
                      placeholder="Skill name…"
                      value={newSkill}
                      onChange={e => setNewSkill(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addSkill()}
                      autoFocus
                    />
                    <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={addSkill}>Add</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowSkillInput(false)}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowSkillInput(true)}>+ Add Skill</button>
                )}
              </div>
            )}
          </div>

          {/* Certifications */}
          <div className="info-card">
            <h3><FiAward size={12} />Certifications</h3>
            {(!profile.certifications || profile.certifications.length === 0) ? (
              <p style={{ color: 'var(--text3)', fontSize: '0.875rem' }}>No certifications yet.</p>
            ) : (
              profile.certifications.map(c => (
                <div key={c.certification_id} className="cert-card">
                  {c.certificate_img ? (
                    <img
                      src={`data:image/jpeg;base64,${c.certificate_img}`}
                      alt="Certificate"
                      className="cert-img"
                    />
                  ) : (
                    <div className="cert-icon">🏆</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cert-name">{c.certification_name}</div>
                    {c.issued_by && <div className="cert-by">{c.issued_by}</div>}
                    {(c.issued_date || c.expiry_date) && (
                      <div className="cert-dates">
                        {c.issued_date && `Issued: ${new Date(c.issued_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`}
                        {c.expiry_date && ` · Expires: ${new Date(c.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`}
                      </div>
                    )}
                    {c.certificate_url && (
                      <a className="cert-link" href={c.certificate_url} target="_blank" rel="noreferrer">
                        View Certificate ↗
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
            {isOwn && (
              <Link to="/profile/edit?tab=cert" className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem', display: 'inline-flex' }}>
                + Add Certification
              </Link>
            )}
          </div>
        </>
      )}

      {/* ── EDUCATION ── */}
      {activeTab === 'education' && (
        <div className="info-card">
          <h3><FiBook size={12} />Education</h3>
          {(!profile.education || profile.education.length === 0) ? (
            <p style={{ color: 'var(--text3)', fontSize: '0.875rem' }}>No education records added.</p>
          ) : (
            profile.education.map((e, i) => (
              <div key={i} className="edu-row">
                <span className="edu-type-badge">{e.type}</span>
                <div>
                  <div className="edu-institution">{e.institution}</div>
                </div>
                <span className="edu-score">{e.score}</span>
              </div>
            ))
          )}
          {isOwn && (
            <Link to="/profile/edit?tab=education" className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem', display: 'inline-flex' }}>
              <FiEdit size={13} /> Add Education
            </Link>
          )}
        </div>
      )}

    </div>
  );
};

export default Profile;
