import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// 🛠️ TOGGLE THIS SWITCH: Set to false when your real API/Backend is ready
const USE_MOCK_API = true; 

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.iskolarmatch.ph/v1';
// Preset test accounts for development
const MOCK_USERS = {
  'student@iskolar.ph': { id: 'usr_1', email: 'student@iskolar.ph', name: 'Juan Dela Cruz', role: 'student' },
  'provider@iskolar.ph': { id: 'usr_2', email: 'provider@iskolar.ph', name: 'DOST Scholarship Office', role: 'provider' },
  'admin@iskolar.ph': { id: 'usr_3', email: 'admin@iskolar.ph', name: 'System Administrator', role: 'admin' },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on refresh
  useEffect(() => {
    const initializeAuth = async () => {
      const savedSession = localStorage.getItem('iskolar_session');
      if (savedSession) {
        try {
          setUser(JSON.parse(savedSession));
        } catch (e) {
          localStorage.removeItem('iskolar_session');
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  // Login Handler (Supports Mock & Real API)
  const login = async (email, password) => {
    const emailLower = email.trim().toLowerCase();

    if (USE_MOCK_API) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Match preset mock user or generate dynamic mock user based on email
      let authenticatedUser = MOCK_USERS[emailLower];

      if (!authenticatedUser) {
        let inferredRole = 'student';
        if (emailLower.includes('admin')) inferredRole = 'admin';
        if (emailLower.includes('provider') || emailLower.includes('sponsor')) inferredRole = 'provider';

        authenticatedUser = {
          id: `usr_${Date.now()}`,
          email: emailLower,
          name: emailLower.split('@')[0],
          role: inferredRole,
        };
      }

      localStorage.setItem('iskolar_session', JSON.stringify(authenticatedUser));
      setUser(authenticatedUser);
      return authenticatedUser;
    }

    // --- REAL BACKEND LOGIC (Used when USE_MOCK_API = false) ---
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailLower, password })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Invalid email or password.');

    localStorage.setItem('iskolar_token', data.token);
    setUser(data.user);
    return data.user;
  };

  // Register Handler (Supports Mock & Real API)
  const register = async (payload) => {
    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 400));

      const newUser = {
        id: `usr_${Date.now()}`,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };

      localStorage.setItem('iskolar_session', JSON.stringify(newUser));
      setUser(newUser);
      return newUser;
    }

    // --- REAL BACKEND LOGIC ---
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Registration failed.');

    localStorage.setItem('iskolar_token', data.token);
    setUser(data.user);
    return data.user;
  };

  // Logout Handler
  const logout = () => {
    localStorage.removeItem('iskolar_session');
    localStorage.removeItem('iskolar_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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