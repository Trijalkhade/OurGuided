import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useAuth, API } from './AuthContext';

const GrowthContext = createContext(null);

// ── State shape ──────────────────────────────────────────────────────────────
const initialState = {
  heightCm: 0,
  streakDays: 0,
  longestStreak: 0,
  currentRef: null,
  nextRef: null,
  progressPct: 0,
  distanceRemainingCm: 0,
  shieldCount: 0,
  maxShields: 2,
  isAtRisk: false,
  createdAt: null,
  isModalOpen: false,
  lastAwardData: null, // The most recent award result (for modal animation)
  loading: true,
  error: null,
};

// ── Reducer ──────────────────────────────────────────────────────────────────
function growthReducer(state, action) {
  switch (action.type) {
    case 'SET_STATE':
      return {
        ...state,
        heightCm: action.payload.height_cm || 0,
        streakDays: action.payload.streak_days || 0,
        longestStreak: action.payload.longest_streak || 0,
        currentRef: action.payload.current_ref || null,
        nextRef: action.payload.next_ref || null,
        progressPct: action.payload.progress_pct || 0,
        distanceRemainingCm: action.payload.distance_remaining_cm || 0,
        shieldCount: action.payload.shield_count || 0,
        maxShields: action.payload.max_shields || 2,
        isAtRisk: action.payload.is_at_risk || false,
        createdAt: action.payload.created_at || null,
        loading: false,
        error: null,
      };
    case 'AWARD_RECEIVED':
      return {
        ...state,
        heightCm: action.payload.new_height_cm,
        currentRef: action.payload.current_ref || state.currentRef,
        nextRef: action.payload.next_ref || state.nextRef,
        progressPct: action.payload.progress_pct || state.progressPct,
        shieldCount: action.payload.shields_remaining ?? state.shieldCount,
        isAtRisk: false,
        lastAwardData: action.payload,
        isModalOpen: action.payload.gained_cm > 0,
      };
    case 'CLOSE_MODAL':
      return { ...state, isModalOpen: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────
export const GrowthProvider = ({ children }) => {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(growthReducer, initialState);

  // Fetch initial state on mount (when user is authenticated)
  const fetchState = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await API.get('/growth/state');
      dispatch({ type: 'SET_STATE', payload: data });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchState();
    }
  }, [user, fetchState]);

  // Called by study/quiz handlers when they receive a growth object in the response
  const handleGrowthAward = useCallback((growthData) => {
    if (!growthData) return;
    dispatch({ type: 'AWARD_RECEIVED', payload: growthData });
  }, []);

  const closeModal = useCallback(() => {
    dispatch({ type: 'CLOSE_MODAL' });
  }, []);

  const refreshState = useCallback(() => {
    fetchState();
  }, [fetchState]);

  const value = {
    ...state,
    handleGrowthAward,
    closeModal,
    refreshState,
  };

  return (
    <GrowthContext.Provider value={value}>
      {children}
    </GrowthContext.Provider>
  );
};

// ── Hook ─────────────────────────────────────────────────────────────────────
export const useGrowth = () => {
  const context = useContext(GrowthContext);
  if (!context) {
    throw new Error('useGrowth must be used within GrowthProvider');
  }
  return context;
};

export default GrowthContext;
