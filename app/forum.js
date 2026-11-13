/* Glossarium: The Reading Room. Talk under every word (linked across the ten languages), community notes on the cards,
   and a forum with sections, search, [[word]] links, following, a notification bell, reports and the owner's admin view.
   Reading is public and goes straight to the database's web address (no Google code is loaded for reading);
   writing needs an account and uses the Firebase code that sync.js loads. The database rules (docs/firestore.rules)
   check every write on the server: author, native-speaker mark, one vote per person, 15 seconds between posts, blocks. */
(function () {
'use strict';
const PROJECT = 'glossarium-25071', KEY = 'AIzaSyBvq97UZM9NJotUsusdBGbmuovTjBAlwFI', ADMIN = 'heitorpaisch@gmail.com';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const A = () => window.FLT;
const SY = () => window.FLTSync && window.FLTSync.api;
const t = (k, en, v) => (A() && A().t ? A().t(k, en, v) : (v ? en.replace(/\{(\w+)\}/g, (m, x) => v[x] != null ? v[x] : m) : en));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = s => document.querySelector(s);
const LANGS = ['en', 'de', 'fr', 'pt', 'cs', 'it', 'es', 'nl', 'sv', 'la'];
const lname = l => (A() && A().LNAME && A().LNAME[l]) || l;
const TYPES = {
  question: ['?', 'forum.ty.question', 'Question'], tip: ['✎', 'forum.ty.tip', 'Usage tip'], regional: ['⚑', 'forum.ty.regional', 'Regional note'],
  trick: ['✦', 'forum.ty.trick', 'Memory trick'], example: ['❝', 'forum.ty.example', 'Example sentence'], mistake: ['⚠', 'forum.ty.mistake', 'Mistake in this entry'], post: ['¶', 'forum.ty.post', 'Post']
};
const typeName = k => t(TYPES[k][1], TYPES[k][2]);
const NOTE_TYPES = ['tip', 'regional', 'trick', 'example'];         // shown on the card as community notes when voted up
const SECTIONS = [['general', '☕', 'Introductions & chat'], ['grammar', '§', 'Grammar'], ['swiss', '🇨🇭', 'Swiss German & dialects'], ['tips', '✎', 'Tips & resources'], ['feedback', '✉', 'Glossarium: ideas & problems']];
const secName = s => { const g = SECTIONS.find(x => x[0] === s); if (g) return t('forum.sec.' + g[0], g[2]); if (s && s.startsWith('l-')) return lname(s.slice(2)); return s; };
const secIcon = s => { const g = SECTIONS.find(x => x[0] === s); return g ? g[1] : '❧'; };

/* ---------- reading: straight from the database's web address ---------- */
function decode(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return +v.integerValue;
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = decode(x); return o; }
  return null;
}
const docOf = d => { const o = { id: d.name.split('/').pop() }; for (const [k, v] of Object.entries(d.fields || {})) o[k] = decode(v); return o; };
const enc = v => typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : { stringValue: String(v) };
async function runQuery(parent, collection, filters, lim) {
  const f = filters.map(([field, op, value]) => ({ fieldFilter: { field: { fieldPath: field }, op, value: Array.isArray(value) ? { arrayValue: { values: value.map(enc) } } : enc(value) } }));
  const body = { structuredQuery: { from: [{ collectionId: collection }], where: f.length === 1 ? f[0] : { compositeFilter: { op: 'AND', filters: f } }, limit: lim || 200 } };
  const r = await fetch(`${BASE}${parent ? '/' + parent : ''}:runQuery?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('query ' + r.status);
  return (await r.json()).filter(x => x.document).map(x => docOf(x.document));
}
async function getOne(path) {
  const r = await fetch(`${BASE}/${path}?key=${KEY}`);
  if (r.status === 404) return null; if (!r.ok) throw new Error('get ' + r.status);
  return docOf(await r.json());
}

/* ---------- small helpers ---------- */
// insults and slurs only: a dictionary must still let people ask what an ordinary swear word means
const BAD = /\b(nigg\w*|faggot\w*|retard(ed)?|cunt\w*|motherfuck\w*|fotze\w*|schwuchtel\w*|hurensohn\w*|wichser\w*|enculé\w*|fils de pute|filho da puta|hijo de puta|viado|buceta\w*|vaffanculo|figlio di puttana|zmrd\w*|klootzak\w*|kankerlijer\w*|horunge)\b/i;
const tooRude = s => BAD.test(String(s).normalize('NFC'));
function ago(ms) {
  if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return t('forum.now', 'just now'); if (m < 60) return t('forum.min', '{n} min ago', { n: m });
  const h = Math.round(m / 60); if (h < 24) return t('forum.h', '{n} h ago', { n: h });
  return new Date(ms).toLocaleDateString(A() && A().S ? A().S.ui : undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
/* text with line breaks and [[word]] or [[de:Wort]] links */
function rich(s) {
  return esc(s).replace(/\[\[(?:([a-z]{2}):)?([^\]\n]{1,40})\]\]/g, (m, l, w) => `<button class="wlink" data-fw="${esc(w)}" data-fl="${l || ''}">${esc(w)}</button>`).replace(/\n/g, '<br>');
}
const me = () => SY() && SY().user;
const isAdmin = () => { const u = me(); return !!(u && u.email === ADMIN && u.emailVerified); };
const profiles = new Map();          // uid -> public profile (for pictures)
async function loadProfiles(uids) {
  const need = [...new Set(uids)].filter(u => u && !profiles.has(u));
  await Promise.all(need.map(async u => { try { profiles.set(u, await getOne('profiles/' + u) || {}); } catch (e) { profiles.set(u, {}); } }));
}
function author(x) {
  const p = profiles.get(x.uid) || {}, S = SY();
  const pic = S ? S.avatarImg(p.avatar || '', 'pfp sm') : '';
  return `<button class="au" data-fx="profile" data-name="${esc(x.username)}">${pic}<b>@${esc(x.username)}</b>${S ? S.specialHtml(x.uid) + S.badgeHtml(p) : ''}</button>${x.native ? `<span class="native" title="${esc(t('forum.native.tip', 'Native speaker of {lang}', { lang: lname(x.lang) }))}">${esc(t('forum.native', 'Native speaker'))}</span>` : ''}<span class="when">${esc(ago(x.t))}</span>`;
}

/* ---------- state ---------- */
const F = { view: 'home', section: null, threads: [], thread: null, replies: [], word: null, wordIds: [], wordThreads: [], q: '', loading: false, err: '', myVotes: {}, follows: null, compose: null, reportFor: null, admin: null };
const linked = new Map();           // entry id -> threads about it or its translations (from the last cards)

function panel() { return $('#forum'); }
function openPanel(scroll) {
  const p = panel(); if (!p) return;
  if (p.hidden && window.FLTViews && FLTViews.toggle) FLTViews.toggle('forum', true); else if (p.hidden) { const b = $('#forum-toggle'); if (b) b.click(); }
  paint();
  if (scroll !== false) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- talk under a word ---------- */
function relatedIds(e) {          // the word and the words it is translated with (all senses), at most 30 (the database's limit for one question)
  const ids = [e.id];
  for (const s of e.senses || []) for (const arr of Object.values(s.translations || {})) for (const id of arr) if (!ids.includes(id)) ids.push(id);
  return ids.slice(0, 30);
}
async function openWord(e) {
  F.view = 'word'; F.word = { id: e.id, lemma: e.lemma, lang: e.lang, shown: A().withTo(e.id, e.lemma) }; F.wordIds = relatedIds(e); F.wordThreads = []; F.err = ''; F.loading = true; F.compose = null;
  openPanel();
  try {
    F.wordThreads = await runQuery(null, 'threads', [['word', 'IN', F.wordIds], ['hidden', 'EQUAL', false]], 200);
    await loadProfiles(F.wordThreads.map(x => x.uid));
  } catch (e2) { F.err = t('forum.err', 'The Reading Room could not be reached. Check the internet connection.'); }
  F.loading = false; paint();
}
/* after the cards are drawn: how many conversations each card has, and community notes */
let cardsSeq = 0;
async function cards(q) {
  const my = ++cardsSeq, entries = Object.values(q || {}).filter(Boolean);
  if (!entries.length || !/^https?:$/.test(location.protocol) || (A().S && A().S.forum === false)) return;
  const own = entries.map(e => e.id);
  let all = []; for (const e of entries) for (const id of relatedIds(e)) if (!all.includes(id)) all.push(id);
  all = all.slice(0, 90);
  try {
    const chunks = []; for (let i = 0; i < all.length; i += 30) chunks.push(all.slice(i, i + 30));
    const res = [...new Map((await Promise.all(chunks.map(c => runQuery(null, 'threads', [['word', 'IN', c], ['hidden', 'EQUAL', false]], 100)))).flat().map(x => [x.id, x])).values()];
    if (my !== cardsSeq) return;
    for (const e of entries) {
      const rel = new Set(relatedIds(e)), mine = res.filter(x => rel.has(x.word));
      linked.set(e.id, mine);
      const n = document.querySelector(`[data-tn="${CSS.escape(e.id)}"]`); if (n) n.textContent = mine.length ? ' ' + mine.length : '';
      const notes = mine.filter(x => x.word === e.id && NOTE_TYPES.includes(x.type) && x.score >= 1).sort((a, b) => b.score - a.score).slice(0, 2);
      const box = document.querySelector(`[data-cn="${CSS.escape(e.id)}"]`);
      if (box) box.innerHTML = notes.length ? `<div class="cn-h">${esc(t('forum.notes', 'Community notes'))}</div>` + notes.map(x => `<div class="cn"><span class="ty">${TYPES[x.type][0]}</span> ${rich(x.body.length > 220 ? x.body.slice(0, 220) + '…' : x.body)}${x.region ? ` <span class="rg">${esc(x.region)}</span>` : ''} <button class="lnk small" data-fx="thread" data-id="${esc(x.id)}">@${esc(x.username)} · ▲${x.score}</button></div>`).join('') : '';
    }
    void own;
  } catch (e) {}
}

/* ---------- forum home and sections ---------- */
async function openSection(sec) {
  F.view = 'section'; F.section = sec; F.threads = []; F.loading = true; F.err = ''; F.compose = null; paint();
  try { F.threads = (await runQuery(null, 'threads', [['section', 'EQUAL', sec], ['hidden', 'EQUAL', false]], 300)).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0)); await loadProfiles(F.threads.map(x => x.uid)); }
  catch (e) { F.err = t('forum.err', 'The Reading Room could not be reached. Check the internet connection.'); }
  F.loading = false; paint();
}
let recent = null;
async function loadRecent() {
  try { recent = (await runQuery(null, 'threads', [['kind', 'EQUAL', 'forum'], ['hidden', 'EQUAL', false]], 300)).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0)); await loadProfiles(recent.slice(0, 15).map(x => x.uid)); }
  catch (e) { recent = []; F.err = t('forum.err', 'The Reading Room could not be reached. Check the internet connection.'); }
  if (F.view === 'home') paint();
}
async function openThread(id) {
  F.view = 'thread'; F.loading = true; F.err = ''; F.compose = null; F.reportFor = null; openPanel();
  try {
    F.thread = await getOne('threads/' + id);
    if (!F.thread || F.thread.hidden) { F.thread = null; F.err = t('forum.gone', 'This conversation is no longer here.'); }
    else {
      F.replies = (await runQuery('threads/' + id, 'replies', [['hidden', 'EQUAL', false]], 500)).sort((a, b) => (a.t || 0) - (b.t || 0));
      await loadProfiles([F.thread.uid, ...F.replies.map(x => x.uid)]);
      await loadMyVotes(id);
      seen(id, F.thread.lastAt);
    }
  } catch (e) { F.err = t('forum.err', 'The Reading Room could not be reached. Check the internet connection.'); }
  F.loading = false; paint();
}
async function loadMyVotes(tid) {
  F.myVotes = {}; const u = me(); if (!u) return;
  try {
    const S = SY(); await S.load();
    await Promise.all(['thread', ...F.replies.map(r => r.id)].map(async k => { const d = await S.fb.getDoc(S.fb.doc(S.db, 'threads', tid, 'votes', u.uid + '_' + k)); if (d.exists()) F.myVotes[k] = d.data().v; }));
  } catch (e) {}
}

/* ---------- writing ---------- */
async function needAccount() {
  const S = SY(); if (!S) return false;
  if (!S.user || !S.profile) { S.openCreate(); return false; }
  await S.load(); return true;
}
function pace(batch) { const S = SY(); batch.set(S.fb.doc(S.db, 'limits', S.user.uid), { t: S.fb.serverTimestamp() }); }
const nativeOf = lang => { const p = SY() && SY().profile; return !!(p && (p.speaks || []).some(x => x.l === lang && x.lv === 'native')); };
function friendly(e) {
  const c = String(e && (e.code || e.message) || e);
  if (/permission/i.test(c)) return t('forum.slow', 'Not posted. Wait 15 seconds between posts, and check that your profile is complete.');
  return t('forum.fail', 'That did not work. Check the internet connection and try again.');
}
async function postThread(d) {
  if (!(await needAccount())) return false;
  const S = SY(), fb = S.fb, ref = fb.doc(fb.collection(S.db, 'threads'));
  const ts = fb.serverTimestamp();
  const x = { kind: d.kind, section: d.section || '', word: d.word || '', lemma: d.lemma || '', lang: d.lang || 'xx', type: d.type, region: d.region || '', title: d.title || '', body: d.body,
    uid: S.user.uid, username: S.profile.username, native: nativeOf(d.lang || 'xx'), t: ts, lastAt: ts, lastBy: S.user.uid, replies: 0, score: 0, best: '', hidden: false };
  const b = fb.writeBatch(S.db); pace(b); b.set(ref, x); await b.commit();
  await follow(ref.id, true);
  return ref.id;
}
async function postReply(tid, body) {
  if (!(await needAccount())) return false;
  const S = SY(), fb = S.fb, th = F.thread, ts = fb.serverTimestamp();
  const ref = fb.doc(fb.collection(S.db, 'threads', tid, 'replies'));
  const b = fb.writeBatch(S.db); pace(b);
  b.set(ref, { body, uid: S.user.uid, username: S.profile.username, native: nativeOf(th.lang), lang: th.lang, t: ts, score: 0, hidden: false });
  b.update(fb.doc(S.db, 'threads', tid), { replies: fb.increment(1), lastAt: ts, lastBy: S.user.uid });
  await b.commit();
  await follow(tid, true);
  return ref.id;
}
async function vote(target, v) {
  if (!(await needAccount())) return;
  const S = SY(), fb = S.fb, tid = F.thread.id, u = S.user.uid, cur = F.myVotes[target] || 0;
  const vref = fb.doc(S.db, 'threads', tid, 'votes', u + '_' + target), pref = target === 'thread' ? fb.doc(S.db, 'threads', tid) : fb.doc(S.db, 'threads', tid, 'replies', target);
  try {
    if (cur) { const b = fb.writeBatch(S.db); b.delete(vref); b.update(pref, { score: fb.increment(-cur) }); await b.commit(); }
    if (cur !== v) { const b = fb.writeBatch(S.db); b.set(vref, { v }); b.update(pref, { score: fb.increment(v) }); await b.commit(); }
    const obj = target === 'thread' ? F.thread : F.replies.find(r => r.id === target);
    obj.score += (cur !== v ? v : 0) - cur; F.myVotes[target] = cur === v ? 0 : v;
  } catch (e) { toast(friendly(e)); }
  paint();
}
async function setBest(rid) {
  const S = SY(); try { await S.fb.setDoc(S.fb.doc(S.db, 'threads', F.thread.id), { best: F.thread.best === rid ? '' : rid }, { merge: true }); F.thread.best = F.thread.best === rid ? '' : rid; } catch (e) { toast(friendly(e)); }
  paint();
}
async function remove(kind, id) {
  const S = SY(); if (!S || !S.user) return;
  try {
    if (kind === 'thread') { await S.fb.deleteDoc(S.fb.doc(S.db, 'threads', id)); F.thread = null; F.view = F.word ? 'word' : 'home'; if (F.word) { F.wordThreads = F.wordThreads.filter(x => x.id !== id); } }
    else { await S.fb.deleteDoc(S.fb.doc(S.db, 'threads', F.thread.id, 'replies', id)); F.replies = F.replies.filter(r => r.id !== id); }
  } catch (e) { toast(friendly(e)); }
  paint();
}
async function hide(kind, id) {          // the owner only
  const S = SY();
  try {
    const ref = kind === 'thread' ? S.fb.doc(S.db, 'threads', id) : S.fb.doc(S.db, 'threads', F.thread.id, 'replies', id);
    await S.fb.setDoc(ref, { hidden: true }, { merge: true });
    if (kind === 'thread') { F.thread = null; F.view = 'home'; } else F.replies = F.replies.filter(r => r.id !== id);
    toast(t('forum.hidden', 'Hidden.'));
  } catch (e) { toast(friendly(e)); }
  paint();
}
async function report(why) {
  if (!(await needAccount())) return;
  const S = SY(), x = F.reportFor;
  try { await S.fb.addDoc(S.fb.collection(S.db, 'reports'), { about: x.uid, by: S.user.uid, why, t: Date.now(), kind: x.kind, thread: F.thread.id, reply: x.kind === 'reply' ? x.id : '' }); toast(t('comm.reported', 'Thank you. The report was sent.')); }
  catch (e) { toast(friendly(e)); }
  F.reportFor = null; paint();
}
const toast = m => { try { A().toast(m); } catch (e) {} };

/* ---------- following and the bell ---------- */
async function myFollows() {
  if (F.follows) return F.follows;
  const S = SY(); if (!S || !S.user) return {};
  try { await S.load(); const d = await S.fb.getDoc(S.fb.doc(S.db, 'follows', S.user.uid)); F.follows = d.exists() ? (d.data().m || {}) : {}; } catch (e) { F.follows = {}; }
  return F.follows;
}
async function saveFollows() { const S = SY(); try { await S.fb.setDoc(S.fb.doc(S.db, 'follows', S.user.uid), { m: F.follows }); } catch (e) {} }
async function follow(tid, on) {
  const S = SY(); if (!S || !S.user) return;
  const f = await myFollows();
  if (on) f[tid] = Date.now(); else delete f[tid];
  const keys = Object.keys(f); if (keys.length > 60) keys.sort((a, b) => f[a] - f[b]).slice(0, keys.length - 60).forEach(k => delete f[k]);
  await saveFollows(); bell();
}
async function seen(tid, at) { const S = SY(); if (!S || !S.user) return; const f = await myFollows(); if (f[tid] != null) { f[tid] = Math.max(f[tid], at || Date.now()) + 1; saveFollows(); bell(); } }
let news = [];
async function bell() {
  const S = SY(), u = S && S.user;
  if (!u) { news = []; paintBell(); return; }
  const f = await myFollows();
  const ids = Object.keys(f).slice(0, 60);
  const out = [];
  await Promise.all(ids.map(async id => { try { const x = await getOne('threads/' + id); if (x && !x.hidden && x.lastAt > f[id] && x.lastBy !== u.uid) out.push(x); } catch (e) {} }));
  news = out.sort((a, b) => b.lastAt - a.lastAt); paintBell();
}
function paintBell() {
  const b = $('#forum-toggle'); if (b) b.innerHTML = esc(t('nav.forum', 'Reading Room')) + (news.length ? ` <span class="req-dot" title="${esc(t('forum.new.tip', 'New replies'))}">${news.length}</span>` : '');
}

/* ---------- admin view (the owner only) ---------- */
async function openAdmin() {
  F.view = 'admin'; F.admin = { loading: true }; paint();
  try {
    const S = SY(); await S.load();
    const snap = await S.fb.getDocs(S.fb.query(S.fb.collection(S.db, 'reports'), S.fb.limit(100)));
    const reps = []; snap.forEach(d => reps.push(Object.assign({ id: d.id }, d.data())));
    reps.sort((a, b) => b.t - a.t); await loadProfiles(reps.map(r => r.about));
    F.admin = { reports: reps };
  } catch (e) { F.admin = { err: String(e.code || e) }; }
  paint();
}
async function adminDo(k, b) {
  const S = SY(), fb = S.fb;
  try {
    if (k === 'rep-done') { await fb.deleteDoc(fb.doc(S.db, 'reports', b.dataset.id)); F.admin.reports = F.admin.reports.filter(r => r.id !== b.dataset.id); }
    else if (k === 'block') { await fb.setDoc(fb.doc(S.db, 'blocked', b.dataset.uid), { t: Date.now() }); toast(t('forum.blocked', 'This account can no longer post.')); }
    else if (k === 'unblock') { await fb.deleteDoc(fb.doc(S.db, 'blocked', b.dataset.uid)); toast(t('forum.unblocked', 'This account can post again.')); }
  } catch (e) { toast(friendly(e)); }
  paint();
}

/* ---------- drawing ---------- */
function crumbs() {
  const parts = [`<button class="lnk" data-fx="home">${esc(t('nav.forum', 'Reading Room'))}</button>`];
  if (F.view === 'section') parts.push(esc(secName(F.section)));
  if (F.view === 'word' && F.word) parts.push(esc(t('forum.about', 'About “{w}”', { w: F.word.shown })));
  if (F.view === 'thread' && F.thread) parts.push(F.thread.kind === 'word' ? `<button class="lnk" data-fx="word-back">${esc(t('forum.about', 'About “{w}”', { w: F.thread.lemma }))}</button>` : `<button class="lnk" data-fx="section" data-s="${esc(F.thread.section)}">${esc(secName(F.thread.section))}</button>`);
  if (F.view === 'admin') parts.push(esc(t('forum.admin', 'Admin')));
  return `<p class="crumbs">${parts.join(' › ')}</p>`;
}
function threadRow(x) {
  const lang = x.kind === 'word' ? `<span class="f-lg">${esc(lname(x.lang))}</span> ` : '';
  const plain = x.body.replace(/\[\[(?:[a-z]{2}:)?([^\]\n]+)\]\]/g, '$1');
  const title = x.title || (plain.length > 90 ? plain.slice(0, 90) + '…' : plain);
  return `<li class="th"><button class="th-b" data-fx="thread" data-id="${esc(x.id)}"><span class="ty" title="${esc(typeName(x.type))}">${TYPES[x.type][0]}</span><span class="th-t">${lang}${x.kind === 'word' ? `<b>${esc(x.lemma)}</b> · ` : ''}${esc(title)}</span>
    <span class="th-m">@${esc(x.username)}${x.native ? ' · ' + esc(t('forum.native', 'Native speaker')) : ''} · ${esc(ago(x.lastAt))} · ${esc(t('forum.n.replies', '{n} replies', { n: x.replies || 0 }))} · ▲${x.score || 0}${x.best ? ' · ✓' : ''}</span></button></li>`;
}
function composeHtml(kind) {
  const c = F.compose || {};
  const types = kind === 'word' ? ['question', 'tip', 'regional', 'trick', 'example', 'mistake'] : ['post', 'question', 'tip'];
  return `<form class="compose" id="f-compose" data-kind="${kind}">
    <div class="row">${types.map(k => `<label class="ty-opt${(c.type || types[0]) === k ? ' on' : ''}"><input type="radio" name="f-type" value="${k}" ${(c.type || types[0]) === k ? 'checked' : ''}><span class="ty">${TYPES[k][0]}</span> ${esc(typeName(k))}</label>`).join('')}</div>
    ${kind === 'forum' ? `<input class="text" id="f-title" maxlength="120" placeholder="${esc(t('forum.title.ph', 'Title'))}" value="${esc(c.title || '')}">` : ''}
    ${kind === 'word' ? `<input class="text" id="f-region" maxlength="40" placeholder="${esc(t('forum.region.ph', 'Region (only for regional notes), e.g. Zürich, Brazil'))}" value="${esc(c.region || '')}" ${c.type === 'regional' ? '' : 'hidden'}>` : ''}
    <textarea class="text" id="f-body" rows="4" maxlength="2000" placeholder="${esc(kind === 'word' ? t('forum.body.word', 'Ask a question or share what you know about “{w}”. Link words like [[Haus]].', { w: F.word ? F.word.lemma : '' }) : t('forum.body.ph', 'Write your post. Link words like [[Haus]] or [[fr:maison]].'))}">${esc(c.body || '')}</textarea>
    ${c.type === 'mistake' && F.word ? `<p class="hint">${esc(t('forum.mistake.h', 'Mistakes are fixed by the people who check the dictionary every morning.'))} <a href="${esc(issueUrl(F.word))}" target="_blank" rel="noopener">${esc(t('forum.mistake.send', 'Also send it to them'))}</a></p>` : ''}
    <div class="row"><button class="btn primary" type="submit">${esc(t('forum.publish', 'Publish'))}</button><button class="btn" type="button" data-fx="compose-x">${esc(t('btn.cancel', 'Cancel'))}</button><span class="hint" id="f-msg" aria-live="polite"></span></div>
    <p class="hint">${esc(t('forum.rules', 'Be kind and stay on topic. Posts with insults are refused; reported posts can be removed.'))}</p></form>`;
}
const issueUrl = w => 'https://github.com/heitorpais/four-language-translator/issues/new?title=' + encodeURIComponent('Mistake in ' + w.id) + '&body=' + encodeURIComponent('Entry: ' + w.id + '\n\nWhat is wrong:\n');
function postHtml(x, kind) {
  const u = me(), mine = u && x.uid === u.uid, v = F.myVotes[kind === 'thread' ? 'thread' : x.id] || 0, th = F.thread;
  const best = kind === 'reply' && th.best === x.id;
  const tools = [];
  if (kind === 'reply' && u && th.uid === u.uid) tools.push(`<button class="lnk small" data-fx="best" data-id="${esc(x.id)}">${best ? esc(t('forum.best.undo', 'Not the best answer')) : esc(t('forum.best.mark', '✓ Best answer'))}</button>`);
  if (u && !mine) tools.push(`<button class="lnk small" data-fx="report" data-kind="${kind}" data-id="${esc(x.id)}" data-uid="${esc(x.uid)}">${esc(t('forum.report', 'Report'))}</button>`);
  if (mine) tools.push(`<button class="lnk small" data-fx="del" data-kind="${kind}" data-id="${esc(x.id)}">${esc(t('forum.delete', 'Delete'))}</button>`);
  if (isAdmin() && !mine) tools.push(`<button class="lnk small adm" data-fx="hide" data-kind="${kind}" data-id="${esc(x.id)}">${esc(t('forum.hide', 'Hide (admin)'))}</button><button class="lnk small adm" data-fx="block" data-uid="${esc(x.uid)}">${esc(t('forum.block', 'Block (admin)'))}</button>`);
  const rep = F.reportFor && F.reportFor.id === x.id ? `<div class="report"><p>${esc(t('forum.r.why', 'What is wrong with this post?'))}</p><div class="row">${[['rude', t('forum.r.rude', 'Rude or offensive')], ['spam', t('forum.r.spam', 'Spam or advertising')], ['wrong', t('forum.r.wrong', 'Wrong or misleading')], ['other', t('comm.r.other', 'Something else')]].map(([k, l]) => `<button class="chip" data-fx="report-send" data-why="${k}">${esc(l)}</button>`).join('')}<button class="lnk small" data-fx="report-x">${esc(t('btn.cancel', 'Cancel'))}</button></div></div>` : '';
  return `<article class="post${best ? ' best' : ''}${kind === 'thread' ? ' op' : ''}"><div class="votes"><button class="vb${v > 0 ? ' on' : ''}" data-fx="vote" data-target="${kind === 'thread' ? 'thread' : esc(x.id)}" data-v="1" aria-label="${esc(t('forum.up', 'Helpful'))}" ${mine ? 'disabled' : ''}>▲</button><span class="sc">${x.score || 0}</span><button class="vb${v < 0 ? ' on' : ''}" data-fx="vote" data-target="${kind === 'thread' ? 'thread' : esc(x.id)}" data-v="-1" aria-label="${esc(t('forum.down', 'Not helpful'))}" ${mine ? 'disabled' : ''}>▼</button></div>
    <div class="post-b"><div class="post-h">${author(x)}${best ? `<span class="best-l">✓ ${esc(t('forum.best', 'Best answer'))}</span>` : ''}</div>
    ${kind === 'thread' && x.title ? `<h3>${esc(x.title)}</h3>` : ''}
    ${kind === 'thread' ? `<p class="ty-l"><span class="ty">${TYPES[x.type][0]}</span> ${esc(typeName(x.type))}${x.region ? ` · <span class="rg">${esc(x.region)}</span>` : ''}${x.kind === 'word' ? ` · ${esc(lname(x.lang))}: <button class="wlink" data-fw="${esc(x.lemma)}" data-fl="${esc(x.lang)}">${esc(x.lemma)}</button>` : ''}</p>` : ''}
    <div class="body">${rich(x.body)}</div><div class="tools">${tools.join(' · ')}</div>${rep}</div></article>`;
}
function body() {
  if (F.loading) return `<p class="hint">${esc(t('prof.loading', 'Loading…'))}</p>`;
  const err = F.err ? `<p class="hint err">${esc(F.err)}</p>` : '';
  const search = `<div class="field f-search"><input id="f-q" type="search" placeholder="${esc(t('forum.search', 'Search the Reading Room…'))}" value="${esc(F.q)}" aria-label="${esc(t('forum.search', 'Search the Reading Room…'))}"></div>`;
  if (F.view === 'home') {
    if (!recent) { loadRecent(); }
    const hits = F.q ? (recent || []).filter(x => (x.title + ' ' + x.body + ' ' + x.username).toLowerCase().includes(F.q)) : null;
    const secs = [...SECTIONS.map(s => s[0]), ...LANGS.map(l => 'l-' + l)];
    return `${search}${err}${hits ? `<h3>${esc(t('forum.results', 'Results'))}</h3>${hits.length ? `<ul class="threads">${hits.map(threadRow).join('')}</ul>` : `<p class="hint">${esc(t('comm.nofound', 'Nobody found for “{q}”.', { q: F.q }).replace(/^Nobody/, t('forum.nothing', 'Nothing')))}</p>`}` : ''}
      <div class="secs">${secs.map(s => `<button class="sec" data-fx="section" data-s="${s}"><span class="si">${s.startsWith('l-') ? (A() ? A().flag(A().S.main[s.slice(2)] || s.slice(2), true) : '') : secIcon(s)}</span>${esc(secName(s))}</button>`).join('')}</div>
      <h3>${esc(t('forum.latest', 'Latest conversations'))}</h3>${recent ? (recent.length ? `<ul class="threads">${recent.slice(0, 15).map(threadRow).join('')}</ul>` : `<p class="hint">${esc(t('forum.empty', 'Nothing here yet. Start the first conversation!'))}</p>`) : `<p class="hint">${esc(t('prof.loading', 'Loading…'))}</p>`}
      ${news.length ? `<h3>${esc(t('forum.new', 'New replies for you'))}</h3><ul class="threads">${news.map(threadRow).join('')}</ul>` : ''}
      <p class="hint">${esc(t('forum.tip', 'Every word card also has its own conversation: tap “💬 Discuss” on a card.'))}</p>
      ${isAdmin() ? `<button class="btn sm" data-fx="admin">${esc(t('forum.admin', 'Admin'))}</button>` : ''}`;
  }
  if (F.view === 'section') {
    const list = F.q ? F.threads.filter(x => (x.title + ' ' + x.body + ' ' + x.username).toLowerCase().includes(F.q)) : F.threads;
    return `${search}${err}<h3>${esc(secName(F.section))}</h3>${F.compose ? composeHtml('forum') : `<button class="btn primary" data-fx="compose">${esc(t('forum.new.thread', '+ New conversation'))}</button>`}
      ${list.length ? `<ul class="threads">${list.map(threadRow).join('')}</ul>` : `<p class="hint">${esc(t('forum.empty', 'Nothing here yet. Start the first conversation!'))}</p>`}`;
  }
  if (F.view === 'word' && F.word) {
    const here = F.wordThreads.filter(x => x.word === F.word.id).sort((a, b) => (b.score - a.score) || (b.lastAt - a.lastAt));
    const other = F.wordThreads.filter(x => x.word !== F.word.id).sort((a, b) => b.lastAt - a.lastAt);
    return `${err}<h3>${esc(t('forum.about', 'About “{w}”', { w: F.word.shown }))} <small class="hint">${esc(lname(F.word.lang))}</small></h3>
      ${F.compose ? composeHtml('word') : `<button class="btn primary" data-fx="compose">${esc(t('forum.ask', '+ Ask or share something'))}</button>`}
      ${here.length ? `<ul class="threads">${here.map(threadRow).join('')}</ul>` : `<p class="hint">${esc(t('forum.word.empty', 'No conversation about this word yet. Be the first!'))}</p>`}
      ${other.length ? `<h3>${esc(t('forum.other.l', 'In the other languages'))}</h3><p class="hint">${esc(t('forum.other.h', 'Conversations about the same word in other languages.'))}</p><ul class="threads">${other.map(threadRow).join('')}</ul>` : ''}`;
  }
  if (F.view === 'thread' && F.thread) {
    const th = F.thread, u = me(), fol = F.follows && F.follows[th.id] != null;
    const reps = F.replies.slice().sort((a, b) => (a.id === th.best ? -1 : b.id === th.best ? 1 : 0) || (a.t - b.t));
    return `${err}${postHtml(th, 'thread')}
      <div class="row thread-tools">${u ? `<button class="btn sm" data-fx="follow">${fol ? esc(t('forum.unfollow', '✓ Following')) : esc(t('forum.follow', '🔔 Follow'))}</button>` : ''}<span class="hint">${esc(t('forum.n.replies', '{n} replies', { n: F.replies.length }))}</span></div>
      ${reps.map(r => postHtml(r, 'reply')).join('')}
      <form class="compose" id="f-reply"><textarea class="text" id="f-rbody" rows="3" maxlength="2000" placeholder="${esc(t('forum.reply.ph', 'Write a reply… Link words like [[Haus]].'))}"></textarea><div class="row"><button class="btn primary" type="submit">${esc(t('forum.reply', 'Reply'))}</button><span class="hint" id="f-rmsg" aria-live="polite"></span></div></form>`;
  }
  if (F.view === 'admin') {
    const a = F.admin || {};
    if (a.loading) return `<p class="hint">${esc(t('prof.loading', 'Loading…'))}</p>`;
    if (a.err) return `<p class="hint err">${esc(a.err)}</p>`;
    return `<h3>${esc(t('forum.reports', 'Reports'))} (${a.reports.length})</h3>${a.reports.length ? `<ul class="threads">${a.reports.map(r => { const p = profiles.get(r.about) || {}; return `<li class="th"><div class="th-b"><span class="th-t"><b>${esc(r.why)}</b> · @${esc(p.username || r.about)} · ${esc(r.kind || 'profile')} · ${esc(ago(r.t))}</span><span class="th-m">${r.thread ? `<button class="lnk small" data-fx="thread" data-id="${esc(r.thread)}">${esc(t('forum.open', 'Open'))}</button> · ` : p.username ? `<button class="lnk small" data-fx="profile" data-name="${esc(p.username)}">${esc(t('forum.open', 'Open'))}</button> · ` : ''}<button class="lnk small" data-fx="block" data-uid="${esc(r.about)}">${esc(t('forum.block', 'Block (admin)'))}</button> · <button class="lnk small" data-fx="unblock" data-uid="${esc(r.about)}">${esc(t('forum.unblock', 'Unblock'))}</button> · <button class="lnk small" data-fx="rep-done" data-id="${esc(r.id)}">${esc(t('forum.done', 'Done, remove report'))}</button></span></div></li>`; }).join('')}</ul>` : `<p class="hint">${esc(t('forum.noreports', 'No reports.'))}</p>`}`;
  }
  return err;
}
function paint() {
  const p = panel(); if (!p || p.hidden) return;
  p.innerHTML = `<h2>${esc(t('nav.forum', 'Reading Room'))}</h2>${crumbs()}${body()}`;
}

/* ---------- events ---------- */
document.addEventListener('click', async ev => {
  const w = ev.target.closest('.wlink');
  if (w) { ev.preventDefault(); goWord(w.dataset.fw, w.dataset.fl || (F.thread && F.thread.lang) || (F.word && F.word.lang)); return; }
  const b = ev.target.closest('[data-fx]'); if (!b) return;
  const k = b.dataset.fx;
  if (b.closest('form') && b.type !== 'submit') ev.preventDefault();
  if (k === 'home') { F.view = 'home'; F.q = ''; F.compose = null; paint(); }
  else if (k === 'section') openSection(b.dataset.s);
  else if (k === 'thread') openThread(b.dataset.id);
  else if (k === 'word-back') { if (F.thread && F.thread.kind === 'word' && F.word) { F.view = 'word'; paint(); } else if (F.thread) goWord(F.thread.lemma, F.thread.lang); }
  else if (k === 'profile') { location.hash = '#/@' + b.dataset.name; }
  else if (k === 'compose') { if (!(await needAccount())) return; F.compose = { type: F.view === 'word' ? 'question' : 'post' }; paint(); const x = $('#f-title') || $('#f-body'); if (x) x.focus(); }
  else if (k === 'compose-x') { F.compose = null; paint(); }
  else if (k === 'vote') vote(b.dataset.target, +b.dataset.v);
  else if (k === 'best') setBest(b.dataset.id);
  else if (k === 'del') remove(b.dataset.kind, b.dataset.id);
  else if (k === 'hide') hide(b.dataset.kind, b.dataset.id);
  else if (k === 'report') { F.reportFor = { kind: b.dataset.kind, id: b.dataset.id, uid: b.dataset.uid }; paint(); }
  else if (k === 'report-x') { F.reportFor = null; paint(); }
  else if (k === 'report-send') report(b.dataset.why);
  else if (k === 'follow') { const on = !(F.follows && F.follows[F.thread.id] != null); await follow(F.thread.id, on); paint(); }
  else if (k === 'admin') openAdmin();
  else if (k === 'block' || k === 'unblock' || k === 'rep-done') adminDo(k, b);
});
document.addEventListener('change', ev => {
  if (ev.target.name === 'f-type') { readCompose(); F.compose.type = ev.target.value; paint(); }
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'f-q') { F.q = ev.target.value.trim().toLowerCase(); const pos = ev.target.selectionStart; paint(); const q = $('#f-q'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (e) {} } }
});
function readCompose() { if (!F.compose) F.compose = {}; const ti = $('#f-title'), bo = $('#f-body'), rg = $('#f-region'); if (ti) F.compose.title = ti.value; if (bo) F.compose.body = bo.value; if (rg) F.compose.region = rg.value; }
document.addEventListener('submit', async ev => {
  if (ev.target.id === 'f-compose') {
    ev.preventDefault(); readCompose();
    const c = F.compose, kind = ev.target.dataset.kind, msg = $('#f-msg'), say = m => { if (msg) msg.textContent = m; };
    const bodyTxt = (c.body || '').trim(), title = (c.title || '').trim();
    if (bodyTxt.length < 2) return say(t('forum.short', 'Write a little more.'));
    if (kind === 'forum' && title.length < 3) return say(t('forum.need.title', 'Give your conversation a title.'));
    if (tooRude(bodyTxt + ' ' + title + ' ' + (c.region || ''))) return say(t('forum.rude', 'Please write without insults or swear words.'));
    say(t('acct.syncing', 'Saving…'));
    try {
      const id = await postThread(kind === 'word' ? { kind, word: F.word.id, lemma: F.word.lemma, lang: F.word.lang, type: c.type || 'question', region: c.type === 'regional' ? (c.region || '').trim() : '', body: bodyTxt }
        : { kind, section: F.section, lang: F.section.startsWith('l-') ? F.section.slice(2) : 'xx', type: c.type || 'post', title, body: bodyTxt });
      if (!id) return;
      F.compose = null; recent = null;
      openThread(id);
    } catch (e) { say(friendly(e)); }
  }
  if (ev.target.id === 'f-reply') {
    ev.preventDefault();
    const ta = $('#f-rbody'), msg = $('#f-rmsg'), txt = (ta.value || '').trim(), say = m => { if (msg) msg.textContent = m; };
    if (txt.length < 2) return say(t('forum.short', 'Write a little more.'));
    if (tooRude(txt)) return say(t('forum.rude', 'Please write without insults or swear words.'));
    say(t('acct.syncing', 'Saving…'));
    try { const id = await postReply(F.thread.id, txt); if (!id) return; openThread(F.thread.id); } catch (e) { say(friendly(e)); }
  }
});
async function goWord(word, lang) {
  const F2 = A(); if (!F2) return;
  lang = LANGS.includes(lang) ? lang : F2.S.order[0];
  try { if (!F2.S.order.includes(lang)) await F2.setLanguages([...F2.S.order.slice(0, F2.MAX_SLOTS - 1), lang]); await F2.translate(lang, word); } catch (e) {}
  const c = $('#cards'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.FLTForum = { openWord, cards, paint, bell, openThread };
function start() {
  const S = window.FLTSync && window.FLTSync.api;
  if (S) S.onAuth.push(() => { F.follows = null; bell(); paint(); });
  paintBell();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
