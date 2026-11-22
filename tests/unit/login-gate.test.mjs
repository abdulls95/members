import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const app = read('assets/js/app.js');
const css = read('assets/css/cornod.css');
const auth = read('assets/js/core/auth-client.js');

test('unauthenticated visitors cannot render protected CORNOD views via hash navigation', () => {
  assert.match(app, /let view = !isSignedIn\(\) \? P\.signin : \(route \? route\.view : P\.notFound\)/);
  assert.match(app, /if \(isSignedIn\(\) && ctx\?\.path === '\/admin'\) view = P\.denied/);
  assert.match(app, /ROUTES\.filter\(\(r\) => r\.group === g\)/);
});
test('navigation is hidden and only sign-in is visible until account is confirmed', () => {
  assert.match(app, /\$\('#nav'\)\.innerHTML = authenticated \?/);
  assert.match(app, /\$\('\.sidebar'\)\.hidden = !authenticated/);
  assert.match(app, /\$\('#menu-btn'\)\.hidden = !authenticated/);
  assert.match(css, /\.shell\.auth-locked \{/);
  assert.match(css, /\.shell\.auth-locked \.sidebar/);
});
test('session requires verified identity, logout revokes visible access', () => {
  assert.match(auth, /const user = await request\('\/user'/);
  assert.match(auth, /session = null;\s*emit\(\);/);
  assert.match(app, /location\.hash = '#\/dashboard'/);
});
