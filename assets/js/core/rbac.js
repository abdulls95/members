// Role-based access control model. The SAME table is mirrored server-side (backend/api/rbac.md);
// the client copy only decides what to render. The server is the only authority.

export const PERMISSIONS = [
  'workspace:read', 'workspace:create', 'workspace:delete',
  'terminal:connect', 'files:read', 'files:write',
  'tools:install', 'labs:start', 'osint:query', 'ai:chat',
  'admin:users', 'admin:quotas', 'admin:audit', 'admin:system',
];

export const ROLES = {
  guest: { rank: 0, perms: [] },
  member: { rank: 1, perms: ['workspace:read', 'workspace:create', 'terminal:connect', 'files:read', 'files:write', 'labs:start', 'ai:chat'] },
  developer: { rank: 2, inherits: 'member', perms: ['workspace:delete', 'tools:install', 'osint:query'] },
  admin: { rank: 3, inherits: 'developer', perms: ['admin:users', 'admin:quotas', 'admin:audit', 'admin:system'] },
};

export function permsOf(role) {
  const r = ROLES[role];
  if (!r) return new Set();
  const inherited = r.inherits ? permsOf(r.inherits) : new Set();
  r.perms.forEach((p) => inherited.add(p));
  return inherited;
}

export function can(role, perm) {
  if (!PERMISSIONS.includes(perm)) throw new Error(`Unknown permission: ${perm}`);
  return permsOf(role).has(perm);
}
