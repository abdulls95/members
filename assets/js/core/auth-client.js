// CORNOD email + password / passwordless Auth client. A real Supabase Auth session, never an owner role.
// Tokens stay only in memory: a page reload requires a new email sign-in.
// Public publishable keys are OK in client code. Privileged keys are forbidden.
import { AUTH } from './auth-config.js';

let session = null;
const listeners = new Set();
export function getSignedInUser() { return session?.user ?? null; }
export function isSignedIn() { return Boolean(session?.user); }
export function getAccessToken() { return session?.token ?? null; }
export function onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { for (const fn of listeners) fn(getSignedInUser()); }

export function validateEmail(email) {
  return typeof email === 'string' && email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
export function validateOtp(code) {
  return typeof code === 'string' && /^[0-9]{6,8}$/.test(code.trim());
}
const apiHeaders = () => ({ apikey: AUTH.publishableKey, 'content-type': 'application/json' });
async function request(path, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(AUTH.origin + '/auth/v1' + path, {
    ...options,
    headers: { ...apiHeaders(), ...(options.headers || {}) },
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer'
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Do not surface remote API messages verbatim in the public UI.
    const error = new Error('AUTH_REQUEST_FAILED');
    error.status = response.status;
    error.code = typeof body.code === 'string' ? body.code : 'auth_error';
    throw error;
  }
  return body;
}

export function validatePassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128;
}
export async function signUpWithPassword(email, password, fetchImpl = fetch) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!validateEmail(normalized)) throw new Error('INVALID_EMAIL');
  if (!validatePassword(password)) throw new Error('WEAK_PASSWORD');
  const data = await request('/signup?redirect_to=' + encodeURIComponent(AUTH.redirectUrl), {
    method: 'POST', body: JSON.stringify({ email: normalized, password })
  }, fetchImpl);
  // Signup normally requires email verification and returns no session.
  if (data?.access_token) await acceptSession(data, fetchImpl);
  return { needsConfirmation: !data?.access_token };
}
export async function signInWithPassword(email, password, fetchImpl = fetch) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!validateEmail(normalized) || typeof password !== 'string' || !password) throw new Error('INVALID_CREDENTIALS');
  const data = await request('/token?grant_type=password', {
    method: 'POST', body: JSON.stringify({ email: normalized, password })
  }, fetchImpl);
  return acceptSession(data, fetchImpl);
}
export async function requestPasswordReset(email, fetchImpl = fetch) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!validateEmail(normalized)) throw new Error('INVALID_EMAIL');
  await request('/recover?redirect_to=' + encodeURIComponent(AUTH.redirectUrl), {
    method: 'POST', body: JSON.stringify({ email: normalized })
  }, fetchImpl);
}
export async function updatePassword(password, fetchImpl = fetch) {
  if (!validatePassword(password)) throw new Error('WEAK_PASSWORD');
  if (!session?.token) throw new Error('NOT_SIGNED_IN');
  await request('/user', {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + session.token },
    body: JSON.stringify({ password })
  }, fetchImpl);
}

export async function requestEmailLogin(email, fetchImpl = fetch) {
  const normalized = String(email).trim().toLowerCase();
  if (!validateEmail(normalized)) throw new Error('INVALID_EMAIL');
  // Public sign-up creates an Auth identity, not CORNOD tenant membership.
  // Only a separately verified trusted service can grant tenant/owner access.
  await request('/otp?redirect_to=' + encodeURIComponent(AUTH.redirectUrl), {
    method: 'POST',
    body: JSON.stringify({ email: normalized, create_user: true })
  }, fetchImpl);
  return normalized;
}
export async function verifyEmailCode(email, code, fetchImpl = fetch) {
  if (!validateEmail(email)) throw new Error('INVALID_EMAIL');
  if (!validateOtp(code)) throw new Error('INVALID_CODE');
  const data = await request('/verify', {
    method: 'POST',
    body: JSON.stringify({ email: String(email).trim().toLowerCase(), token: code.trim(), type: 'email' })
  }, fetchImpl);
  return acceptSession(data, fetchImpl);
}
async function acceptSession(data, fetchImpl = fetch) {
  const token = data?.access_token;
  if (typeof token !== 'string' || !token) throw new Error('MISSING_SESSION');
  // Verify through Supabase Auth, never trust unverified decoded JWT payloads.
  const user = await request('/user', { headers: { Authorization: 'Bearer ' + token } }, fetchImpl);
  if (!user?.id || typeof user.email !== 'string') throw new Error('INVALID_SESSION');
  session = { token, user };
  emit();
  return user;
}
export function isAuthCallback(fragment) {
  return typeof fragment === 'string' && fragment.startsWith('#') &&
    /(?:^#|&)access_token=/.test(fragment);
}
export async function consumeEmailRedirect(fetchImpl = fetch, locationImpl = typeof window === 'undefined' ? null : window.location, historyImpl = typeof window === 'undefined' ? null : window.history) {
  const fragment = locationImpl?.hash;
  if (!isAuthCallback(fragment)) return false;
  const params = new URLSearchParams(fragment.slice(1));
  const token = params.get('access_token');
  // Immediately remove the token-bearing URL fragment (before any async work).
  historyImpl?.replaceState(null, '', (locationImpl.pathname || '/') + (locationImpl.search || '') + '#/signin');
  if (!token || params.get('token_type')?.toLowerCase() !== 'bearer') throw new Error('INVALID_SESSION');
  await acceptSession({ access_token: token }, fetchImpl);
  return true;
}
export async function signOut(fetchImpl = fetch) {
  const token = session?.token;
  session = null;
  emit();
  if (token) {
    // Revocation is best effort. Local in-memory session is always removed.
    await request('/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }, fetchImpl).catch(() => {});
  }
}
