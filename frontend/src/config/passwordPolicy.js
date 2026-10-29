/**
 * Minimum length for a password the user chooses.
 * Must match backend/src/utils/passwordPolicy.js.
 */
export const MIN_PASSWORD_LENGTH = 15;

export const SAME_PASSWORD_MESSAGE = 'Your new password must be different from your current password.';

export function unchangedPasswordMessage(currentPassword, newPassword) {
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') return '';
  if (!currentPassword || !newPassword) return '';
  if (currentPassword === newPassword) return SAME_PASSWORD_MESSAGE;
  return '';
}
