/**
 * HapticEngine - Manages device vibration feedback
 * Supports both Vibration API and fallback mechanisms
 */

class HapticEngine {
  constructor() {
    this.isSupported = this.detectSupport();
    this.isEnabled = true;
    this.intensity = 1; // 0-1 scale
  }

  /**
   * Detect Vibration API support
   */
  detectSupport() {
    return !!(
      navigator.vibrate ||
      navigator.webkitVibrate ||
      navigator.mozVibrate ||
      navigator.msVibrate
    );
  }

  /**
   * Get vibration function for current device
   */
  getVibrateFunction() {
    return (
      navigator.vibrate ||
      navigator.webkitVibrate ||
      navigator.mozVibrate ||
      navigator.msVibrate ||
      null
    );
  }

  /**
   * Core vibration method with intensity scaling
   * @param {number|array} pattern - Duration(s) in ms
   * @param {number} intensity - 0-1, scales pattern durations
   */
  vibrate(pattern, intensity = this.intensity) {
    if (!this.isSupported || !this.isEnabled) return false;

    const vibrator = this.getVibrateFunction();
    if (!vibrator) return false;

    try {
      // Scale pattern by intensity
      let scaledPattern = Array.isArray(pattern)
        ? pattern.map((p, i) => (i % 2 === 0 ? p * intensity : p))
        : pattern * intensity;

      // Clamp to reasonable limits (1-500ms)
      if (Array.isArray(scaledPattern)) {
        scaledPattern = scaledPattern.map(p =>
          Math.max(1, Math.min(500, p))
        );
      } else {
        scaledPattern = Math.max(1, Math.min(500, scaledPattern));
      }

      vibrator.call(navigator, scaledPattern);
      return true;
    } catch (err) {
      console.warn('Vibration failed:', err);
      return false;
    }
  }

  /**
   * Stop any ongoing vibration
   */
  stop() {
    if (!this.isSupported) return;
    const vibrator = this.getVibrateFunction();
    if (vibrator) vibrator.call(navigator, 0);
  }

  // ═══════════════════════════════════════
  // HAPTIC PATTERNS
  // ═══════════════════════════════════════

  tap() {
    this.vibrate(20, 0.7);
  }

  buttonPress() {
    this.vibrate([30, 20, 30], 0.6);
  }

  success() {
    this.vibrate([40, 30, 40, 30, 40], 1);
  }

  celebration() {
    this.vibrate([50, 100, 50, 100, 50, 100, 50], 1);
  }

  warning() {
    this.vibrate([80, 40, 80], 0.7);
  }

  error() {
    this.vibrate([100, 50, 100, 50, 100], 0.8);
  }

  navigation() {
    this.vibrate([30, 20, 30], 0.5);
  }

  modalOpen() {
    this.vibrate([40, 40, 20], 0.6);
  }

  modalClose() {
    this.vibrate([20, 40, 40], 0.6);
  }

  progress() {
    this.vibrate(15, 0.4);
  }

  impact() {
    this.vibrate([60, 20, 40], 0.8);
  }

  notification() {
    this.vibrate([30, 30], 0.6);
  }

  subtle() {
    this.vibrate(10, 0.3);
  }

  strong() {
    this.vibrate(100, 0.9);
  }

  custom(pattern, intensity = this.intensity) {
    this.vibrate(pattern, intensity);
  }

  setIntensity(value) {
    this.intensity = Math.max(0, Math.min(1, value));
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled) this.stop();
  }
}

export const hapticEngine = new HapticEngine();
export default HapticEngine;
