/* Four-Language Translator: the views around the cards.
   Explore (by level, word type, A–Z, irregular verbs, random word, about), My words (saved, lists, history, known,
   notes, export/import), Practice (12 kinds of exercise), Settings (Display, Audio, Data), the welcome box and the
   "add to home screen" tip. Uses window.FLT from app.js; all personal data stays on this device. */
(function () {
'use strict';
let A = null;                     // the app (window.FLT)
const $ = s => document.querySelector(s);
const t = (k, en, v) => A.t(k, en, v), esc = s => A.esc(s);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const ALL = ['en', 'de', 'fr', 'pt'];
const POSLIST = ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'pronoun', 'conjunction', 'numeral', 'interjection', 'determiner', 'article', 'phrase'];
const V = { tab: { explore: 'level', me: 'saved', }, xlang: null, xlevel: 'A1', xpos: 'noun', xletter: 'a', pr: null };
const coreOf = lang => { const out = []; for (const e of A.D.byId.values()) if (e.lang === lang && e.tier === 'core') out.push(e); return out.sort((a, b) => (a.frequency_rank || 1e9) - (b.frequency_rank || 1e9)); };
const chipOf = e => `<button class="chip" data-open="${esc(e.id)}" lang="${e.lang}">${e.pos === 'noun' && e.noun && e.noun.gender ? A.artHtml(A.article(e.lang, e, e.lemma), e.noun.gender) + ' ' : ''}${esc(A.withTo(e.id, e.lemma))}${A.lvlBadge(e, true)}</button>`;
const langSelect = (id, val, extra) => `<select id="${id}">${(extra || []).map(([v, n]) => `<option value="${v}"${v === val ? ' selected' : ''}>${esc(n)}</option>`).join('')}${ALL.map(l => `<option value="${l}"${l === val ? ' selected' : ''}>${esc(A.LNAME[l])}</option>`).join('')}</select>`;
const learnLang = () => A.S.learning || A.S.order[1] || 'de';

/* ---------- grammar pages ---------- */
function grammar(key) {
  const g = FLTLearn.GRAMMAR[key], el = $('#grammar'); if (!g || !el) return;
  el.hidden = false;
  el.innerHTML = `<div class="row"><h2>${esc(t('gram.title', 'Grammar'))}</h2><button class="chip" data-x="gram-close" aria-label="${esc(t('btn.close', 'Close'))}">×</button></div><h3 class="grp" lang="en">${esc(g.title)}</h3>${g.text.map(p => `<p lang="en">${esc(p)}</p>`).join('')}<p class="hint">${esc(t('gram.note', 'Short notes written by AI (Claude), in English.'))}</p>`;
  el.scrollIntoView({ block: 'nearest', behavior: A.animOn() ? 'smooth' : 'auto' });
}

/* ---------- panels ---------- */
const PANELS = ['explore', 'practice', 'me', 'settings', 'sources', 'grammar'];
function togglePanel(name, force) {
  for (const p of PANELS) {
    const el = $('#' + p), btn = $('#' + p + '-toggle'); if (!el) continue;
    const show = p === name ? (force != null ? force : el.hidden) : false;
    el.hidden = !show; if (btn) btn.setAttribute('aria-expanded', String(show));
    if (show) paint(p);
  }
}
function closePanels() { PANELS.forEach(p => { const el = $('#' + p); if (el) el.hidden = true; const b = $('#' + p + '-toggle'); if (b) b.setAttribute('aria-expanded', 'false'); }); }
function paint(p) { if (p === 'explore') paintExplore(); else if (p === 'me') paintMe(); else if (p === 'practice') paintPractice(); else if (p === 'settings') paintSettings(); }
function counter() {
  const n = Object.keys(A.P.favs).length, b = $('#me-toggle');
  if (b) b.textContent = t('nav.me', 'My words') + (n ? ' · ' + t('nav.saved', '{n} saved', { n }) : '');
  if (!$('#me').hidden) paintMe();
}
const tabs = (group, list) => `<div class="tabs" role="tablist">${list.map(([k, n]) => `<button role="tab" class="tabb" data-tab="${group}:${k}" aria-selected="${V.tab[group] === k}">${esc(n)}</button>`).join('')}</div>`;

/* ---------- Explore ---------- */
function paintExplore() {
  const el = $('#explore'); if (!A.D.ready) { el.innerHTML = `<h2>${esc(t('nav.explore', 'Explore'))}</h2><p class="hint">${esc(t('msg.loading', 'The dictionary data is still loading.'))}</p>`; return; }
  const lang = V.xlang || (V.xlang = learnLang());
  let body = '';
  const tab = V.tab.explore;
  if (tab === 'level') {
    body = `<div class="row">${LEVELS.map(l => `<button class="lvl ${l} big${V.xlevel === l ? ' sel' : ''}" data-xlevel="${l}">${l} · ${esc(t('cefr.' + l, A.CEFR[l]))}</button>`).join('')}</div>`;
    const list = coreOf(lang).filter(e => { const v = A.levelOf(e); return v && v.l === V.xlevel; });
    body += listChips(list, t('x.level.n', '{n} words at level {l}', { n: A.num(list.length), l: V.xlevel }));
  } else if (tab === 'pos') {
    const all = coreOf(lang), have = POSLIST.filter(p => all.some(e => e.pos === p));
    body = `<div class="row">${have.map(p => `<button class="chip${V.xpos === p ? ' sel' : ''}" data-xpos="${p}">${esc(t('pos.' + p, p))} <small>${A.num(all.filter(e => e.pos === p).length)}</small></button>`).join('')}</div>`;
    body += listChips(all.filter(e => e.pos === V.xpos), '');
  } else if (tab === 'az') {
    const all = coreOf(lang), letters = [...new Set(all.map(e => A.fold(e.lemma)[0]).filter(c => c && /[a-z]/.test(c)))].sort();
    body = `<div class="row az">${letters.map(c => `<button class="chip${V.xletter === c ? ' sel' : ''}" data-xletter="${c}">${c.toUpperCase()}</button>`).join('')}</div>`;
    const list = all.filter(e => A.fold(e.lemma)[0] === V.xletter).sort((a, b) => A.fold(a.lemma) < A.fold(b.lemma) ? -1 : 1);
    body += listChips(list, t('x.az.n', '{n} common words. Rarer words load when you look them up.', { n: A.num(list.length) }));
  } else if (tab === 'irr') {
    const list = coreOf(lang).filter(e => e.pos === 'verb' && e.verb && e.verb.regular === false && e.verb.principal_parts);
    body = `<p class="hint">${esc(t('x.irr.n', '{n} irregular verbs, most frequent first. Changed letters are bold.', { n: A.num(list.length) }))}</p><div class="tblwrap"><table class="irrt"><thead><tr><th>${esc(t('x.irr.inf', 'Infinitive'))}</th><th>${esc(t('x.irr.past', 'Past'))}</th><th>${esc(t('x.irr.pp', 'Participle'))}</th>${lang === 'de' || lang === 'fr' ? `<th>${esc(t('row.aux', 'Auxiliary'))}</th>` : ''}<th>${esc(t('lvl.stored', 'Level'))}</th></tr></thead><tbody>${list.slice(0, 400).map(e => { const p = e.verb.principal_parts; return `<tr><td><button class="lnk" data-open="${esc(e.id)}" lang="${lang}">${esc(A.withTo(e.id, e.lemma))}</button></td><td lang="${lang}">${p[1] ? A.diffMark(e.lemma, p[1], true) : ''}</td><td lang="${lang}">${p[2] ? A.diffMark(e.lemma, p[2], true) : ''}</td>${lang === 'de' || lang === 'fr' ? `<td>${esc(e.verb.aux || '')}</td>` : ''}<td>${A.lvlBadge(e, true)}</td></tr>`; }).join('')}</tbody></table></div>`;
  } else if (tab === 'random') {
    body = `<div class="row"><button class="btn" data-x="random">🎲 ${esc(t('x.random.go', 'Show me a random word'))}</button><label class="ck"><input type="checkbox" id="x-rlevel"${V.rlevel !== false ? ' checked' : ''}> ${esc(t('x.random.mine', 'at my level ({l})', { l: A.S.myLevel }))}</label></div>`;
  } else if (tab === 'regional') {
    const regs = A.REG[lang].map(r => r.toUpperCase()), by = {};
    regs.forEach(r => { by[r] = []; });
    for (const e of coreOf(lang)) if (e.used_in && e.used_in.length) e.used_in.forEach(r => { if (by[r]) by[r].push(e); });
    body = `<p class="hint">${esc(t('x.reg.p', 'Words that Wiktionary marks as used only in some regions (Helvetisms, Austrian words, Brazil or Portugal, UK or US…). Common words only; rarer ones are marked on their cards.'))}</p>`
      + regs.map(r => `<div class="lst"><b>${A.flag(r.toLowerCase(), true)}${esc(A.RNAME[r.toLowerCase()])}</b> <span class="hint">${A.num(by[r].length)}</span><div class="chips">${by[r].slice(0, V.more ? 2000 : 200).map(chipOf).join('')}</div></div>`).join('');
  } else if (tab === 'about') body = aboutHtml();
  el.innerHTML = `<h2>${esc(t('nav.explore', 'Explore'))}</h2>
    <div class="row"><label for="x-lang">${esc(t('x.lang', 'Language'))}</label>${langSelect('x-lang', lang)}</div>
    ${tabs('explore', [['level', t('x.tab.level', 'By level')], ['pos', t('x.tab.pos', 'By word type')], ['az', t('x.tab.az', 'A–Z')], ['irr', t('x.tab.irr', 'Irregular verbs')], ['random', t('x.tab.random', 'Random word')], ['regional', t('x.tab.reg', 'Regional words')], ['about', t('x.tab.about', 'About the dictionary')]])}
    <div class="tabbody">${body}</div>`;
}
function listChips(list, head) {
  const max = V.more ? 2000 : 300;
  return `${head ? `<p class="hint">${esc(head)}</p>` : ''}<div class="chips">${list.slice(0, max).map(chipOf).join('')}</div>${list.length > max ? `<button class="more" data-x="more">${esc(t('x.more', 'Show more ({n})', { n: A.num(list.length - max) }))}</button>` : ''}`;
}
function aboutHtml() {
  const m = A.D.manifest || {}, c = m.counts || {};
  const lv = {}; for (const l of ALL) { lv[l] = { est: 0 }; LEVELS.forEach(x => { lv[l][x] = 0; }); }
  for (const e of A.D.byId.values()) if (e.tier === 'core') { const v = A.levelOf(e); if (v) { lv[e.lang][v.l]++; if (v.est) lv[e.lang].est++; } }
  const row = (n, f) => `<tr><th>${esc(n)}</th>${ALL.map(l => `<td>${f(l)}</td>`).join('')}</tr>`;
  return `<p>${esc(t('about.p1', 'Everything in this dictionary ships with the app and comes from Wiktionary, Tatoeba and FrequencyWords; nothing is looked up on the internet when you search. The numbers below count what the app holds.'))}</p>
  <div class="tblwrap"><table class="about"><thead><tr><th></th>${ALL.map(l => `<th>${A.flag(A.S.main[l], true)}${esc(A.LNAME[l])}</th>`).join('')}</tr></thead><tbody>
  ${row(t('about.entries', 'Entries'), l => A.num((c[l] || {}).entries || 0))}
  ${row(t('about.core', 'Common words (full entries)'), l => A.num((c[l] || {}).core || 0))}
  ${row(t('about.ext', 'Less common words'), l => A.num((c[l] || {}).extended || 0))}
  ${row(t('about.tail', 'Rare words'), l => A.num((c[l] || {}).long_tail || 0))}
  ${row(t('about.forms', 'Inflected forms'), l => A.num((c[l] || {}).inflected_forms || 0))}
  ${LEVELS.map(x => row(x + ' · ' + t('cefr.' + x, A.CEFR[x]), l => A.num(lv[l][x]))).join('')}
  ${row(t('about.est', 'Levels estimated from frequency'), l => A.num(lv[l].est))}
  </tbody></table></div>
  <p class="hint">${esc(t('about.lvl', 'Levels marked ≈ are estimated from how often a word is used in film subtitles (most frequent 600 words A1, up to 1,500 A2, 3,000 B1, 5,500 B2, 9,000 C1). Levels without ≈ were written by AI for German words.'))}</p>
  <p class="hint">${esc(t('about.ver', 'Data version {v}, built {d}.', { v: m.version || '', d: m.built || '' }))}</p>`;
}

/* ---------- My words ---------- */
function entryChipsFromMap(map, sort) {
  const ids = Object.keys(map).sort(sort || ((a, b) => (map[b].t || 0) - (map[a].t || 0)));
  return ids.map(id => `<button class="chip" data-open="${esc(id)}" lang="${id.slice(0, 2)}">${A.flag(A.S.main[id.slice(0, 2)], true)}${esc(A.withTo(id, map[id].w || id.split(':')[1]))}</button>`).join('');
}
function paintMe() {
  const el = $('#me'), P = A.P, tab = V.tab.me;
  const n = { saved: Object.keys(P.favs).length, known: Object.keys(P.known).length, notes: Object.keys(P.notes).length, lists: P.lists.length, history: P.history.length };
  let body = '';
  if (tab === 'saved') body = n.saved ? `<p class="hint">${esc(t('me.saved.n', '{n} words saved. Tap one to open it.', { n: A.num(n.saved) }))}</p><div class="chips">${entryChipsFromMap(P.favs)}</div><div class="row"><button class="btn" data-x="pr-saved">${esc(t('me.practice', 'Practise these words'))}</button><button class="btn" data-x="fc-open">${esc(t('fc.open', 'Flashcards: {n} due', { n: dueIds().length }))}</button></div>` : `<p class="hint">${esc(t('me.saved.none', 'No saved words yet. Tap ☆ on a card to save a word.'))}</p>`;
  else if (tab === 'lists') {
    body = (P.lists.length ? P.lists.map((L, k) => `<div class="lst"><div class="row"><b>${esc(L.name)}</b> <small class="hint">${esc(t('me.list.n', '{n} words', { n: L.ids.length }))}</small><button class="chip" data-x="pr-list" data-k="${k}">${esc(t('me.practice.s', 'Practise'))}</button><button class="chip" data-x="list-ren" data-k="${k}">${esc(t('me.rename', 'Rename'))}</button><button class="chip" data-x="list-del" data-k="${k}">${esc(t('btn.delete', 'Delete'))}</button></div><div class="chips">${L.ids.map(id => `<button class="chip" data-open="${esc(id)}" lang="${id.slice(0, 2)}">${A.flag(A.S.main[id.slice(0, 2)], true)}${esc(A.withTo(id, (L.w && L.w[id]) || id.split(':')[1]))}</button>`).join('')}</div></div>`).join('') : `<p class="hint">${esc(t('me.lists.none', 'No lists yet. Use “＋ List” on a card to make one.'))}</p>`)
      + `<div class="row"><input class="text" id="me-newlist" placeholder="${esc(t('list.new', 'New list…'))}"><button class="btn sm" data-x="list-new">${esc(t('btn.add', 'Add'))}</button></div>`;
  } else if (tab === 'history') {
    const byDay = {}; P.history.forEach(h => { const d = new Date(h.t).toLocaleDateString(A.S.ui); (byDay[d] = byDay[d] || []).push(h); });
    body = n.history ? Object.entries(byDay).map(([d, hs]) => `<div class="lst"><b>${esc(d)}</b><div class="chips">${hs.map(h => `<button class="chip" data-open="${esc(h.id)}" lang="${h.id.slice(0, 2)}">${A.flag(A.S.main[h.id.slice(0, 2)], true)}${esc(A.withTo(h.id, h.w))}</button>`).join('')}</div></div>`).join('') + `<button class="btn sm" data-x="hist-clear">${esc(t('me.hist.clear', 'Clear history'))}</button>` : `<p class="hint">${esc(t('me.hist.none', 'No words looked up yet.'))}</p>`;
  } else if (tab === 'known') body = n.known ? `<p class="hint">${esc(t('me.known.n', '{n} words marked as known. Known words are left out of the word of the day.', { n: n.known }))}</p><div class="chips">${entryChipsFromMap(P.known)}</div>` : `<p class="hint">${esc(t('me.known.none', 'Mark a word with “I know this” on its card.'))}</p>`;
  else if (tab === 'notes') body = n.notes ? Object.entries(P.notes).map(([id, txt]) => `<div class="lst"><button class="chip" data-open="${esc(id)}" lang="${id.slice(0, 2)}">${A.flag(A.S.main[id.slice(0, 2)], true)}${esc(A.withTo(id, id.split(':')[1]))}</button> <span>${esc(txt)}</span></div>`).join('') : `<p class="hint">${esc(t('me.notes.none', 'Write a note with “✎ Note” on a card.'))}</p>`;
  else if (tab === 'file') body = `<p class="hint">${esc(t('me.file.p', 'Your saved words, lists, notes, known words and history stay in this browser only. Save them to a file to keep a copy or move them to another device.'))}</p>
    <div class="row"><button class="btn" data-x="export">⬇ ${esc(t('me.export', 'Save to a file'))}</button><button class="btn" data-x="export-csv">⬇ ${esc(t('me.csv', 'Spreadsheet (CSV)'))}</button><button class="btn" data-x="export-anki">⬇ ${esc(t('me.anki', 'Anki flashcards'))}</button><button class="btn" data-x="print">🖨 ${esc(t('me.print', 'Print or PDF'))}</button><label class="btn">⬆ ${esc(t('me.import', 'Load from a file'))}<input type="file" id="me-import" accept="application/json,.json" hidden></label></div><p class="hint" id="me-file-msg" aria-live="polite"></p>`;
  el.innerHTML = `<h2>${esc(t('nav.me', 'My words'))}</h2>${tabs('me', [['saved', '★ ' + t('me.tab.saved', 'Saved') + ' ' + n.saved], ['lists', t('me.tab.lists', 'Lists') + ' ' + n.lists], ['history', t('me.tab.history', 'History')], ['known', '✓ ' + t('me.tab.known', 'Known') + ' ' + n.known], ['notes', '✎ ' + t('me.tab.notes', 'Notes') + ' ' + n.notes], ['file', t('me.tab.file', 'Export / import')]])}<div class="tabbody">${body}</div>`;
  const imp = $('#me-import');
  if (imp) imp.addEventListener('change', async () => {
    const f = imp.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text()); if (!d || d.app !== 'four-language-translator') throw 0;
      const P = A.P;
      Object.assign(P.favs, d.favs || {}); Object.assign(P.known, d.known || {}); Object.assign(P.notes, d.notes || {});
      for (const L of d.lists || []) { const o = P.lists.find(x => x.name === L.name); if (o) { L.ids.forEach(id => { if (!o.ids.includes(id)) o.ids.push(id); }); o.w = Object.assign(o.w || {}, L.w || {}); } else P.lists.push(L); }
      const seen = new Set(P.history.map(h => h.id)); P.history = P.history.concat((d.history || []).filter(h => !seen.has(h.id))).sort((a, b) => b.t - a.t).slice(0, 300);
      P.mistakes = (P.mistakes || []).concat(d.mistakes || []).slice(-200);
      A.saveP(); paintMe(); $('#me-file-msg').textContent = t('me.import.ok', 'Loaded. Your words from the file were added.');
    } catch (e) { $('#me-file-msg').textContent = t('me.import.bad', 'This file is not a word list from this app.'); }
  });
}
/* the saved words and lists as rows in all four languages */
async function myRows() {
  const P = A.P, ids = [...new Set([...Object.keys(P.favs), ...P.lists.flatMap(L => L.ids)])];
  await A.ensureIds(ids);
  const rows = [];
  for (const id of ids) {
    const e = A.D.byId.get(id); if (!e) continue;
    const s = e.senses.find(x => ALL.some(l => l !== e.lang && A.trIds(x, l).length)), w = {};
    if (s) await A.ensureIds(ALL.filter(l => l !== e.lang).map(l => A.trIds(s, l)[0]).filter(Boolean));
    for (const l of ALL) { if (l === e.lang) { w[l] = A.regionView(e).word; continue; } const x = s && A.D.byId.get(A.trIds(s, l)[0]); w[l] = x ? A.regionView(x).word : ''; }
    const art = (l, x) => { const y = l === e.lang ? e : (s && A.D.byId.get(A.trIds(s, l)[0])); return y && y.pos === 'noun' ? A.article(l, y, w[l]) : ''; };
    ALL.forEach(l => { const a = art(l); if (a && w[l]) w[l] = A.withArt(a, w[l]); });
    const lv = A.levelOf(e);
    rows.push({ id, lang: e.lang, w, level: lv ? lv.l : '', note: P.notes[id] || '', lists: P.lists.filter(L => L.ids.includes(id)).map(L => L.name).join(', '), fav: !!P.favs[id] });
  }
  return rows;
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  const m = $('#me-file-msg'); if (m) m.textContent = t('me.saved.as', 'Saved as {f} in your downloads.', { f: name });
}
async function exportCsv() {
  const rows = await myRows(), q = v => '"' + String(v || '').replace(/"/g, '""') + '"';
  const head = [...ALL.map(l => A.LNAME[l]), t('lvl.stored', 'Level'), t('note.mine', 'My note'), t('me.tab.lists', 'Lists')];
  download('my-words.csv', '\ufeff' + [head, ...rows.map(r => [...ALL.map(l => r.w[l]), r.level, r.note, r.lists])].map(r => r.map(q).join(',')).join('\r\n'), 'text/csv');
}
async function exportAnki() {        // Anki: File › Import, fields separated by tab; front = the word, back = the other three
  const rows = await myRows(), clean = v => String(v || '').replace(/[\t\n]/g, ' ');
  download('my-words-anki.txt', '#separator:tab\n#html:true\n#tags column:3\n' + rows.map(r => [clean(r.w[r.lang]), ALL.filter(l => l !== r.lang && r.w[l]).map(l => A.LNAME[l] + ': ' + clean(r.w[l])).join('<br>'), 'four-language-translator ' + r.lang + (r.level ? ' ' + r.level : '')].join('\t')).join('\n'), 'text/plain');
}
async function printMe() {
  const rows = await myRows(), el = $('#print-area');
  el.innerHTML = `<h1>${esc(t('nav.me', 'My words'))}</h1><table><thead><tr>${ALL.map(l => `<th>${esc(A.LNAME[l])}</th>`).join('')}<th>${esc(t('lvl.stored', 'Level'))}</th><th>${esc(t('note.mine', 'My note'))}</th></tr></thead><tbody>${rows.map(r => `<tr>${ALL.map(l => `<td lang="${l}">${esc(r.w[l])}</td>`).join('')}<td>${esc(r.level)}</td><td>${esc(r.note)}</td></tr>`).join('')}</tbody></table>`;
  window.print();
}
function exportMe() {
  const P = A.P, d = { app: 'four-language-translator', version: 1, saved: new Date().toISOString(), favs: P.favs, known: P.known, notes: P.notes, lists: P.lists, history: P.history, mistakes: P.mistakes };
  const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'my-words-four-language-translator.json'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  const m = $('#me-file-msg'); if (m) m.textContent = t('me.export.ok', 'Saved as my-words-four-language-translator.json in your downloads.');
}

/* ---------- Practice ---------- */
const MODES = [
  ['gender', 'der / die / das', ['de', 'fr', 'pt']], ['plural', 'Plural', ['de', 'fr', 'pt', 'en']], ['aux', 'haben / sein', ['de', 'fr']], ['case', 'Preposition + case', ['de']],
  ['translate', 'Translation', ALL], ['gap', 'Fill the gap', ALL], ['listen', 'Listen and type', ALL], ['parts', 'Principal parts', ['de', 'en']],
  ['match', 'Matching game (4 languages)', ALL], ['review', 'Review my mistakes', ALL], ['cards', 'Flashcards (spaced repetition)', ALL]];
const modeName = m => t('pr.mode.' + m[0], m[1]);
function practiceDefaults() {
  return { mode: 'gender', lang: A.S.learning && A.S.learning !== 'en' ? A.S.learning : 'de', to: A.S.speak || 'en', level: 'mine', source: 'all', list: 0 };
}
function paintPractice() {
  const el = $('#practice');
  if (!V.pc) V.pc = Object.assign(practiceDefaults(), A.S.practice || {});
  const c = V.pc;
  if (V.fc) { el.innerHTML = `<h2>${esc(t('nav.practice', 'Practice'))}</h2>${cardsHtml()}`; const f = $('#fc-flip'); if (f) setTimeout(() => f.focus(), 30); return; }
  if (V.pr && V.pr.q) { el.innerHTML = `<h2>${esc(t('nav.practice', 'Practice'))}</h2>${questionHtml()}`; focusAnswer(); return; }
  const mode = MODES.find(m => m[0] === c.mode) || MODES[0];
  const langs = mode[2];
  if (!langs.includes(c.lang)) c.lang = langs[0];
  el.innerHTML = `<h2>${esc(t('nav.practice', 'Practice'))}</h2>
  ${V.pr && V.pr.done ? resultHtml() : ''}
  <div class="prset">
    <div class="set"><label for="pr-mode">${esc(t('pr.what', 'Exercise'))}</label><select id="pr-mode">${MODES.map(m => `<option value="${m[0]}"${m[0] === c.mode ? ' selected' : ''}>${esc(modeName(m))}</option>`).join('')}</select><div class="hint">${esc(t('pr.hint.' + c.mode, modeHint(c.mode)))}</div></div>
    ${c.mode === 'match' || c.mode === 'review' || c.mode === 'cards' ? '' : `<div class="set"><label for="pr-lang">${esc(t('pr.lang', 'Language'))}</label><select id="pr-lang">${langs.map(l => `<option value="${l}"${l === c.lang ? ' selected' : ''}>${esc(A.LNAME[l])}</option>`).join('')}</select></div>`}
    ${c.mode === 'translate' ? `<div class="set"><label for="pr-to">${esc(t('pr.to', 'Answer in'))}</label>${langSelect('pr-to', c.to, [['any', t('pr.any', 'Any language (mixed)')]])}</div>` : ''}
    ${c.mode === 'review' || c.mode === 'cards' ? '' : `<div class="set"><label for="pr-level">${esc(t('pr.level', 'Level'))}</label><select id="pr-level">${[['mine', t('pr.level.mine', 'My level and below ({l})', { l: A.S.myLevel })], ['all', t('pr.level.all', 'All levels')], ...LEVELS.map(l => [l, l + ' · ' + t('cefr.' + l, A.CEFR[l])])].map(([v, n]) => `<option value="${v}"${v === c.level ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
    <div class="set"><label for="pr-src">${esc(t('pr.src', 'Words'))}</label><select id="pr-src"><option value="all"${c.source === 'all' ? ' selected' : ''}>${esc(t('pr.src.all', 'All common words'))}</option><option value="saved"${c.source === 'saved' ? ' selected' : ''}>${esc(t('pr.src.saved', 'Only my saved words'))}</option>${A.P.lists.map((L, k) => `<option value="list:${k}"${c.source === 'list:' + k ? ' selected' : ''}>${esc(t('pr.src.list', 'List: {l}', { l: L.name }))}</option>`).join('')}</select></div>`}
  </div>
  <div class="row">${c.mode === 'cards' ? `<button class="btn primary" data-x="fc-start">${esc(t('fc.start', 'Start: {n} cards due', { n: dueIds().length }))}</button><span class="hint">${esc(t('fc.deck', '{n} words in your flashcards (saved words and lists)', { n: deckIds().length }))}</span>` : `<button class="btn primary" data-x="pr-start">${esc(t('pr.start', 'Start: 10 questions'))}</button><span class="hint">${esc(t('pr.mistakes', '{n} mistakes saved for review', { n: (A.P.mistakes || []).length }))}</span>`}</div>
  <p class="hint" id="pr-msg" aria-live="polite"></p>`;
}
function modeHint(m) {
  return { cards: 'Your saved words and lists. Each card comes back after a gap that grows when you know it (SM-2).', gender: 'Choose the article of the noun.', plural: 'Type the plural.', aux: 'Which auxiliary forms the perfect tense?', case: 'Which case follows the preposition or verb?',
    translate: 'Choose the right translation.', gap: 'Type the missing word of the example sentence.', listen: 'Listen to the word and type it.', parts: 'Type the past form and the participle.',
    match: 'Find the same word in all four languages.', review: 'The questions you got wrong before, until you get them right.' }[m] || '';
}
const lvOK = (e, c) => { if (c.level === 'all') return true; const v = A.levelOf(e); if (!v) return false; return c.level === 'mine' ? A.LVORD[v.l] <= A.LVORD[A.S.myLevel] : v.l === c.level; };
async function pool(c, lang) {
  let ids = null;
  if (c.source === 'saved') ids = Object.keys(A.P.favs);
  else if (c.source && c.source.startsWith('list:')) { const L = A.P.lists[+c.source.slice(5)]; ids = L ? L.ids.slice() : []; }
  if (ids) {
    await A.ensureIds(ids);
    // a saved word in another language counts through its translations
    const out = new Set();
    for (const id of ids) { const e = A.D.byId.get(id); if (!e) continue; if (e.lang === lang) out.add(e); else { const s = e.senses.find(x => A.trIds(x, lang).length); if (s) { await A.ensureIds(A.trIds(s, lang)); const x = A.D.byId.get(A.trIds(s, lang)[0]); if (x) out.add(x); } } }
    return [...out];
  }
  return coreOf(lang).filter(e => lvOK(e, c));
}
const gloss = e => { const s = e.senses.find(x => x.gloss_en) || e.senses[0]; if (!s) return ''; const ui = A.S.ui, tr = ui !== e.lang && A.trIds(s, ui)[0]; return tr ? A.withTo(tr, (A.D.byId.get(tr) || {}).lemma) || s.gloss_en || '' : (s.gloss_en || ''); };
const firstTr = (e, to) => { for (const s of e.senses) { const ids = A.trIds(s, to); if (ids.length) return ids[0]; } return null; };
const ART = { de: { m: 'der', f: 'die', n: 'das' }, fr: { m: 'le', f: 'la' }, pt: { m: 'o', f: 'a' } };
const norm = s => A.fold(String(s || '')).replace(/^(der|die|das|le|la|les|l'|o|a|os|as|the|to)\s+/, '').replace(/['’]/g, "'").replace(/\s+/g, ' ').trim();
async function makeQuestions(c) {
  const lang = c.lang, qs = [];
  if (c.mode === 'review') {
    const ms = (A.P.mistakes || []).slice(-30).reverse(); await A.ensureIds(ms.map(m => m.id));
    for (const m of ms) { const e = A.D.byId.get(m.id); if (!e) continue; const q = await one(Object.assign({}, c, { mode: m.mode, lang: e.lang, to: m.to || c.to }), [e], [e]); if (q) { q.review = true; qs.push(q); } if (qs.length >= 10) break; }
    return qs;
  }
  if (c.mode === 'match') {
    const base = (await pool(Object.assign({}, c), learnLang())).filter(e => ALL.every(l => l === e.lang || firstTr(e, l)));
    const picks = shuffle(base).slice(0, 12); await A.ensureIds(picks.flatMap(e => ALL.map(l => firstTr(e, l)).filter(Boolean)));
    for (let k = 0; k + 4 <= picks.length && qs.length < 3; k += 4) qs.push({ mode: 'match', rows: picks.slice(k, k + 4).map(e => { const r = {}; ALL.forEach(l => { r[l] = l === e.lang ? e : A.D.byId.get(firstTr(e, l)); }); return r; }).filter(r => ALL.every(l => r[l])) });
    return qs.filter(q => q.rows.length >= 3);
  }
  const all = await pool(c, lang);
  for (const e of shuffle(all)) { if (qs.length >= 10) break; const q = await one(c, [e], all); if (q) qs.push(q); }
  return qs;
}
async function one(c, [e], all) {
  const lang = e.lang, rv = A.regionView(e);
  const base = { mode: c.mode, e, lang };
  if (c.mode === 'gender') {
    if (e.pos !== 'noun' || !e.noun || !ART[lang] || !ART[lang][e.noun.gender]) return null;
    const opts = Object.values(ART[lang]);
    return Object.assign(base, { prompt: `<span class="big" lang="${lang}">${esc(rv.word)}</span><span class="hint">${esc(gloss(e))}</span>`, choices: opts, answer: ART[lang][e.noun.gender] });
  }
  if (c.mode === 'plural') {
    if (e.pos !== 'noun' || !e.noun || !rv.plural || rv.plural === rv.word) return null;
    const art = A.article(lang, e, rv.word);
    return Object.assign(base, { prompt: `<span class="big" lang="${lang}">${art ? A.artHtml(art, e.noun.gender) + ' ' : ''}${esc(rv.word)}</span><span class="hint">${esc(t('pr.q.plural', 'Plural?'))} · ${esc(gloss(e))}</span>`, typed: true, answer: rv.plural, show: (lang === 'en' ? '' : A.article(lang, e, rv.plural, true) + ' ') + rv.plural });
  }
  if (c.mode === 'aux') {
    if (e.pos !== 'verb' || !rv.aux || !['haben', 'sein', 'avoir', 'être'].includes(rv.aux)) return null;
    return Object.assign(base, { prompt: `<span class="big" lang="${lang}">${esc(rv.word)}</span><span class="hint">${esc(gloss(e))}</span>`, choices: lang === 'de' ? ['haben', 'sein'] : ['avoir', 'être'], answer: rv.aux });
  }
  if (c.mode === 'case') {
    const g = (e.governs || []).find(x => x.case && /^(Akk|Dat|Gen)$/.test(x.case)); if (!g) return null;
    return Object.assign(base, { prompt: `<span class="big" lang="${lang}">${esc(e.lemma)}${g.prep && g.prep !== e.lemma ? ' ' + esc(g.prep) : ''} + ?</span><span class="hint">${esc(gloss(e))}</span>`, choices: ['Akk', 'Dat', 'Gen'], answer: g.case, names: { Akk: 'Akkusativ', Dat: 'Dativ', Gen: 'Genitiv' } });
  }
  if (c.mode === 'translate') {
    const to = c.to === 'any' ? shuffle(ALL.filter(l => l !== lang))[0] : (c.to === lang ? ALL.find(l => l !== lang) : c.to);
    const right = firstTr(e, to); if (!right) return null;
    const others = shuffle((all.length >= 12 ? all : coreOf(lang)).filter(x => x !== e && x.pos === e.pos)).slice(0, 60).map(x => firstTr(x, to)).filter(x => x && x !== right);
    const opts = [...new Set([right, ...others])].slice(0, 4); if (opts.length < 3) return null;
    await A.ensureIds(opts);
    const words = shuffle(opts).map(id => A.withTo(id, (A.D.byId.get(id) || {}).lemma)).filter(Boolean);
    const ans = A.withTo(right, (A.D.byId.get(right) || {}).lemma); if (!ans) return null;
    return Object.assign(base, { to, prompt: `<span class="big" lang="${lang}">${esc(rv.word)}</span><span class="hint">${A.flag(A.S.main[lang], true)} → ${A.flag(A.S.main[to], true)}${esc(A.LNAME[to])}</span>`, choices: [...new Set(words)], answer: ans });
  }
  if (c.mode === 'gap') {
    const x = (e.examples || []).find(s => s.hl && s.text && s.text.length < 110); if (!x) return null;
    const word = x.text.slice(x.hl[0], x.hl[1]), ui = A.S.ui !== lang ? A.S.ui : (lang === 'en' ? 'de' : 'en');
    const hintTr = x.translations && x.translations[ui];
    return Object.assign(base, { prompt: `<span class="sent" lang="${lang}">${esc(x.text.slice(0, x.hl[0]))}<span class="gap">${'_'.repeat(Math.max(4, word.length))}</span>${esc(x.text.slice(x.hl[1]))}</span>${hintTr ? `<span class="hint">${A.flag(A.S.main[ui], true)}${esc(hintTr)}</span>` : ''}<span class="hint">${esc(t('pr.q.gap', 'Word: {w}', { w: e.lemma }))}</span>`, typed: true, answer: word });
  }
  if (c.mode === 'listen') {
    if (/\s/.test(e.lemma) || e.lemma.length < 3) return null;
    return Object.assign(base, { prompt: `<button class="btn big say-q" data-x="pr-say">🔊 ${esc(t('pr.q.listen', 'Play the word'))}</button><span class="hint">${esc(t('pr.q.listen.h', 'Hold for slow. Type what you hear.'))}</span>`, typed: true, answer: rv.word, say: rv.word, sayLang: lang });
  }
  if (c.mode === 'parts') {
    const p = e.verb && e.verb.principal_parts; if (e.pos !== 'verb' || !p || e.verb.regular !== false || !p[1] || !p[2] || /\s/.test(e.lemma)) return null;
    return Object.assign(base, { prompt: `<span class="big" lang="${lang}">${esc(rv.word)}</span><span class="hint">${esc(gloss(e))} · ${esc(t('pr.q.parts', 'past form, participle'))}</span>`, typed: true, two: true, answer: p[1] + ', ' + p[2], parts: [p[1], p[2]] });
  }
  return null;
}
/* ---------- flashcards: SM-2 spaced repetition over saved words and lists ---------- */
const DAY = 864e5;
function deckIds() { const P = A.P; return [...new Set([...Object.keys(P.favs), ...P.lists.flatMap(L => L.ids)])]; }
function dueIds(now) { now = now || Date.now(); return deckIds().filter(id => { const c = A.P.srs[id]; return !c || c.due <= now; }); }
function sm2(c, q) {          // q: 1 again, 3 hard, 4 good, 5 easy
  c = Object.assign({ ef: 2.5, n: 0, iv: 0 }, c || {});
  if (q < 3) { c.n = 0; c.iv = 0; c.due = Date.now() + 10 * 60e3; }
  else { c.n++; c.iv = c.n === 1 ? 1 : c.n === 2 ? 6 : Math.round(c.iv * c.ef * (q === 3 ? 0.8 : q === 5 ? 1.3 : 1)); c.ef = Math.max(1.3, c.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))); c.due = Date.now() + c.iv * DAY; }
  c.last = Date.now(); return c;
}
const ivText = c => c.iv ? t('fc.days', '{n} d', { n: c.iv }) : t('fc.min', '10 min');
async function startCards() {
  const ids = dueIds().slice(0, 20);
  const msg = $('#pr-msg');
  if (!ids.length) { if (msg) msg.textContent = deckIds().length ? t('fc.none', 'No cards are due. Come back later!') : t('fc.empty', 'Save words with ☆ or put them in a list first; they become your flashcards.'); return; }
  await A.ensureIds(ids);
  V.fc = { ids: ids.filter(id => A.D.byId.has(id)), i: 0, flipped: false, done: 0 };
  paintPractice();
}
function cardsHtml() {
  const fc = V.fc, id = fc.ids[fc.i];
  if (!id) return `<div class="result"><p class="big">${esc(t('fc.done', 'Done: {n} cards reviewed.', { n: fc.done }))} 🎉</p><p class="hint">${esc(t('fc.next', 'Next card due: {d}', { d: nextDue() }))}</p><button class="btn" data-x="fc-stop">${esc(t('pr.stop', 'Stop'))}</button></div>`;
  const e = A.D.byId.get(id), rv = A.regionView(e), art = e.pos === 'noun' ? A.article(e.lang, e, rv.word) : '';
  const head = `<div class="prhead"><span>${esc(t('fc.n', 'Card {i} of {n}', { i: fc.i + 1, n: fc.ids.length }))}</span><button class="chip" data-x="fc-stop">${esc(t('pr.stop', 'Stop'))}</button></div>`;
  const front = `<div class="q fc"><span class="hint">${A.flag(A.S.main[e.lang], true)}${esc(A.LNAME[e.lang])}</span><span class="big" lang="${e.lang}">${art ? A.artHtml(art, e.noun && e.noun.gender) + ' ' : ''}${esc(rv.word)}</span><button class="btn sm" data-x="fc-say">🔊</button></div>`;
  if (!fc.flipped) return head + front + `<button class="btn primary" data-x="fc-flip" id="fc-flip">${esc(t('fc.show', 'Show the answer'))}</button>`;
  const c = A.P.srs[id];
  const grades = [[1, t('fc.again', 'Again')], [3, t('fc.hard', 'Hard')], [4, t('fc.good', 'Good')], [5, t('fc.easy', 'Easy')]];
  return head + front + miniCard(e).replace(/<button class="btn sm" data-open[^]*?<\/button>/, '') + `<div class="choices grades">${grades.map(([q, n]) => `<button class="choice g${q}" data-fc="${q}">${esc(n)}<small>${esc(ivText(sm2(c, q)))}</small></button>`).join('')}</div>`;
}
function nextDue() { const ds = deckIds().map(id => (A.P.srs[id] || {}).due).filter(Boolean); if (!ds.length) return '—'; return new Date(Math.min(...ds)).toLocaleString(A.S.ui, { dateStyle: 'medium', timeStyle: 'short' }); }

async function startPractice() {
  const c = V.pc; A.S.practice = c; A.saveSettings();
  const msg = $('#pr-msg'); if (msg) msg.textContent = t('pr.making', 'Preparing the questions…');
  const qs = await makeQuestions(c);
  if (!qs.length) { if (msg) msg.textContent = c.mode === 'review' ? t('pr.none.review', 'No mistakes to review. Well done!') : t('pr.none', 'No words fit these choices. Try another level, language or word list.'); return; }
  V.pr = { qs, i: 0, right: 0, wrong: [], q: qs[0], state: null, sel: {} };
  paintPractice();
  if (V.pr.q.say) setTimeout(() => A.speak(V.pr.q.say, V.pr.q.sayLang), 300);
}
function questionHtml() {
  const pr = V.pr, q = pr.q, n = pr.qs.length;
  const head = `<div class="prhead"><span>${esc(t('pr.qn', 'Question {i} of {n}', { i: pr.i + 1, n }))}</span><span>✓ ${pr.right}</span><button class="chip" data-x="pr-stop">${esc(t('pr.stop', 'Stop'))}</button></div>`;
  if (q.mode === 'match') {
    const cols = q.cols || (q.cols = ALL.map(l => shuffle(q.rows.map((r, k) => ({ k, e: r[l] })))));
    return head + `<p class="hint">${esc(t('pr.hint.match', 'Find the same word in all four languages.'))} ${esc(t('pr.match.how', 'Tap one word in each column.'))}</p><div class="match">${ALL.map((l, ci) => `<div class="mcol"><div class="mh">${A.flag(A.S.main[l], true)}${esc(A.LNAME[l])}</div>${cols[ci].map(x => { const done = (q.done || []).includes(x.k), sel = pr.sel[l] === x.k; return `<button class="mw${done ? ' ok' : ''}${sel ? ' sel' : ''}" data-mlang="${l}" data-mk="${x.k}" lang="${l}"${done ? ' disabled' : ''}>${esc(A.regionView(x.e).word)}</button>`; }).join('')}</div>`).join('')}</div><div id="pr-fb" aria-live="polite">${pr.state === 'next' ? `<button class="btn primary" data-x="pr-next">${esc(t('pr.next', 'Next'))}</button>` : ''}</div>`;
  }
  let ans = '';
  if (q.choices) ans = `<div class="choices">${q.choices.map(ch => { let cls = ''; if (pr.state) { if (ch === q.answer) cls = ' ok'; else if (ch === pr.picked) cls = ' bad'; } return `<button class="choice${cls}" data-ch="${esc(ch)}"${pr.state ? ' disabled' : ''} lang="${q.lang}">${q.mode === 'gender' && A.ART_G ? '' : ''}${esc(q.names ? q.names[ch] : ch)}</button>`; }).join('')}</div>`;
  else ans = `<form id="pr-form" class="prform" autocomplete="off"><input class="text big" id="pr-in" lang="${q.lang}" autocapitalize="off" spellcheck="false" placeholder="${esc(q.two ? t('pr.ph.two', 'ging, gegangen') : t('pr.ph', 'Type the answer'))}"${pr.state ? ' disabled' : ''} value="${esc(pr.typed || '')}"><button class="btn primary"${pr.state ? ' disabled' : ''}>${esc(t('pr.check', 'Check'))}</button></form>`;
  let fb = '';
  if (pr.state === 'right') fb = `<p class="fb ok">✓ ${esc(t('pr.right', 'Right!'))} ${q.show && A.fold(q.show) !== A.fold(pr.typed || '') ? esc(q.show) : ''}</p>`;
  if (pr.state === 'wrong') fb = `<p class="fb bad">✗ ${esc(t('pr.wrong', 'Not quite. The answer is'))} <b lang="${q.lang}">${esc(q.show || (q.names ? q.names[q.answer] : q.answer))}</b>.</p>${miniCard(q.e)}`;
  if (pr.state) fb += `<button class="btn primary" data-x="pr-next" id="pr-next">${esc(pr.i + 1 >= n ? t('pr.finish', 'See the result') : t('pr.next', 'Next'))}</button>`;
  return head + `<div class="q ${pr.state === 'wrong' ? 'shake' : pr.state === 'right' ? 'tick' : ''}">${q.prompt}</div>${ans}<div id="pr-fb" aria-live="polite">${fb}</div>`;
}
function miniCard(e) {
  const rv = A.regionView(e), art = e.pos === 'noun' ? A.article(e.lang, e, rv.word) : '';
  const s = e.senses.find(x => ALL.some(l => l !== e.lang && A.trIds(x, l).length));
  const tr = s ? ALL.filter(l => l !== e.lang).map(l => { const id = A.trIds(s, l)[0], x = id && A.D.byId.get(id); return x ? `<span class="nowrap">${A.flag(A.S.main[l], true)}<span lang="${l}">${esc(A.withTo(x.id, x.lemma))}</span></span>` : ''; }).join(' &nbsp;') : '';
  return `<div class="minicard"><div><b class="hw sm" lang="${e.lang}">${art ? A.artHtml(art, e.noun && e.noun.gender) + ' ' : ''}${esc(rv.word)}</b> ${rv.ipa ? `<span class="ipa">/${esc(rv.ipa)}/</span>` : ''} <span class="pos">${esc(t('pos.' + e.pos, e.pos))}</span> ${A.lvlBadge(e, true)}</div>${rv.plural ? `<div class="hint">${esc(t('pr.mini.pl', 'plural'))}: ${esc(rv.plural)}</div>` : ''}${e.verb && e.verb.principal_parts ? `<div class="hint">${esc(e.verb.principal_parts.filter(Boolean).join(' · '))}${rv.aux ? ' · + ' + esc(rv.aux) : ''}</div>` : ''}<div>${tr}</div><button class="btn sm" data-open="${esc(e.id)}" data-x="pr-card">${esc(t('pr.card', 'Open the full card'))}</button></div>`;
}
function resultHtml() {
  const pr = V.pr, n = pr.total || pr.qs.length;
  return `<div class="result"><p class="big">${esc(t('pr.score', '{r} of {n} right', { r: pr.right, n }))} ${pr.right === n ? '🎉' : ''}</p>${pr.wrong.length ? `<p class="hint">${esc(t('pr.saved', 'Your mistakes are saved; choose “Review my mistakes” to practise them.'))}</p><div class="chips">${pr.wrong.map(e => `<button class="chip" data-open="${esc(e.id)}" lang="${e.lang}">${esc(A.withTo(e.id, e.lemma))}</button>`).join('')}</div>` : ''}</div>`;
}
function focusAnswer() { const i = $('#pr-in'); if (i && !i.disabled) setTimeout(() => i.focus(), 30); else { const b = $('#pr-next'); if (b) setTimeout(() => b.focus(), 30); } }
function judge(ok, picked) {
  const pr = V.pr, q = pr.q;
  pr.state = ok ? 'right' : 'wrong'; pr.picked = picked;
  const P = A.P;
  if (ok) { pr.right++; if (q.review) P.mistakes = (P.mistakes || []).filter(m => !(m.id === q.e.id && m.mode === q.mode)); }
  else { pr.wrong.push(q.e); P.mistakes = (P.mistakes || []).filter(m => !(m.id === q.e.id && m.mode === q.mode)).concat([{ mode: q.mode, id: q.e.id, to: q.to, t: Date.now() }]).slice(-200); }
  A.saveP(); paintPractice();
}
function checkTyped(v) {
  const q = V.pr.q; V.pr.typed = v;
  if (q.two) { const parts = v.split(/[,;/]+|\s{2,}/).map(norm).filter(Boolean); const want = q.parts.map(norm); judge(parts.length >= 2 && parts[0] === want[0] && parts[1] === want[1], v); return; }
  const ok = norm(v) === norm(q.answer) || norm(v).replace(/ss/g, 'ß') === norm(q.answer) || (q.show && norm(v) === norm(q.show));
  judge(ok, v);
}
function nextQ() {
  const pr = V.pr;
  pr.i++; pr.state = null; pr.typed = ''; pr.picked = null; pr.sel = {};
  if (pr.i >= pr.qs.length) { pr.q = null; pr.done = true; if (pr.qs[0] && pr.qs[0].mode === 'match') pr.total = pr.qs.reduce((a, q) => a + q.rows.length, 0); paintPractice(); return; }
  pr.q = pr.qs[pr.i]; paintPractice();
  if (pr.q.say) setTimeout(() => A.speak(pr.q.say, pr.q.sayLang), 250);
}
function matchPick(l, k) {
  const pr = V.pr, q = pr.q; q.done = q.done || [];
  pr.sel[l] = k;
  if (ALL.every(x => pr.sel[x] != null)) {
    const ks = ALL.map(x => pr.sel[x]), ok = ks.every(x => x === ks[0]);
    if (ok) { q.done.push(ks[0]); pr.right++; } else { const e = q.rows[ks[0]].de || q.rows[ks[0]][learnLang()]; pr.wrong.push(e); A.P.mistakes = (A.P.mistakes || []).concat([{ mode: 'translate', id: e.id, to: 'any', t: Date.now() }]).slice(-200); A.saveP(); }
    pr.sel = {};
    paintPractice();
    const fb = $('#pr-fb'); if (fb) fb.innerHTML = ok ? `<p class="fb ok tick">✓ ${esc(t('pr.right', 'Right!'))}</p>` : `<p class="fb bad shake">✗ ${esc(t('pr.match.no', 'These are not the same word. Try again.'))}</p>`;
    if (q.done.length >= q.rows.length) { pr.state = 'next'; paintPractice(); }
    else if (!ok) { /* stay */ }
  } else paintPractice();
}

/* ---------- Settings: Display, Audio, Data ---------- */
const setting = (id, label, hint, control) => `<div class="set"><label for="${id}">${esc(label)}</label>${control}${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</div>`;
const check = (id, key, label, hint) => `<div class="set check"><input type="checkbox" id="${id}" data-key="${key}"${A.S[key] ? ' checked' : ''}><div><label for="${id}">${esc(label)}</label>${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</div></div>`;
const select = (id, key, opts) => `<select id="${id}" data-key="${key}">${opts.map(([v, n]) => `<option value="${v}"${String(A.S[key]) === String(v) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
const UI_NAMES = { en: 'English', de: 'Deutsch', fr: 'Français', pt: 'Português' };
function voiceRows() {
  return ALL.map(l => {
    const vs = A.voicesFor(l), cur = A.voiceFor(l);
    return `<div class="set"><label for="s-voice-${l}">${A.flag(A.S.main[l], true)}${esc(t('set.voice', '{lang} voice', { lang: A.LNAME[l] }))}</label>${vs.length ? `<select id="s-voice-${l}" data-voice="${l}"><option value="">${esc(t('set.voice.auto', 'Automatic'))}${cur && !A.S.voice[l] ? ' (' + esc(cur.name) + ')' : ''}</option>${vs.map(v => `<option value="${esc(v.name)}"${A.S.voice[l] === v.name ? ' selected' : ''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('')}</select><div class="hint">✓ ${esc(t('set.voice.n', '{n} voices on this device. Pick a female or male voice by its name.', { n: vs.length }))} <button class="lnk" data-x="voice-test" data-l="${l}">${esc(t('set.voice.test', 'Test'))}</button></div>` : `<div class="hint warnt">✗ ${esc(t('set.voice.none', 'No {lang} voice on this device.', { lang: A.LNAME[l] }))} ${esc(t('set.voice.how', 'To add one: iPhone/iPad: Settings › Accessibility › Spoken Content › Voices. Android: Settings › System › Languages › Text-to-speech. Windows: Settings › Time & language › Speech › Add voices. Mac: System Settings › Accessibility › Spoken Content › System voice › Manage voices. Then reload this page.'))}</div>`}</div>`;
  }).join('');
}
function paintSettings() {
  const el = $('#settings');
  el.innerHTML = `<h2>${esc(t('nav.settings', 'Settings'))}</h2>
  <h3 class="grp">${esc(t('set.g.display', 'Display'))}</h3><div class="sets">
    ${setting('s-ui', t('set.ui', 'Interface language'), t('set.ui.h', 'The language of buttons and explanations.'), select('s-ui', 'ui', ALL.map(l => [l, UI_NAMES[l]])))}
    ${setting('s-theme', t('set.theme', 'Colours'), t('set.theme.h', '“Device” follows your device’s light or dark mode.'), select('s-theme', 'theme', [['system', t('set.theme.system', 'Device')], ['light', t('set.theme.light', 'Light')], ['dark', t('set.theme.dark', 'Dark')], ['midnight', t('set.theme.midnight', 'Midnight (black)')]]))}
    ${setting('s-size', t('set.size', 'Text size'), t('set.size.h', 'Makes all text and buttons larger or smaller.'), select('s-size', 'textSize', [[90, '90 %'], [100, '100 %'], [115, '115 %'], [130, '130 %'], [150, '150 %']]))}
    ${setting('s-mylevel', t('set.mylevel', 'My level'), t('set.mylevel.h', 'Used for the word of the day and for practice.'), select('s-mylevel', 'myLevel', LEVELS.map(l => [l, l + ' · ' + t('cefr.' + l, A.CEFR[l])])))}
    ${check('s-compact', 'compact', t('set.compact', 'Compact cards'), t('set.compact.h', 'Shows the essentials first; the rest opens with “All details”.'))}
    ${check('s-gcolor', 'gcolor', t('set.gcolor', 'Colours for der, die, das'), t('set.gcolor.h', 'Masculine blue ■, feminine red ●, neuter green ▲. The shapes stay when the colours are off.'))}
    ${check('s-anim', 'anim', t('set.anim', 'Animations'), t('set.anim.h', 'Cards slide in, flags turn, the star bounces. Always off when your device asks for reduced motion.'))}
    ${check('s-variants', 'variants', t('set.variants', 'Show other regions'), t('set.variants.h', 'When another country spells or says the word differently, list its form with the flag.'))}
    ${check('s-gsw', 'gsw', t('set.gsw', 'Show Swiss German'), t('set.gsw.h', 'Adds the dialect word (Schwiizerdütsch) to the German card.'))}
    ${setting('s-examples', t('set.examples', 'Context sentences per word'), t('set.examples.h', 'How many of the stored sentences each card shows.'), select('s-examples', 'examples', [[1, '1'], [2, '2'], [3, '3'], [4, '4']]))}
    ${setting('s-level', t('set.level', 'Sentence difficulty'), t('set.level.h', 'Easy shows the shortest stored sentences first, Advanced the longest.'), select('s-level', 'level', [['easy', t('set.level.easy', 'Easy (A1 to A2)')], ['medium', t('set.level.medium', 'Medium (A2 to B1)')], ['advanced', t('set.level.adv', 'Advanced (B2 to C1)')]]))}
    ${setting('s-sugg', t('set.sugg', 'Suggestions while typing'), t('set.sugg.h', 'How many words the list under a box shows.'), select('s-sugg', 'sugg', [[5, '5'], [8, '8'], [12, '12'], [20, '20']]))}
    ${check('s-links', 'links', t('set.links', 'Show outside dictionary links'), t('set.links.h', 'Off by default. Adds Wiktionary links for checking an entry.'))}
    <div class="set"><label>${esc(t('set.langs', 'My languages'))}</label><div class="hint">${esc(t('set.langs.now', 'I speak {s}, I am learning {l}. The four boxes follow this order.', { s: A.LNAME[A.S.speak || 'en'], l: A.LNAME[learnLang()] }))}</div><div><button class="btn sm" data-x="onboard">${esc(t('set.langs.change', 'Change my languages'))}</button></div></div>
  </div>
  <h3 class="grp">${esc(t('set.g.audio', 'Audio'))}</h3><div class="sets">
    ${check('s-slow', 'slow', t('set.slow', 'Slow speech'), t('set.slow.h', 'Plays everything slowly. Without this, hold a speaker button to hear one word slowly.'))}
    ${check('s-autoplay', 'autoplay', t('set.autoplay', 'Say the word when a card opens'), t('set.autoplay.h', 'Off by default.'))}
    ${check('s-playall', 'playAll', t('set.playall', 'Play all four languages after a lookup'), t('set.playall.h', 'Off by default. The ▶ button above the cards does the same on request.'))}
    ${voiceRows()}
  </div>
  <h3 class="grp">${esc(t('set.g.data', 'Data'))}</h3><div class="sets">
    <div class="set"><label for="s-clear">${esc(t('set.clear', 'Saved copy of the dictionary'))}</label><div><button class="btn" id="s-clear">${esc(t('set.clear.btn', 'Clear recent words and the saved copy'))}</button></div><div class="hint" id="s-clear-msg" aria-live="polite">${esc(t('set.clear.h', 'Your saved words and lists are kept. The dictionary is loaded again next time you are online.'))}</div></div>
    <div class="set"><label>${esc(t('set.mywords', 'My words'))}</label><div><button class="btn" data-x="go-file">${esc(t('set.mywords.btn', 'Export or import my words'))}</button></div><div class="hint">${esc(t('set.mywords.h', 'Saved words, lists, notes and history stay only in this browser.'))}</div></div>
    <div class="set"><label>${esc(t('set.install', 'Use it like an app'))}</label>${installHtml()}</div>
    <div class="set"><label>${esc(t('set.reset', 'Reset'))}</label><div><button class="btn" data-x="reset">${esc(t('set.reset.btn', 'Reset all settings to defaults'))}</button></div><div class="hint">${esc(t('set.reset.h', 'Your words, lists and notes are not touched.'))}</div></div>
  </div>`;
  el.querySelectorAll('[data-key]').forEach(c => c.addEventListener('change', () => {
    const k = c.dataset.key, S = A.S;
    S[k] = c.type === 'checkbox' ? c.checked : (typeof A.DEFAULTS[k] === 'number' ? +c.value : c.value);
    A.saveSettings(); A.applyDisplay();
    if (k === 'ui') { A.applyTexts(); A.buildSlots(); counter(); paintSettings(); A.paintRecent(); A.paintWotd(); }
    if (k === 'myLevel') A.paintWotd();
    if (A.state.status === 'done') A.render(false);
  }));
  el.querySelectorAll('[data-voice]').forEach(c => c.addEventListener('change', () => { A.S.voice[c.dataset.voice] = c.value; A.saveSettings(); }));
  $('#s-clear').addEventListener('click', async () => {
    try { localStorage.removeItem('flt:recent3'); } catch (e) {}
    let msg = t('set.clear.ok1', 'Cleared the recent words.');
    try { await new Promise((res, rej) => { const r = indexedDB.open('flt-data', 1); r.onsuccess = () => { const db = r.result, tx = db.transaction('files', 'readwrite'); tx.objectStore('files').clear(); tx.oncomplete = res; tx.onerror = rej; }; r.onerror = rej; }); msg = t('set.clear.ok2', 'Cleared the recent words and the saved copy of the data. The data is loaded again the next time you open the app with an internet connection.'); } catch (e) {}
    $('#s-clear-msg').textContent = msg;
  });
}

/* ---------- welcome: I speak / I'm learning (arranges the four boxes) ---------- */
function onboard() {
  const el = $('#welcome'); const S = A.S;
  if (!V.ob) { const sp0 = S.speak || S.ui || 'en'; V.ob = { speak: sp0, learn: S.learning || (sp0 === 'de' ? 'en' : 'de'), level: S.myLevel }; }
  const sp = V.ob.speak, le = V.ob.learn;
  el.hidden = false;
  el.innerHTML = `<h2>${esc(t('ob.title', 'Welcome'))}</h2><p>${esc(t('ob.p', 'Tell the app which languages you know, so it can put them in the right order. You can change this later in Settings.'))}</p>
  <div class="obrow"><span>${esc(t('ob.speak', 'I speak'))}</span>${ALL.map(l => `<button class="chip${l === sp ? ' sel' : ''}" data-ob="speak" data-l="${l}">${A.flag(BASEF(l), true)}${esc(UI_NAMES[l])}</button>`).join('')}</div>
  <div class="obrow"><span>${esc(t('ob.learn', 'I am learning'))}</span>${ALL.map(l => `<button class="chip${l === le ? ' sel' : ''}" data-ob="learn" data-l="${l}">${A.flag(BASEF(l), true)}${esc(UI_NAMES[l])}</button>`).join('')}</div>
  <div class="obrow"><span>${esc(t('ob.level', 'My level'))}</span>${LEVELS.map(l => `<button class="chip${l === V.ob.level ? ' sel' : ''}" data-ob="level" data-l="${l}">${l}</button>`).join('')}</div>
  <div class="row"><button class="btn primary" data-x="ob-done">${esc(t('ob.go', 'Start'))}</button><button class="btn" data-x="ob-skip">${esc(t('ob.skip', 'Skip'))}</button></div>`;
}
const BASEF = l => A.S.main[l];
function onboardDone(skip) {
  const S = A.S;
  if (!skip && V.ob) {
    S.speak = V.ob.speak; S.learning = V.ob.learn === V.ob.speak ? null : V.ob.learn; S.myLevel = V.ob.level; S.ui = V.ob.speak;
    S.order = [V.ob.speak, ...(S.learning ? [S.learning] : []), ...ALL.filter(l => l !== V.ob.speak && l !== S.learning)];
    A.saveSettings();
  }
  try { localStorage.setItem('flt:onboarded', '1'); } catch (e) {}
  V.ob = null;
  $('#welcome').hidden = true;
  A.applyDisplay(); A.applyTexts(); A.buildSlots(); counter(); A.paintRecent(); A.paintWotd();
  if (A.state.status === 'done') A.render(); else A.render();
  maybeInstallTip();
}

/* ---------- add to home screen ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; maybeInstallTip(); });
const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone; } catch (e) { return false; } };
function installHtml() {
  if (standalone()) return `<div class="hint">✓ ${esc(t('inst.done', 'The app is on your home screen.'))}</div>`;
  return `${installEvt ? `<div><button class="btn" data-x="install">${esc(t('inst.btn', 'Add to home screen'))}</button></div>` : ''}<div class="hint">${esc(t('inst.how', 'iPhone/iPad (Safari): Share button › Add to Home Screen. Android (Chrome): menu ⋮ › Add to Home screen or Install app. Computer (Chrome, Edge): install icon at the right of the address bar.'))}</div>`;
}
function maybeInstallTip() {
  const el = $('#install-tip'); if (!el) return;
  let n = 0; try { n = +localStorage.getItem('flt:visits') || 0; } catch (e) {}
  const off = (() => { try { return localStorage.getItem('flt:tip-off'); } catch (e) { return 1; } })();
  if (standalone() || off || n < 2 || !$('#welcome').hidden) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span>📱 ${esc(t('inst.tip', 'Tip: add the translator to your home screen to open it like an app, also offline.'))}</span>${installEvt ? `<button class="chip" data-x="install">${esc(t('inst.btn', 'Add to home screen'))}</button>` : `<span class="hint">${esc(t('inst.short', 'iPhone: Share › Add to Home Screen · Android: ⋮ › Install app'))}</span>`}<button class="chip" data-x="tip-off" aria-label="${esc(t('btn.close', 'Close'))}">×</button>`;
}

/* ---------- clicks in the views ---------- */
document.addEventListener('click', async ev => {
  const tb = ev.target.closest('[data-tab]'); if (tb) { const [g, k] = tb.dataset.tab.split(':'); V.tab[g] = k; V.more = false; paint(g === 'explore' ? 'explore' : 'me'); return; }
  const lv = ev.target.closest('[data-xlevel]'); if (lv) { V.xlevel = lv.dataset.xlevel; V.more = false; paintExplore(); return; }
  const ps = ev.target.closest('[data-xpos]'); if (ps) { V.xpos = ps.dataset.xpos; V.more = false; paintExplore(); return; }
  const lt = ev.target.closest('[data-xletter]'); if (lt) { V.xletter = lt.dataset.xletter; V.more = false; paintExplore(); return; }
  const ob = ev.target.closest('[data-ob]'); if (ob) { V.ob[ob.dataset.ob] = ob.dataset.l; if (ob.dataset.ob === 'speak') { A.S.ui = ob.dataset.l; A.applyTexts(); } onboard(); return; }
  const fg = ev.target.closest('[data-fc]'); if (fg && V.fc) { const id = V.fc.ids[V.fc.i]; A.P.srs[id] = sm2(A.P.srs[id], +fg.dataset.fc); A.saveP(); if (+fg.dataset.fc < 3) V.fc.ids.push(id); V.fc.i++; V.fc.done++; V.fc.flipped = false; paintPractice(); return; }
  const ch = ev.target.closest('.choice'); if (ch && V.pr && V.pr.q && !V.pr.state) { judge(ch.dataset.ch === V.pr.q.answer, ch.dataset.ch); return; }
  const mw = ev.target.closest('.mw'); if (mw && V.pr && V.pr.q) { matchPick(mw.dataset.mlang, +mw.dataset.mk); return; }
  const nav = ev.target.closest('.navb'); if (nav) { togglePanel(nav.id.replace('-toggle', '')); return; }
  const x = ev.target.closest('[data-x]'); if (!x) return;
  const k = x.dataset.x, P = A.P;
  if (k === 'random') { const lang = V.xlang || learnLang(), mine = $('#x-rlevel') ? $('#x-rlevel').checked : true; V.rlevel = mine; const list = coreOf(lang).filter(e => ['noun', 'verb', 'adjective', 'adverb'].includes(e.pos) && (!mine || (A.levelOf(e) || {}).l === A.S.myLevel)); if (list.length) A.openId(list[Math.floor(Math.random() * list.length)].id); }
  else if (k === 'more') { V.more = true; paintExplore(); }
  else if (k === 'export') exportMe();
  else if (k === 'export-csv') exportCsv();
  else if (k === 'export-anki') exportAnki();
  else if (k === 'print') printMe();
  else if (k === 'gram-close') { $('#grammar').hidden = true; }
  else if (k === 'hist-clear') { P.history = []; A.saveP(); A.paintRecent(); paintMe(); }
  else if (k === 'list-new') { const n = $('#me-newlist').value.trim(); if (n && !P.lists.some(L => L.name === n)) { P.lists.push({ name: n, ids: [], w: {} }); A.saveP(); paintMe(); } }
  else if (k === 'list-del') { const L = P.lists[+x.dataset.k]; if (L && confirmInline(x, t('me.del.sure', 'Delete “{l}”?', { l: L.name }))) { P.lists.splice(+x.dataset.k, 1); A.saveP(); paintMe(); } }
  else if (k === 'list-ren') { const L = P.lists[+x.dataset.k]; const box = document.createElement('span'); box.innerHTML = `<input class="text" value="${esc(L.name)}"> <button class="btn sm">${esc(t('btn.save', 'Save'))}</button>`; x.replaceWith(box); const i = box.querySelector('input'); i.focus(); box.querySelector('button').addEventListener('click', () => { const v = i.value.trim(); if (v) { L.name = v; A.saveP(); } paintMe(); }); }
  else if (k === 'fc-open') { V.pc = Object.assign(V.pc || practiceDefaults(), { mode: 'cards' }); V.pr = null; V.fc = null; togglePanel('practice', true); }
  else if (k === 'pr-saved' || k === 'pr-list') { V.pc = Object.assign(V.pc || practiceDefaults(), { source: k === 'pr-saved' ? 'saved' : 'list:' + x.dataset.k, mode: 'translate', level: 'all' }); V.pr = null; togglePanel('practice', true); }
  else if (k === 'pr-start') { readPracticeForm(); startPractice(); }
  else if (k === 'fc-start') { readPracticeForm(); startCards(); }
  else if (k === 'fc-flip') { V.fc.flipped = true; paintPractice(); }
  else if (k === 'fc-say') { const e = A.D.byId.get(V.fc.ids[V.fc.i]); if (e) { const rv = A.regionView(e); A.speak(A.withArt(e.pos === 'noun' ? A.article(e.lang, e, rv.word) : '', rv.word), e.lang); } }
  else if (k === 'fc-stop') { V.fc = null; paintPractice(); }
  else if (k === 'pr-stop') { V.pr = null; paintPractice(); }
  else if (k === 'pr-next') nextQ();
  else if (k === 'pr-say') { const q = V.pr && V.pr.q; if (q) A.speak(q.say, q.sayLang); }
  else if (k === 'pr-card') { /* data-open handles the card */ }
  else if (k === 'voice-test') { const l = x.dataset.l; A.speak({ en: 'Hello, this is my voice.', de: 'Hallo, das ist meine Stimme.', fr: 'Bonjour, voici ma voix.', pt: 'Olá, esta é a minha voz.' }[l], l); }
  else if (k === 'reset') { const keep = { speak: A.S.speak, learning: A.S.learning, ui: A.S.ui, order: A.S.order }; Object.keys(A.S).forEach(key => delete A.S[key]); Object.assign(A.S, JSON.parse(JSON.stringify(A.DEFAULTS)), keep); A.saveSettings(); A.applyDisplay(); A.applyTexts(); A.buildSlots(); paintSettings(); if (A.state.status === 'done') A.render(); A.toast(t('set.reset.ok', 'Settings are back to their defaults.')); }
  else if (k === 'go-file') { V.tab.me = 'file'; togglePanel('me', true); }
  else if (k === 'onboard') { closePanels(); V.ob = null; onboard(); $('#welcome').scrollIntoView({ block: 'start' }); }
  else if (k === 'ob-done') onboardDone(false);
  else if (k === 'ob-skip') onboardDone(true);
  else if (k === 'install') { if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; maybeInstallTip(); }); } }
  else if (k === 'tip-off') { try { localStorage.setItem('flt:tip-off', '1'); } catch (e) {} maybeInstallTip(); }
});
function confirmInline(btn, q) {        // second tap confirms, so no browser dialog is needed
  if (btn.dataset.sure) return true;
  btn.dataset.sure = '1'; btn.textContent = q; setTimeout(() => { delete btn.dataset.sure; }, 4000); return false;
}
document.addEventListener('change', ev => {
  const id = ev.target.id;
  if (id === 'x-lang') { V.xlang = ev.target.value; V.more = false; paintExplore(); }
  else if (['pr-mode', 'pr-lang', 'pr-to', 'pr-level', 'pr-src'].includes(id)) { readPracticeForm(); V.pr = null; paintPractice(); }
});
document.addEventListener('submit', ev => { if (ev.target.id === 'pr-form') { ev.preventDefault(); const v = $('#pr-in').value; if (v.trim()) checkTyped(v); } });
function readPracticeForm() {
  const c = V.pc || (V.pc = practiceDefaults()), g = id => { const e = $('#' + id); return e ? e.value : null; };
  c.mode = g('pr-mode') || c.mode; c.lang = g('pr-lang') || c.lang; c.to = g('pr-to') || c.to; c.level = g('pr-level') || c.level; c.source = g('pr-src') || c.source;
}

window.FLTViews = {
  init(api) {
    A = api;
    try { localStorage.setItem('flt:visits', String((+localStorage.getItem('flt:visits') || 0) + 1)); } catch (e) {}
    counter(); paintSettings();          // the settings exist from the start (hidden), so they can be read and set any time
    let done = null; try { done = localStorage.getItem('flt:onboarded'); } catch (e) { done = '1'; }
    if (!done) onboard(); else maybeInstallTip();
  },
  counter() { if (A) counter(); },
  voicesChanged() { if (A && !$('#settings').hidden) paintSettings(); },
  afterRender() { if (A) A.paintRecent(); },
  dataReady() { if (!A) return; for (const p of ['explore', 'practice', 'me']) if (!$('#' + p).hidden) paint(p); },
  closePanels, togglePanel, onboard, grammar, sm2,
  get practice() { return V; }
};
})();
