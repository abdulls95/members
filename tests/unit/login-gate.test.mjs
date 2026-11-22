import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const app = read('assets/js/app.js');
const css = read('assets/css/cornod.css');
const auth = read('assets/js/core/auth-client.js');

test('protected CORNOD views require a verified account AND owner approval', () => {
  assert.match(app, /let view = !isSignedIn\(\) \? P\.signin/);
  assert.match(app, /!allowed \? \(ctx\?\.path === '\/signin' \? P\.signin : P\.awaitingApproval\)/);
  assert.match(app, /access !== 'owner' && allowed\) view = P\.denied/);
  assert.match(app, /ROUTES\.filter\(\(r\) => r\.group === g\)/);
});
test('navigation is hidden and account page is accessible to pending members', () => {
  assert.match(app, /\$\('#nav'\)\.innerHTML = allowed \?/);
  assert.match(app, /\$\('\.sidebar'\)\.hidden = !allowed/);
  assert.match(app, /\$\('#menu-btn'\)\.hidden = !allowed/);
  assert.match(css, /\.shell\.auth-locked \{/);
  assert.match(css, /\.shell\.auth-locked \.sidebar/);
});
test('session requires verified identity, logout revokes visible access', () => {
  assert.match(auth, /const user = await request\('\/user'/);
  assert.match(auth, /session = null;\s*emit\(\);/);
  assert.match(app, /location\.hash = '#\/dashboard'/);
});
