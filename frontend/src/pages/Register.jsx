import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, API } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { RiRocketLine } from 'react-icons/ri';
const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";
const CATEGORIES = [
  { id: 1, name: 'Engineering', icon: '⚙️' },
  { id: 2, name: 'Business', icon: '💼' },
  { id: 3, name: 'Life Skills', icon: '🌱' },
  { id: 4, name: 'Psychology', icon: '🧠' },
  { id: 5, name: 'Teaching Skills', icon: '🎓' },
  { id: 6, name: 'Health & Nutrition', icon: '🥗' },
  { id: 7, name: 'Physical Fitness', icon: '🏋️' },
  { id: 8, name: 'Agriculture', icon: '🌾' },
];

const Register = () => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ username: '', email: '', password: '', first_name: '', last_name: '', dob: '', nickname: '' });
  const [interests, setInterests] = useState([]);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const toggleInterest = (id) => setInterests(prev =>
    prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleStep1 = async (e) => {
    e.preventDefault();
    if (!form.username || !form.email || !form.password)
      return toast.error('Fill in all required fields');
    if (!privacyAccepted)
      return toast.error('Please accept the terms and conditions');
    setStep(2);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await register(form);
      // Save interests
      if (interests.length > 0) {
        try { await API.post('/categories/interests', { category_ids: interests }); } catch { }
      }
      toast.success('Welcome to OurGuided! 🎉');
      navigate('/feed');
    } catch (err) {
      setStep(1);
      toast.error((err.response && err.response.data && err.response.data.message) || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-box" style={{ maxWidth: step === 2 ? 540 : 460 }}>
        <div className="auth-logo">
          <h1>OurGuided</h1>
          <p>{step === 1 ? 'Start your learning journey today' : 'What do you want to learn?'}</p>
        </div>

        {/* Step indicator */}
        <div className="register-steps">
          <div className={`step-dot ${step >= 1 ? 'active' : ''}`} />
          <div className="step-line" />
          <div className={`step-dot ${step >= 2 ? 'active' : ''}`} />
        </div>

        {step === 1 && (
          <form onSubmit={handleStep1}>
            <div className="two-col">
              <div className="form-group">
                <label>First Name</label>
                <input placeholder="John" value={form.first_name} onChange={set('first_name')} />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input placeholder="Doe" value={form.last_name} onChange={set('last_name')} />
              </div>
            </div>
            <div className="form-group">
              <label>Username *</label>
              <input placeholder="johndoe" required value={form.username} onChange={set('username')} />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" placeholder="you@example.com" required value={form.email} onChange={set('email')} />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input type="password" placeholder="Minimum 6 characters" required minLength={6}
                value={form.password} onChange={set('password')} />
            </div>
            <div className="form-group">
              <label>Date of Birth *</label>
              <input type="date" required min="1945-01-01" max="2012-12-31"
                value={form.dob} onChange={set('dob')} />
            </div>
            {/* Honeypot field */}
            <div className="form-group" style={{ display: 'none' }}>
              <label>Nickname</label>
              <input value={form.nickname} onChange={set('nickname')} tabIndex="-1" autoComplete="off" />
            </div>
            <div className="form-group privacy-checkbox" style={{ marginTop: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', fontWeight: 'normal', fontSize: '0.88rem', color: 'var(--text2)', lineHeight: 1.5 }}>
                <input
                  type="checkbox"
                  required
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  style={{ 
                    width: '18px', 
                    height: '18px', 
                    marginTop: '2px',
                    accentColor: 'var(--accent)',
                    cursor: 'pointer'
                  }}
                />
                <span>
                  I accept to be 13+ age and agree to the <Link to="/privacy-policy" target="_blank" style={{ color: 'var(--accent)', fontWeight: '600', textDecoration: 'none', borderBottom: '1.5px solid var(--accent)' }}>Privacy Policy and Terms</Link>
                </span>
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={!privacyAccepted}>Continue →</button>
          </form>
        )}

        {step === 2 && (
          <div>
            <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Pick your interests to get personalised daily content and recommendations.
              You can always change these later.
            </p>
            <div className="onboarding-categories">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`onboarding-cat ${interests.includes(cat.id) ? 'selected' : ''}`}
                  onClick={() => toggleInterest(cat.id)}
                >
                  <span className="oc-icon">{cat.icon}</span>
                  <span className="oc-name">{cat.name}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleFinish} disabled={loading}>
                {loading ? 'Creating account…' : interests.length === 0 ? 'Skip & Create Account' : `Join with ${interests.length} interests`}
              </button>
            </div>
          </div>
        )}

        <div className="auth-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
        <div className="auth-copyright" style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: 'var(--text3)', opacity: 0.7 }}>
          &copy; {new Date().getFullYear()} OurGuided. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Register;
