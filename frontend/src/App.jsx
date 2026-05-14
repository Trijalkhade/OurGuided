import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeedbackProvider } from './context/FeedbackContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

// Eager imports — needed on first render
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/Layout';

// Lazy imports — loaded on-demand when user navigates
const Feed = lazy(() => import('./pages/Feed'));
const Profile = lazy(() => import('./pages/Profile'));
const Watchlist = lazy(() => import('./pages/Watchlist'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const Study = lazy(() => import('./pages/Study'));
const Connections = lazy(() => import('./pages/Connections'));
const Explore = lazy(() => import('./pages/Explore'));
const Quizzes = lazy(() => import('./pages/Quizzes'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Playlists = lazy(() => import('./pages/Playlists'));
const Moderation = lazy(() => import('./pages/Moderation'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const CookiePolicy = lazy(() => import('./pages/CookiePolicy'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));


const LoadingScreen = () => (
  <div className="loading-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid var(--border)', borderTop: '4px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
  </div>
);

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return !user ? children : <Navigate to="/feed" replace />;
};

const AppContent = () => {
  const { theme } = useTheme();

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: theme === 'dark' ? '#1a1f2e' : '#ffffff',
            color: theme === 'dark' ? '#e8e8ff' : '#0d1a38',
            border: theme === 'dark' ? '1px solid #2d3748' : '1px solid #dde2ef',
          }
        }}
      />
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/cookies" element={<CookiePolicy />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/feed" />} />
          <Route path="feed" element={<Feed />} />
          <Route path="explore" element={<Explore />} />
          <Route path="quizzes" element={<Quizzes />} />
          <Route path="connections" element={<Connections />} />
          <Route path="profile/edit" element={<EditProfile />} />
          <Route path="profile/:id" element={<Profile />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="playlists" element={<Playlists />} />
          <Route path="study" element={<Study />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="moderation" element={<Moderation />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="post/:id" element={<PostDetail />} />
        </Route>
      </Routes>
    </>
  );
};

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <FeedbackProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
            <AppContent />
          </Suspense>
        </BrowserRouter>
      </FeedbackProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;