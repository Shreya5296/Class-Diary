export function getAdminScope(email?: string | null): string {
  if (!email || typeof email !== 'string' || !email.trim()) {
    return 'default_admin';
  }
  const clean = email.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) - hash) + clean.charCodeAt(i);
    hash |= 0;
  }
  return `adm_${Math.abs(hash).toString(36)}`;
}

export function isOwnedByAdmin(recordAdminId?: string, currentAdminId?: string): boolean {
  if (!recordAdminId) return true;
  if (!currentAdminId) return false;
  return recordAdminId === currentAdminId;
}
