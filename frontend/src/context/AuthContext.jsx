import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

// Base backend URL resolution (e.g., http://localhost:5000)
const RAW_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_BASE_URL = RAW_BASE.endsWith('/') ? RAW_BASE.slice(0, -1) : RAW_BASE;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    const raw = localStorage.getItem('token');
    return raw ? raw.replace(/^"|"$/g, '').trim() : null;
  });
  const [loading, setLoading] = useState(true);

  // Utility to retrieve a clean Bearer token
  const getCleanToken = useCallback(() => {
    const rawToken = localStorage.getItem('token') || token;
    return rawToken ? rawToken.replace(/^"|"$/g, '').replace('Bearer ', '').trim() : null;
  }, [token]);

  /**
   * Helper function to determine post-login or session redirect target
   * Handles camelCase & snake_case properties seamlessly.
   * @param {Object} userData - User object returned from auth endpoints
   * @returns {string} Route path to navigate to
   */
  const getRedirectPath = useCallback((userData) => {
    if (!userData) return '/auth?mode=signin';

    const role = userData?.role?.toLowerCase();
    const isOnboarded = userData?.isOnboarded ?? userData?.is_onboarded ?? false;
    const verificationStatus = (userData?.verificationStatus || userData?.verification_status || '').toLowerCase();

    if (role === 'provider') {
      // 1. Not onboarded -> Provider Onboarding Form
      if (!isOnboarded) {
        return '/provider/onboarding';
      }
      // 2. Onboarded but pending verification -> Pending Approval Screen
      if (verificationStatus === 'pending') {
        return '/provider/pending-approval';
      }
      // 3. Rejected -> Rejection info screen
      if (verificationStatus === 'rejected') {
        return '/provider/rejected';
      }
      // 4. Approved -> Main Provider Dashboard
      return '/dashboard/provider';
    }

    if (role === 'student') {
      // 1. Not onboarded -> Student Onboarding Form
      if (!isOnboarded) {
        return '/onboarding';
      }
      // 2. Onboarded -> Student Dashboard
      return '/dashboard/student';
    }

    if (role === 'admin' || role === 'superadmin' || role === 'super_admin') {
      return '/dashboard/admin';
    }

    return '/auth?mode=signin';
  }, []);

  // Single initialization effect to verify MongoDB JWT session
  useEffect(() => {
    const initializeAuth = async () => {
      const activeToken = getCleanToken();

      if (!activeToken) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${activeToken}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        const data = await res.json();
        
        if (res.ok && data.success !== false) {
          setUser(data.data || data.user);
          setToken(activeToken);
        } else {
          // Token invalid/expired -> clear state
          setUser(null);
          setToken(null);
          localStorage.removeItem('token');
        }
      } catch (err) {
        console.error('Session initialization error:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [getCleanToken]);

  // Update User state locally (critical after Onboarding/Profile updates)
  const updateUser = (updatedUserData) => {
    setUser((prevUser) => {
      if (!prevUser) return updatedUserData;
      return {
        ...prevUser,
        ...updatedUserData,
      };
    });
  };

  // Login Handler
  const login = async (email, password) => {
    const emailLower = email.trim().toLowerCase();

    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: emailLower, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Invalid email or password.');

    const jwtToken = (data.token || data.accessToken || '').replace(/^"|"$/g, '').trim();
    if (jwtToken) {
      localStorage.setItem('token', jwtToken);
      setToken(jwtToken);
    }
    
    const loggedInUser = data.user || data.data;
    setUser(loggedInUser);
    return loggedInUser;
  };

  // Register Handler
  const register = async (payload) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Registration failed.');

    const jwtToken = (data.token || data.accessToken || '').replace(/^"|"$/g, '').trim();
    if (jwtToken) {
      localStorage.setItem('token', jwtToken);
      setToken(jwtToken);
    }

    const registeredUser = data.user || data.data;
    setUser(registeredUser);
    return registeredUser;
  };

  // Password Reset Request
  const resetPassword = async (email) => {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/forgotpassword`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to send reset email');
    return data;
  };

  // Logout Handler
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, resetPassword, updateUser, getRedirectPath }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};