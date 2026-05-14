import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiArrowLeft } from 'react-icons/fi';

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1 = email, 2 = PIN + new password
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRequestPin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.post('/auth/forgot-password', { email });
      toast.success('If that email exists, a reset PIN has been sent.');
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setLoading(true);
    try {
      const { data } = await API.post('/auth/reset-password', { email, pin, newPassword });
      toast.success(data.message);
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          <h1>OurGuided</h1>
          <p>{step === 1 ? 'Reset your password' : 'Enter your PIN'}</p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleRequestPin}>
            <div className="form-group">
              <label><FiMail size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset PIN'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label>6-Digit PIN</label>
              <input
                type="text"
                placeholder="123456"
                required
                maxLength={6}
                pattern="[0-9]{6}"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.3rem', fontFamily: 'var(--mono)' }}
              />
            </div>
            <div className="form-group">
              <label><FiLock size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />New Password</label>
              <input
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep(1)}
              style={{ marginTop: '0.5rem' }}
            >
              <FiArrowLeft size={13} /> Back
            </button>
          </form>
        )}

        <div className="auth-link">
          Remember your password? <Link to="/login">Sign In</Link>
        </div>
        <div className="auth-copyright" style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: 'var(--text3)', opacity: 0.7 }}>
          &copy; {new Date().getFullYear()} OurGuided. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
