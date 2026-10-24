/**
 * Post-login and session redirect target.
 * Pending guardian consent stays on the parental consent waiting screen. 
 * It does not open the dashboard or the onboarding form.
 */
export function resolveRedirectPath(userData) {
  if (!userData) return '/auth?mode=signin';

  const role = userData?.role?.toLowerCase();
  const isOnboarded = userData?.isOnboarded ?? userData?.is_onboarded ?? false;
  const verificationStatus = (
    userData?.verificationStatus ||
    userData?.verification_status ||
    ''
  ).toLowerCase();
  const status = String(userData?.status || '').toLowerCase();

  if (role === 'provider') {
    if (!isOnboarded) {
      return '/provider/onboarding';
    }
    if (verificationStatus === 'rejected') {
      return '/auth?mode=signin';
    }
    const isVerified =
      verificationStatus === 'verified' || verificationStatus === 'approved';
    if (!isVerified) {
      return '/provider/pending-approval';
    }
    return '/dashboard/provider';
  }

  if (role === 'student') {
    if (status === 'pending_consent') {
      return '/consent/verify';
    }
    if (!isOnboarded) {
      return '/onboarding';
    }
    return '/dashboard/student';
  }

  if (role === 'admin' || role === 'superadmin' || role === 'super_admin') {
    return '/dashboard/admin';
  }

  return '/auth?mode=signin';
}