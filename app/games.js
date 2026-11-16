/* Glossarium: the Games tab. Eight word games, all built on the dictionary and playable in every language of the app:
     Quinque (game.js)  guess the word in six tries
     Hangman            guess the word letter by letter
     Anagram            put the letters back in order
     Pairs              find the word and its translation
     Word search        find the hidden words; the clues are their translations
     Honeycomb          make words from seven letters
     Letter grid        find words in a 4 × 4 grid of letters before the time runs out
     Babel (new)        one meaning in up to four languages: every letter you guess opens in all of them at once
   Up to four players can play on one device: they take turns, and the app keeps the score.
   Word lists: data/game/game-<lang>.json.gz (build/game_words.py), loaded through game.js. Uses window.FLT from app.js. */
(function () {
'use strict';
let A = null;
const $ = s => document.querySelector(s);
const t = (k, en, v) => A.t(k, en, v), esc = s => A.esc(s);
const KEY = 'flt:games';
const LV = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
const GAMES = ['quinque', 'hang', 'ana', 'pairs', 'search', 'hive', 'grid', 'babel'];
const icon = (n, c) => window.FLTGame.icon(n, c);
const POS_OK = new Set(['noun', 'verb', 'adjective', 'adverb']);
const H = { game: 'quinque', lang: null, lang2: null, langs: null, level: 'A2', players: [], cur: 0, scores: [], st: null, busy: false, msg: '' };
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fl = l => A.flag((A.S.main && A.S.main[l]) || (A.BASE && A.BASE[l]) || l, true);

function name(g) {
  return { quinque: 'Quinque', hang: t('gh.hang', 'Hangman'), ana: t('gh.ana', 'Anagram'), pairs: t('gh.pairs', 'Pairs'), search: t('gh.search', 'Word search'), hive: t('gh.hive', 'Honeycomb'), grid: t('gh.grid', 'Letter grid'), babel: 'Babel' }[g];
}
function about(g) {
  return {
    quinque: t('gh.quinque.d', 'Guess the word in six tries.'),
    hang: t('gh.hang.d', 'Guess the word letter by letter before the drawing is finished.'),
    ana: t('gh.ana.d', 'The letters of a word are mixed up. Put them back in order.'),
    pairs: t('gh.pairs.d', 'Turn over two cards at a time and find each word with its translation.'),
    search: t('gh.search.d', 'Find the hidden words in the grid. The clues are their translations.'),
    hive: t('gh.hive.d', 'Make as many words as you can from seven letters. Every word uses the middle letter.'),
    grid: t('gh.grid.d', 'Find words in the grid by joining letters that touch. You have three minutes.'),
    babel: t('gh.babel.d', 'New: one meaning in up to four languages. Every letter you guess opens in all of them at once, so each language helps you with the others.')
  }[g];
}

/* ---------- settings and players ---------- */
function mine() {
  const all = A.dataLangs();
  return [...new Set([A.S.learning, ...(A.S.order || []), A.S.speak].filter(l => l && all.includes(l)))];
}
function restore() {
  const s = load(KEY, {}), all = A.dataLangs(), m = mine();
  H.game = GAMES.includes(s.game) ? s.game : 'quinque';
  H.lang = all.includes(s.lang) ? s.lang : (m[0] || 'en');
  H.lang2 = all.includes(s.lang2) && s.lang2 !== H.lang ? s.lang2 : (m.find(l => l !== H.lang) || (H.lang === 'en' ? 'de' : 'en'));
  H.langs = (s.langs || []).filter(l => all.includes(l)).slice(0, 4);
  if (H.langs.length < 2) H.langs = m.slice(0, 4).length >= 2 ? m.slice(0, 4) : [H.lang, H.lang2];
  H.level = LV[s.level] ? s.level : (A.S.myLevel || 'A2');
  H.players = Array.isArray(s.players) && s.players.length ? s.players.slice(0, 4) : [''];
  H.scores = H.players.map(() => 0); H.cur = 0;
}
function persist() { save(KEY, { game: H.game, lang: H.lang, lang2: H.lang2, langs: H.langs, level: H.level, players: H.players }); }
const many = () => H.players.length > 1;
const pname = i => H.players[i] || t('gh.player', 'Player {n}', { n: i + 1 });
function resetScores() { H.scores = H.players.map(() => 0); H.cur = 0; }
function score(p) { if (p) H.scores[H.cur] = (H.scores[H.cur] || 0) + p; }
function nextTurn() { if (many()) H.cur = (H.cur + 1) % H.players.length; }
function scoreHtml(note) {
  if (!many()) return note ? `<p class="gh-turn">${esc(note)}</p>` : '';
  return `<div class="gh-score">${H.players.map((p, i) => `<span class="${i === H.cur ? 'on' : ''}">${esc(pname(i))}: <b>${A.num(H.scores[i] || 0)}</b></span>`).join('')}</div><p class="gh-turn">${esc(note || t('gh.turn', 'Your turn, {p}.', { p: pname(H.cur) }))}</p>`;
}
function winnerHtml() {
  if (!many()) return '';
  const best = Math.max(...H.scores), w = H.players.map((p, i) => i).filter(i => H.scores[i] === best);
  return `<p class="gh-win">${icon('trophy')} ${esc(w.length > 1 ? t('gh.draw', 'A draw: {p}.', { p: w.map(pname).join(', ') }) : t('gh.wins', '{p} wins!', { p: pname(w[0]) }))}</p>`;
}

/* ---------- words ---------- */
const letters = (w, l) => window.FLTGame._letters(w, l);
const foldCh = (ch, l) => { const x = letters(ch, l); return x ? x.join('') : ''; };
async function ready(langs) {
  for (const l of langs) {
    if (!A.D.loaded.has(l)) { H.msg = t('game.loading', 'Loading {lang}…', { lang: A.LNAME[l] }); paintStage(); await A.loadLang(l); }
    await window.FLTGame._loadPool(l);
  }
  H.msg = '';
}
const okLevel = a => { const v = A.levelOf({ level: a[3], frequency_rank: a[2] }); const max = LV[H.level] || 6; return v ? LV[v.l] <= max : max >= 5; };
/* a hidden word from the word list: [id, lemma, rank, level, meaning] */
function pickAnswer(lang, min, max, test) {
  let list = [];
  for (let n = min; n <= max; n++) list = list.concat(window.FLTGame._pool(lang, n).answers);
  let ok = list.filter(a => okLevel(a) && (!test || test(a)));
  if (ok.length < 30) ok = list.filter(a => !test || test(a));
  const rk = KEY + ':recent:' + lang, recent = new Set(load(rk, []));
  const fresh = ok.filter(a => !recent.has(a[0]));
  const a = (fresh.length ? fresh : ok)[rnd((fresh.length ? fresh : ok).length)];
  if (a) save(rk, [...recent, a[0]].slice(-400));
  return a || null;
}
function validSet(lang) {
  const p = {}; for (let n = 3; n <= 9; n++) p[n] = window.FLTGame._pool(lang, n).valid;
  return { has: w => !!(p[w.length] && p[w.length].has(w)), lists: p };
}
/* the first translation of an entry into another language, as a word */
function tr(e, to) {
  let any = null;
  for (const s of e.senses || []) {
    if (s.hidden) continue;
    const xs = A.trIds(s, to).map(id => A.D.byId.get(id)).filter(Boolean);
    const same = xs.find(x => x.pos === e.pos); if (same) return same;     // the same part of speech first: study (verb) = lernen, not das Lernen
    if (!any && xs.length) any = xs[0];
  }
  return any;
}
/* everyday dictionary words of a language (loaded core entries) that have a translation into every language in `to` */
function coreWords(lang, n, to, maxLen) {
  const max = LV[H.level] || 6, rows = (A.D.idx[lang] || []).filter(r => !r.a && r.r < 1e9).sort((a, b) => a.r - b.r);
  const out = [], seen = new Set();
  let pool = [];
  for (const r of rows) {
    const e = A.D.byId.get(r.id); if (!e || seen.has(e.lemma) || !POS_OK.has(e.pos)) continue;
    if ((e.senses || []).some(s => /vulgar|offensive|derogatory/.test(s.register || ''))) continue;
    const v = A.levelOf(e); if (v && LV[v.l] > max) continue;
    const x = letters(e.lemma, lang); if (!x || x.length < 3 || (maxLen && x.length > maxLen)) continue;
    const ts = to.map(l => tr(e, l)); if (ts.some(y => !y)) continue;
    seen.add(e.lemma); pool.push({ e, ts });
    if (pool.length >= 600) break;
  }
  pool = shuffle(pool);
  for (const p of pool) { if (out.length >= n) break; out.push(p); }
  return out;
}

/* ---------- keyboard ---------- */
const ROWS = { de: ['qwertzuiop', 'asdfghjkl', 'yxcvbnm'], fr: ['azertyuiop', 'qsdfghjklm', 'wxcvbn'], sv: ['qwertyuiopå', 'asdfghjklöä', 'zxcvbnm'], default: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] };
function kbHtml(lang, used, extra) {
  const rows = (ROWS[lang] || ROWS.default).map(r => Array.from(r));
  if (extra) for (const c of extra) if (!rows.some(r => r.includes(c))) rows[2].push(c);
  return `<div class="gm-keys">${rows.map(r => `<div class="gm-krow">${r.map(c => `<button class="gm-key ${used[c] || ''}" data-hk="${c}"${used[c] ? ' disabled' : ''}>${c.toUpperCase()}</button>`).join('')}</div>`).join('')}</div>`;
}

/* =================== the games =================== */
const G = {};

/* ---------- Hangman ---------- */
G.hang = {
  MAX: 8,
  async start() {
    await ready([H.lang]);
    const a = pickAnswer(H.lang, 4, 8); if (!a) return null;
    return { id: a[0], word: a[1], def: a[4] || '', guessed: {}, wrong: 0, done: false, won: false, hint: false };
  },
  chars(s) { return Array.from(s.word).map(ch => ({ ch, f: foldCh(ch, H.lang) })); },
  solved(s) { return this.chars(s).every(c => !c.f || Array.from(c.f).every(x => s.guessed[x])); },
  key(s, k) {
    if (s.done || s.guessed[k]) return;
    const n = this.chars(s).reduce((m, c) => m + Array.from(c.f).filter(x => x === k).length, 0);
    s.guessed[k] = n ? 'g' : 'x';
    if (n) score(n); else { s.wrong++; nextTurn(); }
    if (this.solved(s)) { s.done = true; s.won = true; score(3); }
    else if (s.wrong >= this.MAX) { s.done = true; }
  },
  draw(w) {
    const parts = ['<line x1="10" y1="115" x2="90" y2="115"/>', '<line x1="30" y1="115" x2="30" y2="10"/>', '<line x1="30" y1="10" x2="75" y2="10"/>', '<line x1="75" y1="10" x2="75" y2="25"/>',
      '<circle cx="75" cy="35" r="10"/>', '<line x1="75" y1="45" x2="75" y2="75"/>', '<line x1="75" y1="52" x2="62" y2="65"/><line x1="75" y1="52" x2="88" y2="65"/>', '<line x1="75" y1="75" x2="64" y2="95"/><line x1="75" y1="75" x2="86" y2="95"/>'];
    return `<svg class="gh-gallows" viewBox="0 0 100 120" aria-hidden="true">${parts.slice(0, w).join('')}</svg>`;
  },
  html(s) {
    const cells = this.chars(s).map(c => !c.f ? `<span class="gh-sp">${esc(c.ch)}</span>` : `<span class="gh-l">${s.done || Array.from(c.f).every(x => s.guessed[x]) ? esc(c.ch.toUpperCase()) : '&nbsp;'}</span>`).join('');
    const end = s.done ? `<p class="gh-res">${esc(s.won ? t('gh.won', 'Well done!') : t('gh.lost', 'The word was:'))} <button class="chip" data-open="${esc(s.id)}">${esc(s.word)}</button></p>${s.def ? `<p class="hint">${esc(s.def)}</p>` : ''}<button class="btn primary" data-hx="again">${esc(t('gh.again', 'Next word'))}</button>` : '';
    const hint = !s.done ? (s.hint ? `<p class="hint">${icon('hint')} ${esc(s.def || t('game.nodef', 'No explanation in this language for this word yet.'))}</p>` : `<button class="chip" data-hx="hint">${icon('hint')} ${esc(t('game.hint', 'Show what it means'))}</button>`) : '';
    return `${scoreHtml(s.done ? '' : null)}<div class="gh-hangwrap">${this.draw(s.wrong)}<p class="hint">${esc(t('gh.left', '{n} wrong guesses left', { n: this.MAX - s.wrong }))}</p></div>
      <div class="gh-word" lang="${H.lang}">${cells}</div>${hint}${end}${s.done ? '' : kbHtml(H.lang, s.guessed, letters(s.word, H.lang))}`;
  }
};

/* ---------- Anagram ---------- */
G.ana = {
  async start() {
    await ready([H.lang]);
    const a = pickAnswer(H.lang, 5, 7, x => new Set(letters(x[1], H.lang)).size > 2); if (!a) return null;
    const ans = letters(a[1], H.lang); let tiles = shuffle(ans.map((c, i) => ({ c, i })));
    while (tiles.map(x => x.c).join('') === ans.join('')) tiles = shuffle(tiles);
    return { id: a[0], word: a[1], def: a[4] || '', ans, tiles, picked: [], done: false, won: false, hint: false, wrong: false };
  },
  tap(s, i) { if (s.done) return; const k = s.picked.indexOf(i); if (k >= 0) s.picked.splice(k, 1); else s.picked.push(i); s.wrong = false; if (s.picked.length === s.ans.length) this.check(s); },
  check(s) {
    const w = s.picked.map(i => s.tiles[i].c).join('');
    if (w === s.ans.join('') || validSet(H.lang).has(w)) { s.done = true; s.won = true; s.found = w; score(s.hint ? 1 : 2); }
    else { s.wrong = true; }
  },
  give(s) { s.done = true; s.won = false; nextTurn(); },
  html(s) {
    const built = s.picked.map(i => `<button class="gh-tile on" data-ht="${i}">${esc(s.tiles[i].c.toUpperCase())}</button>`).join('') + '<span class="gh-tile ph"></span>'.repeat(s.ans.length - s.picked.length);
    const pool = s.tiles.map((x, i) => `<button class="gh-tile"${s.picked.includes(i) ? ' disabled' : ''} data-ht="${i}">${esc(x.c.toUpperCase())}</button>`).join('');
    const end = s.done ? `<p class="gh-res">${esc(s.won ? t('gh.won', 'Well done!') : t('gh.lost', 'The word was:'))} <button class="chip" data-open="${esc(s.id)}">${esc(s.word)}</button></p>${s.won && s.found !== s.ans.join('') ? `<p class="hint">${esc(t('gh.ana.other', 'Your word is right too.'))}</p>` : ''}${s.def ? `<p class="hint">${esc(s.def)}</p>` : ''}<button class="btn primary" data-hx="again">${esc(t('gh.again', 'Next word'))}</button>` : '';
    return `${scoreHtml()}<div class="gh-built" lang="${H.lang}">${built}</div><p class="gm-msg">${s.wrong ? esc(t('gh.ana.no', 'Not this one. Tap a letter to take it back.')) : ''}</p>
      ${s.done ? end : `<div class="gh-pool">${pool}</div>
      ${s.hint ? `<p class="hint">${icon('hint')} ${esc(s.def || t('game.nodef', 'No explanation in this language for this word yet.'))}</p>` : ''}
      <div class="gh-row"><button class="btn sm" data-hx="mix">${esc(t('gh.mix', 'Mix'))}</button><button class="btn sm" data-hx="clear">${esc(t('gh.clear', 'Clear'))}</button>${s.hint ? '' : `<button class="btn sm" data-hx="hint">${icon('hint')} ${esc(t('game.hint', 'Show what it means'))}</button>`}<button class="btn sm" data-hx="give">${esc(t('gh.give', 'Show the word'))}</button></div>`}`;
  }
};

/* ---------- Pairs ---------- */
G.pairs = {
  N: 8,
  async start() {
    await ready([H.lang, H.lang2]);
    const ws = coreWords(H.lang, this.N, [H.lang2], 12); if (ws.length < 4) return null;
    const cards = [];
    ws.forEach((w, k) => { cards.push({ k, lang: H.lang, text: w.e.lemma, id: w.e.id }); cards.push({ k, lang: H.lang2, text: w.ts[0].lemma, id: w.ts[0].id }); });
    return { cards: shuffle(cards), open: [], won: new Set(), moves: 0, lock: false, done: false };
  },
  tap(s, i) {
    if (s.lock || s.done || s.won.has(s.cards[i].k) || s.open.includes(i)) return;
    s.open.push(i);
    if (s.open.length === 2) {
      s.moves++;
      const [a, b] = s.open.map(x => s.cards[x]);
      if (a.k === b.k) { s.won.add(a.k); s.open = []; score(1); if (s.won.size * 2 === s.cards.length) s.done = true; }
      else { s.lock = true; setTimeout(() => { s.open = []; s.lock = false; nextTurn(); paintStage(); }, 1100); }
    }
  },
  html(s) {
    const cards = s.cards.map((c, i) => { const up = s.open.includes(i) || s.won.has(c.k); return `<button class="gh-card${up ? ' up' : ''}${s.won.has(c.k) ? ' won' : ''}" data-hc="${i}" lang="${c.lang}" aria-label="${up ? esc(c.text) : esc(t('gh.card', 'Card {n}', { n: i + 1 }))}">${up ? `${fl(c.lang)}<span>${esc(c.text)}</span>` : '?'}</button>`; }).join('');
    const end = s.done ? `<p class="gh-res">${esc(t('gh.pairs.done', 'All pairs found in {n} moves.', { n: s.moves }))}</p>${winnerHtml()}<div class="gh-list">${[...new Set(s.cards.map(c => c.k))].map(k => { const two = s.cards.filter(c => c.k === k); return `<span class="gh-pair">${two.map(c => `<button class="chip" data-open="${esc(c.id)}">${fl(c.lang)}${esc(c.text)}</button>`).join(' = ')}</span>`; }).join('')}</div><button class="btn primary" data-hx="again">${esc(t('gh.again2', 'Play again'))}</button>` : '';
    return `${scoreHtml(s.done ? ' ' : null)}<div class="gh-cards">${cards}</div>${end}`;
  }
};

/* ---------- Word search ---------- */
G.search = {
  async start() {
    await ready([H.lang, H.lang2]);
    const N = innerWidth < 500 ? 9 : 11, dirs = [[0, 1], [1, 0], [1, 1], [-1, 1]];
    if (LV[H.level] >= 4) dirs.push([0, -1], [-1, 0], [-1, -1], [1, -1]);
    for (let tries = 0; tries < 20; tries++) {
      const ws = coreWords(H.lang, 14, [H.lang2], N - 1).filter(w => letters(w.e.lemma, H.lang).length >= 4);
      const grid = Array.from({ length: N }, () => Array(N).fill('')), placed = [];
      for (const w of ws) {
        if (placed.length >= 8) break;
        const x = letters(w.e.lemma, H.lang);
        for (let k = 0; k < 60; k++) {
          const [dr, dc] = dirs[rnd(dirs.length)], r0 = rnd(N), c0 = rnd(N), r1 = r0 + dr * (x.length - 1), c1 = c0 + dc * (x.length - 1);
          if (r1 < 0 || r1 >= N || c1 < 0 || c1 >= N) continue;
          if (x.some((ch, i) => { const g = grid[r0 + dr * i][c0 + dc * i]; return g && g !== ch; })) continue;
          x.forEach((ch, i) => { grid[r0 + dr * i][c0 + dc * i] = ch; });
          placed.push({ w, x: x.join(''), cells: x.map((ch, i) => (r0 + dr * i) * N + c0 + dc * i), found: -1 });
          break;
        }
      }
      if (placed.length < 6) continue;
      let fill = ''; for (let n = 4; n <= 8; n++) fill += window.FLTGame._pool(H.lang, n).answers.slice(0, 300).map(a => (letters(a[1], H.lang) || []).join('')).join('');
      if (!fill) fill = placed.map(p => p.x).join('');
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) grid[r][c] = fill[rnd(fill.length)];
      return { N, grid: grid.flat(), words: placed, sel: null, done: false };
    }
    return null;
  },
  tap(s, i) {
    if (s.done) return;
    if (s.sel == null) { s.sel = i; return; }
    const a = s.sel, N = s.N; s.sel = null;
    if (a === i) return;
    const r0 = Math.floor(a / N), c0 = a % N, r1 = Math.floor(i / N), c1 = i % N, dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0), len = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)) + 1;
    if (r0 !== r1 && c0 !== c1 && Math.abs(r1 - r0) !== Math.abs(c1 - c0)) { s.miss = true; nextTurn(); return; }
    const cells = Array.from({ length: len }, (_, k) => (r0 + dr * k) * N + c0 + dc * k), key = cells.join(',');
    const hit = s.words.find(w => w.found < 0 && (w.cells.join(',') === key || w.cells.slice().reverse().join(',') === key));
    if (hit) { hit.found = H.cur; score(1); s.miss = false; if (s.words.every(w => w.found >= 0)) s.done = true; }
    else { s.miss = true; nextTurn(); }
  },
  html(s) {
    const found = new Map(); s.words.forEach((w, k) => { if (w.found >= 0) w.cells.forEach(c => found.set(c, k % 6)); });
    const grid = s.grid.map((ch, i) => `<button class="gh-sc${found.has(i) ? ' f f' + found.get(i) : ''}${s.sel === i ? ' sel' : ''}" data-hs="${i}">${esc(ch.toUpperCase())}</button>`).join('');
    const clues = s.words.map((w, k) => `<li class="${w.found >= 0 ? 'f f' + (k % 6) : ''}">${w.found >= 0 ? `<button class="chip" data-open="${esc(w.w.e.id)}" lang="${H.lang}">${esc(w.w.e.lemma)}</button> = ` : ''}${fl(H.lang2)}${esc(w.w.ts[0].lemma)}${w.found >= 0 ? '' : ` <small>(${letters(w.w.e.lemma, H.lang).length})</small>`}</li>`).join('');
    const msg = s.sel != null ? t('gh.search.end', 'Now tap the last letter of the word.') : s.miss ? t('gh.search.miss', 'No word there. Tap the first letter, then the last.') : t('gh.search.how', 'Tap the first letter of a word, then the last.');
    return `${scoreHtml(s.done ? ' ' : null)}<p class="hint">${esc(t('gh.search.find', 'Find these words in {lang}:', { lang: A.LNAME[H.lang] }))}</p><ul class="gh-clues">${clues}</ul>
      <div class="gh-sgrid" style="--n:${s.N}" lang="${H.lang}">${grid}</div><p class="gm-msg">${esc(s.done ? t('gh.search.done', 'You found them all!') : msg)}</p>${s.done ? winnerHtml() + `<button class="btn primary" data-hx="again">${esc(t('gh.again2', 'Play again'))}</button>` : ''}`;
  }
};

/* ---------- Honeycomb ---------- */
G.hive = {
  async start() {
    await ready([H.lang]);
    const V = validSet(H.lang);
    for (let k = 0; k < 40; k++) {
      const a = pickAnswer(H.lang, 7, 8, x => new Set(letters(x[1], H.lang)).size === 7); if (!a) return null;
      const set = [...new Set(letters(a[1], H.lang))], mid = set[rnd(7)];
      const words = [];
      for (let n = 4; n <= 9; n++) for (const w of V.lists[n] || []) if (w.includes(mid) && Array.from(w).every(c => set.includes(c))) words.push(w);
      if (words.length < 12 || words.length > 120) continue;
      return { id: a[0], word: a[1], mid, outer: shuffle(set.filter(c => c !== mid)), words: new Set(words), found: [], cur: [], msg: '', done: false, total: words.reduce((m, w) => m + this.pts(w, set), 0), set };
    }
    return null;
  },
  pts(w, set) { return (w.length === 4 ? 1 : w.length) + (set.every(c => w.includes(c)) ? 7 : 0); },
  enter(s) {
    const w = s.cur.join(''); s.cur = [];
    if (w.length < 4) s.msg = t('gh.hive.short', 'Too short: at least 4 letters.');
    else if (!w.includes(s.mid)) s.msg = t('gh.hive.mid', 'Every word must use the middle letter.');
    else if (s.found.includes(w)) s.msg = t('gh.hive.again', 'You already found that one.');
    else if (!s.words.has(w)) { s.msg = t('gh.hive.no', '“{w}” is not in the word list.', { w: w.toUpperCase() }); nextTurn(); }
    else { const p = this.pts(w, s.set); s.found.push(w); score(p); s.msg = (s.set.every(c => w.includes(c)) ? t('gh.hive.pan', 'All seven letters!') + ' ' : '') + '+' + p; nextTurn(); }
  },
  html(s) {
    const got = s.found.reduce((m, w) => m + this.pts(w, s.set), 0), pct = Math.round(100 * got / s.total);
    const hex = (c, mid) => `<button class="gh-hex${mid ? ' mid' : ''}" data-hk="${c}">${esc(c.toUpperCase())}</button>`;
    const end = s.done ? `<p class="gh-res">${esc(t('gh.hive.all', 'All {n} words:', { n: s.words.size }))}</p><div class="gh-list">${[...s.words].sort().map(w => `<span class="${s.found.includes(w) ? 'gh-got' : ''}">${esc(w)}</span>`).join(' ')}</div>${winnerHtml()}<button class="btn primary" data-hx="again">${esc(t('gh.again2', 'Play again'))}</button>` : '';
    return `${scoreHtml(s.done ? ' ' : null)}<div class="gh-bar"><div style="width:${pct}%"></div></div><p class="hint">${esc(t('gh.hive.got', '{n} of {m} words · {p} points', { n: s.found.length, m: s.words.size, p: got }))}</p>
      ${s.done ? end : `<div class="gh-input" lang="${H.lang}">${esc(s.cur.join('').toUpperCase()) || '&nbsp;'}</div><p class="gm-msg">${esc(s.msg)}</p>
      <div class="gh-comb">${hex(s.outer[0])}${hex(s.outer[1])}${hex(s.outer[2])}${hex(s.mid, true)}${hex(s.outer[3])}${hex(s.outer[4])}${hex(s.outer[5])}</div>
      <div class="gh-row"><button class="btn sm" data-hx="back">⌫</button><button class="btn sm" data-hx="mix">${esc(t('gh.mix', 'Mix'))}</button><button class="btn primary sm" data-hx="enter">${esc(t('game.enter', 'Enter'))}</button></div>
      <div class="gh-list">${s.found.slice().sort().map(w => `<span class="gh-got">${esc(w)}</span>`).join(' ')}</div><button class="btn sm" data-hx="end">${esc(t('gh.hive.end', 'Show all the words'))}</button>`}`;
  }
};

/* ---------- Letter grid ---------- */
G.grid = {
  SECS: 180,
  async start() {
    await ready([H.lang]);
    const V = validSet(H.lang);
    let src = ''; for (let n = 4; n <= 8; n++) src += window.FLTGame._pool(H.lang, n).answers.slice(0, 600).map(a => (letters(a[1], H.lang) || []).join('')).join('');
    for (let k = 0; k < 15; k++) {
      const cells = Array.from({ length: 16 }, () => src[rnd(src.length)]);
      const all = this.solve(cells, V);
      if (all.size >= 25) return { cells, all, found: [], path: [], msg: '', left: this.SECS, round: 0, done: false, by: H.players.map(() => []) };
    }
    return null;
  },
  near(a, b) { return a !== b && Math.abs(Math.floor(a / 4) - Math.floor(b / 4)) <= 1 && Math.abs(a % 4 - b % 4) <= 1; },
  solve(cells, V) {
    const out = new Set(), self = this;
    const fits = w => { const go = (i, k, used) => { if (k === w.length) return true; for (let j = 0; j < 16; j++) if (!used[j] && cells[j] === w[k] && (i < 0 || self.near(i, j))) { used[j] = 1; if (go(j, k + 1, used)) return true; used[j] = 0; } return false; }; return go(-1, 0, []); };
    const have = new Set(cells);
    for (let n = 3; n <= 9; n++) for (const w of V.lists[n] || []) if (Array.from(w).every(c => have.has(c)) && fits(w)) out.add(w);
    return out;
  },
  pts: w => ({ 3: 1, 4: 1, 5: 2, 6: 3, 7: 5 })[w.length] || 11,
  tap(s, i) {
    if (s.done || !s.timer) return;
    const k = s.path.indexOf(i);
    if (k >= 0) { s.path = s.path.slice(0, k); return; }
    if (s.path.length && !this.near(s.path[s.path.length - 1], i)) { s.path = [i]; return; }
    s.path.push(i);
  },
  enter(s) {
    const w = s.path.map(i => s.cells[i]).join(''); s.path = [];
    if (w.length < 3) { s.msg = t('gh.grid.short', 'At least 3 letters.'); return; }
    const mineNow = s.by[H.cur];
    if (mineNow.includes(w)) { s.msg = t('gh.hive.again', 'You already found that one.'); return; }
    if (!s.all.has(w)) { s.msg = t('gh.hive.no', '“{w}” is not in the word list.', { w: w.toUpperCase() }); return; }
    mineNow.push(w); score(this.pts(w)); s.msg = '+' + this.pts(w);
  },
  go(s) {
    clearInterval(s.timer); s.left = this.SECS; s.path = []; s.msg = '';
    s.timer = setInterval(() => { s.left--; if (s.left <= 0) { clearInterval(s.timer); s.timer = null; this.stop(s); } const el = $('#gh-clock'); if (el) el.textContent = this.clock(s.left); else if (!s.timer) paintStage(); }, 1000);
  },
  stop(s) {
    clearInterval(s.timer); s.timer = null;
    s.round++;
    if (!many() || s.round >= H.players.length) s.done = true; else nextTurn();
    paintStage();
  },
  clock: n => Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'),
  html(s) {
    const grid = s.cells.map((c, i) => `<button class="gh-gc${s.path.includes(i) ? ' on' : ''}" data-hg="${i}"${s.timer ? '' : ' disabled'}>${esc(c.toUpperCase())}</button>`).join('');
    if (s.done) {
      const got = new Set(s.by.flat());
      return `${scoreHtml(' ')}${winnerHtml()}<p class="gh-res">${esc(t('gh.grid.all', 'This grid had {n} words. You found {m}.', { n: s.all.size, m: got.size }))}</p><div class="gh-list">${[...s.all].sort((a, b) => b.length - a.length || a.localeCompare(b)).map(w => `<span class="${got.has(w) ? 'gh-got' : ''}">${esc(w)}</span>`).join(' ')}</div><button class="btn primary" data-hx="again">${esc(t('gh.again2', 'Play again'))}</button>`;
    }
    if (!s.timer) return `${scoreHtml(many() ? t('gh.grid.next', '{p}: your three minutes start when you tap Start.', { p: pname(H.cur) }) : ' ')}<div class="gh-ggrid dim">${grid}</div><button class="btn primary" data-hx="go">${esc(t('gh.start', 'Start'))}</button>`;
    return `${scoreHtml()}<p class="gh-clock" id="gh-clock">${this.clock(s.left)}</p><div class="gh-input" lang="${H.lang}">${esc(s.path.map(i => s.cells[i]).join('').toUpperCase()) || '&nbsp;'}</div><p class="gm-msg">${esc(s.msg)}</p>
      <div class="gh-ggrid" lang="${H.lang}">${grid}</div><div class="gh-row"><button class="btn sm" data-hx="clear">${esc(t('gh.clear', 'Clear'))}</button><button class="btn primary sm" data-hx="enter">${esc(t('game.enter', 'Enter'))}</button><button class="btn sm" data-hx="stop">${esc(t('gh.grid.stop', 'Stop'))}</button></div>
      <div class="gh-list">${s.by[H.cur].map(w => `<span class="gh-got">${esc(w)}</span>`).join(' ')}</div>`;
  }
};

/* ---------- Babel (new) ---------- */
G.babel = {
  MAX: 6,
  async start() {
    const langs = H.langs.slice(0, 4);
    await ready(langs);
    const [L0, ...rest] = langs;
    const ws = coreWords(L0, 60, rest, 12).filter(w => w.ts.every((x, i) => letters(x.lemma, rest[i]) && !/\s/.test(x.lemma)));
    const w = ws[0]; if (!w) return null;
    const rows = [{ lang: L0, e: w.e }, ...rest.map((l, i) => ({ lang: l, e: w.ts[i] }))];
    return { rows, guessed: {}, wrong: 0, done: false, won: false };
  },
  chars(row) { return Array.from(row.e.lemma).map(ch => ({ ch, f: foldCh(ch, row.lang) })); },
  open(s, row) { return this.chars(row).every(c => !c.f || Array.from(c.f).every(x => s.guessed[x])); },
  key(s, k) {
    if (s.done || s.guessed[k]) return;
    let n = 0; for (const r of s.rows) n += this.chars(r).reduce((m, c) => m + Array.from(c.f).filter(x => x === k).length, 0);
    s.guessed[k] = n ? 'g' : 'x';
    if (n) score(n); else { s.wrong++; nextTurn(); }
    if (s.rows.every(r => this.open(s, r))) { s.done = true; s.won = true; }
    else if (s.wrong >= this.MAX) s.done = true;
  },
  html(s) {
    const rows = s.rows.map(r => { const o = s.done || this.open(s, r); return `<div class="gh-brow${o ? ' open' : ''}"><span class="gh-bl">${fl(r.lang)}</span><span class="gh-word" lang="${r.lang}">${this.chars(r).map(c => !c.f ? `<span class="gh-sp">${esc(c.ch)}</span>` : `<span class="gh-l">${s.done || Array.from(c.f).every(x => s.guessed[x]) ? esc(c.ch.toUpperCase()) : '&nbsp;'}</span>`).join('')}</span>${s.done ? `<button class="chip" data-open="${esc(r.e.id)}">↗</button>` : ''}</div>`; }).join('');
    const extra = [...new Set(s.rows.flatMap(r => letters(r.e.lemma, r.lang) || []))];
    const hearts = icon('heart', 'hrt').repeat(this.MAX - s.wrong) + icon('heart0', 'hrt').repeat(s.wrong);
    const end = s.done ? `<p class="gh-res">${esc(s.won ? t('gh.babel.won', 'You opened the word in every language!') : t('gh.babel.lost', 'Out of guesses. Here it is in every language.'))}</p>${winnerHtml()}<button class="btn primary" data-hx="again">${esc(t('gh.again', 'Next word'))}</button>` : '';
    return `${scoreHtml(s.done ? ' ' : null)}<p class="gh-hearts" aria-label="${esc(t('gh.left', '{n} wrong guesses left', { n: this.MAX - s.wrong }))}">${hearts}</p><div class="gh-babel">${rows}</div>${end}${s.done ? '' : kbHtml(s.rows[0].lang, s.guessed, extra)}`;
  }
};


/* the rules of every game (Quinque shows its own in game.js) */
function rulesHtml(g) {
  const R = {
    hang: [t('gh.hang.r1', 'A word is hidden; each line stands for one letter.'), t('gh.hang.r2', 'Tap a letter. If it is in the word, it appears in every place where it occurs; if not, a piece is added to the drawing.'), t('gh.hang.r3', 'After eight wrong letters the drawing is finished and the round is lost.'), t('gh.r.acc', 'Accents are ignored: E also opens É and È.'), t('gh.hang.r5', 'With several players: a right letter earns a point for every place where it appears and you go on; a wrong letter passes the turn; finishing the word earns 3 more points.')],
    ana: [t('gh.ana.r1', 'The letters of one word are mixed up. Tap them in the right order.'), t('gh.ana.r2', 'Any other real word made of exactly these letters counts too.'), t('gh.ana.r3', 'A word found without the explanation is worth 2 points, with it 1 point.'), t('gh.ana.r4', 'With several players, everyone gets their own word in turn.')],
    pairs: [t('gh.pairs.r1', '16 cards lie face down: 8 words and their 8 translations.'), t('gh.pairs.r2', 'Turn over two cards. If they belong together they stay open; if not, they turn back.'), t('gh.pairs.r3', 'The game ends when all pairs are open. The fewer moves, the better.'), t('gh.pairs.r4', 'With several players: a pair earns a point and you go again; a miss passes the turn.')],
    search: [t('gh.search.r1', 'The words are hidden across, down or diagonally; from level B2 also backwards.'), t('gh.search.r2', 'The list shows the translation of each word and its number of letters.'), t('gh.search.r3', 'Tap the first letter of a word, then the last.'), t('gh.search.r4', 'With several players: each word found earns a point; after a miss the turn passes.')],
    hive: [t('gh.hive.r1', 'Make words from the seven letters. A letter may be used more than once.'), t('gh.hive.r2', 'Every word has at least 4 letters and contains the middle letter.'), t('gh.hive.r3', 'Only dictionary forms count: no plurals, no conjugated verbs, no names.'), t('gh.hive.r4', 'Points: a 4-letter word is worth 1, a longer word 1 point per letter. A word with all seven letters earns 7 more.'), t('gh.hive.r5', 'With several players, the turn passes after every word.')],
    grid: [t('gh.grid.r1', 'Join letters that touch, across, down or diagonally, to make words of 3 letters or more.'), t('gh.grid.r2', 'Each letter of the grid can be used only once in a word. Only dictionary forms count.'), t('gh.grid.r3', 'You have three minutes. Points: 3 or 4 letters 1, 5 letters 2, 6 letters 3, 7 letters 5, 8 or more 11.'), t('gh.grid.r4', 'With several players, each player gets three minutes on the same grid, then the scores are compared.')],
    babel: [t('gh.babel.r1', 'One meaning is hidden in two to four languages at once, one row per language.'), t('gh.babel.r2', 'Every letter you guess opens in all the rows where it occurs.'), t('gh.babel.r3', 'A letter that is in none of the words costs a heart. When all six hearts are gone, the round is lost.'), t('gh.r.acc', 'Accents are ignored: E also opens É and È.'), t('gh.babel.r5', 'Related languages help each other: a letter you are sure of in one word often fits the others too.'), t('gh.babel.r6', 'With several players: a point for every letter that opens, and a wrong letter passes the turn.')]
  }[g];
  return R ? `<details class="gm-rules"><summary>${esc(t('game.rules', 'Rules'))}</summary><ul>${R.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>` : '';
}


/* =================== report a mistake (every game) =================== */
const REASONS = [['tr', 'gh.rep.tr', 'Wrong translation'], ['word', 'gh.rep.word', 'Wrong word or spelling'], ['def', 'gh.rep.def', 'Wrong explanation or hint'], ['bug', 'gh.rep.bug', 'Something does not work'], ['other', 'comm.r.other', 'Something else']];
/* the words the player sees right now: [{ lang, lemma, id, to }] */
function shown() {
  const s = H.st, out = [];
  if (H.game === 'quinque') { const q = window.FLTGame.state; for (const l of q.langs || []) { const b = q.boards[l]; if (b && b.lemma) out.push({ lang: l, lemma: b.lemma, id: b.id }); } return out; }
  if (!s) return out;
  if (H.game === 'babel') { const r0 = s.rows[0]; s.rows.forEach((r, i) => out.push({ lang: r.lang, lemma: r.e.lemma, id: r.e.id, to: i ? r0.e.lemma : '' })); }
  else if (H.game === 'pairs') { const by = {}; s.cards.forEach(c => { (by[c.k] = by[c.k] || []).push(c); }); Object.values(by).forEach(([a, b]) => { if (a && b) { const [x, y] = a.lang === H.lang ? [a, b] : [b, a]; out.push({ lang: x.lang, lemma: x.text, id: x.id, to: y.text, tl: y.lang }); } }); }
  else if (H.game === 'search') s.words.forEach(p => out.push({ lang: H.lang, lemma: p.w.e.lemma, id: p.w.e.id, to: p.w.ts[0].lemma, tl: H.lang2 }));
  else if (s.word) out.push({ lang: H.lang, lemma: s.word, id: s.id });
  return out;
}
function repHtml() {
  const r = H.rep;
  if (!r) return `<button class="lnk small gh-repbtn" data-hr="open">${icon('flag')} ${esc(t('gh.rep', 'Report a mistake in this game'))}</button>`;
  if (r.sent) return `<p class="hint">${icon('flag')} ${esc(t('comm.reported', 'Thank you. The report was sent.'))} <button class="lnk small" data-hr="x">${esc(t('btn.ok', 'OK'))}</button></p>`;
  const ws = shown();
  const q = window.FLTGame.state, over = H.game === 'quinque' ? Object.values(q.boards || {}).every(b => b.done) : !!(H.st && H.st.done);
  const words = over && ws.length > 1 ? `<p>${esc(t('gh.rep.which', 'Which word? (optional)'))}</p><div class="row">${ws.map((w, i) => `<button class="chip${r.w === i ? ' on' : ''}" data-hr="w" data-i="${i}">${fl(w.lang)} ${esc(w.lemma)}${w.to ? ` · ${esc(w.to)}` : ''}</button>`).join('')}</div>` : '';
  return `<div class="report gh-rep"><p><b>${esc(t('gh.rep.why', 'What is wrong?'))}</b></p><div class="row">${REASONS.map(([k, key, en]) => `<button class="chip${r.why === k ? ' on' : ''}" data-hr="why" data-k="${k}">${esc(t(key, en))}</button>`).join('')}</div>${words}
    <textarea id="ghrep-note" rows="2" maxlength="160" placeholder="${esc(t('gh.rep.note', 'What should it be? (optional)'))}">${esc(r.note || '')}</textarea>
    ${r.err ? `<p class="hint">${esc(r.err)}</p>` : ''}<div class="row"><button class="btn sm primary" data-hr="send"${r.why ? '' : ' disabled'}>${esc(t('gh.rep.send', 'Send report'))}</button><button class="lnk small" data-hr="x">${esc(t('btn.cancel', 'Cancel'))}</button></div></div>`;
}
function paintRep() { const el = $('#gh-rep'); if (el) el.innerHTML = repHtml(); }
async function sendRep() {
  const r = H.rep, n = $('#ghrep-note'); r.note = n ? n.value.trim().slice(0, 160) : '';
  const ws = shown(), pick = r.w != null && ws[r.w] ? [ws[r.w]] : ws;
  const wtxt = pick.filter(Boolean).map(w => `${w.lang}:${w.lemma}${w.to ? '=' + w.to : ''}`).join(', ');
  const langs = H.game === 'babel' ? H.langs.join('+') : H.game === 'pairs' || H.game === 'search' ? H.lang + '+' + H.lang2 : H.game === 'quinque' ? (window.FLTGame.state.langs || []).join('+') : H.lang;
  const why = `[${H.game} ${langs}] ${r.why} | ${r.note ? r.note + ' | ' : ''}${wtxt}`.slice(0, 300);
  const ok = await window.FLTReport.send({ kind: 'game', why, about: pick[0] ? pick[0].id || pick[0].lemma : H.game, where: H.game });
  if (ok) { r.sent = true; r.err = ''; } else r.err = t('gh.rep.fail', 'The report could not be sent. Please try again.');
  paintRep();
}

/* =================== the tab =================== */
async function newRound() {
  if (H.busy) return;
  H.busy = true; H.st = null; H.msg = ''; if (H.rep && H.rep.sent) { H.rep = null; paintRep(); } paintStage();
  try { H.st = await G[H.game].start(); if (!H.st) H.msg = t('gh.nowords', 'Not enough words for this game in this language and level. Try another language or a higher level.'); }
  catch (e) { H.msg = t('gh.err', 'The game could not start: {e}', { e: e.message }); }
  finally { H.busy = false; }
  paintStage();
}
function optsHtml() {
  const g = H.game; if (g === 'quinque') return '';
  const all = A.dataLangs(), sel = (id, v, list) => `<select id="${id}">${list.map(l => `<option value="${l}"${l === v ? ' selected' : ''}>${esc(A.betaName ? A.betaName(l) : A.LNAME[l])}</option>`).join('')}</select>`;
  let langs = '';
  if (g === 'babel') langs = `<div class="gm-langs">${all.map(l => { const on = H.langs.includes(l); return `<button class="chip${on ? ' sel' : ''}" data-hl="${l}" aria-pressed="${on}"${!on && H.langs.length >= 4 ? ' disabled' : ''}>${on ? `<b class="gh-n">${H.langs.indexOf(l) + 1}</b>` : ''}${fl(l)}${esc(A.LNAME[l])}${A.betaTag(l)}</button>`; }).join('')}</div>`;
  else langs = `<label>${esc(t('gh.lang', 'Language'))} ${sel('gh-lang', H.lang, all)}</label>` + (g === 'pairs' || g === 'search' ? `<label>${esc(g === 'search' ? t('gh.clues', 'Clues in') : t('gh.with', 'Pairs with'))} ${sel('gh-lang2', H.lang2, all.filter(l => l !== H.lang))}</label>` : '');
  const lvl = `<label>${esc(t('game.level', 'Words up to'))} <select id="gh-level">${Object.keys(LV).map(l => `<option${l === H.level ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
  const pl = `<label>${esc(t('gh.players', 'Players'))} <select id="gh-np">${[1, 2, 3, 4].map(n => `<option${n === H.players.length ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`;
  const names = many() ? `<div class="gh-names">${H.players.map((p, i) => `<input class="gh-name" data-pi="${i}" value="${esc(p)}" placeholder="${esc(t('gh.player', 'Player {n}', { n: i + 1 }))}" maxlength="20" aria-label="${esc(t('gh.player', 'Player {n}', { n: i + 1 }))}">`).join('')}</div>` : '';
  return `${g === 'babel' ? `<p class="hint">${esc(t('gh.babel.langs', 'Choose two to four languages. The first one gives the word.'))}</p>` : ''}${langs}<div class="gm-opts">${lvl}${pl}<button class="btn sm" data-hx="new">${esc(t('gh.new', 'New game'))}</button></div>${names}`;
}
function paintStage() {
  const el = $('#gh-stage'); if (!el || H.game === 'quinque') return;
  const s = H.st;
  el.innerHTML = H.busy || (!s && !H.msg) ? `<p class="hint">${esc(H.msg || t('gh.loading', 'Getting the words ready…'))}</p>` : !s ? `<p class="hint">${esc(H.msg)}</p>` : `<div class="gh-play ghp-${H.game}">${G[H.game].html(s)}</div>`;
}
function paint() {
  const el = $('#game'); if (!el || el.hidden || !A) return;
  if (!H.langs) restore();
  const tabs = `<div class="gh-games" role="tablist">${GAMES.map(g => `<button class="gh-g${g === H.game ? ' on' : ''}" role="tab" aria-selected="${g === H.game}" data-hg2="${g}"><span class="gh-ic">${icon(g)}</span><span>${esc(name(g))}</span>${g === 'babel' ? `<small class="beta-tag">${esc(t('gh.newtag', 'new'))}</small>` : ''}</button>`).join('')}</div>`;
  el.innerHTML = `<h2>${esc(t('nav.game', 'Games'))}</h2>${tabs}<h3 class="gh-title">${icon(H.game)} ${esc(name(H.game))}</h3><p class="hint">${esc(about(H.game))}</p>${rulesHtml(H.game)}${optsHtml()}<div id="${H.game === 'quinque' ? 'gm-quinque' : 'gh-stage'}"></div><div id="gh-rep">${repHtml()}</div>`;
  if (H.game === 'quinque') window.FLTGame.paint();
  else if (!H.st && !H.busy) { resetScores(); newRound(); }
  else paintStage();
}
function pick(g) {
  if (H.st && H.st.timer) clearInterval(H.st.timer);
  H.game = g; H.st = null; H.msg = ''; H.rep = null; resetScores(); persist(); paint();
}

/* ---------- events ---------- */
document.addEventListener('click', ev => {
  const el = $('#game'); if (!el || el.hidden || !el.contains(ev.target)) return;
  const g2 = ev.target.closest('[data-hg2]'); if (g2) { pick(g2.dataset.hg2); return; }
  const hl = ev.target.closest('[data-hl]');
  if (hl) { const l = hl.dataset.hl, i = H.langs.indexOf(l); if (i >= 0) { if (H.langs.length > 2) H.langs.splice(i, 1); } else if (H.langs.length < 4) H.langs.push(l); persist(); H.st = null; paint(); return; }
  const hr = ev.target.closest('[data-hr]');
  if (hr) {
    const k = hr.dataset.hr, n = $('#ghrep-note'); if (H.rep && n) H.rep.note = n.value;
    if (k === 'open') H.rep = { why: '', w: null, note: '' };
    else if (k === 'x') H.rep = null;
    else if (k === 'why') H.rep.why = hr.dataset.k;
    else if (k === 'w') H.rep.w = H.rep.w === +hr.dataset.i ? null : +hr.dataset.i;
    else if (k === 'send') { sendRep(); return; }
    paintRep(); return;
  }
  if (H.game === 'quinque') return;
  const s = H.st, game = G[H.game];
  const x = ev.target.closest('[data-hx]');
  if (x) {
    const k = x.dataset.hx;
    if (k === 'new' || k === 'again') { if (s && s.timer) clearInterval(s.timer); if (k === 'new' || !['hang', 'ana', 'babel'].includes(H.game)) resetScores(); newRound(); return; }
    if (!s) return;
    if (k === 'hint') { s.hint = true; if (H.game === 'hang') { nextTurn(); } }
    else if (k === 'mix') { if (H.game === 'ana') { const keep = s.picked.map(i => s.tiles[i]); s.tiles = shuffle(s.tiles.slice()); s.picked = keep.map(tl => s.tiles.indexOf(tl)); } else s.outer = shuffle(s.outer); }
    else if (k === 'clear') { if (H.game === 'ana') { s.picked = []; s.wrong = false; } else s.path = []; }
    else if (k === 'give') game.give(s);
    else if (k === 'back') s.cur.pop();
    else if (k === 'enter') game.enter(s);
    else if (k === 'end') s.done = true;
    else if (k === 'go') { game.go(s); }
    else if (k === 'stop') { game.stop(s); return; }
    paintStage(); return;
  }
  if (!s) return;
  const hk = ev.target.closest('[data-hk]');
  if (hk) { if (H.game === 'hive') { if (!s.done) { s.cur.push(hk.dataset.hk); s.msg = ''; } } else game.key(s, hk.dataset.hk); paintStage(); return; }
  const ht = ev.target.closest('[data-ht]'); if (ht) { game.tap(s, +ht.dataset.ht); paintStage(); return; }
  const hc = ev.target.closest('[data-hc]'); if (hc) { game.tap(s, +hc.dataset.hc); paintStage(); return; }
  const hs = ev.target.closest('[data-hs]'); if (hs) { game.tap(s, +hs.dataset.hs); paintStage(); return; }
  const hg = ev.target.closest('[data-hg]'); if (hg) { game.tap(s, +hg.dataset.hg); paintStage(); return; }
});
document.addEventListener('change', ev => {
  const id = ev.target.id; if (!id || !id.startsWith('gh-')) return;
  if (id === 'gh-lang') { H.lang = ev.target.value; if (H.lang2 === H.lang) H.lang2 = mine().find(l => l !== H.lang) || (H.lang === 'en' ? 'de' : 'en'); }
  else if (id === 'gh-lang2') H.lang2 = ev.target.value;
  else if (id === 'gh-level') H.level = ev.target.value;
  else if (id === 'gh-np') { const n = +ev.target.value; H.players = Array.from({ length: n }, (_, i) => H.players[i] || ''); }
  persist(); if (H.st && H.st.timer) clearInterval(H.st.timer); H.st = null; paint();
});
document.addEventListener('input', ev => {
  const p = ev.target.closest && ev.target.closest('[data-pi]'); if (!p) return;
  H.players[+p.dataset.pi] = p.value.trim(); persist();
  const sc = $('.gh-score'); if (sc && H.st) paintStage();
});
document.addEventListener('keydown', ev => {
  const el = $('#game'); if (!el || el.hidden || H.game === 'quinque' || !H.st || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const tg = ev.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
  const s = H.st, game = G[H.game];
  const k = ev.key && Array.from(ev.key).length === 1 ? (H.game === 'babel' ? foldCh(ev.key, s.rows[0].lang) : foldCh(ev.key, H.lang)) : '';
  if (H.game === 'hang' || H.game === 'babel') { if (k && k.length === 1) { ev.preventDefault(); game.key(s, k); paintStage(); } }
  else if (H.game === 'hive') {
    if (ev.key === 'Enter') { ev.preventDefault(); game.enter(s); }
    else if (ev.key === 'Backspace') { ev.preventDefault(); s.cur.pop(); }
    else if (k && (s.outer.includes(k) || k === s.mid)) { ev.preventDefault(); s.cur.push(k); s.msg = ''; }
    else return;
    paintStage();
  } else if (H.game === 'ana' && k && !s.done) {
    const i = s.tiles.findIndex((x, j) => x.c === k && !s.picked.includes(j)); if (i >= 0) { ev.preventDefault(); game.tap(s, i); paintStage(); }
  } else if (H.game === 'ana' && ev.key === 'Backspace' && !s.done) { ev.preventDefault(); s.picked.pop(); s.wrong = false; paintStage(); }
});

window.FLTGames = {
  init(api) { A = api; },
  paint() { if (!A) return; paint(); },
  get state() { return H; },
  _G: G
};
})();
