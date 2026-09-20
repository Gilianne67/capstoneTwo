import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export default function DashboardRedirect() {
  const { user, loading } = useAuth();
  const [profileStatus, setProfileStatus] = useState(null);

  useEffect(() => {
    if (loading || user?.role?.toLowerCase() !== 'student') return;

    const token = localStorage.getItem('token');
    fetch(`${API_BASE_URL}/students/profile/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setProfileStatus(data?.completed ?? false))
      .catch(() => setProfileStatus(false));
  }, [loading, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (user.role?.toLowerCase() === 'student' && profileStatus === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user.role?.toLowerCase() === 'student' && !profileStatus) {
    return <Navigate to="/dashboard/student/onboarding" replace />;
  }

  // Route to the appropriate role dashboard
  return <Navigate to={`/dashboard/${user.role}`} replace />;
}