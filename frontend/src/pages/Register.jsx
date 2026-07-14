import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, API } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { RiRocketLine, RiCheckLine, RiCloseLine, RiCalendarEventLine } from 'react-icons/ri';
import WheelDatePicker from '../components/WheelDatePicker';

const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";
const CATEGORIES = [
  { id: 1, name: 'Real Talk', icon: '💬' },
  { id: 2, name: 'Experiments & Ideas', icon: '🧪' },
  { id: 3, name: 'Loopholes & Fixes', icon: '🔧' },
  { id: 4, name: 'Life Hacks', icon: '⚡' },
  { id: 5, name: 'Youth & Education', icon: '🎒' },
  { id: 6, name: 'Health & Body', icon: '🥗' },
  { id: 7, name: 'Earth & Hands', icon: '🌱' },
  { id: 8, name: 'Economy & Power', icon: '💡' },
];

const Register = () => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ username: '', email: '', password: '', first_name: '', last_name: '', dob: '', nickname: '' });
  const [interests, setInterests] = useState([]);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  // Password validation checks
  const hasMinLength = form.password.length >= 8;
  const hasUpper = /[A-Z]/.test(form.password);
  const hasLower = /[a-z]/.test(form.password);
  const hasNumber = /[0-9]/.test(form.password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber;

  // Age validation
  const getAge = (dobString) => {
    if (!dobString) return 0;
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = getAge(form.dob);
  const isUnderage = form.dob && age < 13;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const toggleInterest = (id) => setInterests(prev =>
    prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleStep1 = async (e) => {
    e.preventDefault();
    if (!form.username || !form.email || !form.password || !form.dob)
      return toast.error('Fill in all required fields');
    if (!isPasswordValid)
      return toast.error('Please meet all password requirements');
    if (isUnderage)
      return toast.error('You must be at least 13 years old to register');
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
          <p>{step === 1 ? 'Join the conversation' : 'What do you care about?'}</p>
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
              <input type="password" placeholder="Create a strong password" required 
                value={form.password} onChange={set('password')} />
              
              {/* Password Nuances UI */}
              <div className="password-requirements" style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: hasMinLength ? 'var(--success, #10b981)' : 'var(--text3)' }}>
                  {hasMinLength ? <RiCheckLine /> : <RiCloseLine />} <span>At least 8 characters</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: hasUpper ? 'var(--success, #10b981)' : 'var(--text3)' }}>
                  {hasUpper ? <RiCheckLine /> : <RiCloseLine />} <span>One uppercase letter</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: hasLower ? 'var(--success, #10b981)' : 'var(--text3)' }}>
                  {hasLower ? <RiCheckLine /> : <RiCloseLine />} <span>One lowercase letter</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: hasNumber ? 'var(--success, #10b981)' : 'var(--text3)' }}>
                  {hasNumber ? <RiCheckLine /> : <RiCloseLine />} <span>One number</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Date of Birth *</label>
              <div 
                className={`dob-trigger ${isUnderage ? 'error-border' : ''}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', border: `1px solid ${isUnderage ? '#ef4444' : 'var(--border)'}`, 
                  borderRadius: '8px', cursor: 'pointer', background: 'var(--bg2)', color: form.dob ? 'var(--text)' : 'var(--text3)'
                }}
                onClick={() => setShowDatePicker(true)}
              >
                <span>{form.dob ? new Date(form.dob).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Select your birth date'}</span>
                <RiCalendarEventLine size={18} />
              </div>
              
              {isUnderage && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <RiCloseLine size={14} /> You must be 13 or older to join.
                </div>
              )}

              {showDatePicker && (
                <div className="wheel-modal-overlay" onClick={() => setShowDatePicker(false)}>
                  <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '400px' }}>
                    <WheelDatePicker 
                      value={form.dob} 
                      onChange={(val) => setForm(prev => ({ ...prev, dob: val }))} 
                      onClose={() => setShowDatePicker(false)}
                    />
                  </div>
                </div>
              )}
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
              Pick what interests you — your feed will show more of it.
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
