import { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { MIN_PASSWORD_LENGTH, unchangedPasswordMessage } from '../../config/passwordPolicy';
import {
  presentPasswordUpdateFailure,
  presentSavedPasswordResult,
} from './passwordUpdateMessage';

export function SecurityForm({
  onSave,
  passwordChangeAvailable = true
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [statusMessage, setStatusMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    if (!passwordChangeAvailable) return;
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passwordChangeAvailable || submitting) return;

    if (passwords.newPassword !== passwords.confirmPassword) {
      setStatusMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    if (passwords.newPassword.length < MIN_PASSWORD_LENGTH) {
      setStatusMessage({ type: 'error', text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` });
      return;
    }

    const reusedPassword = unchangedPasswordMessage(passwords.currentPassword, passwords.newPassword);
    if (reusedPassword) {
      setStatusMessage({ type: 'error', text: reusedPassword });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);
    try {
      const result = onSave ? await onSave({ passwords }) : null;
      const alert = presentSavedPasswordResult(result);
      setStatusMessage(alert);
      if (alert.type !== 'error') {
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err) {
      setStatusMessage(presentPasswordUpdateFailure(err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-primary" />
        <div>
          <h4 className="text-xs font-extrabold text-app-text">Change Password</h4>
          {!passwordChangeAvailable && (
            <p className="text-[11px] text-text-muted mt-1">Password changes are currently unavailable.</p>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
          statusMessage.type === 'error'
            ? 'bg-rose-50 text-rose-700 border border-rose-200'
            : statusMessage.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
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
              placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
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

        <button
          type="submit"
          disabled={!passwordChangeAvailable || submitting}
          className="w-full sm:w-auto px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}

export default SecurityForm;