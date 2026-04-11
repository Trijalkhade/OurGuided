import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeedbackProvider } from './context/FeedbackContext';
import Login         from './pages/Login';
import Register      from './pages/Register';
import Feed          from './pages/Feed';
import Profile       from './pages/Profile';
import Watchlist     from './pages/Watchlist';
import PostDetail    from './pages/PostDetail';
import EditProfile   from './pages/EditProfile';
import Study         from './pages/Study';
import Connections   from './pages/Connections';
import Explore       from './pages/Explore';
import Quizzes       from './pages/Quizzes';
import Notifications from './pages/Notifications';
import Leaderboard   from './pages/Leaderboard';
import Playlists     from './pages/Playlists';
import Moderation    from './pages/Moderation';
import Layout        from './components/Layout';
import './App.css';

const LoadingScreen = () => (
  <div className="loading-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #ddd', borderTop: '4px solid #3b5bfa', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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

const AppContent = () => (
  <>
    <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a2e', color: '#e8e8ff', border: '1px solid #2563eb' } }} />
    <Routes>
      <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/feed" />} />
        <Route path="feed"          element={<Feed />} />
        <Route path="explore"       element={<Explore />} />
        <Route path="quizzes"       element={<Quizzes />} />
        <Route path="connections"   element={<Connections />} />
        <Route path="profile/edit"  element={<EditProfile />} />
        <Route path="profile/:id"   element={<Profile />} />
        <Route path="watchlist"     element={<Watchlist />} />
        <Route path="playlists"     element={<Playlists />} />
        <Route path="study"         element={<Study />} />
        <Route path="leaderboard"   element={<Leaderboard />} />
        <Route path="moderation"    element={<Moderation />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="post/:id"      element={<PostDetail />} />
      </Route>
    </Routes>
  </>
);

const App = () => (
  <AuthProvider>
    <FeedbackProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <AppContent />
        </Suspense>
      </BrowserRouter>
    </FeedbackProvider>
  </AuthProvider>
);

export default App;