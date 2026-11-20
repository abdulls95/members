// Browser smoke test: serves site/ on a local port, visits every route in AR and EN,
// at desktop / tablet / phone sizes, fails on console errors, CSP violations or broken layout.
// Usage: node tests/e2e/smoke.mjs [--shots=dir]
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

async function loadPlaywright() {
  try { return await import('playwright'); } catch {
    const req = createRequire(import.meta.url);
    return req(join(process.env.NODE_GLOBAL || '/opt/node22/lib/node_modules', 'playwright'));
  }
}

const ROOT = resolve('site');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, p.endsWith('/') ? p + 'index.html' : p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(await readFile(file)); }
  catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const shots = process.argv.find((a) => a.startsWith('--shots='))?.split('=')[1];
if (shots) mkdirSync(shots, { recursive: true });

const ROUTES = ['/', '/dashboard', '/status', '/workspaces', '/terminal', '/files', '/marketplace', '/commands', '/ai', '/osint', '/labs', '/admin', '/settings', '/signin', '/nope'];
const VIEWPORTS = { desktop: [1440, 900], tablet: [834, 1194], phone: [390, 844] };

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };

for (const [vpName, [w, h]] of Object.entries(VIEWPORTS)) {
  for (const lang of ['ar', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((l) => localStorage.setItem('cornod:prefs:v1', JSON.stringify({ lang: l, previewRole: 'guest' })), lang);
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    for (const r of ROUTES) {
      await page.goto(base + '#' + r);
      await page.waitForSelector('#main > *');
      const tag = `${vpName}/${lang}${r}`;
      check(await page.getAttribute('html', 'dir') === (lang === 'ar' ? 'rtl' : 'ltr'), `${tag}: wrong dir`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overflow <= 1, `${tag}: horizontal overflow ${overflow}px`);
      if (shots && ['/', '/terminal', '/marketplace', '/status'].includes(r)) {
        await page.screenshot({ path: join(shots, `${vpName}-${lang}${r.replace(/\//g, '_') || '_home'}.png`), fullPage: false });
      }
    }
    // Behavioural checks (once per language, desktop only).
    if (vpName === 'desktop') {
      await page.goto(base + '#/terminal');
      await page.fill('#term-in', 'whoami'); await page.press('#term-in', 'Enter');
      const out = await page.textContent('#term-out');
      check(/NOT executed|لم يُنفَّذ/.test(out), `${lang}: terminal must state command was not executed`);
      check(await page.textContent('#term-state').then((s) => /disconnected|غير متصل/.test(s)), `${lang}: terminal state should be disconnected`);

      await page.goto(base + '#/admin');
      check(await page.locator('text=' + (lang === 'ar' ? 'ليست لديك صلاحية' : 'do not have permission')).count() === 1, `${lang}: guest must be denied /admin`);
      check(await page.locator('#nav a[data-path="/admin"]').count() === 0, `${lang}: admin link hidden for guest`);

      await page.goto(base + '#/commands');
      await page.fill('#cmd-q', 'git');
      const visible = await page.locator('#cmd-grid > .card:visible').count();
      check(visible === 2, `${lang}: command search for git should show 2, got ${visible}`);

      await page.goto(base + '#/');
      await page.click('#lang-btn');
      check(await page.getAttribute('html', 'lang') === (lang === 'ar' ? 'en' : 'ar'), `${lang}: language toggle`);
    }
    if (vpName === 'phone') {
      await page.goto(base + '#/');
      await page.click('#menu-btn');
      await page.waitForTimeout(250);
      const box = await page.locator('.sidebar').boundingBox();
      check(box && box.x >= -1 && box.x + box.width <= w + 1, `${lang}: mobile drawer should open on-screen`);
      if (shots) await page.screenshot({ path: join(shots, `phone-${lang}-menu.png`) });
    }
    check(errors.length === 0, `${vpName}/${lang}: console errors: ${errors.join(' | ')}`);
    await ctx.close();
  }
}

await browser.close();
server.close();
if (failures.length) { console.error('FAIL\n' + failures.map((f) => ' - ' + f).join('\n')); process.exit(1); }
console.log(`PASS — ${ROUTES.length} routes × 2 languages × ${Object.keys(VIEWPORTS).length} viewports`);
