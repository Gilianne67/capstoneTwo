import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth();

  // 1. Wait for AuthContext session check
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // 2. Unauthenticated -> send to login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // 3. Unauthorized role -> redirect to their role's home dashboard
  if (
  allowedRoles && 
  !allowedRoles.map(r => r.toLowerCase()).includes(user?.role?.toLowerCase())
) {
  return <Navigate to={`/dashboard/${user.role}`} replace />;
}

  // 4. Render children if wrapped directly, or Outlet if used as layout route
  return children ? children : <Outlet />;
}