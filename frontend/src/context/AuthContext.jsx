import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { resolveRedirectPath } from './redirectPath';
import { API_BASE_URL } from '../config/api';
import { interpretLogoutResult } from './logoutResult';
import {
  clearStoredSession as removeStoredCredentials,
  endedSessionReason,
  SESSION_ENDED_EVENT,
  storageEventEndsSession,
} from './sessionEnded';
import {
  isMaintenanceResponse,
  MAINTENANCE_EVENT,
  maintenanceMessage,
} from './maintenanceMode';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceNotice, setMaintenanceNotice] = useState('');
  const [token, setToken] = useState(() => {
    const raw = localStorage.getItem('token');
    return raw ? raw.replace(/^"|"$/g, '').trim() : null;
  });
  const [loading, setLoading] = useState(true);

  // Utility to retrieve a clean Bearer token across context state and storage keys
  const getCleanToken = useCallback(() => {
    const rawToken = token || 
                     localStorage.getItem('token') || 
                     localStorage.getItem('accessToken') || 
                     localStorage.getItem('authToken');
    return rawToken ? rawToken.replace(/^"|"$/g, '').replace('Bearer ', '').trim() : null;
  }, [token]);

  const getRedirectPath = useCallback(
    (userData) => resolveRedirectPath(userData),
    []
  );

  const clearStoredSession = useCallback(() => {
    removeStoredCredentials(localStorage);
    setUser(null);
    setToken(null);
  }, []);

  const noteMaintenance = useCallback((data) => {
    setMaintenance(true);
    setMaintenanceNotice(maintenanceMessage(data));
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
          setMaintenance(false);
          setUser(data.data || data.user);
          setToken(activeToken);
        } else if (isMaintenanceResponse(res.status, data)) {
          noteMaintenance(data);
        } else if (res.status === 401 || res.status === 403) {
          setMaintenance(false);
          clearStoredSession();
        } else if (res.status === 429) {
          console.warn('Session check was rate limited. The saved session was kept.');
        }
      } catch (err) {
        console.error('Session initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [getCleanToken, clearStoredSession, noteMaintenance]);

  useEffect(() => {
    const endSession = () => clearStoredSession();
    const onStorage = (event) => {
      if (storageEventEndsSession(event)) endSession();
    };
    const onMaintenance = (event) => noteMaintenance(event && event.detail);
    window.addEventListener(SESSION_ENDED_EVENT, endSession);
    window.addEventListener(MAINTENANCE_EVENT, onMaintenance);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, endSession);
      window.removeEventListener(MAINTENANCE_EVENT, onMaintenance);
      window.removeEventListener('storage', onStorage);
    };
  }, [clearStoredSession, noteMaintenance]);

  useEffect(() => {
    let cancelled = false;

    const verifyVisibleSession = async () => {
      if (document.visibilityState === 'hidden') return;
      const activeToken = getCleanToken();
      if (!activeToken) return;

      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && isMaintenanceResponse(res.status, data)) {
          noteMaintenance(data);
        } else if (!cancelled && endedSessionReason(res.status, data)) {
          clearStoredSession();
        }
      } catch {
        // Keep the signed-in screen when this check cannot reach the server.
      }
    };

    window.addEventListener('focus', verifyVisibleSession);
    document.addEventListener('visibilitychange', verifyVisibleSession);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', verifyVisibleSession);
      document.removeEventListener('visibilitychange', verifyVisibleSession);
    };
  }, [getCleanToken, clearStoredSession, noteMaintenance]);

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
    if (!response.ok) {
      const err = new Error(data.message || data.error || 'Invalid email or password.');
      err.verificationDeclined = Boolean(data.verificationDeclined);
      err.requiresConsent = Boolean(data.requiresConsent);
      throw err;
    }

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
    if (!response.ok) {
      const err = new Error(data.message || data.error || 'Registration failed.');
      err.verificationDeclined = Boolean(data.verificationDeclined);
      err.canResubmit = Boolean(data.canResubmit);
      err.emailTaken = Boolean(data.emailTaken);
      throw err;
    }

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
    console.log(`🌐 [AuthContext] Sending forgotpassword fetch request to: ${API_BASE_URL}/auth/forgotpassword`);
    
    const res = await fetch(`${API_BASE_URL}/auth/forgotpassword`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    const data = await res.json();
    console.log(`📩 [AuthContext] forgotpassword API Response:`, data);

    if (!res.ok) throw new Error(data.message || data.error || 'Failed to send reset email');
    return data;
  };

  // Logout Handler
  const replaceSession = (nextToken) => {
    const jwtToken = String(nextToken || '').replace(/^"|"$/g, '').trim();
    if (!jwtToken) return;
    localStorage.setItem('token', jwtToken);
    setToken(jwtToken);
  };

  const logout = async () => {
    const activeToken = getCleanToken();
    let response;

    try {
      response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'GET',
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        credentials: 'include',
      });
    } catch (err) {
      console.warn('Logout API unreachable.', err);
      return interpretLogoutResult({ networkError: true });
    }

    let data = {};
    try {
      data = await response.json();
    } catch (err) {
      data = {};
    }

    const result = interpretLogoutResult({ ok: response.ok, data });
    if (!result.clearSession) return result;

    clearStoredSession();
    return result;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, maintenance, maintenanceNotice, login, register, logout, resetPassword, updateUser, replaceSession, getRedirectPath, getCleanToken }}>
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