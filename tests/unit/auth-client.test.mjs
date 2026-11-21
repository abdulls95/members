import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTH } from '../../assets/js/core/auth-config.js';
import {
  validateEmail, validateOtp, requestEmailLogin, verifyEmailCode,
  getSignedInUser, isSignedIn, isAuthCallback, consumeEmailRedirect, signOut
} from '../../assets/js/core/auth-client.js';

function fakeResponse(json = {}, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => json };
}
test('public Auth config contains only a publishable project API key', () => {
  assert.match(AUTH.origin, /^https:\/\/[^/]+\.supabase\.co$/);
  assert.match(AUTH.publishableKey, /^sb_publishable_/);
  assert.match(AUTH.redirectUrl, /^https:\/\/abdulls95\.github\.io\/members\/$/);
});
test('email OTP signup calls the expected Supabase Auth service, not the Data API', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options }); return fakeResponse({});
  };
  assert.equal(await requestEmailLogin(' Example@Gmail.com ', fetchImpl), 'example@gmail.com');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/auth\/v1\/otp\?redirect_to=/);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.credentials, 'omit');
  const payload = JSON.parse(calls[0].options.body);
  assert.deepEqual(payload, { email: 'example@gmail.com', create_user: true });
  assert.equal(calls[0].options.headers.apikey, AUTH.publishableKey);
  assert.equal(validateEmail('not-an-email'), false);
  assert.equal(validateOtp('abc'), false);
  assert.equal(validateOtp('123456'), true);
  await assert.rejects(requestEmailLogin('wrong', fetchImpl), /INVALID_EMAIL/);
});
test('OTP verification requires Supabase /user confirmation, then logout clears memory', async () => {
  const routes = [];
  const fetchImpl = async (url, options) => {
    routes.push({ url, method: options.method, authorization: options.headers.Authorization });
    if (url.endsWith('/verify')) return fakeResponse({ access_token: 'test-access-token' });
    if (url.endsWith('/user')) return fakeResponse({ id: 'user-id', email: 'verified@example.org' });
    if (url.endsWith('/logout')) return fakeResponse({});
    throw new Error('Unexpected route ' + url);
  };
  const user = await verifyEmailCode('verified@example.org', '123456', fetchImpl);
  assert.equal(user.email, 'verified@example.org');
  assert.equal(isSignedIn(), true);
  assert.equal(getSignedInUser().id, 'user-id');
  assert.deepEqual(routes.map(x => x.url.split('/').at(-1)), ['verify', 'user']);
  assert.equal(routes[1].authorization, 'Bearer test-access-token');
  await signOut(fetchImpl);
  assert.equal(isSignedIn(), false);
  assert.equal(routes[2].authorization, 'Bearer test-access-token');
});
test('magic-link redirect is removed before awaiting network verification', async () => {
  const location = { hash: '#access_token=temporary-token&token_type=bearer&expires_in=3600', pathname: '/members/', search: '' };
  let cleaned = false;
  const history = { replaceState: (_state, _title, url) => { cleaned = true; assert.equal(url, '/members/#/signin'); } };
  const fetchImpl = async (url, options) => {
    assert.equal(cleaned, true);
    assert.match(url, /\/auth\/v1\/user$/);
    assert.equal(options.headers.Authorization, 'Bearer temporary-token');
    return fakeResponse({ id: 'magic-link-user', email: 'magic@example.org' });
  };
  assert.equal(isAuthCallback(location.hash), true);
  assert.equal(isAuthCallback('#/signin'), false);
  assert.equal(await consumeEmailRedirect(fetchImpl, location, history), true);
  assert.equal(getSignedInUser().id, 'magic-link-user');
  await signOut(async () => fakeResponse({}));
});
test('failed sign-in does not create a browser admin or signed-in session', async () => {
  await assert.rejects(
    verifyEmailCode('x@example.org', '123456', async () => fakeResponse({ code: 'bad' }, 401)),
    /AUTH_REQUEST_FAILED/
  );
  assert.equal(isSignedIn(), false);
  assert.equal(await consumeEmailRedirect(async () => fakeResponse({}), { hash: '#/learn' }, null), false);
});
