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
import AIAssistant from './components/AIAssistant';

// Wrapper to conditionally show AI Assistant
const AIAssistantWrapper = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  // Only show on dashboard pages when logged in
  const showAssistant = user && !location.pathname.includes('login') && !location.pathname.includes('reset');
  
  return showAssistant ? <AIAssistant /> : null;
};

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <AuthProvider>
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
            
            {/* AI Assistant - appears on all logged-in pages */}
            <AIAssistantWrapper />
          </AuthProvider>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
