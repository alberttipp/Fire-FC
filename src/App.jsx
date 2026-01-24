import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PlayerDashboard from './pages/PlayerDashboard';
import ParentDashboard from './pages/ParentDashboard';
import DebugStatus from './pages/DebugStatus';
import PrivateRoute from './components/PrivateRoute';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
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
          <Route path="/debug" element={<DebugStatus />} />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
