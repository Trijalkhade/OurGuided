import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import OptimizedImage from '../components/OptimizedImage';

/* ═══════════════════════════════════════════════════════════════
   OURGUIDED — LANDING PAGE
   Aesthetic: "Rolex Tier" — ultra-premium, declarative, timeless
═══════════════════════════════════════════════════════════════ */

const LandingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect logged-in users to feed
  useEffect(() => {
    if (user) navigate('/feed', { replace: true });
  }, [user, navigate]);

  return (
    <div className="landing-shell">
      {/* ── Navigation ────────────────────────────────────── */}
      <LandingNav onEnter={() => navigate('/register')} />

      {/* ── Section 1: Hero ───────────────────────────────── */}
      <HeroSection />

      {/* ── Section 2: Quiet Signal ───────────────────────── */}
      <QuietSignalSection />

      {/* ── Section 3: Feed Preview ──────────────────────── */}
      <FeedPreviewSection />

      {/* ── Section 4: Manifesto ──────────────────────────── */}
      <ManifestoSection />

      {/* ── Section 5: Environment ────────────────────────── */}
      <EnvironmentSection />

      {/* ── Footer ────────────────────────────────────────── */}
      <LandingFooter />
    </div>
  );
};


/* ── Scroll Reveal Hook ──────────────────────────────────────── */
const useScrollReveal = () => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // We do not unobserve for images, allowing them to parralax/animate continuously,
            // but for text reveals we keep them visible once shown.
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const revealEls = el.querySelectorAll('.reveal');
    revealEls.forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, []);

  return ref;
};


/* ── Navigation ──────────────────────────────────────────────── */
const LandingNav = ({ onEnter }) => (
  <nav className="landing-nav" id="landing-nav">
    <span className="landing-nav-wordmark">OURGUIDED</span>
    <button className="landing-nav-enter" onClick={onEnter}>
      Enter ↗
    </button>
  </nav>
);


/* ── Section 1: Hero ─────────────────────────────────────────── */
const HeroSection = () => {
  const ref = useScrollReveal();

  return (
    <section className="landing-hero premium-section" id="hero" ref={ref}>
      {/* Background Image with slow Rolex-style zoom */}
      <div className="premium-image-wrapper">
        <OptimizedImage 
          src="/hero-bg.jpg" 
          alt="A macro shot of intricately layered, dark architectural forms representing deep thought" 
          className="premium-image-slow-pan" 
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          wrapperClass="premium-image-inner"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <div className="premium-overlay-gradient"></div>
      </div>

      <div className="landing-hero-content">
        <h1 className="landing-hero-headline reveal">
          The things worth knowing<br />
          rarely arrive loudly.
        </h1>
        <p className="landing-hero-subtitle reveal reveal-delay-1">
          A sanctuary for the genuinely curious. A destination where thought is given space to breathe, and knowledge is crafted to endure.
        </p>
      </div>

      <div className="landing-scroll-indicator reveal reveal-delay-2">
        <div className="landing-scroll-line" />
        <span className="landing-scroll-text">Discover</span>
      </div>
    </section>
  );
};


/* ── Section 2: Quiet Signal ─────────────────────────────────── */
const SIGNAL_CARDS = [
  { label: 'Dialogues', value: 'Enduring dialogues' },
  { label: 'Transmission', value: 'Thoughts shared' },
  { label: 'Focus', value: 'Minds engaged' },
];

const QuietSignalSection = () => {
  const ref = useScrollReveal();

  return (
    <section className="landing-signal" id="signal" ref={ref}>
      <div className="landing-signal-header reveal">
        <p className="landing-signal-eyebrow">The Pulse</p>
        <h2 className="landing-signal-title">
          The pulse of discourse. A measure of resonance, not reach.
        </h2>
      </div>

      <div className="landing-signal-cards">
        {SIGNAL_CARDS.map((card, i) => (
          <div
            key={card.label}
            className={`landing-signal-card reveal reveal-delay-${i + 1}`}
          >
            <p className="landing-signal-card-label">{card.label}</p>
            <p className="landing-signal-card-value">{card.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
};


/* ── Section 3: Feed Preview ─────────────────────────────────── */
const FEED_CARDS = [
  { tag: 'Mastery', title: 'The pursuit of mastery in the modern age' },
  { tag: 'Reflection', title: 'The enduring value of quiet reflection' },
  { tag: 'Craft', title: 'Craftsmanship in an era of speed' },
  { tag: 'Legacy', title: 'A legacy of shared wisdom' },
];

const FeedPreviewSection = () => {
  const ref = useScrollReveal();

  return (
    <section className="landing-feed" id="feed-preview" ref={ref}>
      <div className="landing-feed-header reveal">
        <p className="landing-feed-eyebrow">The Collection</p>
        <h2 className="landing-feed-title">
          The Architecture of Thought. Ideas built to stand the test of time.
        </h2>
      </div>

      <div className="landing-feed-grid">
        {FEED_CARDS.map((card, i) => (
          <div
            key={card.tag}
            className={`landing-feed-card reveal reveal-delay-${i + 1}`}
          >
            <p className="landing-feed-card-tag">{card.tag}</p>
            <p className="landing-feed-card-title">{card.title}</p>
          </div>
        ))}
      </div>
    </section>
  );
};


/* ── Section 4: Manifesto ────────────────────────────────────── */
const ManifestoSection = () => {
  const ref = useScrollReveal();

  return (
    <section className="landing-manifesto premium-section" id="manifesto" ref={ref}>
       <div className="premium-image-wrapper">
        <OptimizedImage 
          src="/manifesto-bg.jpg" 
          alt="Abstract dark macro texture, like brushed obsidian or deep ink" 
          className="premium-image-slow-pan" 
          loading="lazy"
          sizes="100vw"
          wrapperClass="premium-image-inner"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <div className="premium-overlay-gradient"></div>
      </div>

      <div className="landing-manifesto-content">
        <p className="landing-manifesto-line reveal">
          Excellence requires patience.
        </p>
        <p className="landing-manifesto-line reveal reveal-delay-1">
          Wisdom demands space.
        </p>
        <div className="landing-manifesto-pause reveal reveal-delay-2" />
      </div>
    </section>
  );
};


/* ── Section 5: Environment ──────────────────────────────────── */
const EnvironmentSection = () => {
  const ref = useScrollReveal();

  return (
    <section className="landing-environment premium-section" id="environment" ref={ref}>
      <div className="premium-image-wrapper">
        <OptimizedImage
          className="premium-image-slow-pan"
          src="/environment.jpg"
          alt="An expansive, dark, brutalist interior bathed in a single ray of warm natural light"
          loading="lazy"
          sizes="100vw"
          wrapperClass="premium-image-inner"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <div className="premium-overlay-bottom"></div>
      </div>
      <p className="landing-environment-caption reveal">
        An environment crafted for the discerning mind.
      </p>
    </section>
  );
};


/* ── Footer ──────────────────────────────────────────────────── */
const LandingFooter = () => (
  <footer className="landing-footer" id="landing-footer">
    <span className="landing-footer-wordmark">OURGUIDED</span>
    <div className="landing-footer-meta">
      <a href="/browse" className="landing-footer-link">Browse</a>
      <a href="/privacy-policy" className="landing-footer-link">Privacy</a>
      <a href="/cookies" className="landing-footer-link">Cookies</a>
      <span className="landing-footer-copy">© {new Date().getFullYear()}</span>
    </div>
  </footer>
);


export default LandingPage;
