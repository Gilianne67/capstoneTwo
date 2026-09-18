import React, { createContext, useContext, useState, useEffect } from 'react';

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
  const getCleanToken = () => {
    const rawToken = localStorage.getItem('token') || token;
    return rawToken ? rawToken.replace(/^"|"$/g, '').replace('Bearer ', '').trim() : null;
  };

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
  }, []);

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
    
    setUser(data.user || data.data);
    return data.user || data.data;
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

    setUser(data.user || data.data);
    return data.user || data.data;
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
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {!loading && children}
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