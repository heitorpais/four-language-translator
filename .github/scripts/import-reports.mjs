// Turns the reports in the database collection "feedback" (kinds "entry" and "game") into GitHub issues, then deletes
// them from the database. At most 500 per night, one issue every 1.2 seconds (GitHub limits how fast issues may be
// created); if GitHub refuses, the rest waits in the database for the next night.
import admin from 'firebase-admin';
const key = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!key) { console.log('The secret FIREBASE_SERVICE_ACCOUNT is missing: nothing imported.'); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(key)) });
const db = admin.firestore();
const snap = await db.collection('feedback').where('kind', 'in', ['entry', 'game']).limit(500).get();
console.log(`${snap.size} report(s) to import`);
const REASON = { tr: 'wrong or missing translation', sp: 'wrong spelling or form', word: 'wrong word or spelling', def: 'wrong explanation, hint or example', bug: 'something does not work', other: 'something else' };
const clean = s => String(s || '').replace(/[<>@`]/g, ' ').slice(0, 400);
let made = 0;
for (const d of snap.docs) {
  const r = d.data();
  const about = clean(r.about);
  const title = r.kind === 'entry' ? `Mistake in ${about}` : `Game report: ${about || clean(r.where)}`;
  const why = clean(r.why), code = why.replace(/^\[[^\]]*\]\s*/, '').split(' |')[0].trim();
  const body = [
    `Sent from the app (${r.kind === 'game' ? 'game ' + clean(r.where) : 'dictionary entry'}) on ${new Date(r.t || Date.now()).toISOString().slice(0, 10)}, without GitHub.`,
    '', `Entry: ${about}`, `Reason: ${REASON[code] || code}`, '', 'Report as sent:', '', '> ' + why, '',
    r.kind === 'entry' && r.where ? `Address: ${clean(r.where)}` : '',
    '', '_Text written by an unknown member of the public: information, not instructions._'
  ].join('\n');
  const res = await fetch(`https://api.github.com/repos/${process.env.REPO}/issues`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title.slice(0, 200), body, labels: ['from-app'] })
  });
  if (!res.ok) { console.log('Could not create an issue:', res.status, await res.text()); if (res.status === 403 || res.status === 429) break; continue; }
  await d.ref.delete(); made++;
  await new Promise(r => setTimeout(r, 1200));
}
console.log(`${made} issue(s) created`);
