import { t, setLang, onLangChange, getLang } from './core/i18n.js';
import { createRouter } from './core/router.js';
import * as store from './core/store.js';
import { icon, LOGO } from './core/icons.js';
import { esc } from './core/ui.js';
import * as P from './views/pages.js';
import { learn } from './views/learn.js';
import { consumeEmailRedirect, onAuthChange, isSignedIn } from './core/auth-client.js';
import { getAccessStatus, onAccessChange } from './core/access-client.js';
import { owner } from './views/owner.js';

// Route table. `perm` = permission needed to view (UI gating only; the API enforces for real).
export const ROUTES = [
  { path: '/', key: 'home', icon: 'home', group: 'platform', view: P.home },
  { path: '/dashboard', key: 'dashboard', icon: 'dashboard', group: 'platform', view: P.dashboard },
  { path: '/status', key: 'status', icon: 'status', group: 'platform', view: P.status },
  { path: '/workspaces', key: 'workspaces', icon: 'workspaces', group: 'build', view: P.workspaces },
  // Preserve the old URL without showing the disconnected terminal in navigation.
  { path: '/terminal', key: 'learn', icon: 'terminal', group: 'legacy', view: learn },
  { path: '/learn', key: 'learn', icon: 'terminal', group: 'build', view: learn },
  { path: '/files', key: 'files', icon: 'files', group: 'build', view: P.files },
  { path: '/marketplace', key: 'marketplace', icon: 'marketplace', group: 'build', view: P.marketplace },
  { path: '/commands', key: 'commands', icon: 'commands', group: 'build', view: P.commands },
  { path: '/ai', key: 'ai', icon: 'ai', group: 'build', view: P.ai },
  { path: '/osint', key: 'osint', icon: 'osint', group: 'security', view: P.osint },
  { path: '/labs', key: 'labs', icon: 'labs', group: 'security', view: P.labs },
  // Owner console is unavailable until server-verified authentication is deployed.
  // Keep the old URL as a locked route; never expose it in public navigation.
  { path: '/admin', key: 'admin', icon: 'admin', group: 'owner-only', view: owner },
  { path: '/settings', key: 'settings', icon: 'settings', group: 'account', view: P.settings },
  { path: '/signin', key: 'signin', icon: 'signin', group: 'account', view: P.signin },
];

const $ = (s) => document.querySelector(s);
let cleanup = null;
let current = { route: null, ctx: null };

function renderChrome() {
  const groups = ['platform', 'build', 'security', 'account'];
  const authenticated = isSignedIn();
  const access = getAccessStatus();
  const allowed = authenticated && (access === 'approved' || access === 'owner');
  // This only gates the browser interface. Static GitHub Pages source remains public.
  $('#nav').innerHTML = allowed ? [...groups, ...(access === 'owner' ? ['owner-only'] : [])].map((g) => `
    <div class="nav-group"><div class="nav-label">${esc(t('nav.' + g))}</div>
    ${ROUTES.filter((r) => r.group === g).map((r) =>
    `<a href="#${r.path}" data-path="${r.path}">${icon(r.icon)}<span>${esc(t('nav.' + r.key))}</span></a>`).join('')}</div>`).join('') : '';
  $('.shell').classList.toggle('auth-locked', !allowed);
  $('.sidebar').hidden = !allowed;
  $('#menu-btn').hidden = !allowed;
  $('#lang-btn').textContent = t('lang.switch');
  $('#auth-link').textContent = isSignedIn() ? t('auth.account') : t('auth.title');
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
  // Always require an authenticated Supabase session before rendering any CORNOD section.
  // This is a client navigation gate, NOT a server-side access control boundary.
  const access = getAccessStatus();
  const allowed = access === 'owner' || access === 'approved';
  let view = !isSignedIn() ? P.signin :
    !allowed ? P.awaitingApproval : (route ? route.view : P.notFound);
  if (ctx?.path === '/admin' && access !== 'owner' && allowed) view = P.denied;
  const main = $('#main');
  const fullCtx = { ...ctx, role: 'guest', rerender: () => { renderChrome(); renderView(); } };
  main.innerHTML = view.render(fullCtx);
  cleanup = view.mount?.(main, fullCtx) || null;
  document.title = `${allowed && route ? t('nav.' + route.key) : t('auth.title')} · CORNOD`;
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
  onAuthChange(() => { if (current.ctx) { renderChrome(); renderView(); } });
  onAccessChange((access) => {
    if (current.ctx && (access === 'owner' || access === 'approved') && current.ctx.path === '/signin') {
      location.hash = '#/dashboard';
    }
    if (current.ctx) { renderChrome(); renderView(); }
  });

  // Consume one-time Supabase magic-link tokens before the hash router sees them.
  // The client removes the bearer token from the URL immediately.
  const callback = consumeEmailRedirect().catch(() => {
    // A failed callback never grants access; the visitor can request another email.
  });
  const router = createRouter(ROUTES, (route, ctx) => { current = { route, ctx }; renderView(); });
  renderChrome();
  router.resolve();
  callback.then(() => { if (current.ctx) renderView(); });
}

boot();
