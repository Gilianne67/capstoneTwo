import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  GraduationCap, 
  LayoutDashboard, 
  User, 
  Search, 
  Award, 
  Bookmark, 
  FileText, 
  Bell, 
  Settings, 
  HelpCircle, 
  LogOut, 
  Building2, 
  ShieldCheck, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight,
  PlusCircle,
  CheckSquare,
  Tags,
  AlertTriangle,
  Layers,
  Menu,
  X
} from 'lucide-react';

export default function Sidebar({ isCollapsed, setIsCollapsed, role, session }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Mobile drawer state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile drawer when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileOpen]);

  const themes = {
    student: {
      sidebarBg: 'bg-blue-50/90 md:bg-blue-50/40',
      roleAccent: 'text-[#2563eb]',
      pillBg: 'bg-[#2563eb]',
      activeBg: 'bg-blue-100/80 text-[#2563eb]',
      hoverBg: 'hover:bg-blue-100/50 text-slate-600 hover:text-slate-900',
      badgeBg: 'bg-blue-200/80 text-[#2563eb]',
      geoGradient: 'from-blue-600/20 via-blue-400/15 to-transparent',
      geoCircle: 'border-blue-500/25 bg-blue-500/10',
      geoPattern: 'rgba(37, 99, 235, 0.18)',
    },
    provider: {
      sidebarBg: 'bg-emerald-50/90 md:bg-emerald-50/40',
      roleAccent: 'text-[#059669]',
      pillBg: 'bg-[#059669]',
      activeBg: 'bg-emerald-100/80 text-[#047857]',
      hoverBg: 'hover:bg-emerald-100/50 text-slate-600 hover:text-slate-900',
      badgeBg: 'bg-emerald-200/80 text-[#047857]',
      geoGradient: 'from-emerald-600/20 via-emerald-400/15 to-transparent',
      geoCircle: 'border-emerald-500/25 bg-emerald-500/10',
      geoPattern: 'rgba(5, 150, 105, 0.18)',
    },
    admin: {
      sidebarBg: 'bg-amber-50/90 md:bg-amber-50/40',
      roleAccent: 'text-[#d97706]',
      pillBg: 'bg-[#d97706]',
      activeBg: 'bg-amber-100/80 text-[#b45309]',
      hoverBg: 'hover:bg-amber-100/50 text-slate-600 hover:text-slate-900',
      badgeBg: 'bg-amber-200/80 text-[#b45309]',
      geoGradient: 'from-amber-600/20 via-amber-400/15 to-transparent',
      geoCircle: 'border-amber-500/25 bg-amber-500/10',
      geoPattern: 'rgba(217, 119, 6, 0.18)',
    }
  };

  const currentTheme = themes[role] || themes.student;

  const getNavSections = () => {
    if (role === 'provider') {
      return {
        menu: [
          { label: 'Dashboard', path: '/dashboard/provider', icon: LayoutDashboard },
          { label: 'Scholarship Listings', path: '/dashboard/provider/listings', icon: Layers },
          { label: 'Create Listing', path: '/dashboard/provider/create', icon: PlusCircle },
          { label: 'Performance & Analytics', path: '/dashboard/provider/analytics', icon: BarChart3 },
          { label: 'Organization Verification', path: '/dashboard/provider/verification', icon: Building2 },
        ],
        general: [
          { label: 'Settings & RBAC', path: '/dashboard/provider/settings', icon: Settings },
          { label: 'Help & Support', path: '/dashboard/provider/help', icon: HelpCircle },
        ]
      };
    }

    if (role === 'admin') {
      return {
        menu: [
          { label: 'Operations Dashboard', path: '/dashboard/admin', icon: LayoutDashboard },
          { label: 'Verification Queue', path: '/dashboard/admin/verification', icon: CheckSquare, badge: 'Pending' },
          { label: 'Content Moderation', path: '/dashboard/admin/moderation', icon: AlertTriangle },
          { label: 'Taxonomy & Tags', path: '/dashboard/admin/taxonomy', icon: Tags },
          { label: 'Audit & Compliance', path: '/dashboard/admin/audit-log', icon: ShieldCheck },
        ],
        general: [
          { label: 'System Settings', path: '/dashboard/admin/settings', icon: Settings },
          { label: 'Notifications', path: '/dashboard/admin/notifications', icon: Bell },
          { label: 'Help Center', path: '/dashboard/admin/help', icon: HelpCircle },
        ]
      };
    }

    // Default: Student Module
    return {
      menu: [
        { label: 'Dashboard', path: '/dashboard/student', icon: LayoutDashboard },
        { label: 'Matched Feed', path: '/dashboard/student/matches', icon: Award, badge: 'Live' },
        { label: 'Student Profile', path: '/dashboard/student/profile', icon: User },
        { label: 'Scholarship Search', path: '/dashboard/student/search', icon: Search },
        { label: 'Saved Scholarships', path: '/dashboard/student/saved', icon: Bookmark },
        { label: 'Application Tracker', path: '/dashboard/student/applications', icon: FileText },
      ],
      general: [
        { label: 'Deadline Alerts', path: '/dashboard/student/notifications', icon: Bell },
        { label: 'Settings', path: '/dashboard/student/settings', icon: Settings },
        { label: 'Help Center', path: '/dashboard/student/help', icon: HelpCircle },
      ]
    };
  };

  const { menu, general } = getNavSections();

  const handleLogout = () => {
    localStorage.removeItem('iskolar_session');
    localStorage.removeItem('token');
    setIsMobileOpen(false);
    navigate('/auth?mode=signin');
  };

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;

    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={() => setIsMobileOpen(false)}
        className={`relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
          isActive 
            ? `${currentTheme.activeBg}` 
            : `${currentTheme.hoverBg}`
        } ${isCollapsed ? 'md:justify-center md:px-0' : ''}`}
        title={isCollapsed ? item.label : undefined}
      >
        {/* Active Pill Bar */}
        {isActive && (
          <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full ${currentTheme.pillBg}`} />
        )}

        <div className="flex items-center gap-3">
          <Icon className={`h-4 w-4 shrink-0 ${isActive ? currentTheme.roleAccent : ''}`} />
          <span className={`truncate ${isCollapsed ? 'md:hidden' : 'block'}`}>{item.label}</span>
        </div>

        {/* Optional Badge */}
        {item.badge && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${currentTheme.badgeBg} ${isCollapsed ? 'md:hidden' : 'block'}`}>
            {item.badge}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <>
      {/* 📱 Mobile Top Bar Header & Trigger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between z-40 shadow-xs">
        <div className="flex items-center gap-2">
          <GraduationCap className={`h-6 w-6 ${currentTheme.roleAccent}`} />
          <span className="font-bold text-lg tracking-tight text-slate-900">
            Iskolar<span className={currentTheme.roleAccent}>Match</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileOpen((prev) => !prev)}
          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 focus:outline-hidden"
          aria-label="Toggle Mobile Navigation Menu"
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* 📱 Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* 💻 Main Sidebar Container (Mobile Off-Canvas Drawer + Desktop Adaptive Panel) */}
      <aside
        className={`fixed md:static top-0 bottom-0 left-0 z-50 ${currentTheme.sidebarBg} backdrop-blur-md md:backdrop-blur-none border-r border-slate-200/80 text-slate-800 flex flex-col justify-between transition-all duration-300 shadow-xl md:shadow-none ${
          // Mobile state transforms
          isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'
        } ${
          // Desktop width states
          isCollapsed ? 'md:w-20' : 'md:w-64'
        }`}
      >
        {/* GEOMETRIC BACKGROUND ACCENTS */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className={`absolute -right-20 -bottom-20 w-80 h-80 bg-gradient-to-tl ${currentTheme.geoGradient} rounded-full blur-2xl`} />
          <div className={`absolute -right-12 -bottom-10 w-48 h-48 border-2 ${currentTheme.geoCircle} rounded-3xl rotate-45`} />
          <div className={`absolute right-6 bottom-24 w-28 h-28 border ${currentTheme.geoCircle} rounded-full`} />
          <div 
            className="absolute inset-0 opacity-80"
            style={{
              backgroundImage: `radial-gradient(${currentTheme.geoPattern} 1.5px, transparent 1.5px)`,
              backgroundSize: '18px 18px'
            }}
          />
        </div>

        {/* Desktop Collapse Toggle Button (Hidden on Mobile) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3.5 top-6 bg-white text-slate-800 border border-slate-300 rounded-full p-1.5 shadow-lg hover:bg-slate-50 hover:scale-110 active:scale-95 transition-all z-50 cursor-pointer"
          aria-label="Toggle Desktop Sidebar Width"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4 stroke-[2.5]" /> : <ChevronLeft className="h-4 w-4 stroke-[2.5]" />}
        </button>

        {/* Brand Header */}
        <div className="p-5 flex items-center justify-between md:justify-start h-20 relative z-10">
          <div className="flex items-center gap-2.5 group">
            <GraduationCap className={`h-7 w-7 transition-all duration-300 group-hover:scale-110 ${currentTheme.roleAccent}`} />
            <span className={`font-bold text-xl tracking-tight text-slate-900 ${isCollapsed ? 'md:hidden' : 'block'}`}>
              Iskolar<span className={currentTheme.roleAccent}>Match</span>
            </span>
          </div>

          {/* Mobile Close Button inside Drawer Header */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100/50"
            aria-label="Close Mobile Drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Body */}
        <div className="flex-1 px-3 py-2 space-y-6 overflow-y-auto custom-scrollbar relative z-10">
          {/* MENU Section */}
          <div>
            <p className={`px-3 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase mb-2 ${isCollapsed ? 'md:hidden' : 'block'}`}>
              Menu
            </p>
            <div className="space-y-1">
              {menu.map(renderNavItem)}
            </div>
          </div>

          {/* GENERAL Section */}
          <div>
            <p className={`px-3 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase mb-2 ${isCollapsed ? 'md:hidden' : 'block'}`}>
              General
            </p>
            <div className="space-y-1">
              {general.map(renderNavItem)}
            </div>
          </div>
        </div>

        {/* Logout Footer */}
        <div className="p-3 border-t border-slate-200/80 bg-white/60 relative z-10">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors ${
              isCollapsed ? 'md:justify-center md:px-0' : ''
            }`}
            title={isCollapsed ? 'Logout' : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={isCollapsed ? 'md:hidden' : 'block'}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}