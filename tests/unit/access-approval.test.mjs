import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { signInWithPassword, signOut } from '../../assets/js/core/auth-client.js';
import { checkAccess, getAccessStatus, listAccountRequests, reviewAccount } from '../../assets/js/core/access-client.js';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const response = (json, status=200) => ({ok: status>=200 && status<300,status,json:async()=>json});

test('membership is pending by default; unknown owner status cannot unlock pages', async () => {
  const authFetch=async(url)=>{
    if(url.includes('/token?')) return response({access_token:'test-member-token'});
    if(url.endsWith('/user')) return response({id:'80f6e99a-c92c-49da-9fe9-d5f1f1942a79',email:'member@example.org'});
    return response({});
  };
  await signInWithPassword('member@example.org','correct-password',authFetch);
  const memberFetch=async(url, options)=>{
    assert.match(url,/\/rest\/v1\/account_approvals\?select=status&user_id=eq/);
    assert.equal(options.headers.Authorization, 'Bearer test-member-token');
    return response([]);
  };
  assert.equal(await checkAccess(memberFetch),'pending');
  assert.equal(getAccessStatus(),'pending');
  await assert.rejects(listAccountRequests(memberFetch),/OWNER_ONLY/);
  await assert.rejects(reviewAccount('273f09b2-3584-4d98-beea-4abf9251c2c3','approved',memberFetch),/OWNER_ONLY/);
  assert.equal(await checkAccess(async()=>response({message:'denied'},403)), 'checking-failed');
  assert.equal(getAccessStatus(),'checking-failed');
  await signOut(authFetch);
  assert.equal(getAccessStatus(),'signed-out');
});

test('approved status and owner are database responses, not browser preferences', async () => {
  const source=read('assets/js/app.js');
  const access=read('assets/js/core/access-client.js');
  assert.match(source, /const allowed = access === 'owner' \|\| access === 'approved'/);
  assert.match(source, /!allowed \? \(ctx\?\.path === '\/signin' \? P\.signin : P\.awaitingApproval\)/);
  assert.match(source, /access !== 'owner'/);
  assert.match(access, /getAccessToken/);
  assert.doesNotMatch(access, /localStorage|sessionStorage/);
});
