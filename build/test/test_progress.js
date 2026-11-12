// Progress page: all 20 badges can be earned (hidden test mode), the page works offline and on a phone,
// turning badges off hides the page, the animation and the sound; screenshots and share images for the report.
// Run:  node build/test/test_progress.js [folder for screenshots]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', 'app'), OUT = process.argv[2] || '/tmp/progress-shots';
fs.mkdirSync(OUT, { recursive: true });
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]), f = path.join(ROOT, u === '/' ? 'index.html' : u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const res = []; const ok = (n, p, i) => res.push([n, !!p, i == null ? '' : String(i).slice(0, 160)]);
(async () => {
  await new Promise(r => server.listen(8784, r));
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addInitScript(() => { localStorage.setItem('flt:onboarded', '1'); window.__chimes = 0; const C = window.AudioContext; if (C) window.AudioContext = function () { window.__chimes++; return new C(); }; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8784/?progress-test');
  await p.waitForFunction(() => window.FLT && FLT.D.ready && FLT.state.status === 'done' && FLT.D.details, null, { timeout: 120000 });
  await p.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
  const ev = (f, a) => p.evaluate(f, a);
  // real practice counts: one word right on 3 different days is learned
  await ev(() => { const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }; [2, 1, 0].forEach(n => FLTProgress.record('de:Haus:noun', true, 'gender', d(n))); });
  ok('a word answered right on 3 days is learned', await ev(() => !!FLT.P.prog.words['de:Haus:noun'].l));
  await ev(() => FLTProgress.record('de:Tisch:noun', true, 'translate'));
  ok('a word right on 1 day is not learned yet', await ev(() => !FLT.P.prog.words['de:Tisch:noun'].l));
  await ev(() => FLT.openId('de:Baum:noun'));
  ok('lookups do not count as practice', await ev(() => !FLT.P.prog.words['de:Baum:noun']));
  await p.click('#progress-toggle'); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '/1-progress-start.png', fullPage: true });
  // every badge through the test mode
  const keys = await ev(() => FLTProgress.BADGES.map(b => b.k));
  for (const k of keys) {
    await p.click(`[data-pg="test"][data-k="${k}"]`); await p.waitForTimeout(400);
    const per = await ev(k => FLTProgress.BADGES.find(b => b.k === k).per, k);
    const have = await ev(([k, per]) => per ? Object.keys(FLT.P.badges).some(x => x.startsWith(k + ':')) : !!FLT.P.badges[k], [k, per]);
    ok('badge can be earned: ' + k, have);
  }
  ok('20 badges', keys.length === 20, keys.length);
  ok('unlock shows the message with the bounce', await ev(() => !document.querySelector('#badge-pop').hidden && !!document.querySelector('#badge-pop .bicon.pop')));
  ok('unlock plays the chime (sound on)', (await ev(() => window.__chimes)) > 0);
  await p.click('[data-pg="pop-close"]').catch(() => {});
  await p.click('[data-pg="test-year"]'); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '/2-progress-earned.png', fullPage: true });
  // one locked and one unlocked badge, close up
  await ev(() => { FLT.P.badges = Object.fromEntries(Object.entries(FLT.P.badges).filter(([k]) => k !== 'month')); FLTProgress.paint(); });
  await p.waitForTimeout(300);
  const tiles = await p.$$('#progress .badge');
  for (const t of tiles) { const txt = await t.innerText(); if (/Perfect week/.test(txt)) await t.screenshot({ path: OUT + '/3-badge-unlocked.png' }); if (/Perfect month/.test(txt)) await t.screenshot({ path: OUT + '/4-badge-locked.png' }); }
  // share images
  const save = async (expr, file) => { const url = await ev(expr); fs.writeFileSync(OUT + '/' + file, Buffer.from(url.split(',')[1], 'base64')); };
  await save(async () => (await FLTProgress._badgeImage('swiss', true)).toDataURL('image/png'), '5-share-badge.png');
  await save(async () => (await FLTProgress._yearImage(new Date().getFullYear())).toDataURL('image/png'), '6-share-year.png');
  await p.click('#progress .badge.on [data-pg="share"]'); await p.waitForTimeout(800);
  ok('share box with a preview', await ev(() => !!document.querySelector('#sh-prev canvas')));
  await p.click('[data-pg="share-close"]');
  ok('yearly summary shown', /you learned/.test(await ev(() => document.querySelector('#progress .yr').innerText)));
  // phone
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  await ev(() => document.querySelector('#progress').scrollIntoView());
  await p.screenshot({ path: OUT + '/7-progress-phone.png' });
  ok('phone: no sideways scrolling of the page', await ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await ev(() => document.documentElement.scrollWidth));
  await p.setViewportSize({ width: 1280, height: 1000 });
  // offline
  await ctx.setOffline(true); await p.reload(); await p.waitForFunction(() => window.FLT && FLT.D.ready, null, { timeout: 60000 });
  await p.click('#progress-toggle'); await p.waitForFunction(() => /Words learned/.test(document.querySelector('#progress').innerText), null, { timeout: 15000 }).catch(() => {});
  ok('works offline', /Words learned/.test(await ev(() => document.querySelector('#progress').innerText)) && (await ev(() => Object.keys(FLT.P.badges).length)) > 20);
  await ctx.setOffline(false);
  // badges off: page, animation and sound hidden
  await p.click('#settings-toggle'); await ev(() => { const c = document.querySelector('#s-badges'); c.checked = false; c.dispatchEvent(new Event('change')); });
  ok('badges off hides the Progress link and page', await ev(() => document.querySelector('#progress-toggle').hidden && document.querySelector('#progress').hidden));
  await ev(() => { window.__chimes = 0; FLT.P.badges = {}; document.querySelector('#badge-pop').hidden = true; });
  await ev(() => FLTProgress.check()); await p.waitForTimeout(400);
  ok('badges off: no message, no sound', await ev(() => document.querySelector('#badge-pop').hidden && window.__chimes === 0));
  ok('badges off: progress is still recorded', await ev(() => Object.keys(FLT.P.prog.words).length > 100));
  ok('no page errors', errs.length === 0, errs.join(' | '));
  for (const [n, pass, i] of res) console.log((pass ? 'PASS ' : 'FAIL ') + n + (i ? '  [' + i + ']' : ''));
  console.log(res.every(r => r[1]) ? 'RESULT: ALL PASS' : 'RESULT: SOME FAILED');
  await b.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
