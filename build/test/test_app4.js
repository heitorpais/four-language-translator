// Phase 4 browser test. Serves ./app with gzip (as GitHub Pages does), opens it in Chrome.
//  1. first visit on a throttled connection: time until the core card data is in, and until the details are in
//  2. lookups of extended / long-tail words and of inflected forms (letters loaded on demand)
//  3. translation order (gehen -> ir, sehr -> very)
//  4. offline: core words open from the saved copy; a letter loaded before still works; an unloaded letter fails politely
// Run:  node build/test/test_app4.js [Mbit/s, default 50]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..', '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2' };
const gz = new Map(); let served = 0;
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  served++;
  const ext = path.extname(f), type = TYPES[ext] || 'application/octet-stream';
  if (ext === '.woff2') { r.writeHead(200, { 'Content-Type': type }); return fs.createReadStream(f).pipe(r); }
  if (!gz.has(f)) gz.set(f, zlib.gzipSync(fs.readFileSync(f), { level: 6 }));
  r.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'gzip' }); r.end(gz.get(f));
});
const MBIT = +(process.argv[2] || 50);
const results = []; const ok = (n, p, i) => results.push([n, p, i || '']);
(async () => {
  await new Promise(r => server.listen(8767, r));
  // warm the gzip cache so compression time is not counted as network time
  for (const f of fs.readdirSync(path.join(ROOT, 'data'))) { const p = path.join(ROOT, 'data', f); if (fs.statSync(p).isFile()) gz.set(p, zlib.gzipSync(fs.readFileSync(p), { level: 6 })); }
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: MBIT * 1e6 / 8, uploadThroughput: 10e6 / 8 });
  const t0 = Date.now();
  await page.goto('http://localhost:8767/');
  await page.waitForFunction(() => window.FLT && window.FLT.D.ready, null, { timeout: 180000 });
  const tCore = (Date.now() - t0) / 1000;
  await page.waitForFunction(() => window.FLT.D.details, null, { timeout: 180000 });
  const tDet = (Date.now() - t0) / 1000;
  ok(`first visit at ${MBIT} Mbit/s: core card data loaded, app usable`, tCore < 3, tCore.toFixed(1) + ' s');
  ok(`first visit at ${MBIT} Mbit/s: examples and background of the core words loaded`, true, tDet.toFixed(1) + ' s');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller || document.querySelector('#offline-state').textContent.includes('Saved'), null, { timeout: 60000 });

  // ---- lookups (online)
  const look = async (lang, word) => page.evaluate(async ([l, w]) => {
    await window.FLT.translate(l, w); const s = window.FLT.state;
    return { status: s.status, id: s.entry && s.entry.id, tier: s.entry && s.entry.tier, form: s.form, slots: ['en', 'de', 'fr', 'pt'].map(x => document.querySelector('#in-' + x).value).join(' | '), err: s.error };
  }, [lang, word]);
  for (const [l, w, want] of [['de', 'gehen', 'de:gehen:verb'], ['de', 'ging', 'de:gehen:verb'], ['en', 'went', 'en:go:verb'], ['de', 'Häuser', 'de:Haus:noun'],
    ['fr', 'allons', 'fr:aller:verb'], ['pt', 'fui', null], ['de', 'Ackerbau', 'de:Ackerbau:noun'], ['en', 'quixotic', 'en:quixotic:adjective'],
    ['fr', 'tergiverser', 'fr:tergiverser:verb'], ['pt', 'saudade', 'pt:saudade:noun'], ['de', 'Strasse', 'de:Straße:noun'], ['de', 'qwxz', null]]) {
    const r = await look(l, w);
    const pass = want === null ? (w === 'qwxz' ? r.status === 'error' : r.status === 'done') : r.id === want;
    ok(`lookup ${l} "${w}"`, pass, `${r.status} ${r.id || r.err.slice(0, 40)} ${r.tier || ''}${r.form ? ' (form)' : ''} → ${r.slots}`);
  }
  const order = await page.evaluate(async () => {
    const out = {};
    await window.FLT.translate('de', 'gehen'); out.gehen_pt = document.querySelector('#in-pt').value;
    await window.FLT.translate('de', 'sehr'); out.sehr_en = document.querySelector('#in-en').value;
    await window.FLT.translate('de', 'Haus'); out.haus = ['en', 'fr', 'pt'].map(x => document.querySelector('#in-' + x).value).join(' | ');
    await window.FLT.translate('en', 'go'); out.go = window.FLT.state.entry.senses[window.FLT.state.sense].gloss_en;
    return out;
  });
  ok('translation order: gehen → Portuguese "ir" first', order.gehen_pt === 'ir', order.gehen_pt);
  ok('translation order: sehr → English "very" first', order.sehr_en === 'very', order.sehr_en);
  ok('Haus → house | maison | casa', order.haus === 'house | maison | casa', order.haus);
  ok('English "go": first meaning shown is moving', /move/.test(order.go || ''), order.go);
  const sug = await page.evaluate(async () => {
    const i = document.querySelector('#in-de'); i.focus(); i.value = 'zerk'; i.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 1500));
    return [...document.querySelectorAll('#sg-de li')].map(x => x.textContent);
  });
  ok('suggestions include extended words and forms', sug.length > 0, sug.slice(0, 8).join(', '));

  // ---- offline
  await ctx.setOffline(true);
  served = 0;
  await page.reload(); await page.waitForFunction(() => window.FLT && window.FLT.D.ready && window.FLT.D.details, null, { timeout: 120000 });
  ok('offline: page, core and details load from the saved copy', served === 0, served + ' requests reached the server');
  const off = await page.evaluate(async () => {
    const F = window.FLT, out = { n: 0, bad: [] };
    const core = [...F.D.byId.values()].filter(e => e.tier === 'core');
    const byLang = {}; core.forEach(e => (byLang[e.lang] = byLang[e.lang] || []).push(e));
    for (const l in byLang) {
      const list = byLang[l];
      for (let i = 0; i < list.length; i += Math.max(1, Math.floor(list.length / 500))) {
        const e = list[i]; out.n++;
        await F.openEntry(e);
        const card = document.querySelector('.card[data-id="' + CSS.escape(e.id) + '"]');
        const why = [];
        if (!card) why.push('no card');
        else {
          if (e.ipa.default && !card.querySelector('.ipa')) why.push('no IPA');
          if (e.examples.length && !card.querySelector('.ex li')) why.push('no examples');
        }
        if (why.length) out.bad.push(e.id + ': ' + why.join(', '));
      }
    }
    await F.translate('en', 'quixotic'); out.prev = F.state.status + ' ' + (F.state.entry ? F.state.entry.id : '');
    await F.translate('fr', 'manger'); out.coreOffline = F.state.status + ' ' + (F.state.entry ? F.state.entry.id : '');
    await F.translate('de', 'Xylophon'); out.unloaded = F.state.status + ': ' + (F.state.error || '');
    return out;
  });
  ok('offline: core words open complete cards', off.bad.length === 0, `${off.n} core entries checked (every n-th, about 500 per language)` + (off.bad.length ? '; ' + off.bad.slice(0, 5).join(' | ') : ''));
  ok('offline: a core word whose letter file was never loaded still works', /^done fr:manger/.test(off.coreOffline), off.coreOffline);
  ok('offline: a word whose letter was loaded before still works', /^done en:quixotic/.test(off.prev), off.prev);
  ok('offline: a word whose letter was never loaded fails politely', /^error/.test(off.unloaded), off.unloaded.slice(0, 120));
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  let fail = 0;
  for (const [n, p, i] of results) { if (!p) fail++; console.log((p ? 'PASS ' : 'FAIL ') + n + (i ? '  (' + i + ')' : '')); }
  console.log(fail ? `RESULT: ${fail} FAILED` : 'RESULT: ALL PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
