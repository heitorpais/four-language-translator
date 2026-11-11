/* Four-Language Translator. Every lookup reads the local data files in ./data (kept in IndexedDB).
   Nothing is generated or requested at lookup time. Word forms come from forms.js. */
(function () {
'use strict';

/* ---------- regions and settings ---------- */
const REG = { en: ['us', 'gb'], de: ['de', 'ch', 'at'], fr: ['fr', 'ca', 'be', 'ch'], pt: ['br', 'pt'] };
const BASE = { en: 'us', de: 'de', fr: 'fr', pt: 'br' };
const RNAME = { us: 'United States', gb: 'United Kingdom', de: 'Germany', ch: 'Switzerland', at: 'Austria', fr: 'France', ca: 'Canada', be: 'Belgium', br: 'Brazil', pt: 'Portugal' };
const LOCALE = { en: { us: 'en-US', gb: 'en-GB' }, de: { de: 'de-DE', ch: 'de-CH', at: 'de-AT' }, fr: { fr: 'fr-FR', ca: 'fr-CA', be: 'fr-BE', ch: 'fr-CH' }, pt: { br: 'pt-BR', pt: 'pt-PT' } };
const S = { variants: true, gsw: true, slow: false, links: false, examples: 2, level: 'medium', sugg: 8, main: { en: 'us', de: 'de', fr: 'fr', pt: 'br' } };
const fold = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[’`]/g, "'").trim();

/* ---------- flags ---------- */
const FLAG_ART = {
us: '<rect width="60" height="40" fill="#B22234"/><path d="M0,4.62H60M0,10.77H60M0,16.92H60M0,23.08H60M0,29.23H60M0,35.38H60" stroke="#fff" stroke-width="3.08"/><rect width="26" height="21.54" fill="#3C3B6E"/><path d="M3,3H24M3,7H24M3,11H24M3,15H24M3,19H24" stroke="#fff" stroke-width="1.5" stroke-dasharray="0 4.1" stroke-linecap="round"/>',
gb: '<rect width="60" height="40" fill="#012169"/><path d="M0,0L60,40M60,0L0,40" stroke="#fff" stroke-width="7"/><path d="M0,0L60,40M60,0L0,40" stroke="#C8102E" stroke-width="2.6"/><path d="M30,0v40M0,20h60" stroke="#fff" stroke-width="12"/><path d="M30,0v40M0,20h60" stroke="#C8102E" stroke-width="7"/>',
de: '<rect width="60" height="40" fill="#000"/><rect y="13.33" width="60" height="26.67" fill="#DD0000"/><rect y="26.67" width="60" height="13.33" fill="#FFCE00"/>',
fr: '<rect width="60" height="40" fill="#EF4135"/><rect width="40" height="40" fill="#fff"/><rect width="20" height="40" fill="#0055A4"/>',
br: '<rect width="60" height="40" fill="#009C3B"/><path d="M30,4L55,20L30,36L5,20Z" fill="#FFDF00"/><circle cx="30" cy="20" r="9" fill="#002776"/><path d="M21.3,18Q30,15 38.9,22" fill="none" stroke="#fff" stroke-width="1.8"/>',
ch: '<rect width="60" height="40" fill="#DA291C"/><path d="M26,8h8v8h8v8h-8v8h-8v-8h-8v-8h8z" fill="#fff"/>',
at: '<rect width="60" height="40" fill="#C8102E"/><rect y="13.33" width="60" height="13.34" fill="#fff"/>',
pt: '<rect width="60" height="40" fill="#DA291C"/><rect width="24" height="40" fill="#046A38"/><circle cx="24" cy="20" r="7.5" fill="#FFE900"/><circle cx="24" cy="20" r="3.6" fill="#DA291C" stroke="#fff" stroke-width="1.4"/>',
be: '<rect width="60" height="40" fill="#EF3340"/><rect width="40" height="40" fill="#FDDA24"/><rect width="20" height="40" fill="#000"/>',
ca: '<rect width="60" height="40" fill="#fff"/><rect width="15" height="40" fill="#D80621"/><rect x="45" width="15" height="40" fill="#D80621"/><path d="M30,7L27.6,11.5L25,10.2L26.2,16.5L22.8,13.2L22.2,15L18,14.2L19.4,18.5L17.6,19.6L24.5,25L23.7,27.5L29.4,26.8L29.2,32.5H30.8L30.6,26.8L36.3,27.5L35.5,25L42.4,19.6L40.6,18.5L42,14.2L37.8,15L37.2,13.2L33.8,16.5L35,10.2L32.4,11.5Z" fill="#D80621"/>'
};
const flag = (c, mini) => FLAG_ART[c] ? `<svg class="flag${mini ? ' mini' : ''}" viewBox="0 0 60 40" preserveAspectRatio="none" aria-hidden="true">${FLAG_ART[c]}</svg>` : '';
const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3zm11.5 3a4 4 0 0 0-2-3.46v6.92a4 4 0 0 0 2-3.46zm-2-8.3v2.1a7 7 0 0 1 0 12.4v2.1a9 9 0 0 0 0-16.6z"/></svg>';
const LANGS = [
  { id: 'en', name: 'English', ph: 'type a word…', code: 'EN' },
  { id: 'de', name: 'German', ph: 'Wort eingeben…', code: 'DE' },
  { id: 'fr', name: 'French', ph: 'saisir un mot…', code: 'FR' },
  { id: 'pt', name: 'Portuguese', ph: 'digite uma palavra…', code: 'PT' }
];
const LNAME = { en: 'English', de: 'German', fr: 'French', pt: 'Portuguese' };
const CEFR = { A1: 'basic', A2: 'elementary', B1: 'intermediate', B2: 'upper intermediate', C1: 'advanced', C2: 'academic' };
const TRY = ['Haus', 'gehen', 'gut', 'Zeit', 'helfen', 'schön', 'anfangen', 'Kind'];

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => Number(n).toLocaleString('en-US');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
(function () {
  const saved = store.get('flt:settings4', {});
  Object.assign(S, saved, { main: Object.assign({}, S.main, saved.main || {}) });
  Object.keys(REG).forEach(l => { if (!REG[l].includes(S.main[l])) S.main[l] = BASE[l]; });
})();
let recent = store.get('flt:recent3', { en: [], de: [], fr: [], pt: [] });
let toastTimer = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.textContent = ''; }, 6000); }

/* ---------- data: ./data files, kept in IndexedDB ----------
   core-<lang>.json      the most frequent words, card data: loaded on the first visit
   details-<lang>.json   examples and background of the core words: loaded right after
   ext/<lang>/<k>.json   all other words (extended and long tail) and the inflected forms, by first letters:
                         loaded when a word starting with those letters is typed, looked up or shown */
const D = { byId: new Map(), idx: { en: [], de: [], fr: [], pt: [] }, frows: { en: [], de: [], fr: [], pt: [] }, count: { en: 0, de: 0, fr: 0, pt: 0 },
  entries: { en: 0, de: 0, fr: 0, pt: 0 }, top: {}, manifest: null, ready: false, details: false, buckets: new Map(), db: null };
const DB_NAME = 'flt-data', FILES = 'files';
function idbOpen() {
  return new Promise((res, rej) => {
    let r; try { r = indexedDB.open(DB_NAME, 1); } catch (e) { return rej(e); }
    r.onupgradeneeded = () => r.result.createObjectStore(FILES);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const idbReq = (db, mode, fn) => new Promise((res, rej) => { const t = db.transaction(FILES, mode), q = fn(t.objectStore(FILES)); t.oncomplete = () => res(q.result); t.onerror = t.onabort = () => rej(t.error); });
const idbGet = (db, k) => idbReq(db, 'readonly', s => s.get(k));
const idbPut = (db, k, v) => idbReq(db, 'readwrite', s => s.put(v, k));
const idbClear = db => idbReq(db, 'readwrite', s => s.clear());
async function getFile(file, sha) {          // saved copy on this device, otherwise the network
  let rec = null;
  if (D.db) { try { rec = await idbGet(D.db, file); } catch (e) {} }
  if (rec && rec.sha === sha) return rec.data;
  const r = await fetch('data/' + file + '?v=' + sha);
  if (!r.ok) throw new Error('A data file could not be loaded (' + file + ').');
  const data = await r.json();
  if (D.db) idbPut(D.db, file, { sha, data }).catch(() => {});      // saved in the background
  return data;
}
async function loadData(progress) {
  let manifest = null;
  const mf = fetch('data/manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);   // in parallel with opening the database
  try { D.db = await idbOpen(); } catch (e) { D.db = null; }
  manifest = await mf;
  if (!manifest && D.db) { try { manifest = await idbGet(D.db, 'manifest'); } catch (e) {} }
  if (!manifest) throw new Error('The dictionary data could not be loaded. Connect to the internet once so the app can save its data on this device.');
  const out = {}, core = manifest.files.filter(f => f.tier === 'core');
  let done = 0;
  progress('Loading the dictionary data…');
  await Promise.all(core.map(async f => { out[f.lang] = await getFile(f.file, f.sha256); done++; progress(`Loading the dictionary data (${done} of ${core.length})…`); }));
  if (D.db) { try { await idbPut(D.db, 'manifest', manifest); } catch (e) {} }
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    const keep = manifest.files.filter(f => f.tier === 'core' || f.tier === 'details' || f.tier === 'ext').map(f => 'data/' + f.file + '?v=' + f.sha256);
    navigator.serviceWorker.controller.postMessage({ type: 'prune', keep });
  }
  return { manifest, out };
}
async function loadDetails() {
  const det = D.manifest.files.filter(f => f.tier === 'details');
  await Promise.all(det.map(async f => {
    const d = await getFile(f.file, f.sha256);
    for (const id in d) {
      const e = D.byId.get(id), x = d[id]; if (!e) continue;
      e.examples = x.examples; e.more = x.more; e.origin = x.origin;
      (x.senses || []).forEach((y, i) => { if (e.senses[i]) Object.assign(e.senses[i], y); });
    }
  }));
  D.details = true;
}
const stripKey = (lang, k) => lang === 'en' ? k.replace(/^to\s+/, '') : lang === 'de' ? k.replace(/^sich\s+/, '') : lang === 'fr' ? k.replace(/^(se\s+|s')/, '') : k.replace(/-se$/, '');
const rowSort = (a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : a.a - b.a || a.r - b.r;
function addRows(lang, entries) {
  const rows = D.idx[lang];
  for (const e of entries) {
    D.byId.set(e.id, e);
    rows.push({ k: fold(e.lemma), w: e.lemma, id: e.id, r: e.frequency_rank || 1e9, a: 0 });
    for (const v of e.regional_variants || []) if (v.form && fold(v.form) !== fold(e.lemma)) rows.push({ k: fold(v.form), w: v.form, id: e.id, r: e.frequency_rank || 1e9, a: 1 });
  }
  rows.sort(rowSort);
}
function buildIndex(out) {
  for (const lang of Object.keys(REG)) addRows(lang, out[lang] || []);
  const c = D.manifest.counts || {};
  for (const lang of Object.keys(REG)) {
    D.count[lang] = (c[lang] && c[lang].words_for_suggestions) || D.idx[lang].length;
    D.entries[lang] = (c[lang] && c[lang].entries) || (out[lang] || []).length;
    D.top[lang] = D.idx[lang].filter(x => !x.a && x.r < 1e9).sort((a, b) => a.r - b.r).slice(0, 60);
  }
  D.ready = true;
}
/* the extended and long-tail tiers carry only some fields: fill in the rest as empty */
function expand(e) {
  const x = Object.assign({ level: null, frequency_rank: null, ipa: { default: null, regional: {} }, noun: null, verb: null, adjective: null, governs: [],
    regional_variants: [], swiss_german: null, synonyms: [], synonyms_text: [], examples: [], usage_note: null, verified: false }, e);
  x.more = { definition: null, collocations: [], idioms: [], word_family: [], antonyms: [], etymology: null, learner_mistake: null };
  x.origin = e.origin || {};
  if (x.pos === 'noun') x.noun = Object.assign({ gender: null, plural: null, plural_alt: [], plural_rule: null, plural_regular: null, genitive: null, irregular_forms: {} }, e.noun || {});
  if (x.pos === 'verb') x.verb = Object.assign({ regular: null, class: null, aux: null, aux_regional: {}, principal_parts: null, present_3sg: null, irregular_forms: {} }, e.verb || {});
  x.senses = (e.senses || []).map(s => Object.assign({ gloss: null, gloss_en: null, register: null, route: {} }, s));
  return x;
}
/* buckets: same folding as build/build_tiers.py */
const bfold = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/’/g, "'").trim();
const bkey = (w, n) => { const f = bfold(w); let k = ''; for (let i = 0; i < n; i++) { const c = f[i]; k += (c && c >= 'a' && c <= 'z') ? c : '_'; } return k; };
function bucketOf(lang, word) {
  const bs = (D.manifest && D.manifest.buckets && D.manifest.buckets[lang]) || {};
  for (let n = 1; n <= 4; n++) { const k = bkey(word, n); if (bs[k]) return k; }
  return null;
}
function loadBucket(lang, k) {
  if (!k) return Promise.resolve();
  const key = lang + '/' + k;
  if (!D.buckets.has(key)) {
    const sha = D.manifest.buckets[lang][k];
    const file = (D.manifest.bucket_file || 'ext/<lang>/<prefix>.json').replace('<lang>', lang).replace('<prefix>', k);
    D.buckets.set(key, getFile(file, sha).then(d => {
      addRows(lang, (d.entries || []).filter(e => !D.byId.has(e.id)).map(expand));
      const fr = D.frows[lang];
      for (const f in d.forms || {}) fr.push({ k: fold(f), w: f, ids: d.forms[f] });
      fr.sort((a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : 0);
    }).catch(err => { D.buckets.delete(key); throw err; }));
  }
  return D.buckets.get(key);
}
const ensureWord = (lang, word) => loadBucket(lang, bucketOf(lang, word));
const idParts = id => { const p = id.split(':'); return { lang: p[0], lemma: p[1] }; };
async function ensureIds(ids) {
  const need = new Map();
  for (const id of ids) if (!D.byId.has(id)) { const { lang, lemma } = idParts(id); const k = bucketOf(lang, lemma); if (k) need.set(lang + '/' + k, [lang, k]); }
  await Promise.all([...need.values()].map(([l, k]) => loadBucket(l, k).catch(() => {})));
}
function lower(rows, q) { let lo = 0, hi = rows.length; while (lo < hi) { const m = (lo + hi) >> 1; if (rows[m].k < q) lo = m + 1; else hi = m; } return lo; }
function findLoaded(lang, word) {
  const rows = D.idx[lang], k0 = fold(word), keys = [k0, stripKey(lang, k0)];
  for (const k of keys) {
    const hit = [];
    for (let i = lower(rows, k); i < rows.length && rows[i].k === k; i++) hit.push(rows[i]);
    if (hit.length) {
      hit.sort((a, b) => (a.w === word ? 0 : 1) - (b.w === word ? 0 : 1) || a.a - b.a || a.r - b.r);
      const seen = new Set();
      return hit.filter(x => !seen.has(x.id) && seen.add(x.id)).map(x => D.byId.get(x.id));
    }
  }
  return [];
}
function formRows(lang, word) {
  const rows = D.frows[lang], out = [];
  for (const k of new Set([fold(word), stripKey(lang, fold(word))])) for (let i = lower(rows, k); i < rows.length && rows[i].k === k; i++) out.push(rows[i]);
  return out;
}
/* A typed word can be a dictionary word ("went", an old noun), an inflected form of another word ("went" of go),
   or both. The best match comes first: exact spelling before spelling without accents, frequent tiers before
   rare ones, the word itself before a form, then frequency, then the word class with more translations. */
const TIER = { core: 0, ext: 1, tail: 2 };
const POSR = { verb: 0, noun: 1, adjective: 2, adverb: 3 };
async function find(lang, word) {
  const w = word.trim(), lw = w.toLowerCase(), sk = stripKey(lang, lw);
  // the letter file may be missing offline: then only the words already on this device can be found
  let missing = false;
  await Promise.all([ensureWord(lang, sk), sk !== lw ? ensureWord(lang, w) : null].map(p => p && p.catch(() => { missing = true; })));
  const ssw = w.replace(/ß/g, 'ss');               // Swiss spelling: Strasse is Straße
  const exact = x => (x === w || x.replace(/ß/g, 'ss') === ssw) ? 0 : (x.toLowerCase() === lw || stripKey(lang, x.toLowerCase()) === sk) ? 1 : 2;
  const cand = new Map();
  const put = (e, ex, isForm) => {
    const nTr = e.senses.reduce((a, s) => a + Object.values(s.translations).reduce((b, l) => b + l.length, 0), 0);
    const key = [ex, TIER[e.tier] || 0, isForm, e.frequency_rank || 1e9, -nTr, POSR[e.pos] == null ? 9 : POSR[e.pos]];
    const old = cand.get(e.id);
    if (!old || cmpKey(key, old.key) < 0) cand.set(e.id, { e, key, isForm });
  };
  for (const e of findLoaded(lang, w)) put(e, exact(e.lemma), 0);
  const fr = formRows(lang, w);
  if (fr.length) {
    await ensureIds(fr.flatMap(r => r.ids));
    for (const r of fr) for (const id of r.ids) { const e = D.byId.get(id); if (e) put(e, exact(r.w), 1); }
  }
  const list = [...cand.values()].sort((a, b) => cmpKey(a.key, b.key));
  if (!list.length && missing) throw new Error('letter file not on this device');
  return { hits: list.map(x => x.e), form: list.length && list[0].isForm ? w : null };
}
function cmpKey(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; }
function suggest(lang, raw, n) {
  const q = stripKey(lang, fold(raw)), out = [], seen = new Set();
  const add = (w, tag) => { if (out.length < n && !seen.has(w)) { seen.add(w); out.push({ w, tag }); } };
  (recent[lang] || []).filter(w => !q || fold(w).startsWith(q)).forEach(w => add(w, 'recent'));
  if (!D.ready) return out;
  if (!q) { D.top[lang].forEach(x => add(x.w, '')); return out; }
  const rows = D.idx[lang], c = [];
  for (let i = lower(rows, q); i < rows.length && rows[i].k.startsWith(q) && c.length < 3000; i++) c.push(rows[i]);
  c.sort((a, b) => (a.k === q ? 0 : 1) - (b.k === q ? 0 : 1) || a.r - b.r || a.k.length - b.k.length);
  c.forEach(x => add(x.w, ''));
  const fr = D.frows[lang], fc = [];
  for (let i = lower(fr, q); i < fr.length && fr[i].k.startsWith(q) && fc.length < 400; i++) fc.push(fr[i]);
  fc.sort((a, b) => (a.k === q ? 0 : 1) - (b.k === q ? 0 : 1) || a.k.length - b.k.length);
  fc.forEach(x => add(x.w, '→ ' + idParts(x.ids[0]).lemma));
  return out;
}

/* ---------- senses and translations ---------- */
const hiddenRoute = (s, lang) => !!((s.hidden && s.hidden.includes(lang)) || (s.route && s.route[lang] === 'via-en-unchecked'));      // kept in the data, never shown
/* Regional order (data: senses[].regional {id: ["BR"] | ["+CH"] | ["-CH"] | []}, see build/regions.py):
   a word marked for the reader's region comes first if the list also has a word for another region or the marker
   is "+R"; words marked only for other regions (or "-R") come last; the rest keep their order. */
const plainRegions = mk => mk ? mk.filter(x => !/^[+-]/.test(x)) : null;
function regionScore(s, lang, ids) {
  const m = s.regional || {}, R = S.main[lang].toUpperCase();
  const pair = ids.some(t => { const p = plainRegions(m[t]); return p && p.length && !p.includes(R); });
  return t => {
    const mk = m[t]; if (!mk) return 1;
    if (mk.includes('+' + R)) return 0;
    if (mk.includes('-' + R)) return 2;
    const p = plainRegions(mk);
    if (!mk.length) return 2;
    if (!p.length) return 1;
    return p.includes(R) ? (pair ? 0 : 1) : 2;
  };
}
function trIds(s, lang) {
  if (hiddenRoute(s, lang)) return [];
  const ids = (s.translations[lang] || []).filter(id => D.byId.has(id));
  if (!s.regional || ids.length < 2) return ids;
  const sc = regionScore(s, lang, ids), k = new Map(ids.map((t, i) => [t, sc(t) * 1000 + i]));
  return ids.slice().sort((a, b) => k.get(a) - k.get(b));
}
// where a word is used, if only in some regions: from the sense it was reached through, else from the entry
function usedIn(e, s) {
  const p = s && s.regional ? plainRegions(s.regional[e.id]) : null;
  if (p && (p.length || (s.regional[e.id] || []).length === 0)) return p;
  return e.used_in || null;
}
function visibleSenses(e) {
  return e.senses.map((s, i) => ({ s, i })).filter(({ s }) => !(e.lang !== 'de' && hiddenRoute(s, 'de')) && Object.keys(REG).some(l => l !== e.lang && trIds(s, l).length));
}
const linkedIds = e => [...e.senses.flatMap(s => Object.values(s.translations).flat()), ...(e.synonyms || [])];

/* ---------- state ---------- */
let state = { status: 'loading', msg: 'Loading the dictionary data…', src: { lang: 'de', word: 'stehen' }, entry: null, sense: 0, pick: {}, forms: {}, more: {}, others: [], error: '' };
let seq = 0;
async function openEntry(e, sense, word, form) {
  const my = ++seq;
  try { await ensureIds(linkedIds(e)); } catch (err) {}
  if (my !== seq) return;
  const vis = visibleSenses(e);
  const si = (sense != null && e.senses[sense]) ? sense : (vis.length ? vis[0].i : 0);
  state = { status: 'done', src: { lang: e.lang, word: word || e.lemma }, entry: e, sense: si, pick: {}, forms: {}, more: {}, others: state.others || [], form: form || null, error: '' };
  recent[e.lang] = [e.lemma, ...(recent[e.lang] || []).filter(x => x !== e.lemma)].slice(0, 8); store.set('flt:recent3', recent);
  render();
}
async function translate(lang, word) {
  word = String(word || '').trim(); if (!word) return;
  if (!D.ready) { toast('The dictionary data is still loading.'); return; }
  const my = ++seq;
  let res;
  try { res = await find(lang, word); }
  catch (err) { if (my === seq) { state = Object.assign({}, state, { status: 'error', error: 'The data for this word is not on this device yet. Connect to the internet once to load it.', near: [] }); render(); } return; }
  if (my !== seq) return;
  if (!res.hits.length) {
    const near = suggest(lang, word.slice(0, Math.max(2, word.length - 2)), 5).map(x => x.w);
    state = { status: 'error', src: { lang, word }, entry: null, sense: 0, pick: {}, forms: {}, more: {}, others: [], near,
      error: `“${word}” is not in the ${LNAME[lang]} data. The app holds ${num(D.count[lang])} ${LNAME[lang]} words and forms and makes no entries up.` };
    render(); return;
  }
  state.others = res.hits;
  return openEntry(res.hits[0], null, word, res.form);
}
function quad() {
  const e = state.entry, s = e.senses[state.sense], q = {}, alts = {};
  q[e.lang] = e;
  for (const l of Object.keys(REG)) {
    if (l === e.lang) continue;
    const ids = s ? trIds(s, l) : [];
    alts[l] = ids;
    q[l] = ids.length ? D.byId.get(ids[Math.min(state.pick[l] || 0, ids.length - 1)]) : null;
  }
  return { q, alts, sense: s };
}

/* ---------- regional view of one entry ---------- */
const ss = s => String(s).replace(/ß/g, 'ss');
const H_ASPIRE = new Set('hache haie haine hall halte hamac hamburger hameau hamster hanche handicap hangar harcèlement hardi harem hareng haricot harpe hasard hâte hausse haut hauteur héros hibou hiérarchie hockey homard honte hoquet hors housse hublot huit hurlement hutte'.split(' '));
function article(lang, e, word, plural) {
  const g = e.noun && e.noun.gender; if (!g) return '';
  if (lang === 'de') return plural ? 'die' : ({ m: 'der', f: 'die', n: 'das' }[g] || '');
  if (lang === 'fr') {
    if (plural) return 'les';
    const w = word.toLowerCase();
    if (/^[aeiouyàâéèêîôûœ]/.test(w) || (w[0] === 'h' && !H_ASPIRE.has(w))) return "l'";
    return { m: 'le', f: 'la', 'm/f': 'le/la' }[g] || '';
  }
  if (lang === 'pt') return plural ? ({ m: 'os', f: 'as', 'm/f': 'os/as' }[g] || '') : ({ m: 'o', f: 'a', 'm/f': 'o/a' }[g] || '');
  return '';
}
const withArt = (a, w) => a ? (a.endsWith("'") ? a + w : a + ' ' + w) : w;
function regionView(e) {
  const lang = e.lang, main = S.main[lang], R = main.toUpperCase(), isBase = main === BASE[lang];
  const v = isBase ? null : (e.regional_variants || []).find(x => x.region === R);
  const o = { word: (v && v.form) || e.lemma, note: v ? v.note : null, changed: !!(v && v.form && v.form !== e.lemma) };
  const reg = e.ipa.regional || {};
  o.ipa = (!isBase && reg[R]) || e.ipa.default; o.narrow = !!e.ipa.narrow && o.ipa === e.ipa.default;
  o.ipaFrom = !isBase && !reg[R] && o.ipa ? BASE[lang] : null;     // no transcription of its own: the base region's is shown, and said so
  o.aux = e.verb ? ((!isBase && e.verb.aux_regional && e.verb.aux_regional[R]) || e.verb.aux) : null;
  o.plural = (v && v.plural) || (e.noun && !o.changed ? e.noun.plural : null);
  // the other regions, where they differ
  o.accents = []; o.groups = [];
  for (const r of REG[lang]) {
    if (r === main) continue;
    const RR = r.toUpperCase(), base = r === BASE[lang];
    const ip = (!base && reg[RR]) || e.ipa.default;
    if (ip && ip !== o.ipa) { const a = o.accents.find(x => x.ipa === ip); if (a) a.regions.push(r); else o.accents.push({ regions: [r], ipa: ip, narrow: !!e.ipa.narrow && ip === e.ipa.default }); }
    const rv = base ? null : (e.regional_variants || []).find(x => x.region === RR);
    const parts = [];
    const w = (rv && rv.form) || e.lemma;
    if (w !== o.word) parts.push(withArt(rv && rv.article ? rv.article : (e.noun ? article(lang, e, w) : ''), w));
    if (rv && rv.plural && rv.plural !== o.plural) parts.push('pl. ' + rv.plural);
    const ax = e.verb ? ((!base && e.verb.aux_regional && e.verb.aux_regional[RR]) || e.verb.aux) : null;
    if (ax && ax !== o.aux) parts.push('auxiliary ' + ax);
    const note = rv ? rv.note : null;
    if (!parts.length && !note) continue;
    const sig = JSON.stringify([parts, note]), g = o.groups.find(x => x.sig === sig);
    if (g) g.regions.push(r); else o.groups.push({ sig, regions: [r], parts, note });
  }
  return o;
}

/* ---------- tables of forms ---------- */
const PERS = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'];
const CASES = [['nom', 'Nominativ'], ['acc', 'Akkusativ'], ['dat', 'Dativ'], ['gen', 'Genitiv']];
const DE_ART = { m: { nom: 'der', acc: 'den', dat: 'dem', gen: 'des' }, f: { nom: 'die', acc: 'die', dat: 'der', gen: 'der' }, n: { nom: 'das', acc: 'das', dat: 'dem', gen: 'des' }, pl: { nom: 'die', acc: 'die', dat: 'den', gen: 'der' } };
const frJe = w => /^[aeiouyhàâéèêîôûœ]/i.test(w) ? "j'" + w : 'je ' + w;
function canForms(e) {
  const b = e[e.pos]; if (!b || !['noun', 'verb', 'adjective'].includes(e.pos)) return false;
  const multi = /[ '’]/.test(e.lemma);
  if (e.pos === 'verb') return !!b.principal_parts && (e.lang === 'en' || !multi);
  if (e.pos === 'noun') return e.lang === 'de' ? !!(b.gender && (b.genitive || b.plural)) : !!b.plural;
  if (e.lang === 'de') return !multi;
  if (e.lang === 'en') return !!b.comparison;
  return !!b.agreement || !multi;
}
function tables(e, rv) {
  const f = FLTForms.forms(e), r = FLTForms.regularForms(e), b = e[e.pos], lang = e.lang, pos = e.pos;
  const stored = b.irregular_forms || {};
  const irr = k => {
    if (f[k] == null) return false;
    if (pos === 'verb') return r[k] != null && f[k] !== r[k];
    if (pos === 'noun') return (k in stored) || (/pl$/.test(k) && b.plural_regular === false);
    if (lang === 'de' || lang === 'en') return (k === 'comp' || k === 'sup') && b.comparison_regular === false;
    return r[k] != null && f[k] !== r[k];
  };
  const row = (label, k, pre, post) => f[k] ? [label, (pre || '') + f[k] + (post || ''), irr(k)] : null;
  const sec = (title, rows) => ({ title, rows: rows.filter(Boolean) });
  const tense = (title, t, pron, wrap) => sec(title, PERS.map((p, i) => f[t + '.' + p] ? [typeof pron[i] === 'function' ? '' : pron[i], wrap ? wrap(f[t + '.' + p], i) : f[t + '.' + p], irr(t + '.' + p)] : null));
  let T = [];
  if (pos === 'verb' && lang === 'de') {
    const pr = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie'];
    const aux = (rv.aux || 'haben').split('/').map(a => a === 'sein' ? 'ist' : 'hat').join('/');
    T = [tense('Präsens (present)', 'praes', pr), tense('Präteritum (simple past)', 'praet', pr),
      sec('Perfekt (perfect)', [f.part2 ? ['er/sie/es', aux + ' ' + f.part2, irr('part2')] : null]),
      tense('Konjunktiv I', 'konj1', pr), tense('Konjunktiv II', 'konj2', pr),
      sec('Imperativ (commands)', [row('du', 'imp.sg', '', '!'), row('ihr', 'imp.pl', '', '!')]),
      sec('Partizipien (participles)', [row('Partizip I', 'part1'), row('Partizip II', 'part2')])];
  } else if (pos === 'noun' && lang === 'de') {
    const g = b.gender;
    T = [sec('Deklination (cases)', [
      ...CASES.map(([c, name]) => f[c + '.sg'] ? [name + ' Sg.', (g && DE_ART[g] ? DE_ART[g][c] + ' ' : '') + f[c + '.sg'], irr(c + '.sg')] : null),
      ...CASES.map(([c, name]) => f[c + '.pl'] ? [name + ' Pl.', DE_ART.pl[c] + ' ' + f[c + '.pl'], irr(c + '.pl')] : null)])];
  } else if (pos === 'adjective' && lang === 'de') {
    const deg = (typ) => sec(typ[1], [['nom', 'Nominativ'], ['gen', 'Genitiv'], ['dat', 'Dativ'], ['acc', 'Akkusativ']].map(([c, name]) =>
      [name, ['m', 'f', 'n', 'pl'].map(x => f['pos.' + typ[0] + '.' + c + '.' + x]).join(' · '), false]));
    T = [sec('Steigerung (comparison)', [['Positiv', e.lemma, false], row('Komparativ', 'comp'), row('Superlativ', 'sup')]),
      deg(['strong', 'Stark: no article (m · f · n · pl)']), deg(['weak', 'Schwach: after der, die, das']), deg(['mixed', 'Gemischt: after ein, kein, mein'])];
    if (b.comparison === null && !stored.comp) T[0].rows = T[0].rows.slice(0, 1);
  } else if (pos === 'verb' && lang === 'en') {
    T = [sec('Forms', [['base form', e.lemma, false], row('he / she / it', '3sg'), row('-ing form', 'ing'), row('past', 'past'), row('past participle', 'pp'), f.pp ? ['perfect', 'has ' + f.pp, irr('pp')] : null])];
  } else if (pos === 'verb' && lang === 'fr') {
    const pr = ['je', 'tu', 'il/elle', 'nous', 'vous', 'ils/elles'];
    const w = (x, i) => i === 0 ? frJe(x) : pr[i] + ' ' + x;
    const que = (x, i) => (i === 0 ? 'que ' + frJe(x) : (i === 2 || i === 5 ? "qu'" : 'que ') + pr[i] + ' ' + x);
    const tt = (title, t, wrap) => sec(title, PERS.map((p, i) => f[t + '.' + p] ? ['', wrap(f[t + '.' + p], i), irr(t + '.' + p)] : null));
    const etre = rv.aux === 'être';
    T = [tt('Présent', 'pres', w), tt('Imparfait', 'impf', w),
      sec('Passé composé', [f.pp ? ['', (etre ? 'je suis ' : "j'ai ") + f.pp + (etre ? '(e)' : ''), irr('pp')] : null]),
      tt('Futur simple', 'fut', w), tt('Conditionnel', 'cond', w), tt('Subjonctif présent', 'subj', que), tt('Passé simple', 'ps', w), tt('Subjonctif imparfait', 'subjimpf', que),
      sec('Impératif', [row('tu', 'imp.2sg', '', ' !'), row('nous', 'imp.1pl', '', ' !'), row('vous', 'imp.2pl', '', ' !')]),
      sec('Participes', [row('présent', 'ppres'), row('passé', 'pp')])];
  } else if (pos === 'verb' && lang === 'pt') {
    const pr = ['eu', 'tu', 'ele/ela/você', 'nós', 'vós', 'eles/elas/vocês'];
    T = [tense('Presente', 'pres', pr), tense('Pretérito perfeito', 'pret', pr), tense('Pretérito imperfeito', 'impf', pr),
      tense('Mais-que-perfeito', 'plup', pr), tense('Futuro do presente', 'fut', pr), tense('Futuro do pretérito (condicional)', 'cond', pr),
      tense('Presente do subjuntivo', 'subj', pr), tense('Imperfeito do subjuntivo', 'subjimpf', pr), tense('Futuro do subjuntivo', 'subjfut', pr),
      tense('Infinitivo pessoal', 'infpers', pr),
      sec('Imperativo', [row('tu', 'imp.2sg'), row('você', 'imp.3sg'), row('nós', 'imp.1pl'), row('vós', 'imp.2pl'), row('vocês', 'imp.3pl')]),
      sec('Formas nominais', [row('infinitivo', 'inf'), row('gerúndio', 'ger'), row('particípio', 'pp')])];
  } else if (pos === 'noun') {
    const pl = b.plural;
    T = [sec(lang === 'en' ? 'Number' : lang === 'fr' ? 'Nombre' : 'Número', [[lang === 'en' ? 'singular' : lang === 'fr' ? 'singulier' : 'singular', withArt(article(lang, e, e.lemma), e.lemma), false],
      pl ? [lang === 'fr' ? 'pluriel' : 'plural', withArt(article(lang, e, pl, true), pl), b.plural_regular === false] : null])];
  } else if (pos === 'adjective' && lang === 'en') {
    T = [sec('Comparison', [['positive', e.lemma, false], row('comparative', 'comp'), row('superlative', 'sup')])];
  } else if (pos === 'adjective') {
    const a = b.agreement || [e.lemma, f['f.sg'], f['m.pl'], f['f.pl']];
    const L = lang === 'fr' ? ['masculin singulier', 'féminin singulier', 'masculin pluriel', 'féminin pluriel'] : ['masculino singular', 'feminino singular', 'masculino plural', 'feminino plural'];
    const K = [null, 'f.sg', 'm.pl', 'f.pl'];
    T = [sec(lang === 'fr' ? 'Accord' : 'Concordância', a.map((x, i) => x ? [L[i], x, !!K[i] && r[K[i]] != null && x !== r[K[i]]] : null))];
  }
  return T.filter(t => t.rows.length);
}

/* ---------- audio: the device's own voices only ---------- */
let voices = [];
try { if ('speechSynthesis' in window) { const lv = () => { voices = speechSynthesis.getVoices() || []; }; lv(); speechSynthesis.addEventListener('voiceschanged', lv); } else document.body.classList.add('no-audio'); } catch (e) {}
function pickVoice(loc) {
  const n = v => String(v.lang || '').toLowerCase().replace('_', '-'), l = loc.toLowerCase();
  return voices.find(v => n(v) === l) || voices.find(v => n(v).slice(0, 2) === l.slice(0, 2));
}
function speak(text, lang) {
  text = String(text || '').replace(/\s*\(.*?\)/g, '').trim(); if (!text) return;
  const loc = LOCALE[lang][S.main[lang]];
  try {
    if (!('speechSynthesis' in window)) throw 0;
    const v = pickVoice(loc);
    if (!v && voices.length) { toast(`No ${LNAME[lang]} voice is installed on this device. You can add one in the device's language or speech settings.`); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = loc;
    u.rate = S.slow ? 0.7 : 0.95;
    speechSynthesis.speak(u);
  } catch (e) { toast('This browser cannot read text aloud.'); }
}
const sayBtn = (text, lang, sm) => `<button class="say${sm ? ' sm' : ''}" data-say="${esc(text)}" data-lang="${lang}" aria-label="Listen" title="Listen">${SPEAKER}</button>`;

/* ---------- render ---------- */
const GENDER = { m: 'masculine', f: 'feminine', n: 'neuter', 'm/f': 'masculine or feminine' };
const CASENAME = { Akk: 'Akkusativ', Dat: 'Dativ', Gen: 'Genitiv' };
const badge = r => r === true ? '<span class="reg ok">regular</span>' : r === false ? '<span class="reg bad">irregular</span>' : '';
const ipaHtml = (ipa, narrow) => `<span class="ipa">${narrow ? '[' : '/'}${esc(ipa)}${narrow ? ']' : '/'}</span>`;
const lemmaOf = id => { const x = D.byId.get(id); return x ? x.lemma : null; };
function wikiLink(lang, word) {
  return `<a href="https://en.wiktionary.org/wiki/${encodeURIComponent(word)}${({ en: '#English', de: '#German', fr: '#French', pt: '#Portuguese' })[lang]}" target="_blank" rel="noopener">Wiktionary</a>`;
}
function exampleList(q) {
  const src = state.entry;
  const donor = (src.examples && src.examples.length) ? src : (q.de && q.de.examples.length ? q.de : Object.values(q).find(x => x && x.examples.length));
  if (!donor) return { donor: null, list: [] };
  let list = donor.examples.slice();
  if (S.level === 'easy') list.sort((a, b) => a.text.length - b.text.length);
  if (S.level === 'advanced') list.sort((a, b) => b.text.length - a.text.length);
  return { donor, list };
}
function examplesBlock(lang, ex) {
  if (!ex.donor) return (!D.details && state.entry && state.entry.tier === 'core') ? '<p class="note" lang="en">Loading example sentences…</p>' : '';
  const items = [];
  for (const x of ex.list) {
    if (items.length >= +S.examples) break;
    let text, hl = null;
    if (lang === ex.donor.lang) { text = x.text; hl = x.hl; } else text = x.translations && x.translations[lang];
    if (!text) continue;
    const html = hl ? esc(text.slice(0, hl[0])) + '<mark>' + esc(text.slice(hl[0], hl[1])) + '</mark>' + esc(text.slice(hl[1])) : esc(text);
    const who = x.origin === 'tatoeba' ? 'Tatoeba ' + (lang === ex.donor.lang ? x.id : (x.translation_ids && x.translation_ids[lang]) || x.id).replace('t:', '#') + ((x.credits && x.credits[lang]) ? ' · ' + x.credits[lang] : '') + ' · CC BY 2.0 FR' : 'Written by AI';
    items.push(`<li title="${esc(who)}">${html}${sayBtn(text, lang, true)}</li>`);
  }
  return items.length ? `<ul class="ex">${items.join('')}</ul>` : '';
}
function formsBlock(e, rv) {
  const fs = state.forms[e.lang]; if (!fs || !fs.open) return '';
  const T = tables(e, rv);
  const anyIrr = T.some(t => t.rows.some(r => r[2]));
  return `<div class="forms">${T.map(t => `<section><h3>${esc(t.title)}</h3><table>${t.rows.map(r => `<tr>${r[0] ? `<th scope="row">${esc(r[0])}</th>` : ''}<td${r[0] ? '' : ' colspan="2"'}${r[2] ? ' class="irr"' : ''}>${esc(r[1])}</td></tr>`).join('')}</table></section>`).join('')}</div>${anyIrr ? '<p class="note" lang="en">Forms in red are irregular.</p>' : ''}`;
}
function sourcesLine(e, ex, lang) {
  const o = Object.values(e.origin || {}), parts = [];
  if (o.includes('wiktionary')) parts.push('Wiktionary (CC BY-SA 4.0)');
  if (ex.donor && ex.list.some(x => x.origin === 'tatoeba')) parts.push('example sentences from Tatoeba (CC BY 2.0 FR)');
  const ai = Object.entries(e.origin || {}).filter(([, v]) => v === 'claude').map(([k]) => ({ level: 'level', swiss_german: 'Swiss German form', usage_note: 'note', 'more.learner_mistake': 'common mistake', 'examples.library': 'some sentences', senses: 'a translation link' }[k] || k.replace(/^more\./, '').replace(/_/g, ' ')));
  if (ai.length) parts.push('written by AI: ' + [...new Set(ai)].join(', '));
  if (o.includes('generated')) parts.push('regular/irregular labels and tables of forms built by rule');
  if (e.tier && e.tier !== 'core') parts.push('short entry: this word has only basic data so far');
  return parts.length ? `<div><h3>Sources</h3><p>${esc(parts.join('; '))}.</p></div>` : '';
}
function moreBlock(e, ex) {
  const ms = state.more[e.lang]; if (!ms || !ms.open) return '';
  if (!e.more && e.tier === 'core' && !D.details) return '<div class="extra" lang="en"><p>Loading the background of this word…</p></div>';
  const d = e.more || {}, lang = e.lang;
  const list = (t, a) => a && a.length ? `<div><h3>${t}</h3><ul>${a.map(x => { const [w, g] = String(x).split(' — '); return `<li><b lang="${lang}">${esc(w)}</b>${g ? ` <span lang="${lang === 'de' && t === 'Idioms' ? 'de' : 'en'}">· ${esc(g)}</span>` : ''}</li>`; }).join('')}</ul></div>` : '';
  const body = `${d.definition ? `<div><h3>Definition</h3><p>${esc(d.definition)}</p></div>` : ''}
    ${list('Common combinations', d.collocations)}${list('Idioms', d.idioms)}${list('Word family', d.word_family)}
    ${d.antonyms && d.antonyms.length ? `<div><h3>Opposites</h3><p lang="${lang}">${esc(d.antonyms.join(', '))}</p></div>` : ''}
    ${d.etymology ? `<div><h3>Origin</h3><p>${esc(d.etymology)}</p></div>` : ''}
    ${d.learner_mistake ? `<div><h3>Common mistake</h3><p>${esc(d.learner_mistake)}</p></div>` : ''}`;
  return `<div class="extra" lang="en">${body.trim() ? body : '<p>No background is stored for this word yet.</p>'}${sourcesLine(e, ex, lang)}</div>`;
}
function card(l, e, alts, ex) {
  const lang = l.id;
  if (!e) return `<article class="card empty"><span class="tab">${l.code}</span><p class="note" lang="en">No ${l.name} translation for this meaning in the data.</p></article>`;
  const pos = e.pos, rv = regionView(e), rows = [], n = e.noun, v = e.verb, a = e.adjective;
  const art = pos === 'noun' ? article(lang, e, rv.word) : '';
  if (rv.accents.length) rows.push(['Elsewhere', rv.accents.map(x => `<span style="white-space:nowrap;margin-right:10px">${x.regions.map(r => flag(r, true)).join('')}${ipaHtml(x.ipa, x.narrow)}</span>`).join('')]);
  if (n) {
    rows.push(['Gender', lang === 'en' ? '<span class="sub">English nouns have no grammatical gender</span>' : `<span class="form">${esc(GENDER[n.gender] || '—')}</span>${art ? ` <span class="sub">article: ${esc(art)}</span>` : ''}`]);
    if (rv.plural) rows.push(['Plural', `<span class="form">${esc(withArt(article(lang, e, rv.plural, true), rv.plural))}</span> ${badge(n.plural_regular)}${n.plural_rule ? `<span class="sub">${esc(n.plural_rule)}</span>` : ''}${n.plural_alt && n.plural_alt.length ? `<span class="sub">also: ${esc(n.plural_alt.join(', '))}</span>` : ''}`]);
  }
  if (v) {
    if (v.regular !== null || v.class) rows.push(['Verb', `${badge(v.regular)}${v.class ? `<span class="sub">${esc(v.class + (lang === 'de' ? ' verb' : ''))}</span>` : ''}`]);
    const pp = v.principal_parts;
    if (pp) {
      let s = '';
      if (lang === 'de') { const ax = (rv.aux || 'haben').split('/').map(x => x === 'sein' ? 'ist' : 'hat').join('/'); s = [v.present_3sg, pp[1], pp[2] ? ax + ' ' + pp[2] : null].filter(Boolean).join(' · '); }
      else if (lang === 'en') { const f = FLTForms.forms(e); s = [f['3sg'], pp[1], pp[2] ? 'has ' + pp[2] : null].filter(Boolean).join(' · '); }
      else if (lang === 'fr') s = [pp[1] ? frJe(pp[1]) : null, pp[2] ? (rv.aux === 'être' ? 'je suis ' + pp[2] + '(e)' : "j'ai " + pp[2]) : null].filter(Boolean).join(' · ');
      else s = pp.slice(1).filter(Boolean).join(' · ');
      if (s) rows.push(['Forms', `<span class="form">${esc(s)}</span>`]);
    }
    if (rv.aux) rows.push(['Auxiliary', `<span class="form">${esc(rv.aux.replace('/', ' or '))}</span>`]);
  }
  if (a && a.agreement) rows.push(['Agreement', `<span class="form">${esc(a.agreement.filter(Boolean).join(' · '))}</span>`]);
  if (a && a.comparison) rows.push(['Compare', `<span class="form">${esc(a.comparison.join(' · '))}</span> ${badge(a.comparison_regular)}`]);
  if (e.governs && e.governs.length) rows.push([lang === 'de' ? 'Prep. + case' : 'Followed by',
    `<ul class="gov">${e.governs.map(g => { const pat = g.pattern || (e.lemma + (g.prep ? ' ' + g.prep : '') + (g.case ? ' + ' + g.case.split('/').map(c => CASENAME[c] || c).join(' / ') : '')); return `<li><span class="pat">${esc(pat)}</span>${g.meaning ? `<span class="sub" lang="en">${esc(g.meaning)}</span>` : ''}</li>`; }).join('')}</ul>`]);
  const syn = [...(e.synonyms || []).map(lemmaOf).filter(Boolean), ...(e.synonyms_text || [])].slice(0, 6);
  if (syn.length) rows.push(['Synonyms', `<span class="form">${esc(syn.join(', '))}</span>`]);
  const sn = state.entry && state.entry.senses[state.sense];
  const chipFlags = id => { const p = sn && sn.regional ? plainRegions(sn.regional[id]) : null; return p && p.length ? p.map(r => flag(r.toLowerCase(), true)).join('') : ''; };
  if (alts && alts.length > 1) rows.push(['Also', alts.map((id, i) => D.byId.get(id) === e ? '' : `<button class="chip" data-pick="${lang}:${i}" lang="${lang}">${chipFlags(id)}${esc(lemmaOf(id))}</button>`).join(' ')]);
  const ui = usedIn(e, e === state.entry ? null : sn), R = S.main[lang].toUpperCase();
  if (ui && !ui.includes(R)) rows.unshift(['Used in', ui.length ? ui.map(r => flag(r.toLowerCase(), true) + esc(RNAME[r.toLowerCase()])).join(' &nbsp;') + ` <span class="sub">not usual in ${esc(RNAME[S.main[lang]])}</span>` : '<span class="sub">regional (not one of the regions offered here)</span>']);
  if (S.variants && rv.groups.length) rows.push(['Variants',
    `<ul class="vars">${rv.groups.map(g => `<li><span class="where" lang="en">${g.regions.map(r => flag(r, true) + esc(RNAME[r])).join(' &nbsp;')}</span>${g.parts.length ? `<span class="form">${esc(g.parts.join(' · '))}</span>` : ''}${g.note ? `<span class="sub" lang="en">${esc(g.note)}</span>` : ''}</li>`).join('')}</ul>`]);
  if (S.gsw && lang === 'de' && e.swiss_german) rows.push(['Swiss German', `${flag('ch', true)}<span class="form" lang="gsw">${esc(e.swiss_german.form)}</span><span class="sub" lang="en">spoken dialect${e.swiss_german.approximate ? ', spelling is approximate' : ''}</span>`]);
  const fs = state.forms[lang], ms = state.more[lang];
  const head = withArt(art, rv.word);
  let html = `<article class="card" lang="${LOCALE[lang][S.main[lang]]}" data-id="${esc(e.id)}">
    <span class="tab">${l.code}</span>
    <div><div class="hwrow"><h2 class="hw">${art ? `<span class="art">${esc(art)}</span>${art.endsWith("'") ? '' : ' '}` : ''}${esc(rv.word)}</h2>${sayBtn(head, lang)}</div>
    <div class="pron">${rv.ipa ? (rv.ipaFrom ? `<span class="ipafrom" lang="en" title="Wiktionary has no separate transcription for ${RNAME[S.main[lang]]}; this is the pronunciation of ${RNAME[rv.ipaFrom]}">${flag(rv.ipaFrom, true)}</span>` : '') + ipaHtml(rv.ipa, rv.narrow) + (rv.ipaFrom ? `<span class="sub ipanote" lang="en">as in ${RNAME[rv.ipaFrom]}</span>` : '') : ''}<span class="pos" lang="en">${esc(pos)}${n && n.gender ? ' · ' + esc(n.gender) : ''}</span>${e.level && CEFR[e.level] ? `<span class="lvl" lang="en">${e.level} · ${CEFR[e.level]}</span>` : ''}</div></div>
    ${rows.length ? `<dl>${rows.map(([x, y]) => `<dt lang="en">${x}</dt><dd>${y}</dd>`).join('')}</dl>` : ''}
    ${canForms(e) ? `<button class="more" data-extra="forms" data-lang="${lang}" lang="en" aria-expanded="${fs && fs.open ? 'true' : 'false'}">${fs && fs.open ? 'Hide forms' : 'See more forms'}</button>${formsBlock(e, rv)}` : ''}
    ${examplesBlock(lang, ex)}
    ${e.usage_note ? `<p class="note" lang="en"><b>Note</b> ${esc(e.usage_note)}</p>` : ''}
    ${rv.note && S.main[lang] !== BASE[lang] ? `<p class="note" lang="en"><b>In ${RNAME[S.main[lang]]}</b> ${esc(rv.note)}</p>` : ''}
    <button class="more" data-extra="more" data-lang="${lang}" lang="en" aria-expanded="${ms && ms.open ? 'true' : 'false'}">${ms && ms.open ? 'Hide background' : 'More about this word'}</button>${moreBlock(e, ex)}
    ${S.links ? `<div class="links" lang="en">${wikiLink(lang, e.lemma)}</div>` : ''}
  </article>`;
  if (lang === 'de' && S.main.de === 'ch') html = html.replace(/ß/g, 'ss');      // Swiss spelling has no ß
  return html;
}
function render(fill) {
  const st = $('#status'), cards = $('#cards');
  if (state.status === 'loading') {
    st.innerHTML = `<span>${esc(state.msg)}</span>`;
    cards.innerHTML = LANGS.map(l => `<article class="card loading"><span class="tab">${l.code}</span><div class="sk big"></div><div class="sk"></div><div class="sk" style="width:80%"></div><div class="sk" style="width:65%"></div></article>`).join('');
    return;
  }
  if (state.status === 'error') {
    st.innerHTML = `<span class="err">${esc(state.error)}</span>` + ((state.near || []).length ? `<span>Close to it:</span>${state.near.map(w => `<button class="chip" data-go="${esc(state.src.lang)}:${esc(w)}">${esc(w)}</button>`).join('')}` : '');
    cards.innerHTML = ''; return;
  }
  const e = state.entry, { q, alts, sense } = quad(), ex = exampleList(q);
  if (fill !== false) LANGS.forEach(l => { const x = q[l.id]; let w = x ? regionView(x).word : ''; if (l.id === 'de' && S.main.de === 'ch') w = ss(w); $('#in-' + l.id).value = w; });
  const vis = visibleSenses(e).filter(x => x.i !== state.sense).slice(0, 5);
  const others = (state.others || []).filter(x => x !== e).slice(0, 4);
  let srcWord = regionView(e).word; if (e.lang === 'de' && S.main.de === 'ch') srcWord = ss(srcWord);
  st.innerHTML = (state.form && fold(state.form) !== fold(e.lemma) ? `<span><b>${esc(state.form)}</b> is a form of <b>${esc(srcWord)}</b>.</span>` : '')
    + `<span>From ${LNAME[e.lang]}: <b>${esc(srcWord)}</b>${sense && sense.gloss_en ? ` · ${esc(sense.gloss_en)}` : ''}</span>`
    + (vis.length ? `<span>Other senses:</span>${vis.map(x => `<button class="chip" data-sense="${x.i}">${esc(x.s.gloss_en || '…')}</button>`).join('')}` : '')
    + (others.length ? `<span>Same spelling:</span>${others.map(x => `<button class="chip" data-id="${esc(x.id)}">${esc(x.lemma)}<small>${esc(x.pos)}</small></button>`).join('')}` : '')
    + `<span>Try:</span>${TRY.filter(w => w !== e.lemma).slice(0, 6).map(w => `<button class="chip" data-go="de:${esc(w)}">${esc(w)}</button>`).join('')}`;
  cards.innerHTML = LANGS.map(l => card(l, q[l.id], alts[l.id], ex)).join('');
}

/* ---------- slots ---------- */
function buildSlots() {
  $('#slots').innerHTML = LANGS.map(l => `
   <div class="slot" data-lang="${l.id}">
     <div class="slot-head"><span id="flag-${l.id}">${flag(S.main[l.id])}</span><span class="lang-name">${l.name}</span>
       <select id="var-${l.id}" aria-label="Main variant of ${l.name}">${REG[l.id].map(r => `<option value="${r}"${r === S.main[l.id] ? ' selected' : ''}>${RNAME[r]}</option>`).join('')}</select>
     </div>
     <form class="field" autocomplete="off">
       <input id="in-${l.id}" type="text" placeholder="${l.ph}" aria-label="${l.name} word" role="combobox" aria-expanded="false" aria-controls="sg-${l.id}" autocapitalize="off" spellcheck="false">
       <button type="submit" id="go-${l.id}">Translate</button>
     </form>
     <ul class="sugg" id="sg-${l.id}" role="listbox" hidden></ul>
     <span class="count" id="cnt-${l.id}">&nbsp;</span>
   </div>`).join('');
  LANGS.forEach(l => {
    const input = $('#in-' + l.id), list = $('#sg-' + l.id); let sel = -1, items = [];
    $('#var-' + l.id).addEventListener('change', e => { S.main[l.id] = e.target.value; store.set('flt:settings4', S); $('#flag-' + l.id).innerHTML = flag(S.main[l.id]); if (state.status === 'done') render(); });
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); sel = -1; };
    const paint = () => { [...list.children].forEach((li, i) => { li.setAttribute('aria-selected', i === sel ? 'true' : 'false'); if (i === sel) li.scrollIntoView({ block: 'nearest' }); }); };
    const open = () => {
      items = suggest(l.id, input.value, +S.sugg);
      if (!items.length || (items.length === 1 && fold(items[0].w) === fold(input.value))) { close(); return; }
      list.innerHTML = items.map((it, i) => `<li role="option" data-i="${i}">${esc(it.w)}${it.tag ? `<small>${it.tag}</small>` : ''}</li>`).join('');
      list.hidden = false; input.setAttribute('aria-expanded', 'true'); sel = -1;
    };
    const pick = w => { input.value = w; close(); translate(l.id, w); };
    input.addEventListener('input', () => {
      open();
      const v = input.value;
      if (D.ready && v.trim()) ensureWord(l.id, stripKey(l.id, fold(v))).then(() => { if (document.activeElement === input && input.value === v) open(); }).catch(() => {});
    });
    input.addEventListener('focus', open);
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', e => {
      if (list.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % items.length; paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; paint(); }
      else if (e.key === 'Escape') { close(); }
      else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); pick(items[sel].w); }
    });
    list.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(items[+li.dataset.i].w); } });
    input.closest('form').addEventListener('submit', e => { e.preventDefault(); close(); const w = input.value.trim(); if (w) translate(l.id, w); });
  });
}

/* ---------- library panel: every entry that ships with the app ---------- */
function libPaint() {
  const total = D.byId.size;
  $('#lib-toggle').textContent = D.ready ? `Library (${num(total)})` : 'Library';
  if (!D.ready) { $('#lib-status').textContent = 'Loading…'; return; }
  $('#lib-status').textContent = `The app holds ${num(LANGS.reduce((a, l) => a + D.entries[l.id], 0))} entries: ` + LANGS.map(l => `${l.name} ${num(D.entries[l.id])}`).join(', ') + `. The ${num(total)} listed here are on this device and work without an internet connection; the others load by first letter when you look them up.`;
  const q = fold($('#lib-filter').value || '');
  let items;
  if (!q) items = D.top.de.concat(D.idx.de.filter(x => !x.a && x.r < 1e9).sort((a, b) => a.r - b.r).slice(60, 400)).map(x => D.byId.get(x.id));
  else {
    items = [];
    for (const l of ['de', 'en', 'fr', 'pt']) { const rows = D.idx[l]; for (let i = lower(rows, q); i < rows.length && rows[i].k.startsWith(q) && items.length < 400; i++) items.push(D.byId.get(rows[i].id)); }
  }
  const seen = new Set(); items = items.filter(e => !seen.has(e.id) && seen.add(e.id));
  $('#lib-list').innerHTML = items.slice(0, 400).map(e => `<button class="chip" data-id="${esc(e.id)}" lang="${e.lang}">${esc(e.lemma)}<small>${esc(e.lang.toUpperCase())}${e.level ? ' ' + esc(e.level) : ''}</small></button>`).join('')
    + (items.length >= 400 ? '<span class="hint">Showing the first 400. Use the filter to find a word.</span>' : '') + (!items.length ? '<span class="hint">No entry starts with these letters.</span>' : '');
}
function sourcesPaint() {
  const m = D.manifest; if (!m) return;
  $('#src-version').textContent = `Data version ${m.version}, built ${m.built}.`;
}
function initPanels() {
  const pair = (btn, panel) => { $(btn).addEventListener('click', () => { const p = $(panel); p.hidden = !p.hidden; $(btn).setAttribute('aria-expanded', String(!p.hidden)); if (!p.hidden && panel === '#library') libPaint(); }); };
  pair('#lib-toggle', '#library'); pair('#set-toggle', '#settings'); pair('#src-toggle', '#sources');
  $('#lib-filter').addEventListener('input', libPaint);
  $('#lib-list').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) { const x = D.byId.get(b.dataset.id); state.others = findLoaded(x.lang, x.lemma); openEntry(x); $('#slots').scrollIntoView({ block: 'start' }); } });
  const save = () => store.set('flt:settings4', S);
  [['variants', 's-variants'], ['gsw', 's-gsw'], ['slow', 's-slow'], ['links', 's-links']].forEach(([k, id]) => {
    const el = $('#' + id); el.checked = !!S[k];
    el.addEventListener('change', () => { S[k] = el.checked; save(); if (state.status === 'done') render(false); });
  });
  [['examples', 's-examples'], ['level', 's-level'], ['sugg', 's-sugg']].forEach(([k, id]) => {
    const el = $('#' + id); el.value = String(S[k]);
    el.addEventListener('change', () => { S[k] = k === 'level' ? el.value : +el.value; save(); if (state.status === 'done') render(false); });
  });
  $('#s-clear').addEventListener('click', async () => {
    recent = { en: [], de: [], fr: [], pt: [] }; store.set('flt:recent3', recent);
    let msg = 'Cleared the recent words.';
    try { const db = await idbOpen(); await idbClear(db); msg = 'Cleared the recent words and the saved copy of the data. The data is loaded again the next time you open the app with an internet connection.'; } catch (e) {}
    $('#s-clear-msg').textContent = msg;
  });
}
$('#status').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  if (b.dataset.go) { const i = b.dataset.go.indexOf(':'); translate(b.dataset.go.slice(0, i), b.dataset.go.slice(i + 1)); }
  else if (b.dataset.sense) { state.sense = +b.dataset.sense; state.pick = {}; render(); }
  else if (b.dataset.id) openEntry(D.byId.get(b.dataset.id));
});
$('#cards').addEventListener('click', e => {
  const s = e.target.closest('[data-say]'); if (s) { speak(s.dataset.say, s.dataset.lang); return; }
  const p = e.target.closest('[data-pick]'); if (p) { const [l, i] = p.dataset.pick.split(':'); state.pick[l] = +i; render(); return; }
  const b = e.target.closest('[data-extra]');
  if (b) { const k = b.dataset.extra, l = b.dataset.lang, cur = state[k][l] || (state[k][l] = { open: false }); cur.open = !cur.open; render(false); }
});

/* ---------- boot ---------- */
function offlineNote(text) { const el = $('#offline-state'); if (el) el.textContent = text; }
async function start() {
  buildSlots(); initPanels(); render(); libPaint();
  try {
    const { manifest, out } = await loadData(msg => { state.msg = msg; if (state.status === 'loading') render(); });
    D.manifest = manifest; buildIndex(out);
    LANGS.forEach(l => { $('#cnt-' + l.id).textContent = num(D.count[l.id]) + ' words'; });
    $('#lex-total').textContent = `${num(LANGS.reduce((a, l) => a + D.count[l.id], 0))} words and forms, ${num(LANGS.reduce((a, l) => a + D.entries[l.id], 0))} entries: ` + LANGS.map(l => `${l.name} ${num(D.entries[l.id])}`).join(', ') + '.';
    loadDetails().then(() => { if (state.status === 'done') render(false); }).catch(() => {});
    libPaint(); sourcesPaint();
    const first = findLoaded('de', 'stehen')[0] || D.byId.get(D.top.de[0].id);
    state.others = findLoaded(first.lang, first.lemma); await openEntry(first);
  } catch (err) {
    state = Object.assign(state, { status: 'error', error: String(err && err.message || err), near: [] }); render();
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => offlineNote('Saved on this device: the app also works without an internet connection.'))
      .catch(() => offlineNote('Offline use is not available in this browser.'));
  } else offlineNote('Offline use needs the app to be opened from its web address.');
}
window.FLT = { D, S, find, translate, openEntry, tables, canForms, visibleSenses, quad, regionView, get state() { return state; }, ready: null };
window.FLT.ready = start();
})();
