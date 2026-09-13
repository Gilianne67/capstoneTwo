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

// Student Module Pages
import StudentDashboard from './features/student/pages/StudentDashboard';
import StudentProfile from './features/student/pages/StudentProfile';
import ScholarshipSearch from './features/student/pages/ScholarshipSearch';
import MatchFeed from './features/student/pages/MatchFeed';
import SavedScholarships from './features/student/pages/SavedScholarships';
import ApplicationTracker from './features/student/pages/ApplicationTracker';
import DeadlineAlerts from './features/student/pages/DeadlineAlerts';
import Settings from './features/student/pages/Settings';
import HelpCenter from './features/student/pages/HelpCenter';

// Provider Module Pages
import ProviderDashboard from './features/provider/pages/ProviderDashboard';
import ScholarshipListings from './features/provider/pages/ScholarshipListings';
import CreateListing from './features/provider/pages/CreateListing';
import PerformanceAnalytics from './features/provider/pages/PerformanceAnalytics';
import OrganizationVerification from './features/provider/pages/OrganizationVerification';
import ProviderSettings from './features/provider/pages/ProviderSettings';
import HelpSupport from './features/provider/pages/HelpSupport';

// Admin Module Pages
import AdminDashboard from './features/admin/pages/AdminDashboard';
import VerificationQueue from './features/admin/pages/VerificationQueue';
import ContentModeration from './features/admin/pages/ContentModeration';
import TaxonomyTags from './features/admin/pages/TaxonomyTags';
import AuditCompliance from './features/admin/pages/AuditCompliance';
import SystemSettings from './features/admin/pages/SystemSettings';
import AdminNotifications from './features/admin/pages/AdminNotifications';
import AdminHelp from './features/admin/pages/AdminHelp';

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

  // 2. If user exists but role doesn't match the current route, send them to THEIR dashboard
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={`/dashboard/${user.role}`} replace />;
  }

  return children;
}

/**
 * Helper to dynamically redirect `/dashboard` to the user's role-specific home
 */
function DashboardRedirect() {
  const { user } = useAuth();
  return <Navigate to={`/dashboard/${user?.role || 'student'}`} replace />;
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
            {/* Redirect /dashboard to /dashboard/:role */}
            <Route index element={<DashboardRedirect />} />

            {/* Student Routes */}
            <Route 
              path="student" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="student/search" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <ScholarshipSearch />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="student/matches" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <MatchFeed />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="student/profile" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentProfile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="student/saved" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <SavedScholarships />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="student/applications" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <ApplicationTracker />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="student/notifications" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <DeadlineAlerts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="student/alerts" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="student/settings" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="student/help" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <HelpCenter />
                </ProtectedRoute>
              } 
            />

            {/* Provider Routes */}
            <Route 
              path="provider" 
              element={
                <ProtectedRoute allowedRoles={['provider']}>
                  <ProviderDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="provider/listings" 
              element={
                <ProtectedRoute allowedRoles={['provider']}>
                  <ScholarshipListings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="provider/create" 
              element={
                <ProtectedRoute allowedRoles={['provider']}>
                  <CreateListing />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="provider/analytics" 
              element={
                <ProtectedRoute allowedRoles={['provider']}>
                  <PerformanceAnalytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="provider/verification" 
              element={
                <ProtectedRoute allowedRoles={['provider']}>
                  <OrganizationVerification />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="provider/settings" 
              element={
                <ProtectedRoute allowedRoles={['provider']}>
                  <ProviderSettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="provider/help" 
              element={
                <ProtectedRoute allowedRoles={['provider']}>
                  <HelpSupport />
                </ProtectedRoute>
              } 
            />

            {/* Admin Routes */}
            <Route 
              path="admin" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="admin/verification" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <VerificationQueue />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="admin/moderation" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ContentModeration />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="admin/taxonomy" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <TaxonomyTags />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="admin/audit-log" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AuditCompliance />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="admin/settings" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <SystemSettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="admin/notifications" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminNotifications />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="admin/help" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminHelp />
                </ProtectedRoute>
              } 
            />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/auth?mode=signin" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}