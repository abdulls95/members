// CORNOD account approval: Supabase table policies, NOT client roles, decide access.
// The status shown here is only a UI gate. Any future private API must recheck it.
import { AUTH } from './auth-config.js';
import { getSignedInUser, getAccessToken, onAuthChange } from './auth-client.js';

let access = 'signed-out';
let identity = null;
let requestSerial = 0;
const listeners = new Set();
export function getAccessStatus() { return access; }
export function onAccessChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function update(value) { access = value; for (const fn of listeners) fn(value); }

async function rest(path, options = {}, fetchImpl = fetch) {
  const token = getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');
  const response = await fetchImpl(AUTH.origin + '/rest/v1/' + path, {
    ...options, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: {
      'apikey': AUTH.publishableKey,
      'Authorization': 'Bearer ' + token,
      'content-type': 'application/json',
      'accept': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error('APPROVAL_REQUEST_FAILED');
    error.status = response.status;
    throw error;
  }
  return body;
}

export async function checkAccess(fetchImpl = fetch) {
  const user = getSignedInUser();
  const serial = ++requestSerial;
  if (!user) { identity = null; update('signed-out'); return 'signed-out'; }
  identity = user.id;
  update('checking');
  try {
    const rows = await rest('account_approvals?select=status&user_id=eq.' + encodeURIComponent(user.id), {}, fetchImpl);
    if (requestSerial !== serial || getSignedInUser()?.id !== identity) return access;
    const status = Array.isArray(rows) && rows.length === 1 ? rows[0].status : 'pending';
    const safe = ['owner', 'approved', 'pending', 'rejected'].includes(status) ? status : 'pending';
    update(safe);
    return safe;
  } catch {
    if (requestSerial === serial) update('checking-failed'); // fail closed
    return access;
  }
}

onAuthChange(() => { void checkAccess(); });

export async function listAccountRequests(fetchImpl = fetch) {
  if (access !== 'owner') throw new Error('OWNER_ONLY');
  const rows = await rest('account_approvals?select=user_id,email,status,created_at,reviewed_at&order=created_at.desc&limit=100', {}, fetchImpl);
  if (!Array.isArray(rows)) throw new Error('INVALID_RESPONSE');
  return rows.filter((row) => row.status !== 'owner');
}

export async function reviewAccount(userId, decision, fetchImpl = fetch) {
  if (access !== 'owner') throw new Error('OWNER_ONLY');
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(String(userId))) throw new Error('INVALID_USER_ID');
  if (!['approved','rejected','pending'].includes(decision)) throw new Error('INVALID_DECISION');
  const ownerId = getSignedInUser()?.id;
  if (!ownerId || ownerId === userId) throw new Error('INVALID_TARGET');
  // PostgreSQL RLS checks that the caller is the confirmed owner and cannot alter owner rows.
  await rest('account_approvals?user_id=eq.' + encodeURIComponent(userId), {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: decision, reviewed_by: ownerId, reviewed_at: new Date().toISOString() })
  }, fetchImpl).then((result) => {
    if (!Array.isArray(result) || result.length !== 1) throw new Error('NO_ROW_UPDATED');
  });
}
