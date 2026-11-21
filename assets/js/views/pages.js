import { t, L, getLang } from '../core/i18n.js';
import { html, raw, esc, pageHead, previewNotice, statusTag } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { TOOLS, TOOL_CATS, COMMANDS, CMD_CATS, LABS, OSINT, FEATURES } from '../data/catalog.js';
import { can } from '../core/rbac.js';
import * as store from '../core/store.js';
import { setLang } from '../core/i18n.js';
import { requestEmailLogin, verifyEmailCode, getSignedInUser, signOut, signUpWithPassword, signInWithPassword, requestPasswordReset, updatePassword } from '../core/auth-client.js';

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
        <a class="btn primary" href="#/learn">${raw(icon('terminal'))}${t('home.ctaLearn')}</a>
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

// ---------- Administration is intentionally locked until verified server-side auth ----------
// No admin preview, fake owner controls or permission-management forms ship in the public UI.
export const admin = {
  render: () => html`<div class="empty mt-40">${t('admin.locked')}</div>`,
};

// ---------- Public personal settings (language only; no authorization knobs) ----------
export const settings = {
  render: () => html`${raw(pageHead('set.title', 'set.sub', 'live'))}
    <div class="grid g2">
      <div class="card"><h3>${raw(icon('globe'))}${t('set.lang')}</h3>
        <select class="input w-full" id="set-lang"><option value="ar"${raw(getLang() === 'ar' ? ' selected' : '')}>العربية</option><option value="en"${raw(getLang() === 'en' ? ' selected' : '')}>English</option></select></div>
      <div class="card"><h3>${t('set.owner')}</h3><p>${t('set.ownerLocked')}</p></div>
    </div>`,
  mount: (root) => {
    root.querySelector('#set-lang').addEventListener('change', (e) => {
      store.set('lang', e.target.value);
      setLang(e.target.value);
    });
  },
};

// ---------- Real Supabase Auth: password sign-in, signup, password reset, optional email code ----------
export const signin = {
  render: () => {
    const user = getSignedInUser();
    if (user) return html`<div class="card accent signin-card">
      <div class="eyebrow">CORNOD / ACCOUNT</div>
      <h1>${t('auth.signedIn')}</h1><p class="auth-email">${user.email}</p>
      <form id="password-change-form">
        <label class="meta block" for="auth-new-password">${t('auth.newPassword')}</label>
        <input class="input w-full" id="auth-new-password" type="password" required minlength="12" maxlength="128" autocomplete="new-password">
        <button class="btn w-full mt-12" type="submit">${t('auth.changePassword')}</button>
      </form>
      <p id="auth-message" role="status" aria-live="polite" class="meta mt-12"></p>
      <div class="notice" role="note"><strong>${t('auth.ownerNoteTitle')}</strong><span>${t('auth.ownerNote')}</span></div>
      <button class="btn primary w-full" type="button" id="signout-btn">${t('auth.signout')}</button>
    </div>`;
    return html`<div class="card accent signin-card">
      <div class="eyebrow">CORNOD / ACCESS</div>
      <h1>${t('auth.title')}</h1>
      <p>${t('auth.passwordIntro')}</p>
      <div class="toolbar" role="group" aria-label="${t('auth.mode')}">
        <button class="btn primary sm" id="mode-login" type="button" aria-pressed="true">${t('auth.login')}</button>
        <button class="btn sm" id="mode-signup" type="button" aria-pressed="false">${t('auth.signup')}</button>
      </div>
      <form id="password-form">
        <label class="meta block" for="signin-email">${t('auth.email')}</label>
        <input id="signin-email" class="input w-full" type="email" value="a.alyf3i@gmail.com" required autocomplete="email" inputmode="email" maxlength="254" spellcheck="false">
        <label class="meta block mt-10" for="signin-password">${t('auth.password')}</label>
        <input id="signin-password" class="input w-full" type="password" required minlength="12" maxlength="128" autocomplete="current-password">
        <p class="meta mt-8" id="password-help" hidden>${t('auth.passwordRules')}</p>
        <button class="btn primary w-full mt-14" id="password-submit" type="submit">${t('auth.login')}</button>
      </form>
      <button id="auth-forgot" class="btn ghost sm mt-12" type="button">${t('auth.forgot')}</button>
      <details class="mt-14" id="email-link-details">
        <summary>${t('auth.emailAlternative')}</summary>
        <form id="signin-form" class="mt-12" novalidate>
          <button class="btn w-full" type="submit">${t('auth.send')}</button>
        </form>
        <form id="verify-form" hidden class="auth-code mt-14" novalidate>
          <label class="meta block" for="signin-code">${t('auth.code')}</label>
          <input id="signin-code" class="input w-full" type="text" pattern="[0-9]{6,8}" maxlength="8" inputmode="numeric" autocomplete="one-time-code" spellcheck="false">
          <button class="btn w-full mt-12" type="submit">${t('auth.verify')}</button>
        </form>
        <p class="meta mt-8">${t('auth.linkHint')}</p>
      </details>
      <p class="meta mt-14" id="signin-message" role="status" aria-live="polite"></p>
      <div class="notice" role="note"><span>${t('auth.noOwner')}</span></div>
    </div>`;
  },
  mount: (root, { rerender }) => {
    let live = true;
    let busy = false;
    const message = root.querySelector('#signin-message') || root.querySelector('#auth-message');
    const status = (value) => { if (live) message.textContent = value; };
    const errorMessage = (error) => {
      if (error?.message === 'WEAK_PASSWORD') return t('auth.passwordRules');
      if (error?.status === 429) return t('auth.rateLimited');
      return t('auth.error');
    };
    const wrap = async (button, action) => {
      if (busy) return;
      busy = true; if (button) button.disabled = true;
      try { await action(); } catch (error) { status(errorMessage(error)); }
      finally { busy = false; if (live && button?.isConnected) button.disabled = false; }
    };
    const logout = root.querySelector('#signout-btn');
    if (logout) {
      const change = root.querySelector('#password-change-form');
      const onChange = (e) => {
        e.preventDefault();
        const passwordField = root.querySelector('#auth-new-password');
        wrap(change.querySelector('button'), async () => {
          await updatePassword(passwordField.value);
          passwordField.value = '';
          status(t('auth.changed'));
        });
      };
      const onLogout = () => wrap(logout, async () => { await signOut(); if (live) rerender(); });
      change.addEventListener('submit', onChange);
      logout.addEventListener('click', onLogout);
      return () => { live = false; change.removeEventListener('submit', onChange); logout.removeEventListener('click', onLogout); };
    }
    const form = root.querySelector('#password-form');
    const email = root.querySelector('#signin-email');
    const password = root.querySelector('#signin-password');
    const submit = root.querySelector('#password-submit');
    const loginButton = root.querySelector('#mode-login');
    const signupButton = root.querySelector('#mode-signup');
    const help = root.querySelector('#password-help');
    const forgot = root.querySelector('#auth-forgot');
    const emailForm = root.querySelector('#signin-form');
    const verifyForm = root.querySelector('#verify-form');
    const codeInput = root.querySelector('#signin-code');
    let mode = 'login';
    let pendingEmail = '';
    function setMode(next) {
      mode = next;
      loginButton.classList.toggle('primary', mode === 'login');
      signupButton.classList.toggle('primary', mode === 'signup');
      loginButton.setAttribute('aria-pressed', String(mode === 'login'));
      signupButton.setAttribute('aria-pressed', String(mode === 'signup'));
      submit.textContent = t(mode === 'signup' ? 'auth.signup' : 'auth.login');
      password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
      help.hidden = mode !== 'signup';
      status('');
    }
    function onSubmit(e) {
      e.preventDefault();
      wrap(submit, async () => {
        if (mode === 'signup') {
          const result = await signUpWithPassword(email.value, password.value);
          password.value = '';
          if (!live) return;
          if (result.needsConfirmation) { status(t('auth.confirmSignup')); setMode('login'); status(t('auth.confirmSignup')); }
          else rerender();
        } else {
          await signInWithPassword(email.value, password.value);
          password.value = '';
          if (live) rerender();
        }
      });
    }
    function onForgot() {
      wrap(forgot, async () => {
        await requestPasswordReset(email.value);
        status(t('auth.resetSent'));
      });
    }
    function onEmail(e) {
      e.preventDefault();
      wrap(emailForm.querySelector('button'), async () => {
        pendingEmail = await requestEmailLogin(email.value);
        if (!live) return;
        verifyForm.hidden = false;
        status(t('auth.sent'));
      });
    }
    function onVerify(e) {
      e.preventDefault();
      wrap(verifyForm.querySelector('button'), async () => {
        await verifyEmailCode(pendingEmail, codeInput.value);
        codeInput.value = '';
        if (live) rerender();
      });
    }
    const chooseLogin = () => setMode('login');
    const chooseSignup = () => setMode('signup');
    form.addEventListener('submit', onSubmit);
    forgot.addEventListener('click', onForgot);
    loginButton.addEventListener('click', chooseLogin);
    signupButton.addEventListener('click', chooseSignup);
    emailForm.addEventListener('submit', onEmail);
    verifyForm.addEventListener('submit', onVerify);
    return () => {
      live = false;
      form.removeEventListener('submit', onSubmit);
      forgot.removeEventListener('click', onForgot);
      loginButton.removeEventListener('click', chooseLogin);
      signupButton.removeEventListener('click', chooseSignup);
      emailForm.removeEventListener('submit', onEmail);
      verifyForm.removeEventListener('submit', onVerify);
    };
  },
};

// ---------- Build status ----------
export const status = {
  render: () => html`${raw(pageHead('status.title', 'status.sub'))}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('status.feature')}</th><th>${t('status.state')}</th><th>${t('status.notes')}</th></tr></thead>
    <tbody>${FEATURES.map(([id, s, name, note]) => raw(html`<tr data-feature="${id}"><td>${L(name)}</td><td>${statusTag(s)}</td><td class="muted">${L(note)}</td></tr>`))}</tbody></table></div>`,
};

export const denied = { render: () => html`<div class="empty mt-40">${t('admin.locked')}</div>` };
export const notFound = { render: () => html`<div class="empty mt-40"><h2>404 — ${t('common.notFound')}</h2><a href="#/">${t('common.back')}</a></div>` };
