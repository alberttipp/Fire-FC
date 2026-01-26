import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PlayerDashboard from './pages/PlayerDashboard';
import ParentDashboard from './pages/ParentDashboard';
import ResetPassword from './pages/ResetPassword';
import PrivateRoute from './components/PrivateRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VoiceCommandProvider } from './context/VoiceCommandContext';
import AIAssistant from './components/AIAssistant';
import VoiceCommandOverlay from './components/VoiceCommandOverlay';

// Wrapper to conditionally show AI Assistant and Voice Commands
const AIAssistantWrapper = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Only show on dashboard pages when logged in
  const showAssistant = user && !location.pathname.includes('login') && !location.pathname.includes('reset');

  return showAssistant ? (
    <>
      <AIAssistant />
      <VoiceCommandOverlay />
    </>
  ) : null;
};

// Wrapper for Voice Command Provider (needs Router context)
const VoiceCommandWrapper = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  // Only enable voice commands when logged in on dashboard pages
  const enableVoice = user && !location.pathname.includes('login') && !location.pathname.includes('reset');

  if (!enableVoice) return children;

  return (
    <VoiceCommandProvider>
      {children}
    </VoiceCommandProvider>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <AuthProvider>
            <VoiceCommandWrapper>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard" element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                } />
                <Route path="/player-dashboard" element={
                  <PrivateRoute>
                    <PlayerDashboard />
                  </PrivateRoute>
                } />
                <Route path="/parent-dashboard" element={
                  <PrivateRoute>
                    <ParentDashboard />
                  </PrivateRoute>
                } />
                {/* Debug route only in development */}
                {import.meta.env.DEV && (
                  <Route path="/debug" element={
                    <Suspense fallback={<div className="min-h-screen bg-brand-dark flex items-center justify-center text-white">Loading...</div>}>
                      {React.createElement(React.lazy(() => import('./pages/DebugStatus')))}
                    </Suspense>
                  } />
                )}
                <Route path="/" element={<Navigate to="/login" />} />
              </Routes>

              {/* AI Assistant & Voice Commands - appears on all logged-in pages */}
              <AIAssistantWrapper />
            </VoiceCommandWrapper>
          </AuthProvider>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
