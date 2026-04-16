import React, { useState, useRef, useEffect } from 'react';
import { API, useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const FEEDBACK_TYPES = [
  { id: 'Complaint', label: 'Complaint', emoji: '😤', desc: "Something isn't working right" },
  { id: 'Compliment', label: 'Compliment', emoji: '🌟', desc: 'Share what you love' },
  { id: 'Suggestion', label: 'Suggestion', emoji: '💡', desc: 'Ideas to make it better' },
  { id: 'View', label: 'View', emoji: '💬', desc: 'Share your perspective' },
  { id: 'Other', label: 'Other', emoji: '📝', desc: 'Anything else on your mind' },
];

const STEPS = { CLOSED: 'closed', TYPE: 'type', FORM: 'form', DONE: 'done' };

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];
const MAX_CHARS = 1000;

export default function FeedbackWidget() {
  const { user } = useAuth();

  const [step, setStep] = useState(STEPS.CLOSED);
  const [selType, setSelType] = useState(null);
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHover] = useState(0);
  const [loading, setLoading] = useState(false);

  const panelRef = useRef(null);
  const textRef = useRef(null);

  /* ── Close panel on outside click ────────────────────────────────────── */
  useEffect(() => {
    if (step === STEPS.CLOSED) return;
    const handle = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) reset();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [step]);

  /* ── Auto-focus textarea ─────────────────────────────────────────────── */
  useEffect(() => {
    if (step === STEPS.FORM) setTimeout(() => textRef.current?.focus(), 80);
  }, [step]);

  const reset = () => {
    setStep(STEPS.CLOSED);
    setSelType(null);
    setContent('');
    setRating(0);
    setHover(0);
  };

  const handleTypeSelect = (t) => { setSelType(t); setStep(STEPS.FORM); };

  const handleBack = () => {
    setStep(STEPS.TYPE);
    setContent('');
    setRating(0);
    setHover(0);
  };

  const handleTextChange = (e) => setContent(e.target.value.slice(0, MAX_CHARS));

  const handleSubmit = async () => {
    if (!content.trim() || content.trim().length < 10) {
      toast.error('Please write at least 10 characters.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await API.post('/feedback', {
        type: selType.id,
        content: content.trim(),
        rating,
      });
      setStep(STEPS.DONE);
      toast.success(data.message || 'Feedback sent!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const charCount = content.length;
  const activeStars = hoverRating || rating;

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="fb-widget" ref={panelRef}>

      {/* ── FAB ─────────────────────────────────────────────────────────── */}
      {step === STEPS.CLOSED && (
        <button
          id="feedback-fab"
          className="fb-fab"
          onClick={() => setStep(STEPS.TYPE)}
          aria-label="Send feedback"
          title="Send feedback to OurGuided"
        >
          <span className="fb-fab-icon">💬</span>
          <span className="fb-fab-label">Feedback</span>
        </button>
      )}

      {/* ── Panel ───────────────────────────────────────────────────────── */}
      {step !== STEPS.CLOSED && (
        <div className="fb-panel">

          {/* Header */}
          <div className="fb-panel-hdr">
            <div className="fb-panel-title">
              {step === STEPS.FORM && (
                <button className="fb-back-btn" onClick={handleBack} aria-label="Go back">←</button>
              )}
              <span>
                {step === STEPS.TYPE && '📬 Send Feedback'}
                {step === STEPS.FORM && `${selType?.emoji} ${selType?.label}`}
                {step === STEPS.DONE && '✅ Submitted!'}
              </span>
            </div>
            <button className="fb-close-btn" onClick={reset} aria-label="Close feedback panel">×</button>
          </div>

          {/* ── STEP 1: Type picker ─────────────────────────────────────── */}
          {step === STEPS.TYPE && (
            <div className="fb-type-grid">
              <p className="fb-subtitle">What would you like to share?</p>
              {FEEDBACK_TYPES.map(t => (
                <button
                  key={t.id}
                  className="fb-type-btn"
                  onClick={() => handleTypeSelect(t)}
                  id={`fb-type-${t.id.toLowerCase()}`}
                >
                  <span className="fb-type-emoji">{t.emoji}</span>
                  <div className="fb-type-info">
                    <strong>{t.label}</strong>
                    <span>{t.desc}</span>
                  </div>
                  <span className="fb-type-arrow">›</span>
                </button>
              ))}
            </div>
          )}

          {/* ── STEP 2: Form ────────────────────────────────────────────── */}
          {step === STEPS.FORM && (
            <div className="fb-form">

              {/* Type badge */}
              <div className="fb-type-badge">
                <span>{selType?.emoji}</span>
                <span>{selType?.desc}</span>
              </div>

              {/* Stars */}
              <div className="fb-rating-wrap">
                <label className="fb-field-label">Rate your experience (optional)</label>
                <div className="fb-stars">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      className={`fb-star${activeStars >= n ? ' fb-star--active' : ''}`}
                      onClick={() => setRating(n === rating ? 0 : n)}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                      type="button"
                    >★</button>
                  ))}
                  {rating > 0 && (
                    <span className="fb-rating-label">{RATING_LABELS[rating]}</span>
                  )}
                </div>
              </div>

              {/* Message textarea */}
              <div className="fb-field-group">
                <label className="fb-field-label">Your message *</label>
                <textarea
                  ref={textRef}
                  className="fb-textarea"
                  placeholder={`Tell us about your ${selType?.label.toLowerCase()}…`}
                  value={content}
                  onChange={handleTextChange}
                  rows={5}
                />
                <div className="fb-char-count">
                  <span>{charCount < 10 ? `${10 - charCount} more characters needed` : ''}</span>
                  <span className={charCount >= MAX_CHARS * 0.9 ? 'fb-char-warn' : ''}>
                    {charCount}/{MAX_CHARS}
                  </span>
                </div>
              </div>

              {/* Email copy notice */}
              <p className="fb-info-text">
                📧 A confirmation copy will be sent to{' '}
                <strong>{user?.email || 'your email'}</strong>
              </p>

              <button
                className="fb-submit-btn"
                onClick={handleSubmit}
                disabled={loading || content.trim().length < 10}
                id="fb-submit"
                type="button"
              >
                {loading
                  ? <><span className="fb-spinner" /> Sending…</>
                  : <>Send {selType?.label}</>
                }
              </button>
            </div>
          )}

          {/* ── STEP 3: Done ────────────────────────────────────────────── */}
          {step === STEPS.DONE && (
            <div className="fb-done">
              <div className="fb-done-icon">📨</div>
              <h3>Thank you{user?.username ? `, ${user.username}` : ''}!</h3>
              <p>
                Your {selType?.label.toLowerCase()} has been sent to the OurGuided team.
                We read everything and will get back to you if needed.
              </p>
              <p className="fb-done-copy">
                📧 A confirmation copy has been sent to your email.
              </p>
              <button
                className="fb-submit-btn"
                onClick={reset}
                id="fb-done-close"
                type="button"
                style={{ marginTop: '.5rem', maxWidth: '180px' }}
              >
                Close
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
