/* Glossarium: Quinque, a five-letter word game (guess the word in six tries).
   The player picks up to four languages; each language gets its own word and its own board. There is no daily limit:
   a new word comes as soon as a board is finished, or at any time with "New words". Everything stays on this device.
   Accents are ignored while typing (é = e), except the Swedish letters å, ä and ö, which are letters of their own.
   Uses window.FLT from app.js. */
(function () {
'use strict';
let A = null;
const $ = s => document.querySelector(s);
const t = (k, en, v) => A.t(k, en, v), esc = s => A.esc(s);
const LEN = 5, TRIES = 6, MAX_LANGS = 4;
const LV = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
const POS_OK = new Set(['noun', 'verb', 'adjective', 'adverb', 'numeral']);
const BAD_REG = /vulgar|offensive|derogatory/;
const KEEP = { sv: 'åäö' };                         // letters that are letters of their own, not accented forms
const ROWS = { de: ['qwertzuiop', 'asdfghjkl', 'yxcvbnm'], sv: ['qwertyuiopå', 'asdfghjklöä', 'zxcvbnm'], fr: ['azertyuiop', 'qsdfghjklm', 'wxcvbn'], default: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] };
const KEY_S = 'flt:game', KEY_STATS = 'flt:game-stats';
const G = { langs: null, level: 'B1', cb: false, boards: {}, active: null, msg: '', busy: false };
const pools = {};
const fl = l => A.flag((A.S.main && A.S.main[l]) || (A.BASE && A.BASE[l]) || l, true);                                  // lang -> { answers: [entry], valid: Set(letter strings) }

const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* the letters of a word as the game sees them, or null when the word cannot be played */
function letters(word, lang) {
  const keep = KEEP[lang] || '', out = [];
  for (const ch of Array.from(String(word).toLowerCase())) {
    if (keep.includes(ch)) { out.push(ch); continue; }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!/^[a-z]$/.test(base)) return null;
    out.push(base);
  }
  return out;
}

function buildPool(lang) {
  if (pools[lang]) return pools[lang];
  const answers = [], valid = new Set();
  const addValid = w => { const l = w && letters(w, lang); if (l && l.length === LEN) valid.add(l.join('')); };
  for (const e of A.D.byId.values()) {
    if (e.lang !== lang) continue;
    addValid(e.lemma);
    const v = e.verb, n = e.noun;
    if (v) { (v.principal_parts || []).forEach(addValid); addValid(v.present_3sg); }
    if (n) { addValid(n.plural); (n.plural_alt || []).forEach(addValid); if (n.cases) Object.values(n.cases).flat().forEach(addValid); }
    for (const x of [v, n, e.adjective]) if (x && x.irregular_forms) Object.values(x.irregular_forms).flat().forEach(f => typeof f === 'string' && addValid(f));
    if (e.tier !== 'core' || !POS_OK.has(e.pos)) continue;
    const l = letters(e.lemma, lang);
    if (!l || l.length !== LEN) continue;
    if (lang !== 'de' && e.lemma[0] !== e.lemma[0].toLowerCase()) continue;         // names and places
    if ((e.senses || []).some(s => BAD_REG.test(s.register || ''))) continue;
    answers.push(e);
  }
  return (pools[lang] = { answers, valid });
}

function pickWord(lang, avoid) {
  const p = buildPool(lang), max = LV[G.level] || 6;
  let list = p.answers.filter(e => { const v = A.levelOf(e); return v ? LV[v.l] <= max : max >= 5; });
  if (list.length < 40) list = p.answers;
  const recent = new Set(load(KEY_S + ':recent:' + lang, []));
  const fresh = list.filter(e => !recent.has(e.id) && e.id !== avoid);
  const pool = fresh.length ? fresh : list;
  const e = pool[Math.floor(Math.random() * pool.length)];
  if (e) { const r = [...recent, e.id].slice(-150); save(KEY_S + ':recent:' + lang, r); }
  return e || null;
}

function newBoard(lang) {
  const e = pickWord(lang, G.boards[lang] && G.boards[lang].id);
  if (!e) return null;
  return { id: e.id, ans: letters(e.lemma, lang), rows: [], cur: [], done: false, won: false, hint: false };
}

/* green / gold / grey for one guess, counting repeated letters correctly */
function score(guess, ans) {
  const res = Array(LEN).fill('x'), left = {};
  ans.forEach((c, i) => { if (guess[i] === c) res[i] = 'g'; else left[c] = (left[c] || 0) + 1; });
  guess.forEach((c, i) => { if (res[i] !== 'g' && left[c]) { res[i] = 'y'; left[c]--; } });
  return res;
}

function persist() {
  const b = {};
  for (const [l, x] of Object.entries(G.boards)) if (x) b[l] = { id: x.id, rows: x.rows, done: x.done, won: x.won, hint: x.hint };
  save(KEY_S, { langs: G.langs, level: G.level, cb: G.cb, active: G.active, boards: b });
}

function restore() {
  const s = load(KEY_S, {});
  const avail = A.dataLangs();
  G.langs = (s.langs || []).filter(l => avail.includes(l)).slice(0, MAX_LANGS);
  if (!G.langs.length) G.langs = [A.S.learning || A.S.order[1] || 'de'].filter(l => avail.includes(l));
  G.level = s.level || A.S.myLevel || 'B1'; G.cb = !!s.cb;
  G.saved = s.boards || {}; G.active = s.active;
}

async function ensureLangs() {
  for (const l of G.langs) if (!A.D.loaded.has(l)) { G.msg = t('game.loading', 'Loading {lang}…', { lang: A.LNAME[l] }); paint(); await A.loadLang(l); delete pools[l]; }
  G.msg = '';
  for (const l of G.langs) {
    if (G.boards[l]) continue;
    const sv = G.saved && G.saved[l], e = sv && A.D.byId.get(sv.id);
    G.boards[l] = e ? { id: e.id, ans: letters(e.lemma, l), rows: sv.rows || [], cur: [], done: !!sv.done, won: !!sv.won, hint: !!sv.hint } : newBoard(l);
  }
  for (const l of Object.keys(G.boards)) if (!G.langs.includes(l)) delete G.boards[l];
  if (!G.langs.includes(G.active)) G.active = G.langs[0];
  persist();
}

function stats(lang) { const all = load(KEY_STATS, {}); return all[lang] || { played: 0, won: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0] }; }
function record(lang, won, tries) {
  const all = load(KEY_STATS, {}), s = all[lang] || { played: 0, won: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0] };
  s.played++; if (won) { s.won++; s.streak++; s.best = Math.max(s.best, s.streak); s.dist[tries - 1]++; } else s.streak = 0;
  all[lang] = s; save(KEY_STATS, all);
}

/* what the hidden word means, in the language the player speaks (or English) */
function meaning(e) {
  const to = [A.S.speak, 'en', ...A.S.order].find(l => l && l !== e.lang && A.D.loaded.has(l));
  const s = (e.senses || [])[0]; if (!s) return '';
  if (to) { const ids = A.trIds(s, to).slice(0, 3); if (ids.length) return ids.map(id => A.D.byId.get(id).lemma).join(', '); }
  return s.gloss_en || '';
}

/* ---------- typing ---------- */
function type(key) {
  const b = G.boards[G.active]; if (!b || b.done || G.busy) return;
  G.msg = '';
  if (key === 'enter') return submit(b);
  if (key === 'back') { b.cur.pop(); return paint(); }
  const l = letters(key, G.active);
  if (!l || l.length !== 1 || b.cur.length >= LEN) return;
  b.cur.push(l[0]); paint();
}

function submit(b) {
  if (b.cur.length < LEN) { G.msg = t('game.short', 'Not enough letters.'); shake(); return paint(); }
  const w = b.cur.join(''), p = buildPool(G.active);
  if (!p.valid.has(w) && w !== b.ans.join('')) { G.msg = t('game.unknown', '“{w}” is not in the word list.', { w: w.toUpperCase() }); shake(); return paint(); }
  b.rows.push(b.cur.slice()); b.cur = [];
  const won = w === b.ans.join('');
  if (won || b.rows.length >= TRIES) {
    b.done = true; b.won = won; record(G.active, won, b.rows.length);
    if (won && window.FLTProgress && FLTProgress.record) { try { FLTProgress.record(b.id, true, 'game'); } catch (e) {} }
    G.msg = won ? [t('game.win1', 'Genius!'), t('game.win2', 'Magnificent!'), t('game.win3', 'Impressive!'), t('game.win4', 'Splendid!'), t('game.win5', 'Great!'), t('game.win6', 'Phew!')][b.rows.length - 1] : '';
    const next = G.langs.find(l => G.boards[l] && !G.boards[l].done);
    if (next) setTimeout(() => { G.active = next; persist(); paint(); }, 1600);
  }
  persist(); paint(true);
}

function shake() { const r = $('#gm-board .gm-row.cur'); if (r && A.animOn()) { r.classList.remove('shake'); void r.offsetWidth; r.classList.add('shake'); } }

/* ---------- drawing ---------- */
function keyColours(b) {
  const k = {}, rank = { x: 1, y: 2, g: 3 };
  for (const row of b.rows) score(row, b.ans).forEach((r, i) => { const c = row[i]; if (!k[c] || rank[r] > rank[k[c]]) k[c] = r; });
  return k;
}

function boardHtml(b, lang, reveal) {
  const rows = [];
  for (let i = 0; i < TRIES; i++) {
    const g = b.rows[i], cur = !b.done && i === b.rows.length, sc = g ? score(g, b.ans) : null;
    const cells = [];
    for (let j = 0; j < LEN; j++) {
      const ch = g ? g[j] : cur ? (b.cur[j] || '') : '';
      const cls = sc ? ' ' + sc[j] : ch ? ' typed' : '';
      const anim = sc && reveal && i === b.rows.length - 1 && A.animOn() ? ` style="animation-delay:${j * 0.12}s"` : '';
      cells.push(`<span class="gm-cell${cls}${anim ? ' flip' : ''}"${anim}>${esc(ch.toUpperCase())}</span>`);
    }
    const label = sc ? sc.map((r, j) => g[j].toUpperCase() + ' ' + (r === 'g' ? t('game.a.g', 'right') : r === 'y' ? t('game.a.y', 'elsewhere') : t('game.a.x', 'not in the word'))).join(', ') : '';
    rows.push(`<div class="gm-row${cur ? ' cur' : ''}"${label ? ` aria-label="${esc(label)}"` : ''}>${cells.join('')}</div>`);
  }
  return `<div class="gm-board" id="gm-board" lang="${lang}">${rows.join('')}</div>`;
}

function keyboardHtml(b, lang) {
  const kc = keyColours(b), rows = (ROWS[lang] || ROWS.default).map(r => Array.from(r));
  const extra = new Set(b.ans.filter(c => !rows.some(r => r.includes(c))));
  if (extra.size) rows[2] = [...rows[2], ...extra];
  return `<div class="gm-keys" role="group" aria-label="${esc(t('game.keys', 'Keyboard'))}">${rows.map((r, i) => `<div class="gm-krow">${i === 2 ? `<button class="gm-key wide" data-gk="enter">${esc(t('game.enter', 'Enter'))}</button>` : ''}${r.map(c => `<button class="gm-key ${kc[c] || ''}" data-gk="${c}">${c.toUpperCase()}</button>`).join('')}${i === 2 ? `<button class="gm-key wide" data-gk="back" aria-label="${esc(t('game.back', 'Delete'))}">⌫</button>` : ''}</div>`).join('')}</div>`;
}

function resultHtml(b, lang) {
  const e = A.D.byId.get(b.id); if (!e) return '';
  const s = stats(lang), pct = s.played ? Math.round(100 * s.won / s.played) : 0;
  const word = A.withTo ? A.withTo(e.id, e.lemma) : e.lemma;
  return `<div class="gm-result">
    <p>${b.won ? esc(t('game.got', 'You found it in {n} of 6.', { n: b.rows.length })) : esc(t('game.lost', 'The word was:'))}
      <button class="chip" data-open="${esc(e.id)}" lang="${lang}">${e.pos === 'noun' && e.noun && e.noun.gender ? A.artHtml(A.article(lang, e, e.lemma), e.noun.gender) + ' ' : ''}${esc(word)}${A.lvlBadge(e, true)}</button>
      <button class="chip" data-gx="say" aria-label="${esc(t('game.say', 'Listen'))}">🔊</button></p>
    <p class="hint">${esc(meaning(e))}</p>
    <p class="hint">${esc(t('game.stats', '{lang}: {p} played · {w} % won · streak {s} (best {b})', { lang: A.LNAME[lang], p: s.played, w: pct, s: s.streak, b: s.best }))}</p>
    <button class="btn primary" data-gx="next">${esc(t('game.next', 'Next word'))}</button>
  </div>`;
}

function paint(reveal) {
  const el = $('#game'); if (!el || el.hidden || !A) return;
  if (!G.langs) restore();
  const avail = A.dataLangs();
  const chooser = `<div class="gm-langs">${avail.map(l => { const on = G.langs.includes(l); return `<button class="chip${on ? ' sel' : ''}" data-gl="${l}" aria-pressed="${on}"${!on && G.langs.length >= MAX_LANGS ? ' disabled' : ''}>${fl(l)}${esc(A.LNAME[l])}</button>`; }).join('')}</div>`;
  const opts = `<div class="gm-opts"><label>${esc(t('game.level', 'Words up to'))} <select id="gm-level">${['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(l => `<option${l === G.level ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <label><input type="checkbox" id="gm-cb"${G.cb ? ' checked' : ''}> ${esc(t('game.cb', 'Colour-blind colours'))}</label>
    <button class="btn sm" data-gx="new">${esc(t('game.new', 'New words'))}</button></div>`;
  let body = '';
  if (G.msg && !G.boards[G.active]) body = `<p class="hint">${esc(G.msg)}</p>`;
  else if (!G.langs.length) body = `<p class="hint">${esc(t('game.pick', 'Choose one to four languages.'))}</p>`;
  else {
    const b = G.boards[G.active];
    const tabs = G.langs.length > 1 ? `<div class="tabs gm-tabs" role="tablist">${G.langs.map(l => { const x = G.boards[l]; const mark = x && x.done ? (x.won ? ' ✓' : ' ✗') : x && x.rows.length ? ` ${x.rows.length}/6` : ''; return `<button class="tabb${l === G.active ? ' on' : ''}" role="tab" aria-selected="${l === G.active}" data-gt="${l}">${fl(l)}${esc(A.LNAME[l])}${mark}</button>`; }).join('')}</div>` : '';
    if (!b) body = tabs + `<p class="hint">${esc(t('game.nowords', 'No five-letter words found for this language.'))}</p>`;
    else {
      const e = A.D.byId.get(b.id);
      const hint = !b.done ? (b.hint && e ? `<p class="hint gm-hint">💡 ${esc(meaning(e))}</p>` : `<button class="chip" data-gx="hint">💡 ${esc(t('game.hint', 'Show what it means'))}</button>`) : '';
      body = tabs + `<div class="gm-play">${boardHtml(b, G.active, reveal)}<p class="gm-msg" aria-live="polite">${esc(G.msg)}</p>${b.done ? resultHtml(b, G.active) : hint + keyboardHtml(b, G.active)}</div>`;
    }
  }
  el.innerHTML = `<h2>Quinque</h2><p class="hint">${esc(t('game.intro', 'Guess the five-letter word in six tries. Green: right letter, right place. Gold: the letter is in the word, somewhere else. Grey: not in the word. Accents do not count (é = e). Play as often as you like.'))}</p>${chooser}${opts}${body}`;
  el.classList.toggle('gm-cbc', G.cb);
}

async function refresh() { if (G.busy) return; G.busy = true; try { await ensureLangs(); } finally { G.busy = false; } paint(); }

/* ---------- events ---------- */
document.addEventListener('click', ev => {
  const el = $('#game'); if (!el || el.hidden || !el.contains(ev.target)) return;
  const k = ev.target.closest('[data-gk]'); if (k) { type(k.dataset.gk); return; }
  const tb = ev.target.closest('[data-gt]'); if (tb) { G.active = tb.dataset.gt; G.msg = ''; persist(); paint(); return; }
  const gl = ev.target.closest('[data-gl]');
  if (gl) {
    const l = gl.dataset.gl, i = G.langs.indexOf(l);
    if (i >= 0) { if (G.langs.length > 1) G.langs.splice(i, 1); } else if (G.langs.length < MAX_LANGS) { G.langs.push(l); G.active = l; }
    persist(); refresh(); return;
  }
  const x = ev.target.closest('[data-gx]'); if (!x) return;
  const b = G.boards[G.active];
  if (x.dataset.gx === 'next' && b) { G.boards[G.active] = newBoard(G.active); G.msg = ''; persist(); paint(); }
  else if (x.dataset.gx === 'new') { for (const l of G.langs) { const o = G.boards[l]; if (o && !o.done && o.rows.length) record(l, false, 0); G.boards[l] = newBoard(l); } G.msg = ''; G.active = G.langs[0]; persist(); paint(); }
  else if (x.dataset.gx === 'hint' && b) { b.hint = true; persist(); paint(); }
  else if (x.dataset.gx === 'say' && b) { const e = A.D.byId.get(b.id); if (e) A.speak(e.lemma, e.lang); }
});
document.addEventListener('change', ev => {
  if (ev.target.id === 'gm-level') { G.level = ev.target.value; persist(); }
  else if (ev.target.id === 'gm-cb') { G.cb = ev.target.checked; persist(); paint(); }
});
document.addEventListener('keydown', ev => {
  const el = $('#game'); if (!el || el.hidden || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const tg = ev.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
  if (ev.key === 'Enter') { if (tg && tg.closest && tg.closest('button') && !tg.closest('[data-gk]')) return; ev.preventDefault(); type('enter'); }
  else if (ev.key === 'Backspace') { ev.preventDefault(); type('back'); }
  else if (ev.key && Array.from(ev.key).length === 1 && /\p{L}/u.test(ev.key)) { ev.preventDefault(); type(ev.key); }
});

window.FLTGame = {
  init(api) { A = api; },
  paint() { if (!A) return; if (!G.langs) restore(); paint(); refresh(); },
  get state() { return G; },
  _letters: letters, _score: score
};
})();
