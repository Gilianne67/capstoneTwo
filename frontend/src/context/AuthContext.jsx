import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { resolveRedirectPath } from './redirectPath';
import { API_BASE_URL } from '../config/api';

const AuthContext = createContext(null);

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
  const getRedirectPath = useCallback(
    (userData) => resolveRedirectPath(userData),
    []
  );

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
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
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

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
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
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
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
    const res = await fetch(`${API_BASE_URL}/auth/forgotpassword`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to send reset email');
    return data;
  };

  // Logout Handler — revoke the current token, then drop local session state.
  const logout = async () => {
    const activeToken = getCleanToken();

    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'GET',
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        credentials: 'include',
      });
    } catch (err) {
      console.warn('Logout API unreachable.', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('iskolar_session');
      setUser(null);
      setToken(null);
    }
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