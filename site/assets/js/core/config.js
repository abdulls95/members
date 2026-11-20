// Public runtime configuration. NO secrets belong here — this file is served to every browser.
// When the backend is deployed, set apiBase/wsBase to its public origin (e.g. https://api.cornod.dev).
export const CONFIG = Object.freeze({
  version: '0.1.0',
  apiBase: null, // e.g. 'https://api.cornod.dev/v1'
  wsBase: null,  // e.g. 'wss://api.cornod.dev/v1/pty'
});

export const backendConfigured = () => Boolean(CONFIG.apiBase && CONFIG.wsBase);
