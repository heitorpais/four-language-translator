/* Service worker: keeps the app and its data on the device so it opens without a connection.
   - app files (index.html, app.js, forms.js, views.js, learn.js, i18n.js, icons): served from the saved copy, refreshed in the background
   - data/manifest.json: network first, saved copy when offline
   - other data files: saved copy first (their address carries a version, so a new version is a new address).
     Core and details files are saved at install; the files of the other words when first used. */
const SHELL = 'flt-shell-v20', DATA = 'flt-data-v2';
const APP_FILES = ['./', 'index.html', 'app.js', 'forms.js', 'views.js', 'progress.js', 'learn.js', 'i18n.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'fonts.css',
  'fonts/ibm-plex-mono-latin-400-normal.woff2', 'fonts/ibm-plex-mono-latin-500-normal.woff2', 'fonts/ibm-plex-mono-latin-ext-400-normal.woff2', 'fonts/ibm-plex-mono-latin-ext-500-normal.woff2', 'fonts/ibm-plex-sans-latin-400-normal.woff2', 'fonts/ibm-plex-sans-latin-500-normal.woff2', 'fonts/ibm-plex-sans-latin-600-normal.woff2', 'fonts/ibm-plex-sans-latin-ext-400-normal.woff2', 'fonts/ibm-plex-sans-latin-ext-500-normal.woff2', 'fonts/ibm-plex-sans-latin-ext-600-normal.woff2', 'fonts/source-serif-4-latin-ext-opsz-italic.woff2', 'fonts/source-serif-4-latin-ext-opsz-normal.woff2', 'fonts/source-serif-4-latin-opsz-italic.woff2', 'fonts/source-serif-4-latin-opsz-normal.woff2'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await shell.addAll(APP_FILES.map(u => new Request(u, { cache: 'reload' })));
    try {
      const data = await caches.open(DATA);
      const res = await fetch('data/manifest.json', { cache: 'no-cache' });
      if (res.ok) {
        await data.put('data/manifest.json', res.clone());
        const manifest = await res.json();
        // files already saved are not downloaded again, so a new app version is ready in seconds
        await Promise.all(manifest.files.filter(f => f.tier === 'core' || f.tier === 'details').map(async f => { const u = 'data/' + f.file + '?v=' + f.sha256; if (!(await data.match(u))) await data.add(u); }));
      }
    } catch (e) { /* the page loads the data itself; this copy is a second safety net */ }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [SHELL, DATA];
    for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  const m = event.data || {};
  if (m.type !== 'prune') return;
  event.waitUntil((async () => {
    const data = await caches.open(DATA);
    const keep = new Set(m.keep.map(u => new URL(u, self.registration.scope).href));
    for (const req of await data.keys()) if (!req.url.endsWith('data/manifest.json') && !keep.has(req.url)) await data.delete(req);
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const path = url.href.slice(self.registration.scope.length).split('?')[0];
  if (path === 'data/manifest.json') {
    event.respondWith((async () => {
      const c = await caches.open(DATA);
      try { const r = await fetch(req); if (r.ok) c.put('data/manifest.json', r.clone()); return r; }
      catch (e) { return (await c.match('data/manifest.json')) || new Response('{}', { status: 504 }); }
    })());
    return;
  }
  if (path.startsWith('data/')) {
    event.respondWith((async () => {
      const c = await caches.open(DATA);
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r;
    })());
    return;
  }
  event.respondWith((async () => {
    const c = await caches.open(SHELL);
    const key = (req.mode === 'navigate' || path === '') ? 'index.html' : path;
    const hit = await c.match(key);
    const refresh = fetch(req).then(r => { if (r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
    if (hit) { event.waitUntil(refresh); return hit; }
    return (await refresh) || new Response('Offline', { status: 504 });
  })());
});
