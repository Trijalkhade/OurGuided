/**
 * SoundEffect - Web Audio API based sound effects manager
 * Handles preloading, playback, and pooling
 */

class SoundEffect {
  constructor() {
    this.audioContext = null;
    this.isSupported = this.detectSupport();
    this.isEnabled = true;
    this.volume = 0.6; // 0-1
    this.preloadedSounds = {};
    this.maxConcurrentSounds = 10;
    this.activeSounds = [];
  }

  /**
   * Detect Web Audio API support
   */
  detectSupport() {
    return !!(
      window.AudioContext ||
      window.webkitAudioContext ||
      window.mozAudioContext ||
      window.msAudioContext
    );
  }

  /**
   * Initialize audio context (call on first user interaction)
   */
  initAudioContext() {
    if (this.audioContext) return this.audioContext;

    try {
      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext ||
        window.mozAudioContext ||
        window.msAudioContext;

      this.audioContext = new AudioContext();
      return this.audioContext;
    } catch (err) {
      console.error('AudioContext initialization failed:', err);
      return null;
    }
  }

  /**
   * Play synthesized tone (no preload needed)
   * @param {number} frequency - Hz (e.g., 440 for A4)
   * @param {number} duration - ms
   * @param {string} type - 'sine', 'square', 'sawtooth'
   */
  playTone(frequency = 440, duration = 100, type = 'sine') {
    if (!this.isSupported || !this.isEnabled) return;

    if (!this.audioContext) {
      this.initAudioContext();
    }

    if (!this.audioContext) return;

    try {
      const ctx = this.audioContext;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const endTime = ctx.currentTime + duration / 1000;

      osc.type = type;
      osc.frequency.value = frequency;
      gainNode.gain.setValueAtTime(this.volume * 0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(endTime);
    } catch (err) {
      console.error('Tone playback failed:', err);
    }
  }

  /**
   * Load audio file from public directory
   * @param {string} filename - Audio file name in /public/audio/
   */
  async loadAudioFile(filename) {
    if (!this.isSupported) return;

    try {
      const response = await fetch(`/audio/${filename}`);
      if (!response.ok) throw new Error(`Failed to load ${filename}`);
      const arrayBuffer = await response.arrayBuffer();
      
      if (!this.audioContext) {
        this.initAudioContext();
      }
      
      if (!this.audioContext) return;
      
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.preloadedSounds[filename] = audioBuffer;
      return audioBuffer;
    } catch (err) {
      console.error(`Failed to load audio file ${filename}:`, err);
      return null;
    }
  }

  /**
   * Play preloaded audio file with fallback to synthesized sound
   * @param {string} filename - Audio file name (must be preloaded first)
   * @param {Function} fallback - Fallback method if file not available
   */
  playAudioFile(filename, fallback = null) {
    if (!this.isSupported || !this.isEnabled) return;

    if (!this.audioContext) {
      this.initAudioContext();
    }

    // Try to play preloaded audio, fallback to synthesized sound
    if (this.audioContext && this.preloadedSounds[filename]) {
      try {
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = this.preloadedSounds[filename];
        gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start(0);
        return;
      } catch (err) {
        console.error('Audio playback failed:', err);
      }
    }

    // Fallback to synthesized sound if available
    if (fallback && typeof fallback === 'function') {
      fallback();
    }
  }

  /**
   * Common sound effects using Web Audio API
   */

  // UI feedback sounds
  click() {
    this.playTone(800, 50, 'sine');
  }

  success() {
    this.playTone(800, 100, 'sine');
    setTimeout(() => this.playTone(1150, 100, 'sine'), 120);
  }

  error() {
    this.playTone(400, 150, 'sine');
  }

  warning() {
    this.playTone(600, 100, 'sine');
    setTimeout(() => this.playTone(600, 100, 'sine'), 120);
  }

  notification() {
    this.playTone(900, 80, 'sine');
  }

  celebration() {
    this.playTone(800, 100, 'sine');
    setTimeout(() => this.playTone(1000, 100, 'sine'), 120);
    setTimeout(() => this.playTone(1200, 150, 'sine'), 240);
  }

  // Custom sounds for specific actions
  beepChime() {
    // One-tune beep + chime for like, create post, accept connection
    this.playTone(1000, 80, 'sine');  // beep
    setTimeout(() => this.playTone(1400, 120, 'sine'), 100);  // chime
  }

  scrape() {
    // Play delete_sound.mp4 with fallback to synthesized sound
    const fallbackScrape = () => {
      // Descending sawtooth tone fallback
      this.playTone(800, 50, 'sawtooth');
      setTimeout(() => this.playTone(600, 50, 'sawtooth'), 60);
      setTimeout(() => this.playTone(400, 60, 'sawtooth'), 120);
    };
    this.playAudioFile('delete_sound.mp4', fallbackScrape);
  }

  birthdaySong() {
    // Happy Birthday melody using playTone (simplified version)
    // C4 C4 D4 C4 F4 E4 (opening bars)
    const notes = [
      { freq: 262, duration: 150 },  // C4
      { freq: 262, duration: 150 },  // C4
      { freq: 294, duration: 150 },  // D4
      { freq: 262, duration: 150 },  // C4
      { freq: 349, duration: 150 },  // F4
      { freq: 330, duration: 300 },  // E4 (held longer)
    ];

    let delay = 0;
    notes.forEach(note => {
      setTimeout(() => this.playTone(note.freq, note.duration, 'sine'), delay);
      delay += note.duration + 50;
    });
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
  }
}

export const soundEffect = new SoundEffect();
export default SoundEffect;
