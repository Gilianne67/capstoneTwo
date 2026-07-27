import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

// Layouts
import PublicLayout from './layouts/PublicLayout';       
import AppLayout from './layouts/AppLayout'; 

// Public Pages
import HomePage from './features/public-landing/pages/HomePage';
import AuthPage from './features/auth/AuthPage';

// Module Dashboards
import StudentDashboard from './features/student/pages/StudentDashboard';
import ProviderDashboard from './features/provider/pages/ProviderDashboard';
import AdminDashboard from './features/admin/pages/AdminDashboard';

/**
 * Guard component that handles authentication & role-based route protection
 */
function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // 1. If not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/auth?mode=signin" state={{ from: location }} replace />;
  }

  // 2. If user exists but role doesn't match the current dashboard route, send them to THEIR dashboard
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={`/dashboard/${user.role}`} replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 1. PUBLIC ROUTES */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/login" element={<AuthPage />} />
          </Route>

          {/* 2. PROTECTED DASHBOARD ROUTES */}
          <Route path="/dashboard" element={<AppLayout />}>
            <Route 
              path="student" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="provider" 
              element={
                <ProtectedRoute allowedRoles={['provider']}>
                  <ProviderDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="admin" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/auth?mode=signin" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}