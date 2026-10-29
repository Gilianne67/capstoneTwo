const normalizeEmail = (value) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

/**
 * Address shown on the public verification holding page.
 * A copied URL is not a credential: the query string is ignored.
 * A signed-in user sees only their own session email. An unauthenticated
 * visitor sees an address only when this same browser passed it in navigation
 * state after sign-in or onboarding.
 */
export function verificationHoldingEmail({ userEmail, stateEmail } = {}) {
  const sessionEmail = normalizeEmail(userEmail);
  if (sessionEmail) return sessionEmail;
  return normalizeEmail(stateEmail);
}
