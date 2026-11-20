// Hash router — works on GitHub Pages (no server rewrites needed).
export function parseHash(hash) {
  const h = (hash || '').replace(/^#!?/, '') || '/';
  const [pathPart, queryPart = ''] = h.split('?');
  const path = '/' + pathPart.split('/').filter(Boolean).join('/');
  const query = Object.fromEntries(new URLSearchParams(queryPart));
  return { path, query };
}

export function createRouter(routes, onRoute) {
  const byPath = new Map(routes.map((r) => [r.path, r]));
  const resolve = () => {
    const { path, query } = parseHash(location.hash);
    onRoute(byPath.get(path) || null, { path, query });
  };
  window.addEventListener('hashchange', resolve);
  return { resolve, go: (path) => { location.hash = '#' + path; } };
}
