import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import Sidebar from '../components/navigation/Sidebar';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [session, setSession] = useState({});

  useEffect(() => {
    const rawSession = localStorage.getItem('iskolar_session');
    if (!rawSession) {
      navigate('/auth?mode=signin');
      return;
    }
    setSession(JSON.parse(rawSession));
  }, [navigate]);

  const role = session.role || 'student';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-row overflow-hidden font-sans">
      {/* Dark Module Sidebar */}
      <Sidebar 
        isCollapsed={isCollapsed} 
        setIsCollapsed={setIsCollapsed} 
        role={role} 
        session={session} 
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Workspace Top Bar (Replaces Public Navbar) */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search scholarships, applicants..." 
                className="w-full pl-9 pr-4 py-1.5 bg-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" />
            </button>

            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                {session.name ? session.name.charAt(0) : 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-800 leading-none">{session.name || 'User'}</p>
                <p className="text-[10px] text-slate-400 capitalize mt-0.5">{role} Account</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}