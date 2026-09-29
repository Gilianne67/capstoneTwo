import { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react';

export function SecurityForm({
  onSave,
  passwordChangeAvailable = true,
  twoFactorAvailable = true
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const handleChange = (e) => {
    if (!passwordChangeAvailable) return;
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!passwordChangeAvailable) return;

    if (passwords.newPassword !== passwords.confirmPassword) {
      setStatusMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    
    // Trigger parent callback
    if (onSave) onSave({ passwords, twoFactorEnabled });
    setStatusMessage({ type: 'success', text: 'Security settings updated successfully!' });
    setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  return (
    <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-6">
      <div className="flex items-center gap-2 pb-4 border-b border-app-text/10">
        <Lock className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-sm font-extrabold text-app-text">Security & Password</h3>
          <p className="text-xs text-text-muted">Manage your password and authentication security</p>
          {!passwordChangeAvailable && (
            <p className="text-[11px] text-text-muted mt-1">Password changes are currently unavailable.</p>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
          statusMessage.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {statusMessage.type === 'error' ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-app-text mb-1.5">Current Password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            name="currentPassword"
            value={passwords.currentPassword}
            onChange={handleChange}
            required={passwordChangeAvailable}
            disabled={!passwordChangeAvailable}
            className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-medium text-app-text focus:outline-hidden focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="••••••••"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-app-text mb-1.5">New Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              name="newPassword"
              value={passwords.newPassword}
              onChange={handleChange}
              required={passwordChangeAvailable}
              disabled={!passwordChangeAvailable}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-medium text-app-text focus:outline-hidden focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Min. 8 characters"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1.5">Confirm New Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={passwords.confirmPassword}
              onChange={handleChange}
              required={passwordChangeAvailable}
              disabled={!passwordChangeAvailable}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-medium text-app-text focus:outline-hidden focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Re-enter new password"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              if (!passwordChangeAvailable) return;
              setShowPassword(!showPassword);
            }}
            disabled={!passwordChangeAvailable}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-app-text font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showPassword ? 'Hide Passwords' : 'Show Passwords'}</span>
          </button>
        </div>

        {/* 2FA Toggle */}
        <div className="pt-4 border-t border-app-text/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-app-text">Two-Factor Authentication (2FA)</p>
            <p className="text-[11px] text-text-muted">
              {twoFactorAvailable
                ? 'Adds an extra layer of security to your account'
                : 'Two-factor authentication is currently unavailable.'}
            </p>
          </div>
          <label className={`relative inline-flex items-center ${twoFactorAvailable ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
            <input
              type="checkbox"
              checked={twoFactorAvailable && twoFactorEnabled}
              disabled={!twoFactorAvailable}
              onChange={() => {
                if (!twoFactorAvailable) return;
                setTwoFactorEnabled(!twoFactorEnabled);
              }}
              className="sr-only peer"
            />
            <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary ${twoFactorAvailable ? '' : 'opacity-50'}`}></div>
          </label>
        </div>

        <button
          type="submit"
          disabled={!passwordChangeAvailable}
          className="w-full sm:w-auto px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Update Password
        </button>
      </form>
    </div>
  );
}

export default SecurityForm;