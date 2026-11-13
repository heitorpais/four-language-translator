/* Glossarium accounts: sign in with Google, a public profile (username, picture, nationality, languages), the
   founding-member badge for the first 1,000 accounts, and "My words" kept the same on every device.
   Optional: without an account nothing here talks to the internet. Google's sign-in script and the Firebase code
   (vendor/firebase.js) are loaded only when someone opens the account box or has an account on this device.
   Storage: Cloud Firestore in Zürich (europe-west6):
     users/<id>       private: the copy of "My words" (only its owner can read or write it)
     profiles/<id>    public: username, picture, nationality, languages, short text, member number
     usernames/<name> public: which account a username belongs to (keeps usernames unique)
     meta/members     public: how many accounts exist (gives every new account the next member number)
   The database rules (docs/firestore.rules) enforce all of this on the server. */
(function () {
'use strict';
const CONFIG = {
  apiKey: 'AIzaSyBvq97UZM9NJotUsusdBGbmuovTjBAlwFI',          // public by design: it names the project, it is not a password
  authDomain: 'glossarium-25071.firebaseapp.com',
  projectId: 'glossarium-25071',
  storageBucket: 'glossarium-25071.firebasestorage.app',
  messagingSenderId: '316855053502',
  appId: '1:316855053502:web:5fa180177c97349abec2ef'
};
const CLIENT_ID = '316855053502-q0r0qoj6o65dkc3nj6s2fm0qsjmhqk3d.apps.googleusercontent.com';
const FOUNDERS = 1000;
const FLAG = 'flt:acct', DIRTY = 'flt:acct-dirty', CACHE = 'flt:acct-profile';
let fb = null, auth = null, db = null, user = null, profile = null, state = 'off', lastSync = 0, pushTimer = 0, msg = '', silent = false;
let gis = null, tokenClient = null, editing = false, viewing = null;
const A = () => window.FLT;
const AV = () => window.FLTAvatars;
const t = (k, en, v) => (A() && A().t ? A().t(k, en, v) : (v ? en.replace(/\{(\w+)\}/g, (m, x) => v[x] != null ? v[x] : m) : en));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = s => document.querySelector(s);
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} } };
const uiLang = () => (A() && A().S && A().S.ui) || navigator.language || 'en';

/* ---------- names of countries and languages, in the interface language ---------- */
const COUNTRIES = 'AD AE AF AG AI AL AM AO AR AS AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FO FR GA GB GD GE GH GI GL GM GN GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NZ OM PA PE PF PG PH PK PL PR PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VN VU WS XK YE ZA ZM ZW'.split(' ');
const APP_LANGS = ['en', 'de', 'fr', 'pt', 'cs', 'it', 'es', 'nl', 'sv', 'la'];
const MORE_LANGS = 'gsw rm ar bg bn ca cy da el eo et eu fa fi ga gl he hi hr hu hy id is ja ka kk ko lt lv mk ms mt nb pl qu ro ru sk sl sq sr sw ta th tl tr uk ur vi yi zh'.split(' ');
const LEVELS_SPEAK = ['native', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1'];
const LEVELS_LEARN = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
function dn(type, code) { try { return new Intl.DisplayNames([uiLang(), 'en'], { type }).of(code) || code; } catch (e) { return code; } }
const countryName = c => dn('region', c);
const langName = l => (A() && A().LNAME && A().LNAME[l]) || dn('language', l);
const flagEmoji = c => c && c.length === 2 && c !== 'XK' ? String.fromCodePoint(...[...c.toUpperCase()].map(ch => 0x1F1A5 + ch.charCodeAt(0))) : '';
const levelName = lv => lv === 'native' ? t('prof.native', 'Native') : lv;
const sortedCountries = () => COUNTRIES.slice().sort((a, b) => countryName(a).localeCompare(countryName(b), uiLang()));
const sortedLangs = () => APP_LANGS.concat(MORE_LANGS.slice().sort((a, b) => langName(a).localeCompare(langName(b), uiLang())));

/* ---------- loading Google's sign-in and Firebase, only when needed ---------- */
function loadGis() {
  if (gis) return gis;
  gis = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => {
      try {
        tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: 'openid email profile', callback: gotToken, error_callback: gisError });
        res();
      } catch (e) { rej(e); }
    };
    s.onerror = () => { gis = null; rej(new Error('gis')); };
    document.head.appendChild(s);
  });
  return gis;
}
async function load() {
  if (fb) return fb;
  fb = await import('./vendor/firebase.js');
  const app = fb.initializeApp(CONFIG);
  auth = fb.getAuth(app); db = fb.getFirestore(app);
  fb.onAuthStateChanged(auth, async u => {
    user = u || null;
    if (user) { ls.set(FLAG, '1'); state = 'syncing'; paintAll(); await loadProfile(); await pull(); }
    else { ls.set(FLAG, null); ls.set(CACHE, null); profile = null; state = 'off'; paintAll(); }
  });
  return fb;
}
async function gotToken(resp) {
  if (!resp || !resp.access_token) { state = 'off'; msg = t('acct.err', 'Signing in did not work. Check the internet connection and try again.'); paintAll(); return; }
  try {
    await load();
    await fb.signInWithCredential(auth, fb.GoogleAuthProvider.credential(null, resp.access_token));
    editing = true; openPanel();
  } catch (e) { state = 'off'; msg = t('acct.err', 'Signing in did not work. Check the internet connection and try again.') + ' (' + (e && e.code || e) + ')'; paintAll(); }
}
function gisError(e) {
  state = 'off';
  msg = e && e.type === 'popup_failed_to_open' ? t('acct.popup', 'The sign-in window was blocked. Allow pop-ups for this site and try again.') : (e && e.type === 'popup_closed' ? '' : t('acct.err', 'Signing in did not work. Check the internet connection and try again.'));
  paintAll();
}
function signIn() {
  msg = '';
  if (tokenClient) { state = 'syncing'; paintAll(); tokenClient.requestAccessToken({ prompt: 'select_account' }); return; }
  state = 'syncing'; paintAll();
  loadGis().then(() => { state = 'off'; msg = t('acct.ready', 'Ready: tap “Continue with Google” once more.'); paintAll(); })
    .catch(() => { state = 'off'; msg = t('acct.offline', 'Google could not be reached. Check the internet connection.'); paintAll(); });
}

/* ---------- "My words" on every device ---------- */
function merge(P, d) {           // the same rules as "Load from a file": nothing is lost, the two sets are joined
  Object.assign(P.favs, d.favs || {}); Object.assign(P.known, d.known || {}); Object.assign(P.notes, d.notes || {});
  for (const L of d.lists || []) { const o = P.lists.find(x => x.name === L.name); if (o) { (L.ids || []).forEach(id => { if (!o.ids.includes(id)) o.ids.push(id); }); o.w = Object.assign(o.w || {}, L.w || {}); } else P.lists.push(L); }
  const seen = new Set(P.history.map(h => h.id)); P.history = P.history.concat((d.history || []).filter(h => !seen.has(h.id))).sort((a, b) => b.t - a.t).slice(0, 300);
  P.mistakes = (P.mistakes || []).concat(d.mistakes || []).slice(-200);
  for (const [k, n] of Object.entries(d.looks || {})) P.looks[k] = Math.max(P.looks[k] || 0, n);
  const words = p => p && p.words ? Object.keys(p.words).length : 0;
  if (d.prog && words(d.prog) > words(P.prog)) P.prog = d.prog;
  P.badges = Object.assign({}, d.badges || {}, P.badges || {}); P.srs = Object.assign({}, d.srs || {}, P.srs || {});
  if (!P.last && d.last) P.last = d.last;
}
function replace(P, d) { for (const k of Object.keys(P)) delete P[k]; Object.assign(P, { favs: {}, known: {}, notes: {}, lists: [], history: [], mistakes: [], looks: {}, offered: {}, last: null, srs: {} }, d); }
const hasData = P => Object.keys(P.favs).length || P.lists.length || Object.keys(P.notes).length || Object.keys(P.known).length || P.history.length;
async function pull() {
  if (!user) return;
  try {
    const snap = await fb.getDoc(fb.doc(db, 'users', user.uid)), P = A().P;
    if (snap.exists()) {
      const d = JSON.parse(snap.data().me || '{}');
      if (ls.get(DIRTY) === '1' || (!ls.get('flt:acct-seen') && hasData(P))) merge(P, d);      // changes made here since the last sync: join them
      else replace(P, d);                                                                          // nothing new here: the saved copy is the newest
      silent = true; A().saveP(); silent = false;
      refreshViews();
    }
    ls.set('flt:acct-seen', '1');
    await push();
  } catch (e) { state = 'error'; msg = String(e && e.code || e); paintAll(); }
}
async function push() {
  if (!user) return;
  clearTimeout(pushTimer);
  try {
    state = 'syncing'; paintAll();
    await fb.setDoc(fb.doc(db, 'users', user.uid), { me: JSON.stringify(A().P), t: Date.now(), v: 1 });
    ls.set(DIRTY, null); lastSync = Date.now(); state = 'on'; paintAll();
  } catch (e) { state = 'error'; paintAll(); }
}
function changed() {          // the app calls this after every change to "My words"
  if (silent || !ls.get(FLAG)) return;
  ls.set(DIRTY, '1');
  if (!user) return;
  clearTimeout(pushTimer); pushTimer = setTimeout(push, 3000);
}
function refreshViews() { try { const V = window.FLTViews; if (V) { V.counter(); if (!$('#me').hidden) V.paint('me'); } A().render(false); } catch (e) {} }

/* ---------- profile ---------- */
async function loadProfile() {
  try { const s = await fb.getDoc(fb.doc(db, 'profiles', user.uid)); profile = s.exists() ? s.data() : null; }
  catch (e) { profile = null; }
  ls.set(CACHE, profile ? JSON.stringify({ username: profile.username, avatar: profile.avatar.startsWith('data:') ? '' : profile.avatar, memberNo: profile.memberNo }) : null);
  if (!profile) editing = true;
  paintAll();
}
const USER_RE = /^[a-z0-9_.]{3,20}$/;
const RESERVED = new Set(['admin', 'administrator', 'glossarium', 'support', 'help', 'moderator', 'mod', 'staff', 'team', 'official', 'root', 'system', 'null', 'undefined', 'anonymous']);
async function nameFree(name) {
  if (!USER_RE.test(name) || /^[._]|[._]$|\.\./.test(name)) return 'bad';
  if (RESERVED.has(name) && !(profile && profile.username === name)) return 'taken';
  const s = await fb.getDoc(fb.doc(db, 'usernames', name));
  return !s.exists() || (s.data().uid === user.uid) ? 'free' : 'taken';
}
async function saveProfile(d) {
  const uid = user.uid, pRef = fb.doc(db, 'profiles', uid), nRef = fb.doc(db, 'usernames', d.username), cRef = fb.doc(db, 'meta', 'members');
  const now = Date.now();
  if (!profile) {          // a new account: take the next member number, the username and create the profile in one step
    let no = 0;
    await fb.runTransaction(db, async tx => {
      const c = await tx.get(cRef), n = await tx.get(nRef);
      if (n.exists() && n.data().uid !== uid) throw Object.assign(new Error('taken'), { code: 'taken' });
      no = (c.exists() ? c.data().n : 0) + 1;
      tx.set(cRef, { n: no });
      tx.set(nRef, { uid });
      tx.set(pRef, Object.assign({}, d, { memberNo: no, created: now, updated: now }));
    });
    profile = Object.assign({}, d, { memberNo: no, created: now, updated: now });
  } else {
    const batch = fb.writeBatch(db);
    if (d.username !== profile.username) {
      const n = await fb.getDoc(nRef); if (n.exists() && n.data().uid !== uid) throw Object.assign(new Error('taken'), { code: 'taken' });
      batch.set(nRef, { uid });
      batch.delete(fb.doc(db, 'usernames', profile.username));
    }
    const p = Object.assign({}, d, { memberNo: profile.memberNo, created: profile.created, updated: now });
    batch.set(pRef, p);
    await batch.commit();
    profile = p;
  }
  ls.set(CACHE, JSON.stringify({ username: profile.username, avatar: profile.avatar.startsWith('data:') ? '' : profile.avatar, memberNo: profile.memberNo }));
}
async function viewProfile(name) {
  viewing = { name, loading: true }; openPanel();
  try {
    await load();
    const n = await fb.getDoc(fb.doc(db, 'usernames', name));
    if (!n.exists()) { viewing = { name, missing: true }; paintPanel(); return; }
    const p = await fb.getDoc(fb.doc(db, 'profiles', n.data().uid));
    viewing = p.exists() ? { name, p: p.data() } : { name, missing: true };
  } catch (e) { viewing = { name, missing: true }; }
  paintPanel();
}
async function deleteAll() {
  if (!user) return;
  if (!confirmDelete()) return;
  try {
    const batch = fb.writeBatch(db);
    batch.delete(fb.doc(db, 'users', user.uid));
    if (profile) { batch.delete(fb.doc(db, 'profiles', user.uid)); batch.delete(fb.doc(db, 'usernames', profile.username)); }
    await batch.commit();
    try { await fb.deleteUser(user); } catch (e) { await fb.signOut(auth); }
    ls.set('flt:acct-seen', null); ls.set(DIRTY, null); ls.set(CACHE, null); profile = null; editing = false;
    msg = t('acct.deleted', 'Your account, your profile and the copy of your words on the server are deleted. The words on this device are still here.'); paintAll();
  } catch (e) { msg = t('acct.del.err', 'Deleting did not work. Try again.'); paintAll(); }
}
let armed = 0;
function confirmDelete() {          // two clicks instead of a browser dialog
  if (Date.now() - armed < 8000) { armed = 0; return true; }
  armed = Date.now(); msg = t('acct.del.confirm', 'Click “Delete my account” again within a few seconds to delete your account and profile for good.'); paintAll(); return false;
}
async function signOutNow() {
  if (!auth) return;
  await push().catch(() => {});
  await fb.signOut(auth); ls.set('flt:acct-seen', null); ls.set(DIRTY, null); editing = false;
  msg = t('acct.out', 'Signed out. Your words stay on this device; they are no longer copied to your account.'); paintAll();
}

/* ---------- drawing ---------- */
const founder = p => p && p.memberNo && p.memberNo <= FOUNDERS;
function badgeHtml(p, big) {
  if (!founder(p)) return '';
  const tip = t('prof.founder.tip', 'Founding member: one of the first {n} accounts (No. {no})', { n: FOUNDERS, no: p.memberNo });
  return `<span class="founder${big ? ' big' : ''}" title="${esc(tip)}" aria-label="${esc(tip)}">✦${big ? ' ' + esc(t('prof.founder', 'Founding member')) + ` <span class="no">No. ${p.memberNo}</span>` : ''}</span>`;
}
const avatarImg = (v, cls) => `<img class="${cls || 'pfp'}" src="${esc(AV().avatarSrc(v))}" alt="">`;
function cornerHtml() {
  const cached = (() => { try { return JSON.parse(ls.get(CACHE) || 'null'); } catch (e) { return null; } })();
  const p = profile || (ls.get(FLAG) && cached);
  if (p && p.username) return `<button class="corner-btn" data-acct-x="panel" aria-label="${esc(t('prof.mine', 'My profile'))}">${avatarImg(profile ? profile.avatar : p.avatar, 'pfp sm')}<span class="un">@${esc(p.username)}</span>${badgeHtml(p)}</button>`;
  if (user || ls.get(FLAG)) return `<button class="corner-btn" data-acct-x="panel">${avatarImg('', 'pfp sm')}<span class="un">${esc(t('prof.finish', 'Finish your profile'))}</span></button>`;
  return `<button class="corner-btn none" data-acct-x="panel"><span class="no-acct">${esc(t('acct.none', 'No account'))}</span><span class="create">${esc(t('acct.create', 'Create one'))}</span></button>`;
}
function profileCard(p, own) {
  const nat = (p.nationality || []).map(c => `<span class="tag">${flagEmoji(c)} ${esc(countryName(c))}</span>`).join(' ');
  const langs = (arr, kind) => (arr || []).map(x => `<span class="tag">${esc(langName(x.l))}${x.lv ? ` <small>${esc(levelName(x.lv))}</small>` : ''}</span>`).join(' ');
  const since = p.created ? new Date(p.created).toLocaleDateString(uiLang(), { year: 'numeric', month: 'long' }) : '';
  return `<div class="prof-card">${avatarImg(p.avatar, 'pfp lg')}<div class="prof-main"><h3>@${esc(p.username)}</h3>${badgeHtml(p, true)}
    ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
    ${nat ? `<p><span class="lbl">${esc(t('prof.nat', 'Nationality'))}</span> ${nat}</p>` : ''}
    ${(p.speaks || []).length ? `<p><span class="lbl">${esc(t('prof.speaks', 'Speaks'))}</span> ${langs(p.speaks)}</p>` : ''}
    ${(p.learning || []).length ? `<p><span class="lbl">${esc(t('prof.learning', 'Learning'))}</span> ${langs(p.learning)}</p>` : ''}
    ${since ? `<p class="hint">${esc(t('prof.since', 'Member since {d}', { d: since }))}${own ? '' : ''}</p>` : ''}
    ${own ? `<p class="hint">${esc(t('prof.link', 'Your profile link:'))} <a href="#/@${esc(p.username)}">glossarium-app.ch/#/@${esc(p.username)}</a></p>` : ''}</div></div>`;
}
/* the editor keeps its own copy while the person changes things */
let draft = null;
function newDraft() {
  const p = profile || {};
  const g = user || {};
  const S = A() && A().S || {};
  return {
    username: p.username || ((g.email || '').split('@')[0] || '').toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20),
    avatar: p.avatar || 'preset:' + AV().names[Math.floor(Math.random() * AV().names.length)],
    nationality: (p.nationality || []).slice(),
    speaks: (p.speaks || (S.speak ? [{ l: S.speak, lv: 'native' }] : [])).map(x => Object.assign({}, x)),
    learning: (p.learning || (S.learning ? [{ l: S.learning, lv: '' }] : [])).map(x => Object.assign({}, x)),
    bio: p.bio || '', nameState: p.username ? 'free' : '', useLangs: !p.username
  };
}
function langRows(kind) {
  const arr = draft[kind], levels = kind === 'speaks' ? LEVELS_SPEAK : LEVELS_LEARN, need = kind === 'speaks' ? arr.length > 1 : true;
  const rows = arr.map((x, i) => `<div class="lrow"><span class="lname">${esc(langName(x.l))}</span>
    <select data-lv="${kind}" data-i="${i}" aria-label="${esc(t('prof.level.of', 'Level in {lang}', { lang: langName(x.l) }))}" class="${need && !x.lv ? 'missing' : ''}">
      <option value="">${esc(t('prof.level.choose', 'Choose the level…'))}</option>${levels.map(v => `<option value="${v}"${x.lv === v ? ' selected' : ''}>${esc(v === 'native' ? t('prof.native', 'Native') : v)}</option>`).join('')}</select>
    <button class="chip" data-acct-x="lang-del" data-kind="${kind}" data-i="${i}" aria-label="${esc(t('prof.remove', 'Remove'))}">×</button></div>`).join('');
  const used = new Set(arr.map(x => x.l));
  const opts = sortedLangs().filter(l => !used.has(l)).map(l => `<option value="${l}">${esc(langName(l))}</option>`).join('');
  return `${rows}<div class="lrow"><select data-add="${kind}"><option value="">${esc(kind === 'speaks' ? t('prof.add.speak', '+ Add a language you speak') : t('prof.add.learn', '+ Add a language you are learning'))}</option>${opts}</select></div>`;
}
function editorHtml() {
  const d = draft;
  const nameNote = { free: t('prof.name.free', '✓ Available'), taken: t('prof.name.taken', 'Already taken'), bad: t('prof.name.bad', '3 to 20 letters a–z, digits, dots or underscores'), checking: t('prof.name.checking', 'Checking…') }[d.nameState] || '';
  const avs = AV().names.map(n => `<button class="av${d.avatar === 'preset:' + n ? ' sel' : ''}" data-acct-x="av" data-av="preset:${n}" aria-label="${esc(n)}">${avatarImg('preset:' + n, 'pfp md')}</button>`).join('')
    + (d.avatar.startsWith('data:') ? `<button class="av sel" data-acct-x="av" data-av="${esc(d.avatar)}">${avatarImg(d.avatar, 'pfp md')}</button>` : '');
  const natOpts = sortedCountries().filter(c => !d.nationality.includes(c)).map(c => `<option value="${c}">${flagEmoji(c)} ${esc(countryName(c))}</option>`).join('');
  return `<form class="prof-edit" id="prof-form" autocomplete="off">
  <div class="f"><label for="prof-name">${esc(t('prof.username', 'Username'))}</label><div class="row"><span class="at">@</span><input class="text" id="prof-name" maxlength="20" value="${esc(d.username)}" spellcheck="false"><span class="hint ${d.nameState}">${esc(nameNote)}</span></div></div>
  <div class="f"><label>${esc(t('prof.picture', 'Profile picture'))}</label><div class="avs">${avs}</div>
    <div class="row"><label class="btn sm">${esc(t('prof.upload', 'Use my own picture…'))}<input type="file" id="prof-file" accept="image/*" hidden></label><span class="hint">${esc(t('prof.upload.h', 'It is cut to a square and made small.'))}</span></div></div>
  <div class="f"><label>${esc(t('prof.nat', 'Nationality'))}</label><div class="row">${d.nationality.map(c => `<span class="tag">${flagEmoji(c)} ${esc(countryName(c))} <button class="x" data-acct-x="nat-del" data-c="${c}" aria-label="${esc(t('prof.remove', 'Remove'))}">×</button></span>`).join('')}
    ${d.nationality.length < 3 ? `<select id="prof-nat"><option value="">${esc(d.nationality.length ? t('prof.nat.more', '+ Another nationality') : t('prof.nat.choose', 'Choose your country…'))}</option>${natOpts}</select>` : ''}</div></div>
  <div class="f"><label>${esc(t('prof.speaks.l', 'Languages I speak'))}</label><div class="hint">${esc(t('prof.speaks.h', 'With more than one language, choose your level in each.'))}</div>${langRows('speaks')}</div>
  <div class="f"><label>${esc(t('prof.learning.l', 'Languages I am learning'))}</label>${langRows('learning')}</div>
  <div class="f"><label for="prof-bio">${esc(t('prof.bio', 'About me'))} <small class="hint">${esc(t('prof.optional', 'optional'))}</small></label><textarea class="text" id="prof-bio" maxlength="200" rows="2">${esc(d.bio)}</textarea></div>
  ${!profile ? `<label class="chk"><input type="checkbox" id="prof-use" ${d.useLangs ? 'checked' : ''}> ${esc(t('prof.use', 'Set up the dictionary with these languages'))}</label>` : ''}
  <div class="row"><button class="btn primary" type="submit">${esc(profile ? t('prof.save', 'Save profile') : t('prof.create', 'Create my profile'))}</button>${profile ? `<button class="btn" type="button" data-acct-x="cancel">${esc(t('btn.cancel', 'Cancel'))}</button>` : ''}</div>
  <p class="hint err" id="prof-err" aria-live="polite"></p>
  ${!profile ? `<p class="hint">${esc(t('prof.founder.h', 'The first {n} accounts get the founding-member badge ✦.', { n: FOUNDERS }))}</p>` : ''}
  </form>`;
}
function accountControls() {
  const st = state === 'syncing' ? t('acct.syncing', 'Saving…') : state === 'error' ? t('acct.error', 'Could not reach the server; your words are safe on this device and will be copied later.') : lastSync ? t('acct.synced', 'Words saved to your account {when}.', { when: ago(lastSync) }) : '';
  return `<p class="hint">${esc(t('acct.on', 'Your words, lists, notes and progress are kept the same on every device where you sign in.'))} ${esc(st)}</p>
    <div class="row"><button class="btn sm" data-acct-x="sync">${esc(t('acct.sync', 'Sync now'))}</button><button class="btn sm" data-acct-x="out">${esc(t('acct.signout', 'Sign out'))}</button><button class="btn sm" data-acct-x="del">${esc(t('acct.delete', 'Delete my account'))}</button> <a href="privacy/">${esc(t('acct.privacy', 'Privacy'))}</a></div>`;
}
const G_LOGO = '<svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" style="vertical-align:-3px;margin-right:6px"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
function signInHtml() {
  return `<p>${esc(t('acct.why', 'With a free account you get a profile, your words on all your devices, and, for the first {n} accounts, the founding-member badge ✦.', { n: FOUNDERS }))}</p>
    <div class="row"><button class="btn" data-acct-x="in" ${state === 'syncing' ? 'disabled' : ''}>${G_LOGO}${esc(t('acct.signin', 'Continue with Google'))}</button> <a href="privacy/">${esc(t('acct.privacy', 'Privacy'))}</a></div>
    <p class="hint">${esc(t('acct.optional', 'Optional: the dictionary works the same without an account.'))}</p>`;
}
function panelHtml() {
  const note = msg ? `<p class="hint msg" aria-live="polite">${esc(msg)}</p>` : '';
  const close = `<button class="close" data-acct-x="close" aria-label="${esc(t('btn.close', 'Close'))}">×</button>`;
  if (viewing) {
    const v = viewing;
    const body = v.loading ? `<p class="hint">${esc(t('prof.loading', 'Loading…'))}</p>` : v.missing ? `<p>${esc(t('prof.missing', 'There is no profile called @{n}.', { n: v.name }))}</p>` : profileCard(v.p, user && v.p.username === (profile && profile.username));
    return `${close}<h2>${esc(t('prof.title', 'Profile'))}</h2>${body}`;
  }
  if (!user) return `${close}<h2>${esc(t('acct.title', 'Account'))}</h2>${ls.get(FLAG) ? `<p class="hint">${esc(t('prof.loading', 'Loading…'))}</p>` : signInHtml()}${note}`;
  if (editing || !profile) {
    if (!draft) draft = newDraft();
    return `${close}<h2>${esc(profile ? t('prof.edit', 'Edit profile') : t('prof.new', 'Create your profile'))}</h2>${editorHtml()}${note}`;
  }
  return `${close}<h2>${esc(t('prof.mine', 'My profile'))}</h2>${profileCard(profile, true)}<div class="row"><button class="btn sm" data-acct-x="edit">${esc(t('prof.edit', 'Edit profile'))}</button></div><hr>${accountControls()}${note}`;
}
function boxHtml() {          // the short version in "My words" and Settings → Data
  if (user && profile) return `<div class="acct-box"><div class="row">${avatarImg(profile.avatar, 'pfp sm')}<b>@${esc(profile.username)}</b>${badgeHtml(profile)} <button class="btn sm" data-acct-x="panel">${esc(t('prof.mine', 'My profile'))}</button></div>${accountControls()}</div>`;
  if (user) return `<div class="acct-box"><div class="row"><button class="btn" data-acct-x="panel">${esc(t('prof.finish', 'Finish your profile'))}</button></div></div>`;
  return `<div class="acct-box"><p class="hint">${esc(t('acct.off', 'Create a free account to keep your words, lists, notes and progress on all your devices.'))}</p><div class="row"><button class="btn" data-acct-x="panel">${esc(t('acct.create.btn', 'Create an account'))}</button></div></div>`;
}
function ago(ms) { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? t('acct.now', 'just now') : t('acct.min', '{n} min ago', { n: m }); }

function ensureDom() {
  if (!$('#acct-corner')) { const h = $('header'); if (h) h.insertAdjacentHTML('beforeend', '<div id="acct-corner"></div>'); }
  if (!$('#account')) { const h = $('header'); if (h) h.insertAdjacentHTML('afterend', '<section id="account" class="panel" hidden aria-label="Account"></section>'); }
}
function paintPanel() { const el = $('#account'); if (el && !el.hidden) el.innerHTML = panelHtml(); }
function paintAll() {
  ensureDom();
  const c = $('#acct-corner'); if (c) c.innerHTML = cornerHtml();
  document.querySelectorAll('[data-acct]').forEach(el => { el.innerHTML = boxHtml(); });
  paintPanel();
}
function openPanel() {
  ensureDom();
  const el = $('#account'); el.hidden = false; el.innerHTML = panelHtml();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (!user && !ls.get(FLAG)) loadGis().catch(() => {});        // ready before the click, so the sign-in window may open
}
function closePanel() { const el = $('#account'); if (el) el.hidden = true; viewing = null; if (/^#\/@/.test(location.hash)) history.replaceState(null, '', location.pathname); }

/* ---------- reading the editor ---------- */
let nameTimer = 0;
function checkName() {
  const v = draft.username;
  draft.nameState = 'checking'; paintNameNote();
  clearTimeout(nameTimer);
  nameTimer = setTimeout(async () => { try { const r = await nameFree(v); if (draft && draft.username === v) { draft.nameState = r; paintNameNote(); } } catch (e) {} }, 350);
}
function paintNameNote() {
  const el = $('#prof-name'); if (!el) return; const n = el.parentNode.querySelector('.hint');
  const txt = { free: t('prof.name.free', '✓ Available'), taken: t('prof.name.taken', 'Already taken'), bad: t('prof.name.bad', '3 to 20 letters a–z, digits, dots or underscores'), checking: t('prof.name.checking', 'Checking…') }[draft.nameState] || '';
  n.textContent = txt; n.className = 'hint ' + draft.nameState;
}
function readForm() { const n = $('#prof-name'), b = $('#prof-bio'), u = $('#prof-use'); if (n) draft.username = n.value.trim().toLowerCase(); if (b) draft.bio = b.value.trim(); if (u) draft.useLangs = u.checked; }
async function submit() {
  readForm();
  const err = m => { const e = $('#prof-err'); if (e) e.textContent = m; };
  const st = await nameFree(draft.username).catch(() => 'error');
  if (st !== 'free') { draft.nameState = st === 'error' ? '' : st; paintNameNote(); return err(st === 'error' ? t('acct.offline', 'Google could not be reached. Check the internet connection.') : t('prof.err.name', 'Choose another username.')); }
  if (!draft.speaks.length) return err(t('prof.err.speaks', 'Add at least one language you speak.'));
  if (draft.speaks.length > 1 && draft.speaks.some(x => !x.lv)) { paintPanel(); return err(t('prof.err.levels', 'Choose your level in every language you speak.')); }
  if (draft.learning.some(x => !x.lv)) { paintPanel(); return err(t('prof.err.learnlv', 'Choose your level in every language you are learning.')); }
  const speaks = draft.speaks.map(x => ({ l: x.l, lv: x.lv || 'native' })), learning = draft.learning.map(x => ({ l: x.l, lv: x.lv }));
  const d = { username: draft.username, avatar: draft.avatar, nationality: draft.nationality.slice(0, 3), speaks, learning, bio: draft.bio.slice(0, 200) };
  const isNew = !profile;
  try { err(t('acct.syncing', 'Saving…')); await saveProfile(d); }
  catch (e) { return err(e && e.code === 'taken' ? t('prof.err.name', 'Choose another username.') : t('prof.err.save', 'Saving did not work. Try again.') + ' (' + (e && e.code || e) + ')'); }
  if (isNew && draft.useLangs) applyLangs(speaks, learning);
  editing = false; draft = null;
  msg = isNew ? (founder(profile) ? t('prof.welcome.f', 'Welcome, @{u}! You are founding member No. {no}. ✦', { u: profile.username, no: profile.memberNo }) : t('prof.welcome', 'Welcome, @{u}!', { u: profile.username })) : t('prof.saved', 'Profile saved.');
  paintAll();
}
function applyLangs(speaks, learning) {          // the dictionary's own setting: what I speak, what I learn, and the boxes
  try {
    const app = APP_LANGS, F = A();
    const sp = speaks.find(x => app.includes(x.l) && x.lv === 'native') || speaks.find(x => app.includes(x.l));
    const le = learning.find(x => app.includes(x.l));
    if (sp) F.S.speak = sp.l; if (le) F.S.learning = le.l;
    const order = [...new Set([sp && sp.l, ...learning.map(x => x.l), ...speaks.map(x => x.l)].filter(l => l && app.includes(l)))].slice(0, F.MAX_SLOTS);
    F.saveSettings();
    if (order.length >= F.MIN_SLOTS) F.setLanguages(order);
  } catch (e) {}
}
function resizeImage(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const S = 192, c = document.createElement('canvas'); c.width = c.height = S;
      const k = Math.min(img.width, img.height), x = (img.width - k) / 2, y = (img.height - k) / 2;
      c.getContext('2d').drawImage(img, x, y, k, k, 0, 0, S, S);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); };
    img.src = url;
  });
}

/* ---------- events ---------- */
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-acct-x]'); if (!b) return;
  const k = b.dataset.acctX;
  if (b.closest('#prof-form') && k !== 'cancel') ev.preventDefault();
  if (k === 'panel') { viewing = null; const el = $('#account'); if (el && !el.hidden && !b.closest('[data-acct]')) closePanel(); else openPanel(); }
  else if (k === 'close') closePanel();
  else if (k === 'in') signIn();
  else if (k === 'out') signOutNow();
  else if (k === 'sync') pull();
  else if (k === 'del') deleteAll();
  else if (k === 'edit') { editing = true; draft = newDraft(); paintPanel(); }
  else if (k === 'cancel') { editing = false; draft = null; paintPanel(); }
  else if (k === 'av') { readForm(); draft.avatar = b.dataset.av; paintPanel(); }
  else if (k === 'nat-del') { readForm(); draft.nationality = draft.nationality.filter(c => c !== b.dataset.c); paintPanel(); }
  else if (k === 'lang-del') { readForm(); draft[b.dataset.kind].splice(+b.dataset.i, 1); paintPanel(); }
});
document.addEventListener('change', async ev => {
  const el = ev.target; if (!el.closest || !el.closest('#prof-form')) return;
  if (el.id === 'prof-nat' && el.value) { readForm(); draft.nationality.push(el.value); paintPanel(); }
  else if (el.dataset.add && el.value) {
    readForm(); const kind = el.dataset.add;
    draft[kind].push({ l: el.value, lv: kind === 'speaks' && !draft.speaks.length ? 'native' : '' });
    paintPanel();
    const missing = document.querySelector(`select[data-lv="${kind}"].missing`); if (missing) missing.focus();
  }
  else if (el.dataset.lv) { draft[el.dataset.lv][+el.dataset.i].lv = el.value; el.classList.toggle('missing', !el.value); }
  else if (el.id === 'prof-file' && el.files[0]) {
    readForm();
    try { draft.avatar = await resizeImage(el.files[0]); } catch (e) { const er = $('#prof-err'); if (er) er.textContent = t('prof.err.img', 'This picture could not be read.'); return; }
    paintPanel();
  }
});
document.addEventListener('input', ev => { if (ev.target.id === 'prof-name' && draft) { draft.username = ev.target.value.trim().toLowerCase(); checkName(); } });
document.addEventListener('submit', ev => { if (ev.target.id === 'prof-form') { ev.preventDefault(); submit(); } });
function route() { const m = /^#\/@([a-z0-9_.]{3,20})$/.exec(location.hash || ''); if (m) viewProfile(m[1]); }
window.addEventListener('hashchange', route);

window.FLTSync = { paint: paintAll, changed, open: openPanel, get signedIn() { return !!user; }, get profile() { return profile; } };
function start() {
  ensureDom(); paintAll(); route();
  if (ls.get(FLAG) && /^https?:$/.test(location.protocol)) load().catch(() => {});      // has an account on this device: reconnect quietly
  if (/acct-test/.test(location.search) && /^(localhost|127\.)/.test(location.hostname)) {      // tests only: a pretend account, no network
    const names = new Set(['taken_name']);
    fb = { doc: (d, c, id) => ({ c, id }), getDoc: async r => ({ exists: () => r.c === 'usernames' && names.has(r.id), data: () => ({ uid: 'other' }) }),
      runTransaction: async (d, fn) => fn({ get: async r => ({ exists: () => false, data: () => ({}) }), set: () => {} }), writeBatch: () => ({ set() {}, delete() {}, commit: async () => {} }) };
    user = { uid: 'test', email: 'heitor.pais@example.com', displayName: 'Heitor' }; profile = null; editing = true; state = 'on'; openPanel();
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
