/* Glossarium: the notification bell (top right, beside the profile button, only when signed in).
   It lists, newest first:
   - friend requests to me (with Accept / Decline right there),
   - people who accepted my friend request,
   - every new reply in the Reading Room conversations I follow
     (my own posts and the ones I replied to are followed by themselves; any other one with "Follow").
   Nothing new is stored for this: the list is worked out from the friendships and the follow list the person can already read.
   It is checked every few minutes while the app is open, and at once when the app comes back to the front.
   If the person allows it, new items are also shown as notifications of this device while the app is open in the background. */
(function () {
'use strict';
const $ = s => document.querySelector(s);
const A = () => window.FLT;
const S = () => window.FLTSync && window.FLTSync.api;
const FO = () => window.FLTForum;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const t = (k, en, v) => (A() && A().t ? A().t(k, en, v) : (v ? en.replace(/\{(\w+)\}/g, (m, x) => v[x] != null ? v[x] : m) : en));
const SHOWN = 'flt:notif-shown';

const N = { items: [], open: false, busy: false, first: true, timer: null, last: 0 };

function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return t('acct.now', 'just now');
  if (m < 60) return t('acct.min', '{n} min ago', { n: m });
  const h = Math.round(m / 60); if (h < 24) return t('notif.h', '{n} h ago', { n: h });
  return t('notif.d', '{n} d ago', { n: Math.round(h / 24) });
}
const keyOf = x => x.k + ':' + (x.rid || x.uid) + ':' + (x.t || 0);

async function gather() {
  const s = S(), u = s && s.user; if (!u) return [];
  const out = [];
  try {
    await s.loadRels();
    const fr = FO() ? await FO().frSeen() : 0, start = !fr;
    if (start && FO()) await FO().setFrSeen(Date.now());          // the first time: old acceptances are not news
    for (const [uid, r] of s.rels()) {
      const p = s.relProfile(uid) || {};
      if (r.status === 'pending' && r.from !== u.uid) out.push({ k: 'req', uid, name: p.username || '?', av: p.avatar, t: r.t || 0 });
      else if (r.status === 'accepted' && r.from === u.uid && !start && (r.t || 0) > fr) out.push({ k: 'acc', uid, name: p.username || '?', av: p.avatar, t: r.t || 0 });
    }
  } catch (e) {}
  try {
    if (FO()) {
      const rs = await FO().unread();
      await FO().loadProfiles(rs.map(x => x.uid));
      rs.forEach(x => { x.av = FO().avatar(x.uid); out.push(x); });
    }
  } catch (e) {}
  return out.sort((a, b) => (a.k === 'req') - (b.k === 'req') || b.t - a.t);
}

let soon = null;
function refresh() { clearTimeout(soon); soon = setTimeout(run, 400); }
async function run() {
  const s = S();
  if (!s || !s.user) { N.items = []; paint(); return; }
  if (N.busy) return; N.busy = true;
  try { N.items = await gather(); N.last = Date.now(); } finally { N.busy = false; }
  announce(); paint();
}

/* notifications of the device (only after the person said yes, and only while the app is in the background) */
function shownSet() { try { return new Set(JSON.parse(localStorage.getItem(SHOWN) || '[]')); } catch (e) { return new Set(); } }
function announce() {
  const seen = shownSet(), fresh = N.items.filter(x => !seen.has(keyOf(x)));
  fresh.forEach(x => seen.add(keyOf(x)));
  try { localStorage.setItem(SHOWN, JSON.stringify([...seen].slice(-300))); } catch (e) {}
  const first = N.first; N.first = false;
  if (first || !fresh.length || !document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
  fresh.slice(0, 3).forEach(x => {
    const title = textOf(x), opts = { body: x.snip || '', tag: keyOf(x), icon: 'icons/icon-192.png', badge: 'icons/icon-32.png', data: { url: urlOf(x) } };
    try { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)); else new Notification(title, opts); } catch (e) {}
  });
}
function urlOf(x) { return x.k === 'req' || x.k === 'acc' ? '#/@' + x.name : '#/r/' + x.tid + '~' + x.rid; }
function textOf(x) {
  if (x.k === 'req') return t('notif.req', '@{n} sent you a friend request', { n: x.name });
  if (x.k === 'acc') return t('notif.acc', '@{n} accepted your friend request', { n: x.name });
  if (x.k === 'mine') return t('notif.mine', '@{n} replied to your post “{t}”', { n: x.name, t: x.title });
  return t('notif.reply', '@{n} replied in “{t}”', { n: x.name, t: x.title });
}

/* ---------- drawing ---------- */
const BELL = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v3.5L4.3 15.6A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.4L18 12.5V9a6 6 0 0 0-6-6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
function avatar(v) { try { const s = S(); return s ? s.avatarImg(v || '', 'pfp xs') : ''; } catch (e) { return ''; } }
function itemHtml(x) {
  const text = '<span>' + esc(textOf(x)).replace(/@([a-z0-9_.]+)/, '<b>@$1</b>') + '</span>';
  if (x.k === 'req') return `<li class="nt req">${avatar(x.av)}<span class="nt-t">${text}<small>${esc(ago(x.t))}</small>
    <span class="row"><button class="btn sm primary" data-acct-x="fr-ok" data-uid="${esc(x.uid)}">${esc(t('comm.accept', 'Accept'))}</button><button class="btn sm" data-acct-x="fr-del" data-uid="${esc(x.uid)}">${esc(t('comm.decline', 'Decline'))}</button><button class="lnk small" data-nx="go" data-i="${N.items.indexOf(x)}">${esc(t('notif.see', 'See profile'))}</button></span></span></li>`;
  return `<li class="nt"><button class="nt-b" data-nx="go" data-i="${N.items.indexOf(x)}">${avatar(x.av)}<span class="nt-t">${text}${x.snip ? `<q>${esc(x.snip)}</q>` : ''}<small>${esc(ago(x.t))}</small></span></button></li>`;
}
function popHtml() {
  const reqs = N.items.filter(x => x.k === 'req'), rest = N.items.filter(x => x.k !== 'req');
  const dev = !('Notification' in window) ? '' : Notification.permission === 'granted' ? `<p class="hint">${esc(t('notif.dev.on', 'Notifications on this device are on (while Glossarium is open).'))}</p>`
    : Notification.permission === 'denied' ? `<p class="hint">${esc(t('notif.dev.no', 'This browser blocks notifications from Glossarium. You can allow them in the browser settings.'))}</p>`
    : `<button class="lnk small" data-nx="device">${esc(t('notif.dev', 'Also show them as notifications on this device'))}</button>`;
  return `<div class="row nt-head"><h2>${esc(t('notif.title', 'Notifications'))}</h2>${rest.length ? `<button class="lnk small" data-nx="all">${esc(t('notif.all', 'Mark all as read'))}</button>` : ''}<button class="chip" data-nx="close" aria-label="${esc(t('btn.close', 'Close'))}">×</button></div>
    ${!N.items.length ? `<p class="hint">${esc(N.last ? t('notif.none', 'Nothing new. Replies to your posts, replies in conversations you follow and friend requests will appear here.') : t('prof.loading', 'Loading…'))}</p>` : ''}
    ${reqs.length ? `<h3 class="grp">${esc(t('comm.requests', 'Requests'))}</h3><ul class="nt-list">${reqs.map(itemHtml).join('')}</ul>` : ''}
    ${rest.length ? `${reqs.length ? `<h3 class="grp">${esc(t('notif.new', 'New'))}</h3>` : ''}<ul class="nt-list">${rest.map(itemHtml).join('')}</ul>` : ''}
    <div class="nt-foot">${dev}</div>`;
}
function paint() {
  const c = $('#acct-corner'); if (!c) return;
  const s = S(), on = !!(s && s.user);
  let w = $('#notif-wrap');
  if (!on) { if (w) w.remove(); N.open = false; return; }
  if (!w) { c.insertAdjacentHTML('afterbegin', '<div id="notif-wrap"><button id="notif-bell" class="notif-bell" data-nx="toggle" aria-expanded="false" aria-haspopup="true"></button><div id="notif-pop" class="notif-pop" hidden role="dialog"></div></div>'); w = $('#notif-wrap'); }
  else if (w.parentNode !== c || c.firstElementChild !== w) c.insertBefore(w, c.firstChild);
  const n = N.items.length, b = $('#notif-bell');
  b.innerHTML = BELL + (n ? `<span class="nt-n">${n > 99 ? '99+' : n}</span>` : '');
  b.title = t('notif.title', 'Notifications'); b.setAttribute('aria-label', t('notif.title', 'Notifications') + (n ? ' (' + n + ')' : ''));
  b.setAttribute('aria-expanded', String(N.open));
  const pop = $('#notif-pop'); pop.hidden = !N.open; if (N.open) pop.innerHTML = popHtml();
  if (N.open) {          // narrow screens: as wide as the screen, right under the bell
    const vw = document.documentElement.clientWidth, r = w.getBoundingClientRect();
    if (vw <= 700) { pop.style.left = (12 - r.left) + 'px'; pop.style.right = 'auto'; pop.style.width = (vw - 24) + 'px'; }
    else { pop.style.left = pop.style.right = pop.style.width = ''; }
  }
}

/* ---------- actions ---------- */
async function go(x) {
  N.open = false; paint();
  if (x.k === 'req') { location.hash = '#/@' + x.name; return; }
  if (x.k === 'acc') { if (FO()) await FO().setFrSeen(x.t); N.items = N.items.filter(y => y !== x); paint(); location.hash = '#/@' + x.name; return; }
  location.hash = '#/r/' + x.tid + '~' + x.rid;          // opening the conversation marks its replies as read
}
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-nx]');
  if (!b) { if (N.open && !ev.target.closest('#notif-wrap')) { N.open = false; paint(); } return; }
  const k = b.dataset.nx;
  if (k === 'toggle') { N.open = !N.open; paint(); if (N.open && Date.now() - N.last > 30000) refresh(); }
  else if (k === 'close') { N.open = false; paint(); }
  else if (k === 'go') { const x = N.items[+b.dataset.i]; if (x) go(x); }
  else if (k === 'all') { if (FO()) await FO().seeAll(); N.items = N.items.filter(x => x.k === 'req'); paint(); }
  else if (k === 'device') { try { await Notification.requestPermission(); } catch (e) {} paint(); }
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && N.open) { N.open = false; paint(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - N.last > 60000) refresh(); });
function tick() { clearTimeout(N.timer); N.timer = setTimeout(() => { if (S() && S().user) run(); tick(); }, document.hidden ? 10 * 60000 : 3 * 60000); }

window.FLTNotify = { refresh, paint, get items() { return N.items; } };
function start() {
  const s = S(); if (s) s.onAuth.push(() => { N.first = true; N.items = []; N.last = 0; paint(); refresh(); });
  paint(); tick();
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', ev => { const u = ev.data && ev.data.notifUrl; if (u) location.hash = u; });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
