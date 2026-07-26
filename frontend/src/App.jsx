import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 1. PUBLIC ROUTES (Includes Public Navbar + Footer) */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<AuthPage />} />
        </Route>

        {/* 2. PROTECTED DASHBOARD ROUTES (NO Public Navbar/Footer) */}
        <Route path="/dashboard" element={<AppLayout />}>
          <Route path="student" element={<StudentDashboard />} />
          <Route path="provider" element={<ProviderDashboard />} />
          <Route path="admin" element={<AdminDashboard />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/auth?mode=signin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}