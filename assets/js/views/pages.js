import { t, L, getLang } from '../core/i18n.js';
import { html, raw, esc, pageHead, previewNotice, statusTag } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { TOOLS, TOOL_CATS, COMMANDS, CMD_CATS, LABS, OSINT, FEATURES } from '../data/catalog.js';
import { ROLES, PERMISSIONS, permsOf, can } from '../core/rbac.js';
import * as store from '../core/store.js';
import { setLang } from '../core/i18n.js';

// ---------- Overview ----------
export const home = {
  render: () => {
    const pillars = [['workspaces', 'env'], ['terminal', 'term'], ['marketplace', 'mkt'], ['labs', 'sec'], ['ai', 'ai'], ['files', 'files']];
    return html`
    <section class="hero">
      <div class="eyebrow">${t('app.tagline')}</div>
      <h1>CORNOD</h1>
      <div class="slogan"><span dir="ltr">${t('app.slogan')}</span></div>
      <p>${t('home.lead')}</p>
      <div class="actions">
        <a class="btn primary" href="#/terminal">${raw(icon('terminal'))}${t('home.ctaTerminal')}</a>
        <a class="btn ghost" href="#/status">${raw(icon('status'))}${t('home.ctaStatus')}</a>
      </div>
    </section>
    <h2>${t('home.pillars')}</h2>
    <div class="grid g3">${pillars.map(([ic, k]) => raw(html`
      <article class="card accent"><h3>${raw(icon(ic))}${t('home.p.' + k)}</h3><p>${t('home.p.' + k + 'D')}</p></article>`))}
    </div>`;
  },
};

// ---------- Dashboard ----------
export const dashboard = {
  render: () => html`${raw(pageHead('dash.title', 'dash.sub', 'preview'))}${previewNotice()}
    <div class="grid g4">${['envs', 'cpu', 'storage', 'tools'].map((k) => raw(html`
      <div class="card stat"><div class="v">—</div><div class="k">${t('dash.' + k)}</div></div>`))}</div>
    <div class="card mt-14"><h3>${t('dash.activity')}</h3><div class="empty">${t('dash.noData')}</div></div>`,
};

// ---------- Workspaces ----------
export const workspaces = {
  render: () => html`${raw(pageHead('ws.title', 'ws.sub', 'preview',
    `<button class="btn primary" disabled aria-disabled="true">${icon('workspaces')}${esc(t('ws.new'))}</button>`))}
    ${previewNotice()}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>${t('ws.image')}</th><th>${t('ws.size')}</th><th>${t('status.state')}</th></tr></thead>
    <tbody><tr><td colspan="4"><div class="empty">${t('ws.empty')}</div></td></tr></tbody></table></div>`,
};

// ---------- Files ----------
export const files = {
  render: () => html`${raw(pageHead('files.title', 'files.sub', 'planned'))}${previewNotice()}
    <div class="card"><div class="cmd"><code>/home/cornod</code></div><div class="empty mt-12">${t('ws.empty')}</div></div>`,
};

// ---------- Marketplace ----------
export const marketplace = {
  render: ({ query }) => {
    const cat = query.cat || 'all';
    const chips = [['all', t('mkt.all')], ...Object.entries(TOOL_CATS).map(([k, v]) => [k, L(v)])];
    return html`${raw(pageHead('mkt.title', 'mkt.sub', 'preview'))}${previewNotice()}
    <div class="toolbar"><input class="input flex-1 minw-200" id="mkt-q" type="search" placeholder="${t('mkt.search')}" aria-label="${t('mkt.search')}">
      <div class="chips" role="group">${chips.map(([k, v]) => raw(html`<a class="chip" href="#/marketplace?cat=${k}" aria-pressed="${String(k === cat)}">${v}</a>`))}</div></div>
    <div class="grid g3" id="mkt-grid">${TOOLS.filter((x) => cat === 'all' || x.cat === cat).map((x) => raw(html`
      <article class="card" data-q="${(x.name + ' ' + x.pkg + ' ' + x.d.en + ' ' + x.d.ar).toLowerCase()}">
        <h3>${x.name}</h3><p>${L(x.d)}</p>
        <div class="meta mono ltr">pkg: ${x.pkg}</div>
        <div class="card-foot"><span class="tag risk-${x.risk}">${t('common.risk')}: ${x.risk}</span>
          <button class="btn sm" disabled aria-disabled="true" title="${t('mkt.needsWs')}">${t('mkt.install')}</button></div>
      </article>`))}</div>`;
  },
  mount: (root) => filterCards(root.querySelector('#mkt-q'), root.querySelector('#mkt-grid')),
};

function filterCards(input, grid) {
  const on = () => {
    const q = input.value.trim().toLowerCase();
    grid.querySelectorAll('[data-q]').forEach((el) => { el.hidden = q && !el.dataset.q.includes(q); });
  };
  input.addEventListener('input', on);
  return () => input.removeEventListener('input', on);
}

// ---------- Command library (fully functional, static) ----------
export const commands = {
  render: () => html`${raw(pageHead('cmd.title', 'cmd.sub', 'live'))}
    <div class="toolbar"><input class="input flex-1" id="cmd-q" type="search" placeholder="${t('cmd.search')}" aria-label="${t('cmd.search')}"></div>
    <div class="grid g2" id="cmd-grid">${COMMANDS.map((c) => raw(html`
      <div class="card" data-q="${(c.c + ' ' + c.d.en + ' ' + c.d.ar + ' ' + c.cat).toLowerCase()}">
        <div class="meta">${L(CMD_CATS[c.cat])}</div>
        <div class="cmd"><code>${c.c}</code><button class="btn sm ghost" data-copy="${c.c}">${t('cmd.copy')}</button></div>
        <p class="mt-8">${L(c.d)}</p></div>`))}</div>`,
  mount: (root) => {
    const off = filterCards(root.querySelector('#cmd-q'), root.querySelector('#cmd-grid'));
    const onClick = async (e) => {
      const b = e.target.closest('[data-copy]'); if (!b) return;
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t('cmd.copied'); setTimeout(() => { b.textContent = t('cmd.copy'); }, 1200); } catch { /* clipboard blocked */ }
    };
    root.addEventListener('click', onClick);
    return () => { off(); root.removeEventListener('click', onClick); };
  },
};

// ---------- OSINT ----------
export const osint = {
  render: ({ role }) => html`${raw(pageHead('osint.title', 'osint.sub', 'preview'))}${previewNotice()}
    <div class="notice danger"><span>${t('osint.policy')}</span></div>
    <div class="grid g2">${OSINT.map((m) => raw(html`
      <article class="card accent"><h3>${raw(icon('osint'))}${L(m.t)}</h3><p>${L(m.d)}</p>
        <div class="toolbar flush"><input class="input ltr" placeholder="${m.input}" disabled aria-label="${L(m.t)}">
        <button class="btn sm" disabled aria-disabled="true">${can(role, 'osint:query') ? 'Run' : '🔒'}</button></div></article>`))}</div>`,
};

// ---------- Labs ----------
export const labs = {
  render: () => html`${raw(pageHead('labs.title', 'labs.sub', 'preview'))}${previewNotice()}
    <div class="grid g3">${LABS.map((l) => raw(html`
      <article class="card accent"><div class="meta mono">${l.id}</div><h3>${L(l.t)}</h3><p>${L(l.d)}</p>
        <dl class="kv"><dt>${t('labs.level')}</dt><dd>${'■'.repeat(l.level)}${'□'.repeat(3 - l.level)}</dd>
        <dt>${t('labs.duration')}</dt><dd>${l.min} ${t('common.min')}</dd></dl>
        <div class="card-foot"><span></span><button class="btn sm" disabled aria-disabled="true">${t('labs.start')}</button></div></article>`))}</div>`,
};

// ---------- AI ----------
export const ai = {
  render: () => html`${raw(pageHead('ai.title', 'ai.sub', 'planned'))}
    <div class="notice"><span>${t('ai.offline')}</span></div>
    <div class="card"><div class="empty">—</div>
      <div class="toolbar mt-12"><input class="input" placeholder="${t('ai.placeholder')}" disabled aria-label="${t('ai.placeholder')}">
      <button class="btn primary" disabled aria-disabled="true">${t('ai.send')}</button></div></div>`,
};

// ---------- Admin (role-gated) ----------
export const admin = {
  perm: 'admin:users',
  render: () => html`${raw(pageHead('admin.title', 'admin.sub', 'preview'))}${previewNotice()}
    <h2>${t('admin.roles')}</h2>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('common.permissions')}</th>
      ${Object.keys(ROLES).map((r) => raw(html`<th class="mono">${r}</th>`))}</tr></thead><tbody>
      ${PERMISSIONS.map((p) => raw(html`<tr><td class="mono ltr">${p}</td>${Object.keys(ROLES).map((r) =>
        raw(`<td>${permsOf(r).has(p) ? '<span class="text-ok">●</span>' : '<span class="muted">·</span>'}</td>`))}</tr>`))}
    </tbody></table></div>
    <div class="grid g3 mt-14">
      ${['users', 'audit', 'health'].map((k) => raw(html`<div class="card"><h3>${t('admin.' + k)}</h3><div class="empty">${t('dash.noData')}</div></div>`))}
    </div>`,
};

// ---------- Settings ----------
export const settings = {
  render: ({ role }) => html`${raw(pageHead('set.title', 'set.sub', 'live'))}
    <div class="grid g2">
      <div class="card"><h3>${raw(icon('globe'))}${t('set.lang')}</h3>
        <select class="input w-full" id="set-lang"><option value="ar"${raw(getLang() === 'ar' ? ' selected' : '')}>العربية</option><option value="en"${raw(getLang() === 'en' ? ' selected' : '')}>English</option></select></div>
      <div class="card"><h3>${t('set.preview')}</h3><p class="meta">${t('set.previewHelp')}</p>
        <select class="input w-full" id="set-role">${Object.keys(ROLES).map((r) => raw(`<option value="${r}"${r === role ? ' selected' : ''}>${r}</option>`))}</select></div>
    </div>`,
  mount: (root, { rerender }) => {
    root.querySelector('#set-lang').addEventListener('change', (e) => { store.set('lang', e.target.value); setLang(e.target.value); });
    root.querySelector('#set-role').addEventListener('change', (e) => { store.set('previewRole', e.target.value); rerender(); });
  },
};

// ---------- Sign in ----------
export const signin = {
  render: () => html`<div class="card accent signin-card">
    <h1>${t('auth.title')}</h1><div class="notice"><span>${t('auth.unavailable')}</span></div>
    <form id="signin-form"><label class="meta">${t('auth.email')}</label><input class="input w-full" type="email" disabled autocomplete="email">
    <label class="meta block mt-10">${t('auth.password')}</label><input class="input w-full" type="password" disabled autocomplete="current-password">
    <button class="btn primary w-full mt-14" disabled aria-disabled="true">${t('auth.title')}</button></form></div>`,
  mount: (root) => {
    const f = root.querySelector('#signin-form');
    const stop = (e) => e.preventDefault(); // no auth backend: never submit anywhere
    f.addEventListener('submit', stop);
    return () => f.removeEventListener('submit', stop);
  },
};

// ---------- Build status ----------
export const status = {
  render: () => html`${raw(pageHead('status.title', 'status.sub'))}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('status.feature')}</th><th>${t('status.state')}</th><th>${t('status.notes')}</th></tr></thead>
    <tbody>${FEATURES.map(([id, s, name, note]) => raw(html`<tr data-feature="${id}"><td>${L(name)}</td><td>${statusTag(s)}</td><td class="muted">${L(note)}</td></tr>`))}</tbody></table></div>`,
};

export const denied = { render: () => html`<div class="empty mt-40">${t('admin.denied')}</div>` };
export const notFound = { render: () => html`<div class="empty mt-40"><h2>404 — ${t('common.notFound')}</h2><a href="#/">${t('common.back')}</a></div>` };
