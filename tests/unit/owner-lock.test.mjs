import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { settings, denied } from '../../assets/js/views/pages.js';
import { setLang } from '../../assets/js/core/i18n.js';
const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

test('public settings expose only personal language, no roles or admin actions', () => {
  for (const lang of ['ar', 'en']) {
    setLang(lang);
    const html = settings.render();
    assert.match(html, /id="set-lang"/);
    assert.doesNotMatch(html, /id="set-role"|admin:users|TENANT_OWNER|<option value="admin"/);
    assert.match(denied.render(), lang === 'ar' ? /مقفلة/ : /locked/);
  }
  setLang('ar');
});

test('admin route stays locked and invisible even with stale localStorage preview role', () => {
  const app = read('assets/js/app.js');
  const store = read('assets/js/core/store.js');
  assert.match(app, /path: '\/admin'.*group: 'owner-only'.*view: owner/);
  assert.doesNotMatch(app, /store\.get\('previewRole'\)/);
  assert.doesNotMatch(store, /previewRole/);
  assert.match(app, /ctx\?\.path === '\/admin' && access !== 'owner'/);
  assert.match(store, /if \(k !== 'lang'/);
});
