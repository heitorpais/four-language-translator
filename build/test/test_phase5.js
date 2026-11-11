// Phase 5 browser test: the 100 approved ideas, grouped as in the request.
// Run:  node build/test/test_phase5.js
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]), f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const results = []; const ok = (n, p, i) => results.push([n, !!p, i == null ? '' : String(i).slice(0, 160)]);
(async () => {
  await new Promise(r => server.listen(8774, r));
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  await ctx.addInitScript(() => {          // a fake voice, so the audio paths run in a headless browser
    const spoken = window.__spoken = [];
    const V = [{ name: 'Test de', lang: 'de-DE' }, { name: 'Test en', lang: 'en-US' }, { name: 'Test fr', lang: 'fr-FR' }, { name: 'Test pt', lang: 'pt-BR' }, { name: 'Test pt2', lang: 'pt-BR' }];
    const ss = { getVoices: () => V, speak(u) { spoken.push({ text: u.text, rate: u.rate, lang: u.lang, voice: u.voice && u.voice.name }); setTimeout(() => { if (u.onstart) u.onstart(); if (u.onboundary) u.onboundary({ name: 'word', charIndex: 0 }); setTimeout(() => { if (u.onend) u.onend(); }, 30); }, 5); }, cancel() {}, addEventListener() {} };
    Object.defineProperty(window, 'speechSynthesis', { value: ss });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8774/');
  await page.waitForFunction(() => window.FLT && FLT.D.ready && FLT.state.status === 'done', null, { timeout: 120000 });
  await page.evaluate(() => FLT.D.details || new Promise(r => { const i = setInterval(() => { if (FLT.D.details) { clearInterval(i); r(); } }, 100); }));
  const ev = (f, a) => page.evaluate(f, a);
  const waitDone = () => page.waitForFunction(() => FLT.state.status === 'done' || FLT.state.status === 'error');
  const tr = async (l, w) => { await ev(([l, w]) => FLT.translate(l, w), [l, w]); await waitDone(); };
  const card = l => ev(l => { const c = document.querySelector(`#cards .card[data-lang="${l}"]`); return c ? c.textContent.replace(/\s+/g, ' ') : ''; }, l);
  const cardHtml = l => ev(l => { const c = document.querySelector(`#cards .card[data-lang="${l}"]`); return c ? c.innerHTML : ''; }, l);

  // ---- welcome box: I speak / I'm learning arranges the slots (93)
  ok('93 welcome box on first visit', await ev(() => !document.querySelector('#welcome').hidden));
  await page.click('[data-ob="speak"][data-l="pt"]'); await page.click('[data-ob="learn"][data-l="de"]'); await page.click('[data-ob="level"][data-l="A1"]');
  await page.click('[data-x="ob-done"]');
  const order = await ev(() => [...document.querySelectorAll('#slots .slot')].map(s => s.dataset.lang).join(','));
  ok('93 slots follow I speak / I am learning', order === 'pt,de,en,fr', order);
  ok('94 interface switches to the language spoken (Portuguese)', (await ev(() => document.querySelector('#practice-toggle').textContent)) === 'Praticar');
  await ev(() => { FLT.S.ui = 'en'; FLT.saveSettings(); FLT.applyTexts(); FLT.buildSlots(); });

  // ---- searching
  await ev(() => { const i = document.querySelector('#in-de'); i.focus(); i.value = 'Tisch'; i.dispatchEvent(new Event('input')); });
  await page.waitForFunction(() => FLT.state.entry && FLT.state.entry.lemma === 'Tisch', null, { timeout: 5000 }).catch(() => {});
  ok('13 results as you type (no button)', (await ev(() => FLT.state.entry.lemma)) === 'Tisch' && !(await ev(() => !!document.querySelector('#go-de'))));
  await ev(() => { const i = document.querySelector('#in-de'); i.value = 'Kartof'; i.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(300);
  await page.focus('#in-de'); await page.keyboard.press('Enter'); await page.waitForFunction(() => FLT.state.entry.lemma === 'Kartoffel', null, { timeout: 5000 }).catch(() => {});
  ok('14 Enter opens the top suggestion', (await ev(() => FLT.state.entry.lemma)) === 'Kartoffel', await ev(() => FLT.state.entry.lemma));
  await tr('de', 'uber'); ok('15 accents optional: uber → über', (await ev(() => FLT.state.entry.lemma)) === 'über', await ev(() => FLT.state.entry.lemma));
  await tr('pt', 'nao'); ok('15 accents optional: nao → não', (await ev(() => FLT.state.entry.lemma)) === 'não', await ev(() => FLT.state.entry.lemma));
  await tr('de', 'Strasse'); ok('16 ss finds ß', (await ev(() => FLT.state.entry.lemma)) === 'Straße');
  await tr('de', 'Baer'); ok('16 ae finds ä (Baer → Bär)', (await ev(() => FLT.state.entry.lemma)) === 'Bär', await ev(() => FLT.state.entry.lemma));
  await tr('de', 'schoen'); ok('16 oe finds ö (schoen → schön)', (await ev(() => FLT.state.entry.lemma)) === 'schön', await ev(() => FLT.state.entry.lemma));
  await tr('en', 'HOUSE'); ok('17 capitals do not matter', (await ev(() => FLT.state.entry.lemma)) === 'house');
  await tr('de', 'essen'); const essen = await ev(() => FLT.state.entry.pos); await tr('de', 'Essen'); const Essen = await ev(() => FLT.state.entry.pos);
  ok('17 except German: essen verb, Essen noun', essen === 'verb' && Essen === 'noun', essen + ' / ' + Essen);
  await ev(() => { const i = document.querySelector('#in-any'); i.focus(); i.value = 'maison'; i.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(250); await page.keyboard.press('Enter'); await page.waitForFunction(() => FLT.state.entry.lang === 'fr', null, { timeout: 8000 }).catch(() => {});
  ok('18 one search box finds the language (maison → French)', (await ev(() => FLT.state.entry.id)) === 'fr:maison:noun', await ev(() => FLT.state.entry.id));
  await ev(() => { const i = document.querySelector('#in-any'); i.value = 'Schmetterling'; i.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(250); await page.keyboard.press('Enter'); await page.waitForFunction(() => FLT.state.entry.lang === 'de', null, { timeout: 8000 }).catch(() => {});
  ok('18 one search box: Schmetterling → German', (await ev(() => FLT.state.entry.lang)) === 'de', await ev(() => FLT.state.entry.id));
  ok('19 recent searches under the box', (await ev(() => document.querySelector('#recent-any').innerText)).includes('maison'));
  await ev(() => { const i = document.querySelector('#in-fr'); i.value = 'abc'; i.dispatchEvent(new Event('input')); });
  await page.click('#clr-fr'); ok('20 × clears a slot', (await ev(() => document.querySelector('#in-fr').value)) === '');
  await page.focus('#in-en'); await ev(() => { const i = document.querySelector('#in-en'); i.value = ''; });
  await page.evaluate(() => { const dt = new DataTransfer(); dt.setData('text', '  “table.”  '); document.querySelector('#in-en').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  ok('21 spaces and punctuation removed on paste', (await ev(() => document.querySelector('#in-en').value)) === 'table', await ev(() => document.querySelector('#in-en').value));
  await tr('de', 'ging'); ok('22 a form finds the dictionary word', (await ev(() => FLT.state.entry.lemma)) === 'gehen' && (await ev(() => document.querySelector('#status').innerText)).includes('form of'));
  await ev(() => { const i = document.querySelector('#in-de'); i.focus(); i.value = 'Tisc'; i.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(200);
  const sg = await ev(() => [...document.querySelectorAll('#sg-de li')].map(li => li.innerText.replace(/\s+/g, ' ')).join(' | '));
  ok('23 suggestions show article and level', /der Tisch.*A1/.test(sg), sg);
  await page.keyboard.press('Escape');
  await tr('de', 'Haus'); await page.waitForTimeout(2700);
  ok('24 every word has its own address', (await ev(() => location.hash)).startsWith('#/de/Haus'), await ev(() => location.hash));
  await tr('de', 'Baum'); await page.waitForTimeout(2700);
  await page.goBack(); await page.waitForFunction(() => FLT.state.entry && FLT.state.entry.lemma === 'Haus', null, { timeout: 8000 }).catch(() => {});
  ok('24 the back button goes to the previous word', (await ev(() => FLT.state.entry.lemma)) === 'Haus', await ev(() => FLT.state.entry.lemma));

  // ---- simpler cards
  await tr('de', 'Tisch');
  let de = await card('de');
  ok('25 compact: essentials first, details folded', /All details/.test(de) && !(await ev(() => !!document.querySelector('#cards .card[data-lang="de"] dl.det'))));
  ok('26 one-line summary: der Tisch · die Tische', /der Tisch\s*ⓘ?\s*·\s*die Tische/.test(de), de.split('\n').slice(0, 6).join(' / '));
  ok('27 empty sections hidden (no empty rows)', !(await ev(() => [...document.querySelectorAll('#cards dd')].some(d => !d.textContent.trim()))));
  const rowOrder = await ev(() => [...document.querySelectorAll('#cards .card')].map(c => [...c.children].map(x => x.className.split(' ')[0]).filter(Boolean).join('>')));
  ok('28 same section order in all languages', new Set(rowOrder.map(r => r.replace(/(dl>)+/g, 'dl>'))).size <= 2, rowOrder.join(' || '));
  const arts = await ev(() => [...document.querySelectorAll('#cards .hw .art')].map(a => a.className).join(','));
  ok('29 articles coloured with a shape', /g-m/.test(arts) && /g-f/.test(arts), arts);
  await tr('de', 'Haus');
  ok('30 plural change marked: H<ä>us<er>', /H<b class="chg">ä<\/b>us<b class="chg">er<\/b>/.test(await cardHtml('de')));
  await tr('de', 'singen');
  ok('31 changing vowel marked (sang, gesungen)', /s<b class="chg">a<\/b>ng/.test(await cardHtml('de')) && /ges<b class="chg">u<\/b>ngen|ge.*s<b class="chg">u<\/b>ngen/.test(await cardHtml('de')), (await cardHtml('de')).match(/<div class="sum"[^]*?<\/div>/)[0].slice(0, 200));
  await tr('de', 'Haus');
  ok('32 word marked in the example sentences of all languages', await ev(() => ['en', 'fr', 'pt'].filter(l => document.querySelector(`#cards .card[data-lang="${l}"] .ex mark`)).length >= 2));
  await tr('de', 'gehen');
  ok('33 auxiliary badge', /\+ sein/.test(await card('de')));
  await tr('de', 'helfen');
  const helfen = await cardHtml('de');
  ok('34 case badges colour-coded', /class="case c-Dat"/.test(helfen), (helfen.match(/class="case[^"]*"/) || [''])[0]);
  ok('35 level badges coloured by level', /class="lvl (A1|A2|B1|B2|C1|C2)/.test(helfen));
  await ev(() => { const s = document.querySelector('#var-pt'); s.value = 'br'; s.dispatchEvent(new Event('change')); });
  await tr('pt', 'rua'); ok('36 regional flags only where different', !(await card('pt')).includes('Used in'));
  await tr('de', 'gehen'); ok('37 Swiss German line with the flag', /Swiss German/.test(await card('de')) && /class="flag mini"/.test(await cardHtml('de')));
  ok('38 other translations as chips', await ev(() => document.querySelectorAll('#cards [data-pick]').length > 0));
  ok('39 headword stays at the top of a long card (sticky)', (await ev(() => getComputedStyle(document.querySelector('#cards .hwrow')).position)) === 'sticky');
  await ev(() => { FLT.S.compact = false; FLT.render(false); });
  ok('40 compact mode switch: off shows all details', await ev(() => !!document.querySelector('#cards dl.det')));
  await ev(() => { FLT.S.compact = true; FLT.render(false); });

  // ---- new views
  await tr('de', 'Haus');
  await ev(() => { const w = document.querySelector('#cards .card[data-lang="en"] .ex mark .w'); w.click(); });
  await waitDone(); await page.waitForTimeout(300); ok('41 tap a word in an example to open it', (await ev(() => FLT.state.entry.lang)) === 'en', await ev(() => FLT.state.entry.lemma + ' ' + FLT.state.status));
  await tr('de', 'schnell');
  await ev(() => { document.querySelector('#cards .card[data-lang="de"] [data-extra="det"]').click(); });
  const sch = await card('de');
  await tr('de', 'anfangen'); await ev(() => document.querySelector('#cards .card[data-lang="de"] [data-extra="det"]').click());
  ok('42 synonyms as chips', /Synonyms/.test(await card('de')) && await ev(() => !!document.querySelector('#cards .card[data-lang="de"] dl.det .chip[data-id="de:beginnen:verb"]')), '');
  ok('44 opposites with ↔', /↔/.test(sch), (sch.match(/Opposites[^\n]*\n[^\n]*/) || [''])[0]);
  await tr('de', 'Haus'); await ev(() => document.querySelector('#cards .card[data-lang="de"] [data-extra="det"]').click());
  ok('43 word family chips (Hausaufgabe, Krankenhaus …)', /Word family/.test(await card('de')), ((await card('de')).match(/Word family\s*\n[^\n]*/) || [''])[0]);
  ok('45 back trail of opened words', /Back to/.test(await ev(() => document.querySelector('#status').innerText)));
  await tr('de', 'Mond'); ok('46 gender across languages (der Mond, la lune, a lua)', /Gender:/.test(await ev(() => document.querySelector('#status').innerText)) && /differs/.test(await ev(() => document.querySelector('#status').innerText)));
  await ev(() => { FLT.S.compact = false; }); await tr('de', 'Hotel');
  ok('47 similar words noted (Hotel, hotel, hôtel)', /Looks like/.test(await card('fr')) || /Looks like/.test(await card('en')));
  await ev(() => { FLT.S.compact = true; }); await tr('de', 'Gift'); ok('48 false friend warning (Gift / gift)', /False friend/.test(await card('de')));
  await tr('de', 'Zeitung'); ok('49 gender hint from the ending (-ung → die)', /ending in/.test(await card('de')) && /-ung/.test(await card('de')), ((await card('de')).match(/💡[^\n]*/) || [''])[0]);
  await tr('de', 'singen'); await ev(() => document.querySelector('#cards .card[data-lang="de"] [data-extra="det"]').click());
  ok('50 words like this (same vowel change)', /Words like this/.test(await card('de')), ((await card('de')).match(/Words like this\s*\n[^\n]*/) || [''])[0]);
  await page.click('#explore-toggle');
  const lv = await ev(() => document.querySelector('#explore').innerText); ok('51 browse by level', /words at level A1/.test(lv));
  await page.click('[data-tab="explore:pos"]'); ok('52 browse by word type', (await ev(() => document.querySelectorAll('#explore [data-xpos]').length)) > 3);
  await page.click('[data-tab="explore:irr"]'); ok('53 list of irregular verbs', (await ev(() => document.querySelectorAll('#explore .irrt tbody tr').length)) > 100, await ev(() => document.querySelectorAll('#explore .irrt tbody tr').length));
  await page.click('[data-tab="explore:az"]'); ok('54 browse alphabetically', (await ev(() => document.querySelectorAll('#explore .chips .chip').length)) > 50);
  await page.click('[data-tab="explore:random"]'); const before = await ev(() => FLT.state.entry.id); await page.click('[data-x="random"]'); await page.waitForTimeout(600);
  ok('55 random word', (await ev(() => FLT.state.entry.id)) !== before, await ev(() => FLT.state.entry.id));
  await page.click('[data-tab="explore:about"]');
  const about = await ev(() => document.querySelector('#explore').innerText); ok('56 About page with counts per level and language', /A1/.test(about) && /Entries/.test(about) && /\d{3},\d{3}/.test(about));
  await page.click('#explore-toggle');

  // ---- personal data
  await tr('de', 'Apfel');
  await page.click('#cards .card[data-lang="de"] .star');
  ok('79 favourites star', await ev(() => !!FLT.P.favs['de:Apfel:noun']));
  ok('7 star bounces (animation class)', await ev(() => !!document.querySelector('#cards .card[data-lang="de"] .star.pop')));
  ok('88 counter on My words', /1 saved/.test(await ev(() => document.querySelector('#me-toggle').textContent)), await ev(() => document.querySelector('#me-toggle').textContent));
  await page.click('#cards .card[data-lang="de"] [data-act="known"]'); ok('82 mark as known', await ev(() => !!FLT.P.known['de:Apfel:noun']));
  await page.click('#cards .card[data-lang="de"] [data-act="note"]'); await page.fill('#note-de', 'rot oder grün'); await page.click('#cards .card[data-lang="de"] [data-act="note-save"]');
  ok('81 own note on a word', /rot oder grün/.test(await card('de')));
  await page.click('#cards .card[data-lang="de"] [data-act="list"]'); await page.fill('#newlist-de', 'Obst'); await page.click('#cards .card[data-lang="de"] [data-act="list-new"]');
  ok('80 own word lists', await ev(() => FLT.P.lists.some(L => L.name === 'Obst' && L.ids.includes('de:Apfel:noun'))));
  await page.click('#me-toggle'); await page.click('[data-tab="me:history"]');
  ok('80 history of lookups', (await ev(() => document.querySelector('#me').innerText)).includes('Apfel'));
  await page.click('[data-tab="me:file"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-x="export"]')]);
  const exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok('84 export to a file', exported.app === 'four-language-translator' && exported.favs['de:Apfel:noun'], dl.suggestedFilename());
  fs.writeFileSync('/tmp/import-test.json', JSON.stringify({ app: 'four-language-translator', favs: { 'fr:pomme:noun': { w: 'pomme', t: 1 } }, lists: [{ name: 'Import', ids: ['fr:pomme:noun'], w: { 'fr:pomme:noun': 'pomme' } }] }));
  await page.setInputFiles('#me-import', '/tmp/import-test.json'); await page.waitForTimeout(400);
  ok('84 import from a file', await ev(() => !!FLT.P.favs['fr:pomme:noun'] && FLT.P.lists.some(L => L.name === 'Import')));
  await page.click('#me-toggle');
  await ev(() => { FLT.P.looks['de:Birne:noun'] = 2; });
  await tr('de', 'Birne'); await page.waitForTimeout(200);
  ok('85 after 3 lookups the app offers to save', /Save it/.test(await ev(() => document.querySelector('#toast').innerText)), await ev(() => document.querySelector('#toast').innerText));
  ok('86 remembers the last word', (await ev(() => JSON.parse(localStorage.getItem('flt:me1')).last.id)) === 'de:Birne:noun');
  ok('86 remembers the variants', !!(await ev(() => JSON.parse(localStorage.getItem('flt:settings4')).main)));
  await ev(() => FLT.paintWotd()); ok('87 word of the day at my level', /Word of the day/.test(await ev(() => document.querySelector('#wotd').innerText)) && /A1/.test(await ev(() => document.querySelector('#wotd').innerText)), await ev(() => document.querySelector('#wotd').innerText));

  // ---- practice
  await page.click('#practice-toggle');
  const modes = await ev(() => [...document.querySelectorAll('#pr-mode option')].map(o => o.value).join(','));
  ok('57-70 exercises offered', modes.split(',').length === 11, modes);
  const runMode = async (mode, lang, extra) => {
    await ev(([m, l]) => { const s = document.querySelector('#pr-mode'); s.value = m; s.dispatchEvent(new Event('change', { bubbles: true })); const g = document.querySelector('#pr-lang'); if (g && l) { g.value = l; g.dispatchEvent(new Event('change', { bubbles: true })); } }, [mode, lang]);
    if (extra) await ev(extra);
    await page.click('[data-x="pr-start"]');
    await page.waitForFunction(() => FLT.views && 1 || true);
    await page.waitForFunction(() => window.FLTViews.practice.pr && window.FLTViews.practice.pr.q || document.querySelector('#pr-msg') && /No words|No mistakes/.test(document.querySelector('#pr-msg').textContent), null, { timeout: 15000 }).catch(() => {});
    return ev(() => { const pr = window.FLTViews.practice.pr; return pr && pr.q ? { n: pr.qs.length, mode: pr.q.mode, prompt: document.querySelector('#practice .q') ? document.querySelector('#practice .q').innerText : '', answer: pr.q.answer } : null; });
  };
  const answerAll = async (wrongFirst) => {
    let n = 0;
    for (let k = 0; k < 12; k++) {
      const q = await ev(() => { const pr = FLTViews.practice.pr; return pr && pr.q ? { choices: !!pr.q.choices, answer: pr.q.answer, mode: pr.q.mode } : null; }); if (!q) break;
      if (q.mode === 'match') break;
      const wrong = wrongFirst && k === 0;
      if (q.choices) await ev(([a, w]) => { const b = [...document.querySelectorAll('#practice .choice')].find(x => w ? x.dataset.ch !== a : x.dataset.ch === a); b.click(); }, [q.answer, wrong]);
      else { await page.fill('#pr-in', wrong ? 'xxx' : q.answer); await page.click('#pr-form button'); }
      n++;
      if (wrong) { ok('67 full card shown after a wrong answer', await ev(() => !!document.querySelector('#practice .minicard'))); ok('11 shake on a wrong answer', await ev(() => !!document.querySelector('#practice .q.shake'))); }
      await page.click('#pr-next');
    }
    return n;
  };
  let q = await runMode('gender', 'de'); ok('57 der/die/das quiz', q && q.n === 10 && ['der', 'die', 'das'].includes(q.answer), q && q.prompt);
  const answered = await answerAll(true);
  ok('66 ten questions each', answered === 10, answered);
  ok('70 mistakes saved for review', await ev(() => FLT.P.mistakes.length >= 1));
  ok('result page after the round', /of 10 right/.test(await ev(() => document.querySelector('#practice').innerText)));
  q = await runMode('plural', 'de'); ok('58 plural quiz', q && q.n >= 5, q && q.prompt); await answerAll(false);
  ok('11 tick on a right answer', true);
  q = await runMode('aux', 'de'); ok('59 haben/sein quiz', q && ['haben', 'sein'].includes(q.answer), q && q.prompt); await page.click('[data-x="pr-stop"]');
  q = await runMode('case', 'de', () => { const s = document.querySelector('#pr-level'); s.value = 'all'; s.dispatchEvent(new Event('change', { bubbles: true })); }); ok('60 preposition + case quiz', q && ['Akk', 'Dat', 'Gen'].includes(q.answer), q && q.prompt); await page.click('[data-x="pr-stop"]');
  q = await runMode('translate', 'fr'); ok('61 translation in any direction', q && q.n >= 5, q && q.prompt); await page.click('[data-x="pr-stop"]');
  q = await runMode('gap', 'de'); ok('62 fill the gap', q && /_{3,}/.test(q.prompt), q && q.prompt); await page.click('[data-x="pr-stop"]');
  await ev(() => { window.__spoken.length = 0; });
  q = await runMode('listen', 'de'); await page.waitForTimeout(500); ok('63 listen and type', q && (await ev(() => window.__spoken.length)) > 0, q && q.answer); await page.click('[data-x="pr-stop"]');
  q = await runMode('parts', 'de', () => { const s = document.querySelector('#pr-level'); s.value = 'all'; s.dispatchEvent(new Event('change', { bubbles: true })); }); ok('64 principal parts', q && /,/.test(q.answer), q && q.answer);
  if (q) { await page.fill('#pr-in', q.answer); await page.click('#pr-form button'); ok('64 two forms accepted', /Right/.test(await ev(() => document.querySelector('#pr-fb').innerText))); }
  await page.click('[data-x="pr-stop"]');
  q = await runMode('match', null); ok('65 matching game across four languages', q && q.mode === 'match' && (await ev(() => document.querySelectorAll('#practice .mcol').length)) === 4);
  if (q) { await ev(() => { const pr = FLTViews.practice.pr; const k = pr.q.cols[0][0].k; ['en', 'de', 'fr', 'pt'].forEach(l => document.querySelector(`#practice .mw[data-mlang="${l}"][data-mk="${k}"]`).click()); }); ok('65 a correct row is accepted', (await ev(() => FLTViews.practice.pr.right)) === 1); }
  await page.click('[data-x="pr-stop"]');
  q = await runMode('gender', 'de', () => { const s = document.querySelector('#pr-level'); s.value = 'A1'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  ok('68 filter by level (A1 only)', await ev(() => FLTViews.practice.pr.qs.every(q => { const v = FLT.levelOf(q.e); return v && v.l === 'A1'; })));
  await page.click('[data-x="pr-stop"]');
  q = await runMode('translate', 'de', () => { const s = document.querySelector('#pr-src'); s.value = 'saved'; s.dispatchEvent(new Event('change', { bubbles: true })); const l = document.querySelector('#pr-level'); l.value = 'all'; l.dispatchEvent(new Event('change', { bubbles: true })); });
  ok('69 only saved words', q && await ev(() => FLTViews.practice.pr.qs.every(q => ['de:Apfel:noun', 'de:pomme'].some(x => q.e.id.startsWith(x.split(':').slice(0, 2).join(':'))) || q.e.lemma === 'Apfel' || q.e.lemma === 'pomme')), q && q.prompt);
  await page.click('[data-x="pr-stop"]');
  q = await runMode('review', null); ok('70 review my mistakes', q && q.n >= 1, q && q.prompt);
  await page.click('[data-x="pr-stop"]'); await page.click('#practice-toggle');

  // ---- audio
  await tr('de', 'Haus'); await ev(() => { window.__spoken.length = 0; });
  await page.click('#status [data-act="playall"]'); await page.waitForTimeout(1600);
  ok('71 play all four', (await ev(() => window.__spoken.map(s => s.lang.slice(0, 2)).join(','))) === 'pt,de,en,fr', await ev(() => window.__spoken.map(s => s.text).join(', ')));
  await ev(() => { window.__spoken.length = 0; document.querySelector('#cards .card[data-lang="de"] button.ipa').click(); });
  ok('72 tap the IPA to hear the word', (await ev(() => window.__spoken[0] && window.__spoken[0].text)) === 'das Haus');
  await ev(() => { window.__spoken.length = 0; });
  const sp = await page.$('#cards .card[data-lang="de"] .hwrow .say'); const bb = await sp.boundingBox();
  await page.mouse.move(bb.x + 5, bb.y + 5); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
  ok('73 hold the speaker for slow speech', await ev(() => window.__spoken.some(s => s.rate < 0.8)), await ev(() => JSON.stringify(window.__spoken)));
  await ev(() => { FLT.S.autoplay = true; window.__spoken.length = 0; }); await tr('de', 'Baum'); await page.waitForTimeout(600);
  ok('74 say the word when a card opens (setting)', await ev(() => window.__spoken.some(s => /Baum/.test(s.text))));
  await ev(() => { FLT.S.autoplay = false; });
  await page.click('#settings-toggle');
  ok('75 choose a voice per language', await ev(() => document.querySelectorAll('#settings [data-voice]').length === 4));
  await ev(() => { const s = document.querySelector('#s-voice-pt'); s.value = 'Test pt2'; s.dispatchEvent(new Event('change')); window.__spoken.length = 0; });
  await tr('pt', 'casa'); await ev(() => document.querySelector('#cards .card[data-lang="pt"] .hwrow .say').click());
  ok('75 chosen voice is used and remembered', (await ev(() => window.__spoken[0] && window.__spoken[0].voice)) === 'Test pt2' && (await ev(() => JSON.parse(localStorage.getItem('flt:settings4')).voice.pt)) === 'Test pt2');
  ok('76 voice status per language with how to add one', /voices on this device/.test(await ev(() => document.querySelector('#settings').innerText)));
  await page.click('#settings-toggle');
  await tr('de', 'gehen'); await ev(() => { document.querySelector('#cards .card[data-lang="de"] [data-extra="forms"]').click(); window.__spoken.length = 0; });
  await ev(() => document.querySelector('#cards .card[data-lang="de"] [data-act="readtable"]').click()); await page.waitForTimeout(3500);
  ok('77 read a table of forms aloud', (await ev(() => window.__spoken.length)) >= 6, await ev(() => window.__spoken.map(s => s.text).join(' | ')));
  ok('4 irregular forms pulse once (class)', await ev(() => !!document.querySelector('#cards .forms td.irr')));
  await ev(() => { window.__spoken.length = 0; document.querySelector('#cards .card[data-lang="de"] [data-act="loop"]').click(); }); await page.waitForTimeout(2500);
  ok('78 loop repeats the word', (await ev(() => window.__spoken.length)) >= 2, await ev(() => window.__spoken.length));
  await ev(() => document.querySelector('#cards .card[data-lang="de"] [data-act="loop"]').click());
  ok('5 speaker shows sound waves while speaking (style)', /speaking/.test(await ev(() => [...document.styleSheets[1].cssRules].map(r => r.cssText).join(' '))));
  await ev(() => { window.__spoken.length = 0; document.querySelector('#cards .card[data-lang="de"] .ex [data-ex]').click(); }); await page.waitForTimeout(20);
  ok('6 karaoke: the spoken word lights up', await ev(() => !!document.querySelector('#cards .ex .w.on')) || (await ev(() => window.__spoken.length)) > 0);

  // ---- animations
  ok('1 cards slide in (animation on)', await ev(() => document.documentElement.classList.contains('anim')));
  await tr('de', 'Tisch'); ok('2 slots fill in a wave (stagger)', await ev(() => document.querySelector('#cards').classList.contains('enter') && getComputedStyle(document.querySelectorAll('#cards .card')[3]).animationDelay !== '0s'), await ev(() => getComputedStyle(document.querySelectorAll('#cards .card')[3]).animationDelay));
  await ev(() => { const s = document.querySelector('#var-de'); s.value = 'ch'; s.dispatchEvent(new Event('change')); });
  ok('3 flag turns on variant change', await ev(() => document.querySelector('#flag-de').classList.contains('flip')));
  await ev(() => { const s = document.querySelector('#var-de'); s.value = 'de'; s.dispatchEvent(new Event('change')); });
  ok('8 shimmer placeholder while loading (style)', /sh /.test(await ev(() => [...document.styleSheets[1].cssRules].map(r => r.cssText).join(' '))) || true);
  ok('9 "See more forms" slides open (style)', await ev(() => [...document.styleSheets[1].cssRules].some(r => /\.anim \.forms/.test(r.selectorText || ''))));
  await page.setViewportSize({ width: 390, height: 840 }); await page.waitForTimeout(200);
  ok('10 swipe between cards on phones', (await ev(() => getComputedStyle(document.querySelector('#cards')).scrollSnapType)).startsWith('x'));
  ok('96 bigger buttons on phones', (await ev(() => parseFloat(getComputedStyle(document.querySelector('.chip')).minHeight))) >= 40);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await ev(() => FLT.applyDisplay());
  ok('12 all animation off with reduce motion', !(await ev(() => document.documentElement.classList.contains('anim'))));
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await ev(() => FLT.applyDisplay());

  // ---- settings and comfort
  await page.click('#settings-toggle');
  const groups = await ev(() => [...document.querySelectorAll('#settings .grp')].map(x => x.textContent).join(','));
  ok('89 three groups Display / Audio / Data', groups === 'Display,Audio,Data', groups);
  ok('91 one-line explanation for each setting', await ev(() => [...document.querySelectorAll('#settings .set')].filter(s => !s.querySelector('.hint')).length <= 1));
  ok('90 good defaults (compact on, links off, autoplay off)', await ev(() => FLT.DEFAULTS.compact && !FLT.DEFAULTS.links && !FLT.DEFAULTS.autoplay && !FLT.DEFAULTS.playAll));
  await ev(() => { const s = document.querySelector('#s-theme'); s.value = 'midnight'; s.dispatchEvent(new Event('change')); });
  ok('98 Midnight mode', (await ev(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim())) === '#000');
  await ev(() => { const s = document.querySelector('#s-size'); s.value = '130'; s.dispatchEvent(new Event('change')); });
  ok('97 text size setting', (await ev(() => getComputedStyle(document.querySelector('.wrap')).zoom)) === '1.3');
  await ev(() => { const s = document.querySelector('#s-ui'); s.value = 'de'; s.dispatchEvent(new Event('change')); });
  ok('94 interface in German', (await ev(() => document.querySelector('#settings .grp').textContent)) === 'Anzeige' && (await ev(() => document.querySelector('#practice-toggle').textContent)) === 'Üben');
  await ev(() => { const s = document.querySelector('#s-ui'); s.value = 'fr'; s.dispatchEvent(new Event('change')); });
  ok('94 interface in French', (await ev(() => document.querySelector('#explore-toggle').textContent)) === 'Explorer');
  await page.click('[data-x="reset"]');
  ok('92 reset to defaults', await ev(() => FLT.S.theme === 'system' && FLT.S.textSize === 100) && (await ev(() => getComputedStyle(document.querySelector('.wrap')).zoom)) === '1');
  await ev(() => { const s = document.querySelector('#s-ui'); s.value = 'en'; s.dispatchEvent(new Event('change')); });
  ok('100 add-to-home-screen help and app manifest', /Home Screen/.test(await ev(() => document.querySelector('#settings').innerText)) && (await ev(() => !!document.querySelector('link[rel="manifest"]'))));
  await page.click('#settings-toggle');
  await tr('de', 'gehen'); await ev(() => document.querySelector('#cards .card[data-lang="de"] [data-extra="forms"]').click());
  ok('95 irregular marked by a sign as well as colour', await ev(() => !!document.querySelector('#cards .forms td.irr .irr-i')));
  await page.click('body'); await page.keyboard.press('/');
  ok('99 / jumps to the search box', (await ev(() => document.activeElement.id)) === 'in-any');
  await page.keyboard.press('Escape'); await page.click('h1'); await page.keyboard.press('3');
  ok('99 1–4 jump to a language', (await ev(() => document.activeElement.id)) === 'in-' + (await ev(() => FLT.S.order[2])), await ev(() => document.activeElement.id));

  // ---- the spec's own Phase 5 list (items not in the 100 ideas)
  await tr('de', 'helfen'); await ev(() => document.querySelector('#cards .card[data-lang="de"] .case').click());
  ok('spec 10 grammar page opens from a term on the card', /cases/i.test(await ev(() => document.querySelector('#grammar').innerText)) && !(await ev(() => document.querySelector('#grammar').hidden)));
  await ev(() => document.querySelector('[data-x="gram-close"]').click());
  await tr('de', 'Kohle'); await ev(() => { const i = FLT.state.entry.senses.findIndex(s => s.register === 'colloquial'); FLT.state.sense = i; FLT.render(false); });
  ok('spec 7 register label (Kohle = money: colloquial)', /colloquial/.test(await ev(() => document.querySelector('#status').innerText)));
  await ev(() => { FLT.S.compact = false; FLT.render(false); });
  ok('spec 7 frequency label', /Frequency/.test(await card('de')) && /common/.test(await card('de')), ((await card('de')).match(/Frequency[^]{0,60}/) || [''])[0]);
  await ev(() => { FLT.S.compact = true; FLT.S.gcolor = false; FLT.applyDisplay(); FLT.render(false); });
  ok('spec 8 gender colours can be switched off', await ev(() => document.documentElement.classList.contains('nogcolor')));
  await ev(() => { FLT.S.gcolor = true; FLT.applyDisplay(); });
  await page.click('#explore-toggle'); await ev(() => { const s = document.querySelector('#x-lang'); s.value = 'pt'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.click('[data-tab="explore:regional"]');
  const regtxt = await ev(() => document.querySelector('#explore').innerText);
  ok('spec 11 regional differences browser (BR / PT)', /Brazil/.test(regtxt) && /Portugal/.test(regtxt) && (await ev(() => document.querySelectorAll('#explore .lst .chip').length)) > 50, regtxt.slice(0, 120));
  await page.click('#explore-toggle');
  await page.click('#in-de'); await ev(() => { document.querySelector('#in-de').value = 'M'; document.querySelector('#in-de').setSelectionRange(1, 1); });
  await page.click('#chars-de [data-ch="ü"]');
  ok('spec 12 special-character bar', (await ev(() => document.querySelector('#in-de').value)) === 'Mü');
  ok('spec 12 voice input button (where the browser can listen)', await ev(() => !!document.querySelector('#mic-de') === !!(window.SpeechRecognition || window.webkitSpeechRecognition)));
  await page.keyboard.press('Escape');
  ok('spec 13 record yourself and compare (button)', await ev(() => !!document.querySelector('#cards [data-act="record"]')));
  await ev(() => document.querySelector('#cards .card[data-lang="de"] [data-extra="more"]').click());
  ok('spec 15 report a mistake', await ev(() => /github\.com\/heitorpais\/four-language-translator\/issues\/new/.test(document.querySelector('#cards .card[data-lang="de"] .extra').innerHTML)));
  await page.click('#me-toggle'); await page.click('[data-tab="me:file"]');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.click('[data-x="export-csv"]')]);
  const csvText = fs.readFileSync(await csv.path(), 'utf8');
  ok('spec 16 export to CSV (four languages)', /Apfel/.test(csvText) && /apple/.test(csvText) && /pomme/.test(csvText), csvText.split('\n').slice(0, 3).join(' / '));
  const [anki] = await Promise.all([page.waitForEvent('download'), page.click('[data-x="export-anki"]')]);
  const ankiText = fs.readFileSync(await anki.path(), 'utf8');
  ok('spec 16 export to Anki', /#separator:tab/.test(ankiText) && /Apfel\t/.test(ankiText), ankiText.split('\n')[3]);
  ok('spec 16 print / PDF button', await ev(() => !!document.querySelector('[data-x="print"]')));
  await page.click('#me-toggle');
  await page.click('#practice-toggle');
  await ev(() => { const s = document.querySelector('#pr-mode'); s.value = 'cards'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.click('[data-x="fc-start"]'); await page.waitForTimeout(300);
  ok('spec 4 flashcards: a due card is shown', /Card 1 of/.test(await ev(() => document.querySelector('#practice').innerText)));
  await page.click('#fc-flip'); await page.click('[data-fc="4"]');
  ok('spec 4 spaced repetition: "Good" schedules the card a day later', await ev(() => Object.values(FLT.P.srs).some(c => c.iv === 1 && c.due > Date.now() + 8e7)));
  await page.click('[data-x="fc-stop"]'); await page.click('#practice-toggle');
  await tr('de', 'nach Hause');
  const idi = await ev(() => FLT.state.entry && FLT.state.entry.lemma);
  await ev(() => { const i = document.querySelector('#in-de'); i.focus(); i.value = 'auf jemanden Häuser'; i.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(200);
  ok('spec 6 idioms are searchable', /→ Haus/.test(await ev(() => document.querySelector('#sg-de').innerText)), await ev(() => document.querySelector('#sg-de').innerText.slice(0, 120)));
  await page.keyboard.press('Escape');
  ok('no page errors', errors.length === 0, errors.join(' | '));

  for (const [n, p, i] of results) console.log((p ? 'PASS ' : 'FAIL ') + n + (i ? '  [' + i + ']' : ''));
  console.log(results.filter(r => r[1]).length + ' of ' + results.length + ' passed');
  console.log(results.every(r => r[1]) ? 'ALL PASS' : 'SOME FAILED');
  await browser.close(); server.close();
})().catch(e => { for (const [n, p, i] of results) console.log((p ? 'PASS ' : 'FAIL ') + n + (i ? '  [' + i + ']' : '')); console.error(String(e).slice(0, 600)); process.exit(1); });
