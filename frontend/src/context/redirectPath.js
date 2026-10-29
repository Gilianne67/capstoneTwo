/**
 * Post-login and session redirect target.
 * Pending guardian consent stays on the parental consent waiting screen. 
 * It does not open the dashboard or the onboarding form.
 */
export function isFinalProviderRejection(userData) {
  return Boolean(userData?.isFinalRejection ?? userData?.is_final_rejection);
}

export function canProviderResubmit(userData) {
  const role = userData?.role?.toLowerCase();
  const verificationStatus = (
    userData?.verificationStatus ||
    userData?.verification_status ||
    ''
  ).toLowerCase();
  return role === 'provider' && verificationStatus === 'rejected' && !isFinalProviderRejection(userData);
}

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
      if (isFinalProviderRejection(userData)) {
        return '/auth?mode=signin';
      }
      return '/dashboard/provider/verification';
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

const providerVerificationStatus = (userData) => (
  userData?.verificationStatus || userData?.verification_status || ''
).toLowerCase();

const providerIsOnboarded = (userData) =>
  Boolean(userData?.isOnboarded ?? userData?.is_onboarded);

/**
 * The guardian consent screen stays reachable without a session. Guardians
 * open the emailed link before they have an account. Student onboarding
 * requires the account created at registration.
 */
export function isSessionOptionalRoute(pathname) {
  return pathname === '/consent/verify';
}

const studentIsOnboarded = (userData) =>
  Boolean(userData?.isOnboarded ?? userData?.is_onboarded);

export function canAccessStudentOnboarding(userData) {
  if (userData?.role?.toLowerCase() !== 'student') return false;
  const status = String(userData?.status || '').toLowerCase();
  if (status === 'pending_consent') return false;
  return !studentIsOnboarded(userData);
}

export function studentFlowRedirect(userData, pathname) {
  if (pathname !== '/onboarding') return null;
  return canAccessStudentOnboarding(userData) ? null : resolveRedirectPath(userData);
}

export function canAccessProviderOnboarding(userData) {
  if (userData?.role?.toLowerCase() !== 'provider') return false;
  if (isFinalProviderRejection(userData)) return false;
  if (!providerIsOnboarded(userData)) return true;
  return canProviderResubmit(userData);
}

export function canAccessProviderPendingApproval(userData) {
  if (userData?.role?.toLowerCase() !== 'provider') return false;
  if (isFinalProviderRejection(userData) || !providerIsOnboarded(userData)) return false;
  if (canProviderResubmit(userData)) return false;
  const verificationStatus = providerVerificationStatus(userData);
  return verificationStatus !== 'verified' && verificationStatus !== 'approved';
}

export function providerFlowRedirect(userData, pathname) {
  if (pathname === '/provider/onboarding') {
    return canAccessProviderOnboarding(userData) ? null : resolveRedirectPath(userData);
  }
  if (pathname === '/provider/pending-approval') {
    return canAccessProviderPendingApproval(userData) ? null : resolveRedirectPath(userData);
  }
  return null;
}