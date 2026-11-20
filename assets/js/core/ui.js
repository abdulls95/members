import { t } from './i18n.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escape untrusted text before interpolating into HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Tagged template that escapes every interpolation unless wrapped in raw(). */
export function html(strings, ...vals) {
  return strings.reduce((out, s, i) => {
    if (i === 0) return s;
    const v = vals[i - 1];
    const str = Array.isArray(v) ? v.map((x) => (x && x.__raw ? x.v : esc(x))).join('')
      : v && v.__raw ? v.v : esc(v);
    return out + str + s;
  }, '');
}
export const raw = (v) => ({ __raw: true, v: String(v ?? '') });

export const statusTag = (s) => raw(`<span class="tag ${esc(s)}"><span class="dot"></span>${esc(t('status.' + s))}</span>`);

export const previewNotice = () => raw(
  `<div class="notice" role="note"><strong>${esc(t('notice.preview'))}</strong><span>${esc(t('notice.previewBody'))}</span></div>`,
);

export function pageHead(titleKey, subKey, status, actions = '') {
  return html`<header class="page-head"><div>
    <div class="eyebrow">CORNOD / ${t(titleKey)}</div>
    <h1>${t(titleKey)} ${status ? statusTag(status) : ''}</h1><p>${t(subKey)}</p></div>
    <div>${raw(actions)}</div></header>`;
}
