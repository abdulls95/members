import { t, getLang } from '../core/i18n.js';
import { html, raw, pageHead } from '../core/ui.js';
import { CONFIG, backendConfigured } from '../core/config.js';
import { DisconnectedAdapter, WebSocketAdapter } from '../terminal/adapters.js';
import { TerminalController } from '../terminal/controller.js';

export const terminal = {
  render: () => html`${raw(pageHead('term.title', 'term.sub', backendConfigured() ? 'live' : 'preview'))}
    <div class="term" id="term">
      <div class="term-bar"><span>cornod@workspace</span><span class="spacer"></span>
        <span id="term-state" class="tag planned"><span class="dot"></span>${t('term.disconnected')}</span></div>
      <div class="term-out" id="term-out" role="log" aria-live="polite"></div>
      <label class="term-in"><span class="ps1">cornod:~$</span>
        <input id="term-in" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="terminal input"></label>
    </div>`,

  mount: (root) => {
    const out = root.querySelector('#term-out');
    const input = root.querySelector('#term-in');
    const stateEl = root.querySelector('#term-state');

    const print = (text, kind = 'out') => {
      const div = document.createElement('div');
      div.className = 'term-line ' + kind;
      div.dir = 'auto'; // Arabic messages render RTL, shell output stays LTR
      div.textContent = kind === 'in' ? `cornod:~$ ${text}` : text; // textContent: remote output can never inject HTML
      out.appendChild(div);
      out.scrollTop = out.scrollHeight;
    };

    const adapter = backendConfigured()
      ? new WebSocketAdapter({
        url: CONFIG.wsBase,
        getTicket: async () => {
          const r = await fetch(`${CONFIG.apiBase}/pty/tickets`, { method: 'POST', credentials: 'include' });
          if (!r.ok) throw new Error('ticket');
          return (await r.json()).ticket;
        },
      })
      : new DisconnectedAdapter();

    const ctl = new TerminalController({ adapter, print, clear: () => { out.textContent = ''; }, lang: getLang });
    adapter.on('state', (s) => {
      stateEl.className = 'tag ' + (s === 'connected' ? 'live' : s === 'connecting' ? 'preview' : 'planned');
      stateEl.lastChild.textContent = t('term.' + s);
    });

    print('CORNOD terminal client v0.1', 'sys');
    print(getLang() === 'ar' ? 'اكتب ‎:help‎ لعرض الأوامر المحلية.' : 'Type :help for local commands.', 'dim');
    if (!backendConfigured()) adapter.connect(); // reports NO_BACKEND honestly

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { ctl.submit(input.value); input.value = ''; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); input.value = ctl.navigate(-1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); input.value = ctl.navigate(1); }
      else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.textContent = ''; }
    });
    root.querySelector('#term').addEventListener('click', () => input.focus());
    input.focus({ preventScroll: true });
    return () => adapter.close();
  },
};
