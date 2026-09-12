import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// 🛠️ TOGGLE THIS SWITCH: Set to false when your real API/Backend is ready
const USE_MOCK_API = false; 

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Preset test accounts for development
const MOCK_USERS = {
  'student@iskolar.ph': { id: 'usr_1', email: 'student@iskolar.ph', name: 'Juan Dela Cruz', role: 'student' },
  'provider@iskolar.ph': { id: 'usr_2', email: 'provider@iskolar.ph', name: 'DOST Scholarship Office', role: 'provider' },
  'admin@iskolar.ph': { id: 'usr_3', email: 'admin@iskolar.ph', name: 'System Administrator', role: 'admin' },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Single initialization effect
  useEffect(() => {
    const initializeAuth = async () => {
      if (USE_MOCK_API) {
        // Restore mock session from localStorage
        const savedSession = localStorage.getItem('iskolar_session');
        if (savedSession) {
          try {
            setUser(JSON.parse(savedSession));
          } catch (e) {
            localStorage.removeItem('iskolar_session');
          }
        }
        setLoading(false);
      } else {
        // Real API session check
        const storedToken = localStorage.getItem('token');
        if (!storedToken) {
          setUser(null);
          setLoading(false);
          return;
        }

        try {
          const res = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
            },
            credentials: 'include',
          });
          const data = await res.json();
          if (data.success) {
            setUser(data.data || data.user);
            setToken(storedToken);
          } else {
            setUser(null);
            localStorage.removeItem('token');
          }
        } catch (err) {
          console.error('Session initialization error:', err);
          setUser(null);
        } finally {
          setLoading(false);
        }
      }
    };

    initializeAuth();
  }, []);

  // Login Handler
  const login = async (email, password) => {
    const emailLower = email.trim().toLowerCase();

    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 300));

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

    // Real Backend Login
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailLower, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Invalid email or password.');

    const jwtToken = data.token;
    localStorage.setItem('token', jwtToken);
    setToken(jwtToken);
    setUser(data.user);
    return data.user;
  };

  // Register Handler
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

    // Real Backend Registration
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Registration failed.');

    const jwtToken = data.token;
    localStorage.setItem('token', jwtToken);
    setToken(jwtToken);
    setUser(data.user);
    return data.user;
  };

  const resetPassword = async (email) => {
  const res = await fetch('/api/v1/auth/forgotpassword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send reset email');
  return data;
};

  // Logout Handler
  const logout = () => {
    localStorage.removeItem('iskolar_session');
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
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