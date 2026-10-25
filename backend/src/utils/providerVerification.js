const DECLINED_PROVIDER_STATUS = 'Rejected';

const isDeclinedProviderStatus = (status) =>
  String(status || '') === DECLINED_PROVIDER_STATUS;

const parseBooleanFlag = (value) => {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
  }
  return false;
};

const isFinalRejection = (provider) =>
  isDeclinedProviderStatus(provider?.verificationStatus) &&
  Boolean(provider?.isFinalRejection);

const canResubmitVerification = (provider) =>
  isDeclinedProviderStatus(provider?.verificationStatus) &&
  !Boolean(provider?.isFinalRejection);

const declinedProviderLoginMessage = (provider) => {
  const reason = provider?.rejectionReason || 'Please contact support for more details.';
  if (isFinalRejection(provider)) {
    return `Your organization verification was declined and this decision is final. Reason: ${reason}`;
  }
  return `Your organization verification was declined. Reason: ${reason}`;
};

const FINAL_REJECTION_REGISTRATION_MESSAGE =
  'Your organization verification was declined and this decision is final. You cannot register again with this email.';

const RESUBMIT_REGISTRATION_MESSAGE =
  'An account with this email already exists. Sign in to update your documents and resubmit for review.';

const resolveRegisteredAccountEmail = async (userRef, findUserById) => {
  if (userRef && typeof userRef === 'object' && userRef.email) {
    const populated = String(userRef.email).trim();
    if (populated) return populated;
  }

  const userId = userRef && typeof userRef === 'object'
    ? (userRef._id || userRef.id || userRef)
    : userRef;
  if (!userId || typeof findUserById !== 'function') return '';

  const found = await findUserById(userId);
  return found?.email ? String(found.email).trim() : '';
};

module.exports = {
  DECLINED_PROVIDER_STATUS,
  FINAL_REJECTION_REGISTRATION_MESSAGE,
  RESUBMIT_REGISTRATION_MESSAGE,
  isDeclinedProviderStatus,
  isFinalRejection,
  canResubmitVerification,
  parseBooleanFlag,
  declinedProviderLoginMessage,
  resolveRegisteredAccountEmail,
};
