import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  hidesAppDuringMaintenance,
  isAdministratorRole,
  isMaintenanceEntryPath,
  MAINTENANCE_MESSAGE,
  performMaintenanceCheckAgain,
  signOutFromMaintenanceScreen,
} from '../../context/maintenanceMode';

function MaintenanceBanner({ message }) {
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-950 px-4 py-3 text-sm">
      <p className="max-w-5xl mx-auto flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
        <span>{message} Administrators can sign in to turn this off.</span>
      </p>
    </div>
  );
}

function MaintenanceScreen({ message, hasSession, onLogout, onSignedOut, onRefresh }) {
  const [logoutError, setLogoutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const pendingLogout = useRef(false);

  const signOut = () => signOutFromMaintenanceScreen({
    logout: onLogout,
    navigate: onSignedOut,
    isPending: () => pendingLogout.current,
    setPending: (value) => {
      pendingLogout.current = value;
      setSigningOut(value);
    },
    setError: setLogoutError,
  });

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-card-bg border border-app-text/10 rounded-2xl shadow-xs p-8">
        <div className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <h1 className="text-lg font-extrabold">Maintenance in progress</h1>
        </div>
        <p className="mt-3 text-sm text-text-muted leading-relaxed">{message}</p>
        {logoutError && (
          <p className="mt-3 text-xs font-semibold text-rose-700">{logoutError}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 cursor-pointer"
          >
            Check again
          </button>
          {hasSession && (
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="px-4 py-2 border border-app-text/15 text-xs font-bold rounded-xl hover:bg-app-bg disabled:opacity-50 cursor-pointer"
            >
              {signingOut ? 'Signing out...' : 'Log out'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MaintenanceGate({ children }) {
  const { maintenance, maintenanceNotice, user, token, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const message = maintenanceNotice || MAINTENANCE_MESSAGE;

  if (!maintenance || !hidesAppDuringMaintenance(location.pathname, user?.role)) {
    if (maintenance && !isAdministratorRole(user?.role) && isMaintenanceEntryPath(location.pathname)) {
      return (
        <>
          <MaintenanceBanner message={message} />
          {children}
        </>
      );
    }
    return children;
  }

  return (
    <MaintenanceScreen
      message={message}
      hasSession={Boolean(token)}
      onLogout={logout}
      onSignedOut={navigate}
      onRefresh={() => performMaintenanceCheckAgain()}
    />
  );
}
