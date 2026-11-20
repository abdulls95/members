// Tiny persisted UI state. Only non-sensitive preferences live here — never tokens or secrets.
const KEY = 'cornod:prefs:v1';
const DEFAULTS = { lang: 'ar', previewRole: 'guest' };

function read() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

let state = typeof localStorage === 'undefined' ? { ...DEFAULTS } : read();

export function get(k) { return state[k]; }
export function set(k, v) {
  state = { ...state, [k]: v };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable: keep in memory */ }
}
