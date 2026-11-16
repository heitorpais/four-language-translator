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
const TRIES = 6, MAX_LANGS = 4;
const LV = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
const KEEP = { sv: 'åäö' };                         // letters that are letters of their own, not accented forms
const ROWS = { de: ['qwertzuiop', 'asdfghjkl', 'yxcvbnm'], sv: ['qwertyuiopå', 'asdfghjklöä', 'zxcvbnm'], fr: ['azertyuiop', 'qsdfghjklm', 'wxcvbn'], default: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] };
const KEY_S = 'flt:game', KEY_STATS = 'flt:game-stats';
const G = { langs: null, level: 'B1', len: 5, cb: false, view: 'all', boards: {}, active: null, msg: '', busy: false };
/* small line drawings used instead of emojis (shared with games.js) */
const SVG = {
  flag: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>',
  quinque: '<rect x="2" y="9" width="4" height="6"/><rect x="7" y="9" width="4" height="6" class="f"/><rect x="12" y="9" width="4" height="6"/><rect x="17" y="9" width="4" height="6" class="f"/>',
  hang: '<path d="M4 21h9M7 21V3h9v3"/><circle cx="16" cy="8.5" r="2.5"/><path d="M16 11v5m-3-3 3-1 3 1m-3 4-2 3m2-3 2 3"/>',
  ana: '<path d="M3 7h4l10 10h4M3 17h4l3-3m4-4 3-3h4m-3-3 3 3-3 3m0 4 3 3-3 3"/>',
  pairs: '<rect x="3" y="5" width="10" height="14" rx="1.5" transform="rotate(-8 8 12)"/><rect x="11" y="5" width="10" height="14" rx="1.5" transform="rotate(8 16 12)"/>',
  search: '<path d="M3 3h10v10H3zM3 8h10M8 3v10"/><circle cx="15" cy="15" r="4"/><path d="m18 18 3.5 3.5"/>',
  hive: '<path d="M8 3.5 11 5v3.5L8 10 5 8.5V5zM16 3.5 19 5v3.5L16 10l-3-1.5V5zM12 10.5l3 1.5v3.5L12 17l-3-1.5V12z" /><path d="M8 17.5l3 1.5v3"/>',
  grid: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1" class="f"/><path d="M5.5 9 7 5l1.5 4M6 7.7h2"/>',
  babel: '<path d="M4 21h16M6 21v-4h12v4M8 17v-4h8v4M9.5 13V9h5v4M11 9V5h2v4M12 5V2.5"/>',
  hint: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4m-4 4h8m-6-4h4v4"/>',
  heart: '<path class="f" d="M12 20s-7-4.4-8.6-8.6C2.2 8 4.4 5 7.5 5c2 0 3.5 1.2 4.5 2.7C13 6.2 14.5 5 16.5 5c3.1 0 5.3 3 4.1 6.4C19 15.6 12 20 12 20z"/>',
  heart0: '<path d="M12 20s-7-4.4-8.6-8.6C2.2 8 4.4 5 7.5 5c2 0 3.5 1.2 4.5 2.7C13 6.2 14.5 5 16.5 5c3.1 0 5.3 3 4.1 6.4C19 15.6 12 20 12 20z"/>',
  speaker: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  star: '<path class="f" d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'
};
const icon = (n, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${SVG[n] || ''}</svg>`;
const pools = {};
const fl = l => A.flag((A.S.main && A.S.main[l]) || (A.BASE && A.BASE[l]) || l, true);                                  // lang -> { answers: [entry], valid: Set(letter strings) }

const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* the letters of a word as the game sees them, or null when the word cannot be played */
function letters(word, lang) {
  const keep = KEEP[lang] || '', out = [];
  if (lang === 'de') word = String(word).replace(/ß/g, 'ss');
  for (const ch of Array.from(String(word).toLowerCase())) {
    if (keep.includes(ch)) { out.push(ch); continue; }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!/^[a-z]$/.test(base)) return null;
    out.push(base);
  }
  return out;
}

/* the word list of a language (built by build/game_words.py, data/game/game-<lang>.json.gz) */
async function loadPool(lang) {
  if (pools[lang]) return pools[lang];
  const f = (A.D.manifest && A.D.manifest.files || []).find(x => x.tier === 'game' && x.lang === lang);
  if (!f) return (pools[lang] = { answers: {}, valid: {} });
  const d = await A.getFile(f.file, f.sha256), valid = {};
  for (const [n, list] of Object.entries(d.valid || {})) valid[n] = new Set(list);
  return (pools[lang] = { answers: d.answers || {}, valid });
}
const pool = (lang, len) => { const p = pools[lang]; return { answers: (p && p.answers[len]) || [], valid: (p && p.valid[len]) || new Set() }; };

function pickWord(lang, len, avoid) {
  const p = pool(lang, len), max = LV[G.level] || 6;
  let list = p.answers.filter(a => { const v = A.levelOf({ level: a[3], frequency_rank: a[2] }); return v ? LV[v.l] <= max : max >= 5; });
  if (list.length < 40) list = p.answers;
  const rk = KEY_S + ':recent:' + lang + len, recent = new Set(load(rk, []));
  const fresh = list.filter(a => !recent.has(a[0]) && a[0] !== avoid);
  const from = fresh.length ? fresh : list;
  const a = from[Math.floor(Math.random() * from.length)];
  if (a) save(rk, [...recent, a[0]].slice(-300));
  return a || null;
}

function newBoard(lang) {
  const o = G.boards[lang], a = pickWord(lang, G.len, o && o.id);
  if (!a) return null;
  if (A.ensureIds && !A.D.byId.has(a[0])) A.ensureIds([a[0]]).then(() => paint()).catch(() => {});   // the full entry, for the meaning and the card
  return { id: a[0], lemma: a[1], def: a[4] || '', len: G.len, ans: letters(a[1], lang), rows: [], cur: [], done: false, won: false, hint: false };
}

/* green / gold / grey for one guess, counting repeated letters correctly */
function score(guess, ans) {
  const res = Array(ans.length).fill('x'), left = {};
  ans.forEach((c, i) => { if (guess[i] === c) res[i] = 'g'; else left[c] = (left[c] || 0) + 1; });
  guess.forEach((c, i) => { if (res[i] !== 'g' && left[c]) { res[i] = 'y'; left[c]--; } });
  return res;
}

function persist() {
  const b = {};
  for (const [l, x] of Object.entries(G.boards)) if (x) b[l] = { id: x.id, lemma: x.lemma, len: x.len, rows: x.rows, done: x.done, won: x.won, hint: x.hint };
  save(KEY_S, { langs: G.langs, level: G.level, len: G.len, cb: G.cb, view: G.view, active: G.active, boards: b });
}

function restore() {
  const s = load(KEY_S, {});
  const avail = A.dataLangs();
  G.langs = (s.langs || []).filter(l => avail.includes(l)).slice(0, MAX_LANGS);
  if (!G.langs.length) G.langs = [A.S.learning || A.S.order[1] || 'de'].filter(l => avail.includes(l));
  G.level = s.level || A.S.myLevel || 'B1'; G.cb = !!s.cb; G.view = s.view === 'one' ? 'one' : 'all'; G.len = s.len === 6 ? 6 : 5;
  G.saved = s.boards || {}; G.active = s.active;
}

async function ensureLangs() {
  for (const l of G.langs) if (!pools[l]) {
    G.msg = t('game.loading', 'Loading {lang}…', { lang: A.LNAME[l] }); paint();
    if (!A.D.loaded.has(l)) await A.loadLang(l);
    await loadPool(l);
  }
  G.msg = '';
  for (const l of G.langs) {
    if (G.boards[l] && G.boards[l].len === G.len) continue;
    const sv = G.saved && G.saved[l];
    if (sv && sv.lemma && (sv.len || 5) === G.len) {
      G.boards[l] = { id: sv.id, lemma: sv.lemma, len: G.len, ans: letters(sv.lemma, l), rows: sv.rows || [], cur: [], done: !!sv.done, won: !!sv.won, hint: !!sv.hint };
      if (A.ensureIds && !A.D.byId.has(sv.id)) A.ensureIds([sv.id]).then(() => paint()).catch(() => {});
    } else G.boards[l] = newBoard(l);
  }
  G.saved = null;
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

/* what the hidden word means, explained in the language being played (never the word itself, never a translation).
   The definitions come with the word list (build/game_words.py); the word is already blanked out there. */
function defOf(lang, id) {
  const p = pools[lang]; if (!p) return '';
  for (const list of Object.values(p.answers || {})) { const a = list.find(x => x[0] === id); if (a) return a[4] || ''; }
  return '';
}
function meaning(b, lang) {
  if (b.def == null) b.def = defOf(lang, b.id);
  return b.def || t('game.nodef', 'No explanation in this language for this word yet.');
}

/* ---------- typing ---------- */
function type(key) {
  const b = G.boards[G.active]; if (!b || b.done || G.busy) return;
  G.msg = '';
  if (key === 'enter') return submit(b);
  if (key === 'back') { b.cur.pop(); return paint(); }
  const l = letters(key, G.active);
  if (!l || l.length !== 1 || b.cur.length >= b.ans.length) return;
  b.cur.push(l[0]); paint();
}

function submit(b) {
  if (b.cur.length < b.ans.length) { G.msg = t('game.short', 'Not enough letters.'); shake(); return paint(); }
  const w = b.cur.join(''), p = pool(G.active, b.ans.length);
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

function shake() { const r = $('#gm-board .gm-row.cur') || $('.gm-mini.on .gm-row.cur'); if (r && A.animOn()) { r.classList.remove('shake'); void r.offsetWidth; r.classList.add('shake'); } }

/* ---------- drawing ---------- */
function keyColours(b) {
  const k = {}, rank = { x: 1, y: 2, g: 3 };
  for (const row of b.rows) score(row, b.ans).forEach((r, i) => { const c = row[i]; if (!k[c] || rank[r] > rank[k[c]]) k[c] = r; });
  return k;
}

function boardHtml(b, lang, reveal, mini) {
  const rows = [];
  for (let i = 0; i < TRIES; i++) {
    const g = b.rows[i], cur = !b.done && i === b.rows.length, sc = g ? score(g, b.ans) : null;
    const cells = [];
    for (let j = 0; j < b.ans.length; j++) {
      const ch = g ? g[j] : cur ? (b.cur[j] || '') : '';
      const cls = sc ? ' ' + sc[j] : ch ? ' typed' : '';
      const anim = sc && reveal && i === b.rows.length - 1 && A.animOn() ? ` style="animation-delay:${j * 0.12}s"` : '';
      cells.push(`<span class="gm-cell${cls}${anim ? ' flip' : ''}"${anim}>${esc(ch.toUpperCase())}</span>`);
    }
    const label = sc ? sc.map((r, j) => g[j].toUpperCase() + ' ' + (r === 'g' ? t('game.a.g', 'right') : r === 'y' ? t('game.a.y', 'elsewhere') : t('game.a.x', 'not in the word'))).join(', ') : '';
    rows.push(`<div class="gm-row${cur ? ' cur' : ''}"${label ? ` aria-label="${esc(label)}"` : ''}>${cells.join('')}</div>`);
  }
  return `<div class="gm-board"${mini ? '' : ' id="gm-board"'} lang="${lang}" style="--n:${b.ans.length}">${rows.join('')}</div>`;
}

function keyboardHtml(b, lang) {
  const kc = keyColours(b), rows = (ROWS[lang] || ROWS.default).map(r => Array.from(r));
  const extra = new Set(b.ans.filter(c => !rows.some(r => r.includes(c))));
  if (extra.size) rows[2] = [...rows[2], ...extra];
  return `<div class="gm-keys" role="group" aria-label="${esc(t('game.keys', 'Keyboard'))}">${rows.map((r, i) => `<div class="gm-krow">${i === 2 ? `<button class="gm-key wide" data-gk="enter">${esc(t('game.enter', 'Enter'))}</button>` : ''}${r.map(c => `<button class="gm-key ${kc[c] || ''}" data-gk="${c}">${c.toUpperCase()}</button>`).join('')}${i === 2 ? `<button class="gm-key wide" data-gk="back" aria-label="${esc(t('game.back', 'Delete'))}">⌫</button>` : ''}</div>`).join('')}</div>`;
}

function resultHtml(b, lang) {
  const e = A.D.byId.get(b.id) || { id: b.id, lemma: b.lemma, lang, pos: '', senses: [] };
  const s = stats(lang), pct = s.played ? Math.round(100 * s.won / s.played) : 0;
  const word = A.withTo ? A.withTo(e.id, e.lemma) : e.lemma;
  return `<div class="gm-result">
    <p>${b.won ? esc(t('game.got', 'You found it in {n} of 6.', { n: b.rows.length })) : esc(t('game.lost', 'The word was:'))}
      <button class="chip" data-open="${esc(e.id)}" lang="${lang}">${e.pos === 'noun' && e.noun && e.noun.gender ? A.artHtml(A.article(lang, e, e.lemma), e.noun.gender) + ' ' : ''}${esc(word)}${e.senses.length ? A.lvlBadge(e, true) : ''}</button>
      <button class="chip" data-gx="say" aria-label="${esc(t('game.say', 'Listen'))}">${icon('speaker')}</button></p>
    <p class="hint">${esc(meaning(b, lang))}</p>
    <p class="hint">${esc(t('game.stats', '{lang}: {p} played · {w} % won · streak {s} (best {b})', { lang: A.LNAME[lang], p: s.played, w: pct, s: s.streak, b: s.best }))}</p>
    <button class="btn primary" data-gx="next">${esc(t('game.next', 'Next word'))}</button>
  </div>`;
}

const root = () => { const p = $('#game'); return p && !p.hidden ? $('#gm-quinque') : null; };   // the Games tab (games.js) gives Quinque its place
function paint(reveal) {
  const el = root(); if (!el || !A) return;
  if (!G.langs) restore();
  const avail = A.dataLangs();
  const chooser = `<div class="gm-langs">${avail.map(l => { const on = G.langs.includes(l); return `<button class="chip${on ? ' sel' : ''}" data-gl="${l}" aria-pressed="${on}"${!on && G.langs.length >= MAX_LANGS ? ' disabled' : ''}>${fl(l)}${esc(A.LNAME[l])}${A.betaTag(l)}</button>`; }).join('')}</div>`;
  const opts = `<div class="gm-opts"><label>${esc(t('game.len', 'Letters'))} <select id="gm-len">${[5, 6].map(n => `<option value="${n}"${n === G.len ? ' selected' : ''}>${n}</option>`).join('')}</select></label><label>${esc(t('game.level', 'Words up to'))} <select id="gm-level">${['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(l => `<option${l === G.level ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <label><input type="checkbox" id="gm-cb"${G.cb ? ' checked' : ''}> ${esc(t('game.cb', 'Colour-blind colours'))}</label>
    ${G.langs && G.langs.length > 1 ? `<label>${esc(t('game.view', 'Show'))} <select id="gm-view"><option value="all"${G.view === 'all' ? ' selected' : ''}>${esc(t('game.view.all', 'All boards together'))}</option><option value="one"${G.view === 'one' ? ' selected' : ''}>${esc(t('game.view.one', 'One board at a time'))}</option></select></label>` : ''}
    <button class="btn sm" data-gx="new">${esc(t('game.new', 'New words'))}</button></div>`;
  let body = '';
  if (G.msg && !G.boards[G.active]) body = `<p class="hint">${esc(G.msg)}</p>`;
  else if (!G.langs.length) body = `<p class="hint">${esc(t('game.pick', 'Choose one to four languages.'))}</p>`;
  else {
    const b = G.boards[G.active];
    const status = x => x && x.done ? (x.won ? ' ✓' : ' ✗') : x && x.rows.length ? ` ${x.rows.length}/6` : '';
    const all = G.langs.length > 1 && G.view === 'all';
    const grid = all ? `<div class="gm-grid">${G.langs.map(l => { const x = G.boards[l]; return `<button class="gm-mini${l === G.active ? ' on' : ''}${x && x.done ? ' done' : ''}" data-gt="${l}" aria-pressed="${l === G.active}"><span class="gm-mini-t">${fl(l)}${esc(A.LNAME[l])}${status(x)}</span>${x ? boardHtml(x, l, reveal && l === G.active, true) : `<span class="hint">${esc(t('game.nowords2', 'No words of this length for this language.'))}</span>`}</button>`; }).join('')}</div>` : '';
    const tabs = all ? grid : G.langs.length > 1 ? `<div class="tabs gm-tabs" role="tablist">${G.langs.map(l => { const x = G.boards[l]; const mark = status(x); return `<button class="tabb${l === G.active ? ' on' : ''}" role="tab" aria-selected="${l === G.active}" data-gt="${l}">${fl(l)}${esc(A.LNAME[l])}${mark}</button>`; }).join('')}</div>` : '';
    if (!b && all) body = tabs;
    else if (!b) body = tabs + `<p class="hint">${esc(t('game.nowords2', 'No words of this length for this language.'))}</p>`;
    else {
      const hint = !b.done ? (b.hint ? `<p class="hint gm-hint">${icon('hint')} ${esc(meaning(b, G.active))}</p>` : `<button class="chip" data-gx="hint">${icon('hint')} ${esc(t('game.hint', 'Show what it means'))}</button>`) : '';
      const now = all ? `<p class="gm-now">${esc(t('game.now', 'Now playing: {lang}', { lang: A.LNAME[G.active] }))}</p>` : '';
      body = tabs + `<div class="gm-play">${all ? now : boardHtml(b, G.active, reveal)}<p class="gm-msg" aria-live="polite">${esc(G.msg)}</p>${b.done ? resultHtml(b, G.active) : hint + keyboardHtml(b, G.active)}</div>`;
    }
  }
  el.innerHTML = `<p class="hint">${esc(t('game.intro2', 'Guess the word in six tries. Green: right letter, right place. Gold: the letter is in the word, somewhere else. Grey: not in the word. Play as often as you like.'))}</p>
    <details class="gm-rules"><summary>${esc(t('game.rules', 'Rules'))}</summary><ul>
      <li>${esc(t('game.r1', 'Only dictionary forms count: nouns in the singular, verbs in the infinitive, adjectives in their basic form.'))}</li>
      <li>${esc(t('game.r2', 'No conjugated verbs, no plurals, no names, no abbreviations.'))}</li>
      <li>${esc(t('game.r3', 'Accents are ignored (é = e, ç = c). In Swedish, å, ä and ö are letters of their own. In German, ß is written ss.'))}</li>
      <li>${esc(t('game.r4', 'Every guess must be a word in the word list. The hidden word is an everyday word up to the level you choose.'))}</li>
    </ul></details>${chooser}${opts}${body}`;
  el.classList.toggle('gm-cbc', G.cb);
}

async function refresh() { if (G.busy) return; G.busy = true; try { await ensureLangs(); } finally { G.busy = false; } paint(); }

/* ---------- events ---------- */
document.addEventListener('click', ev => {
  const el = root(); if (!el || !el.contains(ev.target)) return;
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
  else if (x.dataset.gx === 'say' && b) A.speak(b.lemma, G.active);
});
document.addEventListener('change', ev => {
  if (ev.target.id === 'gm-level') { G.level = ev.target.value; persist(); }
  else if (ev.target.id === 'gm-len') { G.len = +ev.target.value; G.boards = {}; G.msg = ''; persist(); refresh(); }
  else if (ev.target.id === 'gm-view') { G.view = ev.target.value === 'one' ? 'one' : 'all'; persist(); paint(); }
  else if (ev.target.id === 'gm-cb') { G.cb = ev.target.checked; persist(); paint(); }
});
document.addEventListener('keydown', ev => {
  const el = root(); if (!el || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const tg = ev.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
  if (ev.key === 'Enter') { if (tg && tg.closest && tg.closest('button') && !tg.closest('[data-gk]')) return; ev.preventDefault(); type('enter'); }
  else if (ev.key === 'Backspace') { ev.preventDefault(); type('back'); }
  else if (ev.key && Array.from(ev.key).length === 1 && /\p{L}/u.test(ev.key)) { ev.preventDefault(); type(ev.key); }
});

window.FLTGame = {
  init(api) { A = api; },
  paint() { if (!A) return; if (!G.langs) restore(); paint(); refresh(); },
  get state() { return G; },
  _letters: letters, _score: score, _pool: pool, _loadPool: loadPool, icon
};
})();
