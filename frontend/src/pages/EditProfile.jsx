import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, API } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiTrash2, FiPlus, FiPhone } from 'react-icons/fi';

const EditProfile = () => {
  const { user }          = useAuth();
  const navigate          = useNavigate();
  const [searchParams]    = useSearchParams();
  const defaultTab        = searchParams.get('tab') || 'profile';

  const [activeTab,    setActiveTab]    = useState(defaultTab);
  const [loading,      setLoading]      = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [dragActive,   setDragActive]   = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [profile, setProfile] = useState({ bio: '', first_name: '', middle_name: '', last_name: '', dob: '', photo: null });
  const [edu,     setEdu]     = useState({ type: 'University', institution: '', score: '' });
  const [cert,    setCert]    = useState({ certification_name: '', certificate_url: '', certificate_img: null });

  /* Phone state */
  const [phones,      setPhones]      = useState([]);
  const [phoneForm,   setPhoneForm]   = useState({ phone_no: '', about: '' });
  const [phoneLoading, setPhoneLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await API.get(`/users/${user.user_id}`);
        setProfile({
          bio:         data.bio         || '',
          first_name:  data.first_name  || '',
          middle_name: data.middle_name || '',
          last_name:   data.last_name   || '',
          dob:         data.dob ? data.dob.split('T')[0] : '',
          photo:       data.photo       || null,
        });
        setPhones(data.phones || []);
      } catch { toast.error('Failed to load profile'); }
      finally  { setFetchLoading(false); }
    };
    load();
  }, [user]);

  const saveProfile = async () => {
    if (!profile.first_name.trim() || !profile.last_name.trim())
      return toast.error('First and Last name are required');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('first_name',  profile.first_name);
      fd.append('middle_name', profile.middle_name);
      fd.append('last_name',   profile.last_name);
      fd.append('bio',         profile.bio);
      if (profile.dob)                    fd.append('dob',   profile.dob);
      if (profile.photo instanceof File)  fd.append('photo', profile.photo);
      await API.put('/users/profile/update', fd);
      toast.success('Profile updated!');
      navigate(`/profile/${user.user_id}`);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const saveEducation = async () => {
    if (!edu.type || !edu.institution.trim() || !edu.score)
      return toast.error('All fields are required');
    setLoading(true);
    try {
      await API.post('/users/education', edu);
      toast.success('Education saved');
      setEdu({ type: 'University', institution: '', score: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const addCert = async () => {
    if (!cert.certification_name.trim()) return toast.error('Certification name required');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('certification_name', cert.certification_name);
      if (cert.certificate_url)            fd.append('certificate_url', cert.certificate_url);
      if (cert.certificate_img instanceof File) fd.append('certificate_img', cert.certificate_img);
      await API.post('/users/certifications', fd, {
        onUploadProgress: e => { if (e.total) setUploadProgress(Math.round(e.loaded / e.total * 100)); },
      });
      toast.success('Certification added!');
      setUploadProgress(0);
      setCert({ certification_name: '', certificate_url: '', certificate_img: null });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const addPhone = async () => {
    if (!phoneForm.phone_no.trim()) return toast.error('Phone number required');
    setPhoneLoading(true);
    try {
      const { data } = await API.post('/users/phones', phoneForm);
      setPhones(prev => [...prev, data]);
      setPhoneForm({ phone_no: '', about: '' });
      toast.success('Phone number added!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setPhoneLoading(false); }
  };

  const deletePhone = async (phoneId) => {
    if (!window.confirm('Remove this phone number?')) return;
    try {
      await API.delete(`/users/phones/${phoneId}`);
      setPhones(prev => prev.filter(p => p.phone_id !== phoneId));
      toast.success('Phone removed');
    } catch { toast.error('Failed to remove'); }
  };

  const setP = (k) => (e) => setProfile(prev => ({ ...prev, [k]: e.target.value }));
  const setE = (k) => (e) => setEdu(prev => ({ ...prev, [k]: e.target.value }));

  const photoPreview = profile.photo instanceof File
    ? URL.createObjectURL(profile.photo)
    : (profile.photo || null);

  const TABS = [
    { key: 'profile',   label: 'Profile' },
    { key: 'phone',     label: 'Phone' },
    { key: 'education', label: 'Education' },
    { key: 'cert',      label: 'Certification' },
  ];

  if (fetchLoading) return (
    <div className="feed-container">
      <div className="loading-screen" style={{ height: '50vh' }}><div className="spinner"/></div>
    </div>
  );

  return (
    <div className="feed-container">
      <div className="page-header">
        <h2>Edit Profile</h2>
        <p>Update your information and credentials</p>
      </div>

      <div className="tabs">
        {TABS.map(({ key, label }) => (
          <button key={key} className={`tab ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Profile Tab ── */}
      {activeTab === 'profile' && (
        <div className="info-card">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.75rem' }}>
            <label style={{ position: 'relative', cursor: 'pointer', display: 'block' }}>
              <div style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--border)', background: 'linear-gradient(135deg, var(--accent), var(--accent3))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '2rem', fontWeight: 800 }}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}/>
                ) : (
                  (profile.first_name || user?.username || '?')[0]?.toUpperCase()
                )}
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: '.7rem', textAlign: 'center', padding: '4px', borderBottomLeftRadius: '50%', borderBottomRightRadius: '50%' }}>
                Change
              </div>
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) setProfile(p => ({ ...p, photo: f })); }}/>
            </label>
          </div>

          <div className="two-col">
            <div className="form-group"><label>First Name *</label><input value={profile.first_name} onChange={setP('first_name')} placeholder="First name"/></div>
            <div className="form-group"><label>Middle Name</label><input value={profile.middle_name} onChange={setP('middle_name')} placeholder="Optional"/></div>
            <div className="form-group"><label>Last Name *</label><input value={profile.last_name} onChange={setP('last_name')} placeholder="Last name"/></div>
            <div className="form-group">
              <label>Date of Birth</label>
              <input type="date" value={profile.dob} min="1945-01-01" max="2012-12-31"
                onChange={e => setProfile(p => ({ ...p, dob: e.target.value }))}/>
            </div>
          </div>
          <div className="form-group">
            <label>Bio</label>
            <textarea value={profile.bio} onChange={setP('bio')} rows={3} placeholder="Tell others about yourself…"/>
          </div>
          <button className="btn btn-primary" onClick={saveProfile} disabled={loading} style={{ marginTop: '.5rem' }}>
            {loading ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      )}

      {/* ── Phone Tab ── */}
      {activeTab === 'phone' && (
        <>
          {/* Existing phones */}
          {phones.length > 0 && (
            <div className="info-card" style={{ marginBottom: '1rem' }}>
              <h3><FiPhone size={12}/>Saved Phone Numbers</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {phones.map(p => (
                  <div key={p.phone_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'var(--bg3)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', fontFamily: 'var(--mono)' }}>{p.phone_no}</div>
                      {p.about && <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '0.2rem' }}>{p.about}</div>}
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => deletePhone(p.phone_id)} title="Remove">
                      <FiTrash2 size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add phone form */}
          <div className="info-card">
            <h3><FiPlus size={12}/>Add Phone Number</h3>
            <div className="form-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phoneForm.phone_no}
                onChange={e => setPhoneForm(p => ({ ...p, phone_no: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Label / About</label>
              <input
                placeholder="e.g. Personal, Work, WhatsApp…"
                value={phoneForm.about}
                onChange={e => setPhoneForm(p => ({ ...p, about: e.target.value }))}
              />
            </div>
            <button className="btn btn-primary" onClick={addPhone} disabled={phoneLoading} style={{ marginTop: '.5rem' }}>
              {phoneLoading ? 'Adding…' : 'Add Phone Number'}
            </button>
          </div>
        </>
      )}

      {/* ── Education Tab ── */}
      {activeTab === 'education' && (
        <div className="info-card">
          <h3>Add Education</h3>
          <div className="form-group">
            <label>Education Type</label>
            <select value={edu.type} onChange={setE('type')}>
              {['SSC','HSC','Diploma','University','Virtual'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Institution</label>
            <input value={edu.institution} onChange={setE('institution')} placeholder="Institution name"/>
          </div>
          <div className="form-group">
            <label>Score / GPA / Percentage</label>
            <input type="number" step="0.01" min="0" value={edu.score} onChange={setE('score')} placeholder="e.g. 8.5 or 85.5"/>
          </div>
          <button className="btn btn-primary" onClick={saveEducation} disabled={loading} style={{ marginTop: '.5rem' }}>
            {loading ? 'Saving…' : 'Save Education'}
          </button>
        </div>
      )}

      {/* ── Certification Tab ── */}
      {activeTab === 'cert' && (
        <div className="info-card">
          <h3>Add Certification</h3>
          <div className="form-group">
            <label>Certification Name *</label>
            <input value={cert.certification_name}
              onChange={e => setCert(p => ({ ...p, certification_name: e.target.value }))}
              placeholder="e.g. AWS Certified Developer"/>
          </div>
          <div className="form-group">
            <label>Certificate URL</label>
            <input value={cert.certificate_url}
              onChange={e => setCert(p => ({ ...p, certificate_url: e.target.value }))}
              placeholder="https://verify.example.com/cert/…"/>
          </div>
          <div className="form-group">
            <label>Certificate Image</label>
            <div
              onClick={() => document.getElementById('cert-img-upload').click()}
              onDragEnter={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) setCert(p => ({ ...p, certificate_img: f })); }}
              style={{ border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--r)', padding: '1.5rem', textAlign: 'center', background: dragActive ? 'var(--accentbg)' : 'var(--bg3)', cursor: 'pointer', transition: 'all .18s' }}
            >
              {cert.certificate_img ? (
                <div>
                  <img src={URL.createObjectURL(cert.certificate_img)} alt="Preview" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, margin: '0 auto .75rem' }}/>
                  <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>{cert.certificate_img.name}</div>
                </div>
              ) : (
                <div style={{ color: 'var(--text3)', fontSize: '.875rem' }}>
                  Drag &amp; drop image here<br/><span style={{ fontSize: '.78rem' }}>or click to browse</span>
                </div>
              )}
            </div>
            <input id="cert-img-upload" type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) setCert(p => ({ ...p, certificate_img: f })); }}/>
          </div>
          <button className="btn btn-primary" onClick={addCert} disabled={loading} style={{ marginTop: '.5rem' }}>
            {loading ? 'Adding…' : 'Add Certification'}
          </button>
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div style={{ marginTop: '.75rem', height: 5, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--success)', transition: 'width .2s' }}/>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EditProfile;
