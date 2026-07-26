import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import HomePage from './features/public-landing/pages/HomePage';
import AuthPage from './features/auth/AuthPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes wrapped in PublicLayout */}
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<AuthPage />} />
        </Route>

        {/* Fallback placeholder for upcoming auth routes */}
        <Route path="/login" element={<div className="p-8 text-center">Login Page (Coming Next)</div>} />
        <Route path="/signup" element={<div className="p-8 text-center font-bold">Signup Page (Coming Next)</div>} />
      </Routes>
    </BrowserRouter>
  );
}