// Browser test for Phase 3. Serves ./app, opens it in Chrome, lets it save its data, then turns the
// network off and reloads. Offline, it opens every German pilot entry and checks the card.
// Run:  node build/test/test_app.js
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const requests = [];
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]); requests.push(u);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const results = []; const ok = (name, pass, info) => { results.push([name, pass, info || '']); };
(async () => {
  await new Promise(r => server.listen(8765, r));
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  const outside = []; page.on('request', r => { if (!r.url().startsWith('http://localhost:8765/')) outside.push(r.url()); });
  const t0 = Date.now();
  await page.goto('http://localhost:8765/');
  await page.waitForFunction(() => window.FLT && window.FLT.D.ready, null, { timeout: 60000 });
  await page.waitForFunction(() => window.FLT.D.details, null, { timeout: 120000 });
  ok('first visit: data loaded', true, ((Date.now() - t0) / 1000).toFixed(1) + ' s on localhost');
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller || document.querySelector('#offline-state').textContent.includes('Saved'), null, { timeout: 30000 });
  await page.reload(); await page.waitForFunction(() => window.FLT && window.FLT.D.ready, null, { timeout: 60000 });
  ok('service worker controls the page', await page.evaluate(() => !!navigator.serviceWorker.controller));

  // ---- network off
  await ctx.setOffline(true);
  requests.length = 0;
  const t1 = Date.now();
  await page.reload(); await page.waitForFunction(() => window.FLT && window.FLT.D.ready, null, { timeout: 60000 });
  ok('offline: page and data load', true, ((Date.now() - t1) / 1000).toFixed(1) + ' s');
  ok('offline: no request reached the server', requests.length === 0, requests.length + ' requests');

  const r = await page.evaluate(async () => {
    const F = window.FLT, out = { n: 0, bad: [], formsOpened: 0, noTrans: 0, withEx: 0 };
    const de = [...F.D.byId.values()].filter(e => e.lang === 'de' && e.tier === 'core');
    for (const e of de) {
      out.n++;
      await F.openEntry(e);
      const card = document.querySelector('.card[data-id="' + CSS.escape(e.id) + '"]');
      const why = [];
      if (!card) why.push('no card');
      else {
        if (!card.querySelector('.hw').textContent.trim()) why.push('no headword');
        if (e.ipa.default && !card.querySelector('.ipa')) why.push('no IPA');
        if (e.noun && e.noun.gender && !card.querySelector('.art.g-' + ({ m: 'm', f: 'f', n: 'n', 'm/f': 'mf' })[e.noun.gender]) && !card.querySelector('.pos').textContent.includes(' · ' + e.noun.gender)) why.push('no gender');
        if (e.noun && e.noun.plural && !(card.querySelector('.sum') && card.querySelector('.sum').textContent.includes(e.noun.plural))) why.push('no plural');
        if (e.verb && e.verb.aux && !card.querySelector('.aux')) why.push('no auxiliary');
        if (e.examples.length && card.querySelectorAll('.ex li').length === 0) why.push('no examples');
        if (card.querySelectorAll('.ex li').length) out.withEx++;
        const more = card.querySelector('[data-extra="forms"]');
        if (more) {
          more.click();
          const c2 = document.querySelector('.card[data-id="' + CSS.escape(e.id) + '"]');
          if (!c2.querySelector('.forms td')) why.push('forms table empty'); else out.formsOpened++;
        }
        const m = document.querySelector('.card[data-id="' + CSS.escape(e.id) + '"] [data-extra="more"]');
        m.click();
        if (!document.querySelector('.card[data-id="' + CSS.escape(e.id) + '"] .extra')) why.push('no background');
      }
      if (document.querySelectorAll('#cards .card:not(.empty)').length < 2) out.noTrans++;
      if (why.length) out.bad.push(e.id + ': ' + why.join(', '));
    }
    return out;
  });
  ok('offline: every German core entry opens a complete card', r.bad.length === 0, `${r.n} entries, ${r.formsOpened} tables of forms opened, ${r.withEx} with example sentences, ${r.noTrans} without any translation card` + (r.bad.length ? '; problems: ' + r.bad.slice(0, 10).join(' | ') : ''));

  // ---- typed lookups in every slot, offline
  const typed = await page.evaluate(async () => {
    const out = [];
    for (const [l, w] of [['de', 'Straße'], ['de', 'strasse'], ['en', 'house'], ['fr', 'maison'], ['pt', 'casa'], ['en', 'to go'], ['de', 'xyzzy']]) {
      const inp = document.querySelector('#in-' + l); inp.value = w; await window.FLT.translate(l, w);
      const s = window.FLT.state; out.push([l, w, s.status, s.entry ? s.entry.id : s.error.slice(0, 50), ['en', 'de', 'fr', 'pt'].map(x => document.querySelector('#in-' + x).value).join(' | ')]);
    }
    return out;
  });
  typed.forEach(t => ok('offline lookup ' + t[0] + ' "' + t[1] + '"', t[1] === 'xyzzy' ? t[2] === 'error' : t[2] === 'done', t.slice(2).join(' → ')));

  // ---- autocomplete
  const sug = await page.evaluate(() => { const i = document.querySelector('#in-de'); i.value = 'geh'; i.dispatchEvent(new Event('input')); return [...document.querySelectorAll('#sg-de li')].map(x => x.textContent); });
  ok('suggestions while typing', sug.length > 0, sug.join(', '));

  // ---- settings
  const st = await page.evaluate(async () => {
    const F = window.FLT, out = {};
    await F.translate('de', 'stehen');
    const sel = (id, v) => { const s = document.querySelector(id); s.value = v; s.dispatchEvent(new Event('change')); };
    const deCard = () => document.querySelector('#cards .card[data-id^="de:"]');
    sel('#var-de', 'ch'); out.ch_aux = deCard().textContent.includes('sein');
    await F.translate('de', 'Straße'); out.ch_ss = deCard().querySelector('.hw').textContent; out.ch_input = document.querySelector('#in-de').value;
    sel('#var-de', 'de');
    await F.translate('de', 'stehen'); out.de_aux = /\+haben/.test(deCard().textContent.replace(/\s+/g, ''));
    await F.translate('pt', 'rua'); const pc = () => document.querySelector('#cards .card[data-id^="pt:"]');
    out.pt_br = pc().querySelector('.ipa').textContent; sel('#var-pt', 'pt'); out.pt_pt = pc().querySelector('.ipa').textContent; sel('#var-pt', 'br');
    const chk = (id, v) => { const c = document.querySelector(id); c.checked = v; c.dispatchEvent(new Event('change')); };
    await F.translate('de', 'gehen');
    chk('#s-gsw', false); out.gsw_off = !deCard().textContent.includes('Swiss German'); chk('#s-gsw', true); out.gsw_on = deCard().textContent.includes('Swiss German');
    chk('#s-links', true); out.links_on = !!deCard().querySelector('.links a'); chk('#s-links', false); out.links_off = !deCard().querySelector('.links');
    await F.translate('de', 'stehen');
    F.S.compact = false; F.render(false); chk('#s-variants', false); out.var_off = !deCard().textContent.includes('Variants'); chk('#s-variants', true); out.var_on = deCard().textContent.includes('Variants'); F.S.compact = true; F.render(false);
    await F.translate('de', 'Haus');
    sel('#s-examples', '4'); out.ex4 = deCard().querySelectorAll('.ex li').length; sel('#s-examples', '2'); out.ex2 = deCard().querySelectorAll('.ex li').length;
    sel('#s-level', 'easy'); const e1 = deCard().querySelector('.ex li').textContent; sel('#s-level', 'advanced'); const e2 = deCard().querySelector('.ex li').textContent; out.level_changes = e1 !== e2; sel('#s-level', 'medium');
    sel('#s-sugg', '5'); const i = document.querySelector('#in-de'); i.value = 'a'; i.dispatchEvent(new Event('input')); out.sugg5 = document.querySelectorAll('#sg-de li').length;
    chk('#s-slow', true); out.slow = window.FLT.S.slow; chk('#s-slow', false);
    out.sources = !!document.querySelector('#sources') && document.querySelector('#sources').textContent.includes('CC BY-SA 4.0');
    await F.translate('de', 'gehen'); deCard().querySelector('[data-extra="forms"]').click(); out.red = [...deCard().querySelectorAll('.forms td.irr')].map(x => x.textContent).slice(0, 6).join(', ');
    return out;
  });
  ok('setting: Swiss variant shows sein for stehen', st.ch_aux && st.de_aux, 'CH sein / DE haben');
  ok('setting: Swiss variant writes ss', st.ch_ss.includes('Strasse') && st.ch_input === 'Strasse', st.ch_ss + ', input ' + st.ch_input);
  ok('setting: Portuguese main variant', st.pt_br !== st.pt_pt, 'BR ' + st.pt_br + ' / PT ' + st.pt_pt);
  ok('setting: Swiss German on/off', st.gsw_off && st.gsw_on);
  ok('setting: Wiktionary links on/off', st.links_on && st.links_off);
  ok('setting: other regions on/off', st.var_off && st.var_on);
  ok('setting: number of context sentences', st.ex4 === 4 && st.ex2 === 2, st.ex4 + ' / ' + st.ex2);
  ok('setting: sentence difficulty', st.level_changes);
  ok('setting: number of suggestions', st.sugg5 === 5, String(st.sugg5));
  ok('setting: slow speech', st.slow === true);
  ok('Sources & licences section', st.sources);
  ok('irregular forms shown in red (gehen)', !!st.red, st.red);
  const fontsOk = await page.evaluate(async () => { await document.fonts.ready; return ['IBM Plex Sans', 'IBM Plex Mono', 'Newsreader'].map(f => document.fonts.check('16px "' + f + '"')); });
  ok('offline: the app\'s own fonts are in use', fontsOk.every(Boolean), fontsOk.join(', '));
  ok('no request to any other website', outside.length === 0, outside.slice(0, 3).join(' | '));
  // clear local data, then reload offline: must fail gracefully, then online again restores
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  let fail = 0;
  for (const [n, p, i] of results) { if (!p) fail++; console.log((p ? 'PASS ' : 'FAIL ') + n + (i ? '  (' + i + ')' : '')); }
  console.log(fail ? `RESULT: ${fail} FAILED` : 'RESULT: ALL PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
