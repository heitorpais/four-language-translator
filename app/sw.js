/* Service worker: keeps the app and its data on the device so it opens without a connection.
   - app files (index.html, app.js, forms.js, views.js, learn.js, i18n.js, icons): the newest from the network when online, else the saved copy
   - data/manifest.json: network first, saved copy when offline
   - other data files: saved copy first (their address carries a version, so a new version is a new address).
     Each file is saved when the page first uses it, so only the chosen languages are downloaded. */
const SHELL = 'flt-shell-v48', DATA = 'flt-data-v2';
const APP_FILES = ['./', 'index.html', 'app.js', 'forms.js', 'views.js', 'progress.js', 'learn.js', 'i18n.js', 'avatars.js', 'sync.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-32.png', 'icons/icon-maskable-512.png', 'icons/wordmark.png', 'icons/wood.jpg', 'icons/wood-dark.jpg', 'fonts.css',
  'fonts/eb-garamond-latin-wght-normal.woff2', 'fonts/eb-garamond-latin-ext-wght-normal.woff2', 'fonts/cormorant-garamond-latin-wght-normal.woff2', 'fonts/cormorant-garamond-latin-ext-wght-normal.woff2', 'fonts/source-serif-4-latin-ext-opsz-italic.woff2', 'fonts/source-serif-4-latin-ext-opsz-normal.woff2', 'fonts/source-serif-4-latin-opsz-italic.woff2', 'fonts/source-serif-4-latin-opsz-normal.woff2'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await shell.addAll(APP_FILES.map(u => new Request(u, { cache: 'reload' })));
    try {
      const data = await caches.open(DATA);
      const res = await fetch('data/manifest.json', { cache: 'no-cache' });
      if (res.ok) {
        await data.put('data/manifest.json', res.clone());
        // the data files are saved when the page loads them: only the languages the reader chose (2 to 4 of them)
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
  const page = (url.origin + url.pathname).slice(self.registration.scope.length);
  if (req.mode === 'navigate' && page !== '' && page !== 'index.html') return;     // word pages (de/Haus/ …) are plain web pages, not the app
  // app files: the newest version from the network when online (so an update shows at once, also in the home-screen app),
  // the saved copy when offline or when the network takes longer than 4 seconds
  event.respondWith((async () => {
    const c = await caches.open(SHELL);
    const key = (req.mode === 'navigate' || path === '') ? 'index.html' : path;
    const net = fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
    const hit = await c.match(key);
    if (!hit) return (await net) || new Response('Offline', { status: 504 });
    const slow = new Promise(res => setTimeout(() => res(null), 4000));
    const r = await Promise.race([net, slow]);
    if (r && r.ok) return r;
    event.waitUntil(net);
    return hit;
  })());
});
