// The corrections in app/data/manifest.json ("corrections", docs/CORRECTIONS.md) are applied in the browser.
// With no argument: adds sample corrections to a copy of the manifest in memory and checks each kind.
// Run:  node build/test/test_corrections.js
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', 'app');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2' };
const SAMPLE = [
  { entry: 'en:can:verb', issue: 0, note: 'test', set: { 'senses.0.gloss_en': 'TEST GLOSS' } },
  { entry: 'de:Tisch:noun', issue: 0, note: 'test', sense: 0, add_translation: { lang: 'pt', target: 'pt:balcão:noun' } },
  { entry: 'de:Haus:noun', issue: 0, note: 'test', remove_translation: { lang: 'en', target: 'en:house:noun' } },
  { entry: 'de:Baum:noun', issue: 0, note: 'test', hide: true },
];
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]), f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  if (u === '/data/manifest.json' && !process.argv[2]) { const m = JSON.parse(fs.readFileSync(f, 'utf8')); m.corrections = (m.corrections || []).concat(SAMPLE); r.writeHead(200, { 'Content-Type': 'application/json' }); return r.end(JSON.stringify(m)); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const res = []; const ok = (n, p, i) => res.push([n, !!p, i || '']);
(async () => {
  await new Promise(r => server.listen(8782, r));
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext(); await ctx.addInitScript(() => localStorage.setItem('flt:onboarded', '1'));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8782/');
  await p.waitForFunction(() => window.FLT && FLT.D.ready && FLT.state.status === 'done' && FLT.D.details, null, { timeout: 120000 });
  const n = await p.evaluate(() => (FLT.D.manifest.corrections || []).length);
  if (!process.argv[2]) {
    ok('set a field', (await p.evaluate(() => FLT.D.byId.get('en:can:verb').senses[0].gloss_en)) === 'TEST GLOSS');
    ok('add a translation first', (await p.evaluate(() => FLT.D.byId.get('de:Tisch:noun').senses[0].translations.pt[0])) === 'pt:balcão:noun');
    ok('remove a translation', !(await p.evaluate(() => FLT.D.byId.get('de:Haus:noun').senses.some(s => (s.translations.en || []).includes('en:house:noun')))));
    ok('hide an entry', !(await p.evaluate(() => FLT.D.byId.has('de:Baum:noun'))));
  }
  // every correction in the real manifest names a loadable entry
  const missing = await p.evaluate(async () => { const out = []; for (const c of FLT.D.manifest.corrections || []) { if (c.hide) continue; await FLT.ensureIds([c.entry]).catch(() => {}); if (!FLT.D.byId.has(c.entry)) out.push(c.entry); } return out; });
  ok(`all ${n} corrections name an existing entry`, missing.length === 0, missing.join(', '));
  ok('no page errors', errs.length === 0, errs.join(' | '));
  for (const [x, y, z] of res) console.log((y ? 'PASS ' : 'FAIL ') + x + (z ? '  [' + z + ']' : ''));
  console.log(res.every(r => r[1]) ? 'RESULT: ALL PASS' : 'RESULT: SOME FAILED');
  await b.close(); server.close();
})();
