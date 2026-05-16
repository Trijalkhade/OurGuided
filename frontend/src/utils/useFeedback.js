import { useContext } from 'react';
import { FeedbackContext } from '../context/FeedbackContext';
import { hapticEngine } from '../utils/hapticEngine';
import { soundEffect } from '../utils/soundEffect';

/**
 * useFeedback hook - Provides convenient feedback methods
 * Usage: const { onTap, onSuccess, onError } = useFeedback();
 */
export const useFeedback = () => {
  const context = useContext(FeedbackContext);

  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }

  const { preferences } = context;

  /**
   * Core feedback trigger
   */
  const triggerFeedback = (feedbackType, options = {}) => {
    // Haptic feedback
    if (preferences.hapticEnabled && hapticEngine.isSupported) {
      switch (feedbackType) {
        case 'tap':
          hapticEngine.tap();
          break;
        case 'press':
          hapticEngine.buttonPress();
          break;
        case 'success':
          hapticEngine.success();
          break;
        case 'like-success':
          hapticEngine.success();
          break;
        case 'create-success':
          hapticEngine.success();
          break;
        case 'birthday':
          hapticEngine.celebration();
          break;
        case 'error':
          hapticEngine.error();
          break;
        case 'warning':
          hapticEngine.warning();
          break;
        case 'notification':
          hapticEngine.notification();
          break;
        case 'celebration':
          hapticEngine.celebration();
          break;
        case 'modal-open':
          hapticEngine.modalOpen();
          break;
        case 'modal-close':
          hapticEngine.modalClose();
          break;
        case 'navigation':
          hapticEngine.navigation();
          break;
        case 'impact':
          hapticEngine.impact();
          break;
        default:
          break;
      }
    }

    // Sound feedback
    if (preferences.soundEnabled && soundEffect.isSupported) {
      switch (feedbackType) {
        case 'tap':
          soundEffect.click();
          break;
        case 'press':
          soundEffect.click();
          break;
        case 'success':
          soundEffect.success();
          break;
        case 'like-success':
          soundEffect.beepChime();
          break;
        case 'create-success':
          soundEffect.beepChime();
          break;
        case 'accept-connection':
          soundEffect.playAudioFile('connect_sound.mp4', () => soundEffect.beepChime());
          break;
        case 'delete-success':
          soundEffect.scrape();
          break;
        case 'birthday':
          soundEffect.birthdaySong();
          break;
        case 'error':
          // No sound for error (only vibration)
          break;
        case 'warning':
          soundEffect.warning();
          break;
        case 'notification':
          soundEffect.notification();
          break;
        case 'celebration':
          soundEffect.celebration();
          break;
        case 'modal-open':
          soundEffect.click();
          break;
        case 'modal-close':
          soundEffect.notification();
          break;
        case 'navigation':
          soundEffect.click();
          break;
        case 'impact':
          soundEffect.success();
          break;
        default:
          break;
      }
    }
  };

  /**
   * Convenience methods for common interactions
   */
  return {
    // Core trigger
    feedback: triggerFeedback,

    // Common scenarios
    onTap: () => triggerFeedback('tap'),
    onPress: () => triggerFeedback('press'),
    onSuccess: () => triggerFeedback('success'),
    onError: () => triggerFeedback('error'),
    onWarning: () => triggerFeedback('warning'),
    onNotification: () => triggerFeedback('notification'),
    onModalOpen: () => triggerFeedback('modal-open'),
    onModalClose: () => triggerFeedback('modal-close'),
    onNavigation: () => triggerFeedback('navigation'),
    onCelebration: () => triggerFeedback('celebration'),
    onImpact: () => triggerFeedback('impact'),

    // Specific action feedback
    onLikeSuccess: () => triggerFeedback('like-success'),
    onCreateSuccess: () => triggerFeedback('create-success'),
    onAcceptConnection: () => triggerFeedback('accept-connection'),
    onDeleteSuccess: () => triggerFeedback('delete-success'),
    onBirthday: () => triggerFeedback('birthday'),

    // Advanced
    custom: (pattern, intensity) =>
      triggerFeedback('custom', { duration: pattern, intensity }),
    stop: () => hapticEngine.stop(),

    // Utilities
    isFeedbackEnabled:
      preferences.hapticEnabled || preferences.soundEnabled,
    hapticEnabled: preferences.hapticEnabled,
    soundEnabled: preferences.soundEnabled,
  };
};

export default useFeedback;
