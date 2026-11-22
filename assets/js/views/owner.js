import { t } from '../core/i18n.js';
import { html, raw, esc, pageHead } from '../core/ui.js';
import { listAccountRequests, reviewAccount } from '../core/access-client.js';

export const owner = {
  render: () => html`${raw(pageHead('admin.title', 'admin.sub', 'live'))}
    <div class="notice" role="note"><strong>${t('owner.only')}</strong><span>${t('owner.explain')}</span></div>
    <div class="card"><h2>${t('owner.requests')}</h2>
      <p id="owner-msg" role="status" aria-live="polite">${t('owner.loading')}</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th>${t('auth.email')}</th><th>${t('owner.status')}</th><th>${t('owner.action')}</th>
      </tr></thead><tbody id="owner-body"></tbody></table></div></div>`,
  mount: (root) => {
    const tbody = root.querySelector('#owner-body');
    const message = root.querySelector('#owner-msg');
    let live = true;
    let busy = false;
    const status = (s) => t('owner.status.' + s);
    async function refresh() {
      if (!live) return;
      message.textContent = t('owner.loading');
      try {
        const rows = await listAccountRequests();
        if (!live) return;
        tbody.textContent = '';
        for (const item of rows) {
          const tr = document.createElement('tr');
          const email = document.createElement('td');
          email.textContent = item.email;
          email.className = 'ltr';
          const state = document.createElement('td');
          state.textContent = status(item.status);
          const actions = document.createElement('td');
          if (['pending', 'rejected', 'approved'].includes(item.status)) {
            for (const [decision,key] of [['approved','approve'],['rejected','reject']]) {
              const button = document.createElement('button');
              button.type = 'button'; button.className = 'btn sm';
              button.dataset.id = item.user_id; button.dataset.decision = decision;
              button.textContent = t('owner.' + key);
              button.disabled = decision === item.status;
              actions.append(button, document.createTextNode(' '));
            }
          }
          tr.append(email,state,actions); tbody.appendChild(tr);
        }
        message.textContent = rows.length ? t('owner.loaded') : t('owner.empty');
      } catch { if (live) message.textContent = t('owner.failed'); }
    }
    const click = async (event) => {
      const btn = event.target.closest('button[data-decision]');
      if (!btn || busy) return;
      busy = true; btn.disabled = true;
      try {
        await reviewAccount(btn.dataset.id, btn.dataset.decision);
        await refresh();
      } catch { message.textContent = t('owner.failed'); }
      finally { busy = false; if (btn.isConnected) btn.disabled = false; }
    };
    tbody.addEventListener('click', click);
    void refresh();
    return () => { live = false; tbody.removeEventListener('click', click); };
  }
};
