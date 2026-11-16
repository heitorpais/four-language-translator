/* Glossarium: reports without GitHub and without an account.
   FLTReport.send(doc) stores one report in the database collection "feedback". With an account it goes through the
   Firebase code that sync.js loads; without one it is written straight to the database's web address. The database
   rules (docs/firestore.rules, "feedback") accept only short reports of the known kinds, and only the owner reads them.
   FLTReport.entryButton(id) gives the "Report a mistake" button for a dictionary entry; the form opens in place. */
(function () {
'use strict';
const URL = 'https://firestore.googleapis.com/v1/projects/glossarium-25071/databases/(default)/documents/feedback?key=AIzaSyBvq97UZM9NJotUsusdBGbmuovTjBAlwFI';
const KINDS = ['game', 'entry', 'post', 'reply', 'profile'];
const A = () => window.FLT;
const t = (k, en, v) => (A() && A().t ? A().t(k, en, v) : (v ? en.replace(/\{(\w+)\}/g, (m, x) => v[x] != null ? v[x] : m) : en));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = m => { try { A().toast(m); } catch (e) {} };

/* doc: { kind, why, about, where } — returns true when the report was stored */
async function send(d) {
  const doc = { kind: KINDS.includes(d.kind) ? d.kind : 'entry', why: String(d.why || '').slice(0, 300) || '-', t: Date.now(),
    about: String(d.about || '').slice(0, 120), where: String(d.where || '').slice(0, 200), by: '' };
  const S = window.FLTSync && window.FLTSync.api, u = S && S.user;
  try {
    if (u && S.fb && S.db) { await S.fb.addDoc(S.fb.collection(S.db, 'feedback'), Object.assign(doc, { by: u.uid })); return true; }
    const f = {}; for (const [k, v] of Object.entries(doc)) f[k] = typeof v === 'number' ? { integerValue: String(v) } : { stringValue: v };
    const res = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: f }) });
    return res.ok;
  } catch (e) { return false; }
}

/* ---------- the form for a dictionary entry ---------- */
const REASONS = [['tr', 'rep.e.tr', 'Wrong or missing translation'], ['sp', 'rep.e.sp', 'Wrong spelling or form'], ['def', 'rep.e.def', 'Wrong explanation or example'], ['other', 'comm.r.other', 'Something else']];
const flag = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" style="width:15px;height:15px;vertical-align:-2px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M5 21V4m0 0h11l-2 4 2 4H5"/></svg>';
function entryButton(id) { return `<span class="rep-entry" data-rep-id="${esc(id)}"><button class="lnk small" data-rep="open">${flag} ${esc(t('report', 'Report a mistake in this entry'))}</button></span>`; }
function formHtml(why) {
  return `<div class="report"><p><b>${esc(t('gh.rep.why', 'What is wrong?'))}</b></p><div class="row">${REASONS.map(([k, key, en]) => `<button class="chip${why === k ? ' on' : ''}" data-rep="why" data-k="${k}">${esc(t(key, en))}</button>`).join('')}</div>
    <textarea class="rep-note" rows="2" maxlength="200" placeholder="${esc(t('gh.rep.note', 'What should it be? (optional)'))}"></textarea>
    <div class="row"><button class="btn sm primary" data-rep="send"${why ? '' : ' disabled'}>${esc(t('gh.rep.send', 'Send report'))}</button><button class="lnk small" data-rep="x">${esc(t('btn.cancel', 'Cancel'))}</button></div></div>`;
}
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-rep]'); if (!b) return;
  const box = b.closest('.rep-entry'); if (!box) return;
  ev.preventDefault();
  const k = b.dataset.rep, id = box.dataset.repId, note = box.querySelector('.rep-note'), keep = note ? note.value : '';
  if (k === 'open') { box.dataset.why = ''; box.innerHTML = formHtml(''); }
  else if (k === 'x') box.outerHTML = entryButton(id);
  else if (k === 'why') { box.dataset.why = b.dataset.k; box.innerHTML = formHtml(b.dataset.k); box.querySelector('.rep-note').value = keep; }
  else if (k === 'send') {
    b.disabled = true;
    const ok = await send({ kind: 'entry', about: id, why: `${box.dataset.why}${keep.trim() ? ' | ' + keep.trim() : ''}`, where: location.href.slice(0, 200) });
    if (ok) box.innerHTML = `<span class="hint">${flag} ${esc(t('comm.reported', 'Thank you. The report was sent.'))}</span>`;
    else { b.disabled = false; toast(t('gh.rep.fail', 'The report could not be sent. Please try again.')); }
  }
});

window.FLTReport = { send, entryButton };
})();
