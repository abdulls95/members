// Only a language preference persists. Never store account roles or auth tokens here.
const KEY = 'cornod:prefs:v1';
const DEFAULTS = { lang: 'ar' };
function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { lang: saved?.lang === 'en' ? 'en' : 'ar' };
  } catch { return { ...DEFAULTS }; }
}
let state = typeof localStorage === 'undefined' ? { ...DEFAULTS } : read();
export function get(k) { return Object.hasOwn(DEFAULTS, k) ? state[k] : undefined; }
export function set(k, v) {
  if (k !== 'lang' || (v !== 'ar' && v !== 'en')) return;
  state = { lang: v };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* browser storage unavailable */ }
}
