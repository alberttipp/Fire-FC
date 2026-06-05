import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PlayerDashboard from './pages/PlayerDashboard';
import ParentDashboard from './pages/ParentDashboard';
import ResetPassword from './pages/ResetPassword';
import PlayerAccessPage from './pages/PlayerAccessPage';
import TryoutSignup from './pages/TryoutSignup';
import About from './pages/About';
import PrivateRoute from './components/PrivateRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider, useToast } from './components/Toast';
import { ConfirmDialogProvider } from './components/ConfirmDialog';
import { useVersionDrift } from './hooks/useVersionDrift';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VoiceCommandProvider } from './context/VoiceCommandContext';
import AIAssistant from './components/AIAssistant';
import VoiceCommandOverlay from './components/VoiceCommandOverlay';
import BuildStamp from './components/BuildStamp';
import JuggleCountdownBanner from './components/JuggleCountdownBanner';
import EnablePushBanner from './components/notifications/EnablePushBanner';
import IOSInstallPrompt from './components/IOSInstallPrompt';
import { logBuildInfo } from './utils/buildInfo';

// Watches for a new deploy while the user has the app open. Lives inside
// the ToastProvider so it can surface the "new version" prompt as a toast.
const VersionDriftWatcher = () => {
  const toast = useToast();
  useVersionDrift({ toast });
  return null;
};

// Rendered when React Router can't match the current path (typical when a
// cached bundle is older than the current deploy and doesn't yet know
// about a newly-added route). Force a cache-busting reload so the browser
// pulls the current HTML + bundle, which will have the route.
//
// 2026-05-22 loop guard: if the URL already carries our reload marker
// (__r=...), we've already tried the cache-bust once and the route is
// still unknown — reloading again would just blank the screen forever
// (this was the 2026-05-22 black-screen-on-logout bug). Land the user on
// a visible fallback with a way back to /login instead.
const UnknownRouteReload = () => {
  const alreadyReloaded = (() => {
    try { return new URLSearchParams(window.location.search).has('__r'); }
    catch { return false; }
  })();

  useEffect(() => {
    if (alreadyReloaded) return;
    const sep = window.location.search ? '&' : '?';
    window.location.replace(
      window.location.pathname + window.location.search + sep + '__r=' + Date.now() + window.location.hash
    );
  }, [alreadyReloaded]);

  if (!alreadyReloaded) {
    return <div className="min-h-screen bg-brand-dark" />;
  }
  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="glass-panel p-8 max-w-md w-full text-center">
        <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider mb-2">
          Page Not Found
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          We refreshed the app but still couldn't find this page. Head back to login to start over.
        </p>
        <button
          onClick={() => { window.location.href = '/login'; }}
          className="btn-primary px-6 py-2"
        >
          Go to Login
        </button>
      </div>
    </div>
  );
};

// Wrapper to conditionally show AI Assistant and Voice Commands
const AIAssistantWrapper = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Only show on dashboard pages when logged in
  const showAssistant = user && !location.pathname.includes('login') && !location.pathname.includes('reset');

  // Yellow "Hey Fire" mic (VoiceCommandOverlay) is intentionally disabled
  // 2026-05-15 — feature is half-baked. Re-enable here when we find a
  // real use for it (and remove the corresponding memory reminder).
  return showAssistant ? (
    <>
      <EnablePushBanner />
      <JuggleCountdownBanner />
      <AIAssistant />
      {/* <VoiceCommandOverlay /> */}
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
  // Log build info on app load
  useEffect(() => {
    logBuildInfo();
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmDialogProvider>
        <VersionDriftWatcher />
        <Router>
          <AuthProvider>
            <VoiceCommandWrapper>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/player-access/:token" element={<PlayerAccessPage />} />
                <Route path="/tryout-signup" element={<TryoutSignup />} />
                <Route path="/about" element={<About />} />
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
                {/* Debug route - available in all environments */}
                <Route path="/debug" element={
                  <Suspense fallback={<div className="min-h-screen bg-brand-dark flex items-center justify-center text-white">Loading...</div>}>
                    {React.createElement(React.lazy(() => import('./pages/DebugStatus')))}
                  </Suspense>
                } />
                <Route path="/" element={<Navigate to="/login" />} />
                {/* Catch-all: if no route matched, the user navigated to a
                    path the loaded bundle doesn't know about (e.g. a path
                    added in a newer deploy). Hard-reload to fetch the fresh
                    HTML + bundle. Layer 3 of the boot guard normally catches
                    stale bundles before React mounts, but this is a backstop
                    for cases that slip past — including the first load after
                    a deploy on a PWA that ignored cache-control headers. */}
                <Route path="*" element={<UnknownRouteReload />} />
              </Routes>

              {/* AI Assistant & Voice Commands - appears on all logged-in pages */}
              <AIAssistantWrapper />

              {/* iOS install prompt — only renders on iPhone/iPad Safari
                  that isn't installed to Home Screen yet. Auto-hides on
                  Android, on desktop, and after dismissal. */}
              <IOSInstallPrompt />

              {/* Build Stamp - visible indicator of deployed version */}
              <BuildStamp />
            </VoiceCommandWrapper>
          </AuthProvider>
        </Router>
        </ConfirmDialogProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
