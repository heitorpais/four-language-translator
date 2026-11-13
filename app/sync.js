/* Glossarium: sign in with Google and keep "My words" (saved words, lists, notes, known words, history, progress)
   the same on every device. Optional: without signing in nothing here runs and nothing leaves the device.
   The Google/Firebase code (vendor/firebase.js) is loaded only when someone signs in, or has signed in before.
   Storage: Cloud Firestore in Zürich (europe-west6), one document per person, users/<their id>; the database rules
   let a signed-in person read and write only their own document. */
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
const FLAG = 'flt:acct', DIRTY = 'flt:acct-dirty';
let fb = null, auth = null, db = null, user = null, state = 'off', lastSync = 0, pushTimer = 0, msg = '';
const A = () => window.FLT;
const t = (k, en, v) => (A() && A().t ? A().t(k, en, v) : en);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} } };

async function load() {
  if (fb) return fb;
  fb = await import('./vendor/firebase.js');
  const app = fb.initializeApp(CONFIG);
  auth = fb.getAuth(app); db = fb.getFirestore(app);
  fb.onAuthStateChanged(auth, async u => {
    user = u || null;
    if (user) { ls.set(FLAG, '1'); state = 'syncing'; paint(); await pull(); }
    else { ls.set(FLAG, null); state = 'off'; paint(); }
  });
  return fb;
}

/* the same rules as "Load from a file": nothing is lost, the two sets are joined */
function merge(P, d) {
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
  } catch (e) { state = 'error'; msg = String(e && e.code || e); paint(); }
}
async function push() {
  if (!user) return;
  clearTimeout(pushTimer);
  try {
    state = 'syncing'; paint();
    await fb.setDoc(fb.doc(db, 'users', user.uid), { me: JSON.stringify(A().P), t: Date.now(), v: 1 });
    ls.set(DIRTY, null); lastSync = Date.now(); state = 'on'; msg = ''; paint();
  } catch (e) { state = 'error'; msg = String(e && e.code || e); paint(); }
}
let silent = false;
/* called by the app after every change to "My words" */
function changed() {
  if (silent || !ls.get(FLAG)) return;
  ls.set(DIRTY, '1');
  if (!user) return;
  clearTimeout(pushTimer); pushTimer = setTimeout(push, 3000);
}
function refreshViews() { try { const V = window.FLTViews; if (V) { V.counter(); if (!document.getElementById('me').hidden) V.paint('me'); } A().render(false); } catch (e) {} }

async function signIn() {
  try {
    state = 'syncing'; msg = ''; paint();
    await load();
    const p = new fb.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    await fb.signInWithPopup(auth, p);
  } catch (e) {
    const code = e && e.code || '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') { try { await fb.signInWithRedirect(auth, new fb.GoogleAuthProvider()); return; } catch (x) {} }
    state = user ? 'on' : 'off';
    msg = code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' ? '' : t('acct.err', 'Signing in did not work. Check the internet connection and try again.');
    paint();
  }
}
async function signOutNow() {
  if (!auth) return;
  await push().catch(() => {});
  await fb.signOut(auth); ls.set('flt:acct-seen', null); ls.set(DIRTY, null);
  msg = t('acct.out', 'Signed out. Your words stay on this device; they are no longer copied to your account.'); paint();
}
async function deleteAll() {
  if (!user) return;
  if (!confirmDelete()) return;
  try {
    await fb.deleteDoc(fb.doc(db, 'users', user.uid));
    try { await fb.deleteUser(user); }
    catch (e) { if (e && e.code === 'auth/requires-recent-login') { await fb.reauthenticateWithPopup(user, new fb.GoogleAuthProvider()); await fb.deleteUser(auth.currentUser); } else throw e; }
    ls.set('flt:acct-seen', null); ls.set(DIRTY, null);
    msg = t('acct.deleted', 'Your account and the copy of your words on the server are deleted. The words on this device are still here.'); paint();
  } catch (e) { msg = t('acct.del.err', 'Deleting did not work. Try again.'); paint(); }
}
let armed = 0;
function confirmDelete() {          // two clicks instead of a browser dialog
  if (Date.now() - armed < 6000) { armed = 0; return true; }
  armed = Date.now(); msg = t('acct.del.confirm', 'Click “Delete my account” again within a few seconds to delete it for good.'); paint(); return false;
}

function ago(ms) { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? t('acct.now', 'just now') : t('acct.min', '{n} min ago', { n: m }); }
function html() {
  const G = '<svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" style="vertical-align:-3px;margin-right:6px"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
  const note = msg ? `<p class="hint" aria-live="polite">${esc(msg)}</p>` : '';
  const priv = `<a href="privacy/">${esc(t('acct.privacy', 'Privacy'))}</a>`;
  if (user) {
    const who = esc(user.displayName || user.email || '');
    const st = state === 'syncing' ? t('acct.syncing', 'Saving…') : state === 'error' ? t('acct.error', 'Could not reach the server; your words are safe on this device and will be copied later.') : lastSync ? t('acct.synced', 'Saved to your account {when}.', { when: ago(lastSync) }) : '';
    return `<div class="acct-box"><p><b>${who}</b>${user.email && user.displayName ? ` <span class="hint">${esc(user.email)}</span>` : ''}</p>
      <p class="hint">${esc(t('acct.on', 'Your words, lists, notes and progress are kept the same on every device where you sign in.'))} ${esc(st)}</p>
      <div class="row"><button class="btn sm" data-acct-x="sync">${esc(t('acct.sync', 'Sync now'))}</button><button class="btn sm" data-acct-x="out">${esc(t('acct.signout', 'Sign out'))}</button><button class="btn sm" data-acct-x="del">${esc(t('acct.delete', 'Delete my account'))}</button> ${priv}</div>${note}</div>`;
  }
  return `<div class="acct-box"><p class="hint">${esc(t('acct.off', 'Sign in to keep your words, lists, notes and progress on all your devices. Optional: the dictionary works the same without an account.'))}</p>
    <div class="row"><button class="btn" data-acct-x="in" ${state === 'syncing' ? 'disabled' : ''}>${G}${esc(t('acct.signin', 'Sign in with Google'))}</button> ${priv}</div>${note}</div>`;
}
function paint() { document.querySelectorAll('[data-acct]').forEach(el => { el.innerHTML = html(); }); }
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-acct-x]'); if (!b) return;
  const k = b.dataset.acctX;
  if (k === 'in') signIn(); else if (k === 'out') signOutNow(); else if (k === 'sync') pull(); else if (k === 'del') deleteAll();
});
window.FLTSync = { paint, changed, get signedIn() { return !!user; } };
if (ls.get(FLAG) && /^https?:$/.test(location.protocol)) load().catch(() => {});      // signed in before: reconnect quietly
})();
