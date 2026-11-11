// Regional word order and pronunciation labels.
//  1. the same meaning gives the same word whichever language it is typed in (bus, mobile phone, breakfast -> pt)
//  2. Brazil / Portugal and Germany / Switzerland put their own word first (celular / telemóvel, gehen / laufen, rennen)
//  3. a region without its own transcription shows the base region's IPA with its flag and "as in ..."; switching
//     region replaces the IPA (no old transcription left on the card)
// Run:  node build/test/test_regions.js
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]), f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const results = []; const ok = (n, p, i) => results.push([n, p, i || '']);
(async () => {
  await new Promise(r => server.listen(8771, r));
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', e => ok('no page error', false, e.message));
  await page.goto('http://localhost:8771/');
  await page.waitForFunction(() => window.FLT && FLT.D.ready, null, { timeout: 120000 });
  await page.evaluate(() => FLT.D.details);
  const setReg = (lang, r) => page.evaluate(([l, r]) => { const s = document.querySelector('#var-' + l); s.value = r; s.dispatchEvent(new Event('change')); }, [lang, r]);
  const tr = async (lang, w) => { await page.evaluate(([l, w]) => FLT.translate(l, w), [lang, w]); await page.waitForFunction(() => FLT.state.status === 'done' || FLT.state.status === 'error'); };
  const word = l => page.evaluate(l => document.querySelector('#in-' + l).value, l);
  const pron = l => page.evaluate(l => { const c = [...document.querySelectorAll('#cards .card')][['en', 'de', 'fr', 'pt'].indexOf(l)]; return c ? c.querySelector('.pron').textContent : ''; }, l);
  const card = l => page.evaluate(l => [...document.querySelectorAll('#cards .card')][['en', 'de', 'fr', 'pt'].indexOf(l)].textContent, l);

  const cases = [
    // [region settings, source lang, word, target lang, expected]
    [['pt', 'br'], 'de', 'Bus', 'pt', 'ônibus'], [['pt', 'br'], 'fr', 'bus', 'pt', 'ônibus'], [['pt', 'br'], 'en', 'bus', 'pt', 'ônibus'],
    [['pt', 'pt'], 'de', 'Bus', 'pt', 'autocarro'], [['pt', 'pt'], 'fr', 'bus', 'pt', 'autocarro'], [['pt', 'pt'], 'en', 'bus', 'pt', 'autocarro'],
    [['pt', 'br'], 'fr', 'portable', 'pt', 'celular'], [['pt', 'br'], 'en', 'cell phone', 'pt', 'celular'],
    [['pt', 'pt'], 'fr', 'portable', 'pt', 'telemóvel'],
    [['pt', 'br'], 'de', 'Frühstück', 'pt', 'café da manhã'], [['pt', 'pt'], 'de', 'Frühstück', 'pt', 'pequeno-almoço'],
    [['pt', 'br'], 'de', 'Zug', 'pt', 'trem'], [['pt', 'pt'], 'de', 'Zug', 'pt', 'comboio'],
    [['de', 'de'], 'pt', 'andar', 'de', 'gehen'], [['de', 'ch'], 'pt', 'andar', 'de', 'laufen'],
    [['de', 'de'], 'en', 'walk', 'de', 'gehen'], [['de', 'ch'], 'en', 'walk', 'de', 'laufen'],
    [['de', 'ch'], 'en', 'run', 'de', 'rennen'], [['de', 'ch'], 'fr', 'courir', 'de', 'rennen'], [['de', 'ch'], 'pt', 'correr', 'de', 'rennen'],
    [['de', 'de'], 'pt', 'ir', 'de', 'gehen'], [['de', 'ch'], 'pt', 'ir', 'de', 'gehen'],
    [['de', 'ch'], 'en', 'bicycle', 'de', 'Velo'], [['de', 'de'], 'en', 'bicycle', 'de', 'Fahrrad'],
    [['de', 'ch'], 'en', 'sidewalk', 'de', 'Trottoir'], [['de', 'at'], 'en', 'sidewalk', 'de', 'Gehsteig'], [['de', 'de'], 'en', 'sidewalk', 'de', 'Bürgersteig'],
  ];
  for (const [[rl, rv], sl, w, tl, want] of cases) {
    await setReg(rl, rv); await tr(sl, w);
    const got = await word(tl);
    ok(`${sl} "${w}" -> ${tl} (${rv.toUpperCase()})`, got === want, got);
  }
  await setReg('de', 'de'); await setReg('pt', 'br');
  // pronunciation
  await tr('de', 'Straße');
  let p = await pron('de'); ok('Straße DE: German IPA, no "as in"', /ʃtʁaːsə/.test(p) && !/as in/.test(p), p);
  await setReg('de', 'ch'); p = await pron('de');
  ok('Straße CH: shown as "as in Germany"', /as in Germany/.test(p), p);
  await setReg('de', 'de'); p = await pron('de'); ok('Straße back to DE: label gone', !/as in/.test(p), p);
  await tr('pt', 'rua');
  p = await pron('pt'); ok('rua BR: ˈhu.ɐ only on the headword line', /hu\.ɐ/.test(p) && !/ʁu/.test(p), p);
  await setReg('pt', 'pt'); p = await pron('pt'); ok('rua PT: ˈʁu.ɐ replaces it', /ʁu\.ɐ/.test(p) && !/hu\.ɐ/.test(p), p);
  await setReg('pt', 'br');
  // regional word on a card: "Used in"
  await tr('pt', 'telemóvel'); const c = await card('pt'); ok('telemóvel in BR mode says "Used in Portugal"', /Used in.*Portugal/.test(c), c.slice(0, 120));
  for (const [n, pass, info] of results) console.log((pass ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : ''));
  console.log(results.every(r => r[1]) ? 'ALL PASS' : 'SOME FAILED');
  await browser.close(); server.close();
})();
