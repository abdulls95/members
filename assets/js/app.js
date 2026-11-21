import { t, setLang, onLangChange, getLang } from './core/i18n.js';
import { createRouter } from './core/router.js';
import { can } from './core/rbac.js';
import * as store from './core/store.js';
import { icon, LOGO } from './core/icons.js';
import { esc } from './core/ui.js';
import * as P from './views/pages.js';
import { terminal } from './views/terminal.js';
import { learn } from './views/learn.js';

// Route table. `perm` = permission needed to view (UI gating only; the API enforces for real).
export const ROUTES = [
  { path: '/', key: 'home', icon: 'home', group: 'platform', view: P.home },
  { path: '/dashboard', key: 'dashboard', icon: 'dashboard', group: 'platform', view: P.dashboard },
  { path: '/status', key: 'status', icon: 'status', group: 'platform', view: P.status },
  { path: '/workspaces', key: 'workspaces', icon: 'workspaces', group: 'build', view: P.workspaces },
  { path: '/terminal', key: 'terminal', icon: 'terminal', group: 'build', view: terminal },
  { path: '/learn', key: 'learn', icon: 'terminal', group: 'build', view: learn },
  { path: '/files', key: 'files', icon: 'files', group: 'build', view: P.files },
  { path: '/marketplace', key: 'marketplace', icon: 'marketplace', group: 'build', view: P.marketplace },
  { path: '/commands', key: 'commands', icon: 'commands', group: 'build', view: P.commands },
  { path: '/ai', key: 'ai', icon: 'ai', group: 'build', view: P.ai },
  { path: '/osint', key: 'osint', icon: 'osint', group: 'security', view: P.osint },
  { path: '/labs', key: 'labs', icon: 'labs', group: 'security', view: P.labs },
  { path: '/admin', key: 'admin', icon: 'admin', group: 'account', view: P.admin, perm: 'admin:users' },
  { path: '/settings', key: 'settings', icon: 'settings', group: 'account', view: P.settings },
  { path: '/signin', key: 'signin', icon: 'signin', group: 'account', view: P.signin },
];

const $ = (s) => document.querySelector(s);
let cleanup = null;
let current = { route: null, ctx: null };

function renderChrome() {
  const groups = ['platform', 'build', 'security', 'account'];
  const role = store.get('previewRole');
  $('#nav').innerHTML = groups.map((g) => `
    <div class="nav-group"><div class="nav-label">${esc(t('nav.' + g))}</div>
    ${ROUTES.filter((r) => r.group === g && (!r.perm || can(role, r.perm))).map((r) =>
    `<a href="#${r.path}" data-path="${r.path}">${icon(r.icon)}<span>${esc(t('nav.' + r.key))}</span></a>`).join('')}</div>`).join('');
  $('#lang-btn').textContent = t('lang.switch');
  $('#backend-pill').lastChild.textContent = t('status.backend');
  $('#brand-sub').textContent = t('app.slogan');
  $('#menu-btn').setAttribute('aria-label', t('nav.menu'));
  markActive();
}

function markActive() {
  document.querySelectorAll('#nav a').forEach((a) => {
    if (a.dataset.path === current.ctx?.path) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function renderView() {
  const { route, ctx } = current;
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  const role = store.get('previewRole');
  let view = route ? route.view : P.notFound;
  if (route?.perm && !can(role, route.perm)) view = P.denied;
  const main = $('#main');
  const fullCtx = { ...ctx, role, rerender: () => { renderChrome(); renderView(); } };
  main.innerHTML = view.render(fullCtx);
  cleanup = view.mount?.(main, fullCtx) || null;
  document.title = `${route ? t('nav.' + route.key) : '404'} · CORNOD`;
  markActive();
  $('.shell').classList.remove('nav-open');
}

export function boot() {
  setLang(store.get('lang'));
  $('#brand-logo').innerHTML = LOGO;
  $('#menu-btn').innerHTML = icon('menu');
  $('#lang-btn').addEventListener('click', () => {
    const next = getLang() === 'ar' ? 'en' : 'ar';
    store.set('lang', next); setLang(next);
  });
  $('#menu-btn').addEventListener('click', () => $('.shell').classList.toggle('nav-open'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('.shell').classList.remove('nav-open'); });
  onLangChange(() => { renderChrome(); renderView(); });

  const router = createRouter(ROUTES, (route, ctx) => { current = { route, ctx }; renderView(); });
  renderChrome();
  router.resolve();
}

boot();
