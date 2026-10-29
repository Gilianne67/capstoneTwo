export function authorizationHeaders(rawToken) {
  const token = rawToken
    ? String(rawToken).replace(/^"|"$/g, '').replace(/^Bearer\s+/i, '').trim()
    : '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function readStoredAuthorizationHeaders(storage) {
  const raw = storage && typeof storage.getItem === 'function' ? storage.getItem('token') : '';
  return authorizationHeaders(raw);
}

export function createInvitationSubmitGuard() {
  let pending = false;
  return {
    begin() {
      if (pending) return false;
      pending = true;
      return true;
    },
    end() {
      pending = false;
    },
    isPending() {
      return pending;
    },
  };
}

export function invitationFormAfterResponse(form, ok) {
  if (!ok) return form;
  return { fullName: '', email: '', adminRole: 'admin' };
}
