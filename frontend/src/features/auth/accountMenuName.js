export function resolveAccountMenuName(user) {
  const fallback = String(user?.name || user?.firstName || 'User').trim() || 'User';
  if (String(user?.role || '').toLowerCase() !== 'provider') {
    return fallback;
  }

  const representativeName = String(user?.representativeName || '').trim();
  return representativeName || fallback;
}

export function resolveAccountMenuInitial(displayName) {
  const name = String(displayName || '').trim();
  return name && name !== 'User' ? name.charAt(0).toUpperCase() : 'U';
}
