// App.jsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

// Layouts
import PublicLayout from './layouts/PublicLayout';       
import AppLayout from './layouts/AppLayout'; 

// Public Pages
import HomePage from './features/public-landing/pages/HomePage';
import AuthPage from './features/auth/AuthPage';
import OnboardingForm from './features/public-landing/pages/OnboardingForm';
import ParentConsentPage from './features/public-landing/pages/ParentConsentPage';

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

function ConnectionBanner() {
  const [status, setStatus] = useState('Testing backend connection...');

  useEffect(() => {
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) {
          setStatus('✅ Connected to Backend API (Guest / Unauthenticated)');
          return;
        }
        const data = await res.json();
        if (data.success) {
          setStatus(`✅ Connected to Backend API (User: ${data.data.email || data.data.role})`);
        } else {
          setStatus(`✅ Connected to Backend API (${data.message})`);
        }
      })
      .catch((err) => {
        setStatus(`❌ Connection Failed: ${err.message}`);
      });
  }, []);

  return (
    <div style={{ background: '#1e293b', color: '#fff', padding: '0.5rem 1rem', textAlign: 'center', fontSize: '0.875rem' }}>
      {status}
    </div>
  );
}

function ProtectedRouteGuard({ allowedRoles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth?mode=signin" state={{ from: location }} replace />;
  }

  const userRoleNormalized = user?.role?.toLowerCase();
  const isAllowed = allowedRoles?.map((r) => r.toLowerCase()).includes(userRoleNormalized);

  if (allowedRoles && !isAllowed) {
    return <Navigate to={`/dashboard/${user.role}`} replace />;
  }

  return children ? children : <Outlet />;
}

function DashboardRedirect() {
  const { user } = useAuth();
  return <Navigate to={`/dashboard/${user?.role || 'student'}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ConnectionBanner />
      <BrowserRouter>
        <Routes>
          {/* 1. PUBLIC ROUTES */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/consent/verify" element={<ParentConsentPage />} />
          </Route>

          {/* PUBLIC PARENT CONSENT LANDING (No auth required) */}
          <Route path="/consent/verify" element={<ParentConsentPage />} />

          {/* 2. STANDALONE ONBOARDING ROUTE */}
          <Route element={<ProtectedRouteGuard allowedRoles={['student']} />}>
            <Route path="/onboarding" element={<OnboardingForm />} />
          </Route>

          {/* 3. PROTECTED DASHBOARD ROUTES */}
          <Route path="/dashboard" element={<AppLayout />}>
            <Route index element={<DashboardRedirect />} />

            {/* STUDENT SECTION */}
            <Route element={<ProtectedRouteGuard allowedRoles={['student']} />}>
              <Route path="student" element={<StudentDashboard />} />
              <Route path="student/search" element={<ScholarshipSearch />} />
              <Route path="student/matches" element={<MatchFeed />} />
              <Route path="student/profile" element={<StudentProfile />} />
              <Route path="student/saved" element={<SavedScholarships />} />
              <Route path="student/applications" element={<ApplicationTracker />} />
              <Route path="student/notifications" element={<DeadlineAlerts />} />
              <Route path="student/alerts" element={<Settings />} />
              <Route path="student/settings" element={<Settings />} />
              <Route path="student/help" element={<HelpCenter />} />
            </Route>

            {/* PROVIDER SECTION */}
            <Route element={<ProtectedRouteGuard allowedRoles={['provider']} />}>
              <Route path="provider" element={<ProviderDashboard />} />
              <Route path="provider/listings" element={<ScholarshipListings />} />
              <Route path="provider/create" element={<CreateListing />} />
              <Route path="provider/analytics" element={<PerformanceAnalytics />} />
              <Route path="provider/verification" element={<OrganizationVerification />} />
              <Route path="provider/settings" element={<ProviderSettings />} />
              <Route path="provider/help" element={<HelpSupport />} />
            </Route>

            {/* ADMIN SECTION */}
            <Route element={<ProtectedRouteGuard allowedRoles={['admin']} />}>
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/verification" element={<VerificationQueue />} />
              <Route path="admin/moderation" element={<ContentModeration />} />
              <Route path="admin/taxonomy" element={<TaxonomyTags />} />
              <Route path="admin/audit-log" element={<AuditCompliance />} />
              <Route path="admin/settings" element={<SystemSettings />} />
              <Route path="admin/notifications" element={<AdminNotifications />} />
              <Route path="admin/help" element={<AdminHelp />} />
            </Route>
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/auth?mode=signin" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}