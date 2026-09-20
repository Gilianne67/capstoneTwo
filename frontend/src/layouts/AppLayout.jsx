import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Loader2, WifiOff } from 'lucide-react';
import Sidebar from '../components/navigation/Sidebar';
import { useAuth } from '../context/AuthContext'; // 1. Import AuthContext

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://api.iskolarmatch.ph/v1';

export default function AppLayout() {
  const navigate = useNavigate();
  // 2. Consume shared state from AuthContext
  const { user, token, loading, logout } = useAuth();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  // Notifications State
 // const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(2);

  // User Menu State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // 3. Notifications Check
  useEffect(() => {
<<<<<<< HEAD
    if (!user || !token) return;
=======
  let isMounted = true;

  const verifySession = async () => {
   const token = localStorage.getItem('token');

    if (!token) {
      if (isMounted) {
        setSession(null);
        setIsUsingMockData(false);
        setIsLoadingSession(false);
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Session verification failed');
      }

      if (isMounted) {
        setSession(data.user);
        setIsUsingMockData(false);
        localStorage.setItem(
          'iskolar_session',
          JSON.stringify(data.user)
        );
      }
    } catch (err) {
      console.error('Session verification failed:', err);

      localStorage.removeItem('token');
      localStorage.removeItem('iskolar_session');

      if (isMounted) {
        setSession(null);
        setIsUsingMockData(false);
      }

      navigate('/auth?mode=signin', { replace: true });
    } finally {
      if (isMounted) {
        setIsLoadingSession(false);
      }
    }
  };

  verifySession();

  return () => {
    isMounted = false;
  };
}, [navigate]);

  // 2. Notifications Check with Mock Fallback
  {/*
  useEffect(() => {
    if (!session) return;
>>>>>>> second-repo/staging

    let isMounted = true;
    const fetchNotificationBadge = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) setUnreadNotificationsCount(data.count ?? 0);
        }
      } catch (_err) {
        // Retain default notification count on API error
      }
    };

    fetchNotificationBadge();

    return () => {
      isMounted = false;
    };
<<<<<<< HEAD
  }, [user, token]);
=======
  }, [session]);
  */}
>>>>>>> second-repo/staging

  // 4. Unified Logout Handler
  const handleLogout = async () => {
    try {
<<<<<<< HEAD
=======
      const token = localStorage.getItem('token');
>>>>>>> second-repo/staging
      if (token) {
        await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (_err) {
      console.warn('Logout API unreachable.');
    } finally {
      logout(); // Clears AuthContext state and localStorage token
      navigate('/auth?mode=signin', { replace: true });
    }
  };

  // Extract role dynamically from AuthContext user object
  const role = user?.role?.toLowerCase() || 'student';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Initializing workspace session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-row overflow-hidden font-sans">
      {/* Dark Module Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        role={role}
        session={user}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Workspace Top Bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-xs">
          {/* Left Header Area */}
          <div className="flex items-center gap-3">
            {isUsingMockData && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                <WifiOff className="w-3 h-3 text-amber-500" /> Preview Mode (Mock Data)
              </span>
            )}
          </div>

          {/* Right Header Area - Notifications & User Profile */}
          <div className="flex items-center gap-4">
            {/* Notification Bell
            <button
              type="button"
              onClick={() => navigate('/dashboard/notifications')}
              aria-label="View notifications"
              className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <Bell className="h-4 w-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>  */}

            {/* Profile Dropdown Menu */}
            <div className="relative border-l border-slate-200 pl-3">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2.5 focus:outline-hidden cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white shadow-xs">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-slate-800 leading-none">
                    {user?.name || user?.firstName || 'User'}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize mt-0.5">{role} Account</p>
                </div>
              </button>

              {/* User Dropdown Popup */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-500" />
                        Sign Out
                      </button>
                    </div>
)}
            </div>
          </div>
        </header>

        {/* Dashboard Content Area */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <Outlet context={{ session: user, role, isUsingMockData }} />
        </main>
      </div>
    </div>
  );
}