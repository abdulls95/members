// Minimal stroke icon set (24px grid).
const P = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  dashboard: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  workspaces: 'M3 5h18v6H3zM3 13h18v6H3zM7 8h.01M7 16h.01',
  terminal: 'M4 5h16v14H4zM7 9l3 3-3 3M12 15h5',
  files: 'M4 4h6l2 2h8v13H4z',
  marketplace: 'M4 7h16l-1 13H5zM8 7V5a4 4 0 0 1 8 0v2',
  commands: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  osint: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l5 5',
  labs: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3',
  ai: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z',
  admin: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  status: 'M4 19V9M10 19V5M16 19v-7M22 19H2',
  signin: 'M10 17l5-5-5-5M15 12H3M14 4h6v16h-6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
};
export const icon = (name, cls = 'ico') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="${P[name] || ''}"/></svg>`;

export const LOGO = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
  <path d="M16 2l12 7v14l-12 7-12-7V9z" fill="none" stroke="#ff6a13" stroke-width="2"/>
  <path d="M21 11.5A6.5 6.5 0 1 0 21 20.5" fill="none" stroke="#eceef1" stroke-width="2.6" stroke-linecap="square"/>
  <rect x="19" y="14.6" width="5" height="2.8" fill="#ff6a13"/></svg>`;
