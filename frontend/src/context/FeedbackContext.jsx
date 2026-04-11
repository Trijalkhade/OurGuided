import React, { createContext, useState, useEffect } from 'react';
import { hapticEngine } from '../utils/hapticEngine';
import { soundEffect } from '../utils/soundEffect';

export const FeedbackContext = createContext();

export const FeedbackProvider = ({ children }) => {
  const [preferences, setPreferences] = useState({
    hapticEnabled: true,
    soundEnabled: true,
    hapticIntensity: 1,
    soundVolume: 0.6,
    isMobile: false,
    hasHapticSupport: false,
    hasSoundSupport: false,
  });

  /**
   * Initialize on mount
   */
  useEffect(() => {
    const isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent);
    const hasHapticSupport = hapticEngine.isSupported;
    const hasSoundSupport = soundEffect.isSupported;

    // Eagerly initialize audio context on app mount to prevent first-delete latency
    soundEffect.initAudioContext();
    // Preload audio files in background (non-blocking)
    soundEffect.loadAudioFile('delete_sound.mp4').catch(err => {
      console.warn('Failed to preload delete sound:', err);
    });
    soundEffect.loadAudioFile('connect_sound.mp4').catch(err => {
      console.warn('Failed to preload connect sound:', err);
    });

    setPreferences(prev => ({
      ...prev,
      isMobile,
      hasHapticSupport,
      hasSoundSupport,
    }));

    // Load saved preferences from localStorage
    loadPreferences();
  }, []);

  /**
   * Load user preferences from localStorage
   */
  const loadPreferences = () => {
    try {
      const saved = localStorage.getItem('feedbackPreferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        updatePreferences(parsed);
      }
    } catch (err) {
      console.warn('Failed to load feedback preferences:', err);
    }
  };

  /**
   * Update preferences and persist
   */
  const updatePreferences = (newPrefs) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPrefs };

      // Apply changes to engines
      if ('hapticEnabled' in newPrefs) {
        hapticEngine.setEnabled(newPrefs.hapticEnabled);
      }
      if ('soundEnabled' in newPrefs) {
        soundEffect.setEnabled(newPrefs.soundEnabled);
      }
      if ('hapticIntensity' in newPrefs) {
        hapticEngine.setIntensity(newPrefs.hapticIntensity);
      }
      if ('soundVolume' in newPrefs) {
        soundEffect.setVolume(newPrefs.soundVolume);
      }

      // Persist to localStorage
      try {
        localStorage.setItem('feedbackPreferences', JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save feedback preferences:', err);
      }

      return updated;
    });
  };

  /**
   * Preset configurations
   */
  const presets = {
    full: { hapticEnabled: true, soundEnabled: true },
    hapticOnly: { hapticEnabled: true, soundEnabled: false },
    soundOnly: { hapticEnabled: false, soundEnabled: true },
    silent: { hapticEnabled: false, soundEnabled: false },
    mobile: { hapticEnabled: true, soundEnabled: false, hapticIntensity: 0.8 },
    desktop: { hapticEnabled: false, soundEnabled: true, soundVolume: 0.6 },
  };

  const applyPreset = (presetName) => {
    if (presets[presetName]) {
      updatePreferences(presets[presetName]);
    }
  };

  return (
    <FeedbackContext.Provider
      value={{
        preferences,
        updatePreferences,
        presets,
        applyPreset,
      }}
    >
      {children}
    </FeedbackContext.Provider>
  );
};

export default FeedbackContext;
