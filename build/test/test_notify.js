// Browser test of the notification bell (notify.js) with a pretend account, pretend friendships and pretend replies (no network).
// Run: node build/test/test_notify.js
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]), f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const res = []; const ok = (n, p, i) => { res.push([n, !!p]); console.log((p ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : '')); };
(async () => {
  await new Promise(r => server.listen(8771, r));
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { localStorage.setItem('flt:onboarded', '1'); });
  await page.goto('http://localhost:8771/');
  await page.waitForFunction(() => window.FLTNotify && window.FLTSync, null, { timeout: 30000 });
  ok('no bell without an account', !(await page.$('#notif-bell')));
  // pretend account: replace what notify.js reads
  await page.evaluate(() => {
    const now = Date.now(), real = window.FLTSync.api;
    window.__seen = { fr: now - 3600e3, all: 0, frSet: [] };
    const rels = new Map([
      ['u2', { a: 'me', b: 'u2', from: 'u2', status: 'pending', t: now - 5 * 60e3 }],
      ['u3', { a: 'me', b: 'u3', from: 'me', status: 'accepted', t: now - 10 * 60e3 }],
      ['u4', { a: 'me', b: 'u4', from: 'me', status: 'accepted', t: now - 5 * 3600e3 }],          // accepted long ago: not news
    ]);
    const P = { u2: { username: 'anna.m', avatar: 'preset:globe' }, u3: { username: 'lucas', avatar: 'preset:quill' }, u4: { username: 'old', avatar: '' } };
    const keep = window.FLTSync; window.FLTSync = { paint: keep.paint, changed: keep.changed, open: keep.open, paintCommunity: keep.paintCommunity, api: Object.assign({}, { user: { uid: 'me' }, onAuth: [], avatarImg: real.avatarImg, loadRels: async () => {}, rels: () => rels, relProfile: u => P[u], showRequests() {} }), signedIn: true };
    window.FLTForum = Object.assign({}, window.FLTForum, {
      frSeen: async () => window.__seen.fr, setFrSeen: async ts => { window.__seen.frSet.push(ts); window.__seen.fr = ts; },
      unread: async () => window.__seen.all ? [] : [
        { k: 'mine', tid: 'T1', rid: 'R1', uid: 'u3', name: 'lucas', title: 'Grüezi or Hallo?', snip: 'In Zürich you say Grüezi to strangers.', t: now - 2 * 60e3 },
        { k: 'reply', tid: 'T2', rid: 'R2', uid: 'u2', name: 'anna.m', title: 'Gipfeli', snip: 'Yes, Gipfeli is the Swiss word.', t: now - 30 * 60e3 }],
      seeAll: async () => { window.__seen.all = 1; }, loadProfiles: async () => {}, avatar: () => '' });
    window.FLTNotify.refresh();
  });
  await page.waitForFunction(() => document.querySelector('#notif-bell .nt-n'), null, { timeout: 5000 }).catch(() => {});
  const n = await page.textContent('#notif-bell .nt-n').catch(() => '');
  ok('bell shows 4 (1 request, 1 acceptance, 2 replies)', n === '4', 'count ' + n);
  await page.click('#notif-bell');
  const txt = await page.textContent('#notif-pop');
  ok('request listed with Accept', /@anna\.m sent you a friend request/.test(txt) && !!(await page.$('#notif-pop [data-acct-x="fr-ok"][data-uid="u2"]')));
  ok('acceptance listed', /@lucas accepted your friend request/.test(txt));
  ok('old acceptance not listed', !/@old/.test(txt));
  ok('reply to my post listed', /@lucas replied to your post “Grüezi or Hallo\?”/.test(txt) && /Grüezi to strangers/.test(txt));
  ok('reply in followed conversation listed', /@anna\.m replied in “Gipfeli”/.test(txt));
  await page.screenshot({ path: '/tmp/notif.png', clip: { x: 700, y: 0, width: 500, height: 560 } });
  // clicking a reply goes to the conversation
  await page.click('#notif-pop [data-nx="go"] >> text=Gipfeli');
  ok('reply opens its conversation', await page.evaluate(() => location.hash) === '#/r/T2~R2');
  ok('pop closes after a click', await page.evaluate(() => document.querySelector('#notif-pop').hidden));
  // the acceptance: clicking marks it read
  await page.click('#notif-bell');
  await page.click('#notif-pop [data-nx="go"] >> text=accepted');
  ok('acceptance marked read when opened', await page.evaluate(() => window.__seen.frSet.length === 1));
  ok('acceptance opens the profile', await page.evaluate(() => location.hash) === '#/@lucas');
  await page.evaluate(() => { location.hash = ''; });
  // mark all as read keeps the request (it still needs an answer)
  await page.click('#notif-bell');
  await page.click('#notif-pop [data-nx="all"]');
  const after = await page.textContent('#notif-pop');
  ok('mark all read: replies gone, request stays', !/replied/.test(after) && /friend request/.test(after));
  ok('count now 1', (await page.textContent('#notif-bell .nt-n')) === '1');
  // German interface
  await page.evaluate(() => { const A = window.FLT; if (A && A.setUi) A.setUi('de'); });
  await page.click('#notif-bell').catch(() => {});
  await page.keyboard.press('Escape');
  ok('Escape closes it', await page.evaluate(() => document.querySelector('#notif-pop').hidden));
  // small screen
  await page.setViewportSize({ width: 390, height: 800 });
  await page.click('#notif-bell');
  const box = await page.$eval('#notif-pop', e => { const r = e.getBoundingClientRect(); return [r.left, r.right]; });
  ok('fits a phone screen', box[0] >= 0 && box[1] <= 390, JSON.stringify(box));
  await page.screenshot({ path: '/tmp/notif-phone.png' });
  ok('no page errors', !errs.length, errs.join(' | '));
  await browser.close(); server.close();
  const bad = res.filter(r => !r[1]).length; console.log(bad ? `${bad} FAILED` : 'ALL PASS'); process.exit(bad ? 1 : 0);
})();
