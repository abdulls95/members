import test from 'node:test';
import assert from 'node:assert/strict';
import { signUpWithPassword, signInWithPassword, requestPasswordReset, validatePassword, updatePassword, signOut } from '../../assets/js/core/auth-client.js';
import { signin } from '../../assets/js/views/pages.js';
import { setLang } from '../../assets/js/core/i18n.js';

const response = (body = {}) => ({ ok: true, status: 200, json: async () => body });
test('signup transmits password only in request body to Supabase Auth', async () => {
  const calls = [];
  const fetcher = async (url, options) => { calls.push({url,options}); return response({user:{id:'u1'}}); };
  assert.equal(validatePassword('short'),false);
  assert.equal(validatePassword('a password 12345'),true);
  await assert.rejects(signUpWithPassword('student@example.org', 'short', fetcher), /WEAK_PASSWORD/);
  assert.deepEqual(await signUpWithPassword('student@example.org','a password 12345',fetcher), {needsConfirmation:true});
  assert.match(calls[0].url,/\/auth\/v1\/signup\?redirect_to=/);
  assert.deepEqual(JSON.parse(calls[0].options.body),{email:'student@example.org',password:'a password 12345'});
  assert.equal(calls[0].options.credentials,'omit');
});
test('password login verifies session user and never grants admin', async () => {
  const calls=[];
  const fetcher = async (url,options)=>{
    calls.push({url,options});
    if(url.includes('/token?')) return response({access_token:'test-token'});
    if(url.endsWith('/user')) return response({id:'u',email:'student@example.org'});
    if(url.endsWith('/logout')) return response({});
    throw new Error('unexpected');
  };
  const user=await signInWithPassword('student@example.org','correct-password',fetcher);
  assert.equal(user.email,'student@example.org');
  assert.match(calls[0].url,/\/auth\/v1\/token\?grant_type=password/);
  assert.deepEqual(JSON.parse(calls[0].options.body),{email:'student@example.org',password:'correct-password'});
  assert.equal(calls[1].options.headers.Authorization,'Bearer test-token');
  await updatePassword('new-unique-password-123', fetcher);
  assert.equal(calls[2].options.method,'PUT');
  assert.equal(calls[2].url.endsWith('/user'),true);
  await signOut(fetcher);
});
test('password reset requests email and validates input', async () => {
  const calls=[];
  await requestPasswordReset('a@example.org',async (url, options)=>{calls.push({url,options});return response({});});
  assert.match(calls[0].url,/\/auth\/v1\/recover\?redirect_to=/);
  assert.deepEqual(JSON.parse(calls[0].options.body),{email:'a@example.org'});
  await assert.rejects(requestPasswordReset('invalid',()=>{}),/INVALID_EMAIL/);
});
test('public login renders real password input, account creation and recovery in both languages',()=>{
  for(const lang of ['ar','en']){
    setLang(lang);
    const html=signin.render();
    assert.match(html,/id="signin-password"/);
    assert.match(html,/type="password"/);
    assert.match(html,/id="mode-signup"/);
    assert.match(html,/id="auth-forgot"/);
    assert.doesNotMatch(html,/a\.alyf3i@gmail\.com|value="admin"/);
  }
  setLang('ar');
});
