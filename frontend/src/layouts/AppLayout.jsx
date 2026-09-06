import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Loader2, User as UserIcon, WifiOff } from 'lucide-react';
import Sidebar from '../components/navigation/Sidebar';


export default function AppLayout() {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [session, setSession] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  // Notifications State
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(2);

  // User Menu State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // 1. Session & Auth Verification with Fallback
  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      const token = localStorage.getItem('token');
      const rawSession = localStorage.getItem('iskolar_session');

      // Attempt parsing local cached session safely
      let cachedSession = null;
      if (rawSession) {
        try {
          cachedSession = JSON.parse(rawSession);
        } catch (_err) {
          console.warn('Malformed local session cleared.');
          localStorage.removeItem('iskolar_session');
        }
      }

      // If no token exists, fall back to mock preview state
      if (!token) {
        if (isMounted) {
          setSession(cachedSession || MOCK_FALLBACK_SESSION);
          setIsUsingMockData(true);
          setIsLoadingSession(false);
        }
        return;
      }

      // Try Backend Verification
      try {
        const res = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const userData = await res.json();
          if (isMounted) {
            setSession(userData);
            setIsUsingMockData(false);
            localStorage.setItem('iskolar_session', JSON.stringify(userData));
          }
        } else {
          throw new Error('Backend session rejected or token expired');
        }
      } catch (_err) {
        console.warn('API connection failed. Falling back to frontend preview mode.');
        if (isMounted) {
          setSession(cachedSession || MOCK_FALLBACK_SESSION);
          setIsUsingMockData(true);
        }
      } finally {
        if (isMounted) setIsLoadingSession(false);
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  // 2. Notifications Check with Mock Fallback
  useEffect(() => {
    if (!session) return;

    let isMounted = true;
    const fetchNotificationBadge = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const res = await fetch('/api/v1/notifications/unread-count', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) setUnreadNotificationsCount(data.count ?? 0);
        }
      } catch (_err) {
        // Retain default mock notification count on API error
      }
    };

    fetchNotificationBadge();

    return () => {
      isMounted = false;
    };
  }, [session]);

  // 3. Logout Handler
  const handleLogout = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (_err) {
      console.warn('Logout API unreachable.');
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('iskolar_session');
      navigate('/auth?mode=signin', { replace: true });
    }
  }, [navigate]);

  const role = session?.role || 'student';

  if (isLoadingSession) {
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
        session={session || MOCK_FALLBACK_SESSION}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Workspace Top Bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-xs">
          {/* Left Header Area - Mock Preview Badge */}
          <div className="flex items-center gap-3">
            {isUsingMockData && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                <WifiOff className="w-3 h-3 text-amber-500" /> Preview Mode (Mock Data)
              </span>
            )}
          </div>

          {/* Right Header Area - Notifications & User Profile */}
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
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
            </button>

            {/* Profile Dropdown Menu */}
            <div className="relative border-l border-slate-200 pl-3">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2.5 focus:outline-hidden cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white shadow-xs">
                  {session?.name ? session.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-slate-800 leading-none">
                    {session?.name || 'User'}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize mt-0.5">{role} Account</p>
                </div>
              </button>

              {/* User Dropdown Popup */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate('/dashboard/settings');
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" /> Account Settings
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content Area */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <Outlet context={{ session, role, isUsingMockData }} />
        </main>
      </div>
    </div>
  );
}