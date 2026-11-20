import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DICT, t, setLang, L, dir } from '../../site/assets/js/core/i18n.js';
import { parseHash } from '../../site/assets/js/core/router.js';
import { can, permsOf, ROLES, PERMISSIONS } from '../../site/assets/js/core/rbac.js';
import { esc, html, raw } from '../../site/assets/js/core/ui.js';
import { TOOLS, COMMANDS, LABS, OSINT, FEATURES } from '../../site/assets/js/data/catalog.js';

test('i18n: every key exists in both languages and is non-empty', () => {
  const ar = Object.keys(DICT.ar).sort(); const en = Object.keys(DICT.en).sort();
  assert.deepEqual(ar, en);
  for (const l of ['ar', 'en']) for (const [k, v] of Object.entries(DICT[l])) assert.ok(v.trim(), `${l}:${k} empty`);
});

test('i18n: switching language changes output and direction', () => {
  setLang('en'); assert.equal(t('nav.terminal'), 'Terminal'); assert.equal(dir(), 'ltr');
  setLang('ar'); assert.equal(t('nav.terminal'), 'الطرفية'); assert.equal(dir(), 'rtl');
  assert.equal(L({ ar: 'أ', en: 'a' }), 'أ');
  assert.throws(() => setLang('fr'));
});

test('i18n: data catalogs are bilingual', () => {
  const pairs = [...TOOLS.map((x) => x.d), ...COMMANDS.map((x) => x.d), ...LABS.flatMap((x) => [x.t, x.d]), ...OSINT.flatMap((x) => [x.t, x.d]), ...FEATURES.flatMap((f) => [f[2], f[3]])];
  for (const p of pairs) { assert.ok(p.ar && p.en, JSON.stringify(p)); }
});

test('router: parses hash paths and queries', () => {
  assert.deepEqual(parseHash(''), { path: '/', query: {} });
  assert.deepEqual(parseHash('#/marketplace?cat=sec'), { path: '/marketplace', query: { cat: 'sec' } });
  assert.equal(parseHash('#//terminal//').path, '/terminal');
});

test('rbac: inheritance and least privilege', () => {
  assert.equal(permsOf('guest').size, 0);
  assert.ok(can('member', 'terminal:connect'));
  assert.ok(!can('member', 'tools:install'));
  assert.ok(can('developer', 'terminal:connect'), 'developer inherits member');
  assert.ok(!can('developer', 'admin:users'));
  assert.ok(can('admin', 'admin:system'));
  assert.equal(permsOf('admin').size, PERMISSIONS.length);
  assert.throws(() => can('admin', 'made:up'));
  for (const r of Object.values(ROLES)) for (const p of r.perms) assert.ok(PERMISSIONS.includes(p));
});

test('ui: html escapes interpolations, raw opts out', () => {
  assert.equal(esc('<img src=x onerror=1>"\''), '&lt;img src=x onerror=1&gt;&quot;&#39;');
  assert.equal(html`<b>${'<script>'}</b>`, '<b>&lt;script&gt;</b>');
  assert.equal(html`<b>${raw('<i>x</i>')}</b>`, '<b><i>x</i></b>');
  assert.equal(html`${['<a>', raw('<b>')]}`, '&lt;a&gt;<b>');
});

test('features: statuses are only live/preview/planned, sandbox is not claimed live', () => {
  for (const [, s] of FEATURES) assert.ok(['live', 'preview', 'planned'].includes(s));
  const sandbox = FEATURES.find((f) => f[0] === 'sandbox');
  assert.notEqual(sandbox[1], 'live');
});
