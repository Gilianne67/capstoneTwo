import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * @param {Array<string>} allowedRoles - Roles allowed to access (e.g. ['admin', 'provider'])
 * @param {boolean} requireApprovedProvider - If true, restricts pending/rejected providers
 * @param {React.ReactNode} children - Optional wrapped elements
 */
export default function ProtectedRoute({ 
  allowedRoles = [], 
  requireApprovedProvider = false, 
  children 
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 1. Wait for AuthContext session check
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <span className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  // 2. Unauthenticated -> redirect to login with location memory
  if (!user) {
    return <Navigate to="/auth?mode=signin" state={{ from: location }} replace />;
  }

  const rawRole = user?.role?.toLowerCase() || 'student';
  
  // Normalize superadmin variations to match route paths
  const userRole = (rawRole === 'superadmin' || rawRole === 'super_admin') ? 'admin' : rawRole;

  // 3. Role restriction check (case-insensitive)
  if (
    allowedRoles.length > 0 &&
    !allowedRoles.map((r) => r.toLowerCase()).includes(userRole)
  ) {
    // Prevent infinite redirect if user is already on their fallback dashboard path
    const fallbackPath = `/dashboard/${userRole}`;
    if (location.pathname === fallbackPath) {
      return <Navigate to="/auth?mode=signin" replace />;
    }
    return <Navigate to={fallbackPath} replace />;
  }

  // 4. Provider verification status check
  if (userRole === 'provider' && requireApprovedProvider) {
    const status = user?.verificationStatus?.toLowerCase() || user?.verification_status?.toLowerCase();

    if (status === 'pending' && location.pathname !== '/provider/pending-approval') {
      return <Navigate to="/provider/pending-approval" replace />;
    }
    if (status === 'rejected' && location.pathname !== '/provider/rejected') {
      return <Navigate to="/provider/rejected" replace />;
    }
  }

  // 5. Render children or nested Outlet
  return children ? children : <Outlet />;
}