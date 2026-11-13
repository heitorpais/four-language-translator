/* Glossarium (formerly Four-Language Translator): the Progress page. Words learned, level bars, a calendar of practice days, 20 badges,
   shareable badge images and a yearly summary. Everything is stored in this browser (personal data "flt:me1", field
   prog and badges) and goes into the export file. One setting (Settings › Display › Progress and badges) turns all of
   it off: the page, the animations and the sounds.
   Rules: only practice counts, never lookups (except the Explorer badge). A word is learned when it was answered right
   in practice on 3 different days. No points, no rankings, no reminders. */
(function () {
'use strict';
let A = null;
const $ = s => document.querySelector(s);
const t = (k, en, v) => A.t(k, en, v), esc = s => A.esc(s);
const ALL = ['de', 'en', 'fr', 'pt'];          // the languages on screen (FLTViews keeps it in step)
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const day = d => { const x = d ? new Date(d) : new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return day(d); };
const monday = s => { const d = parseDay(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return day(d); };
let TEST = /progress-test/.test(location.search + location.hash);

function prog() {
  const P = A.P;
  if (!P.prog || P.prog.v !== 1) P.prog = { v: 1, words: {}, days: {}, runs: {}, best: {}, aux: {}, opened: {}, quizzes: 0 };
  if (!P.badges) P.badges = {};
  return P.prog;
}
const on = () => A && A.S.badges !== false;

/* ---------- recording (called by the practice views) ---------- */
function record(id, ok, mode, when) {
  if (!A || !id) return;
  const g = prog(), d = when || day();
  g.days[d] = (g.days[d] || 0) + 1;
  const w = g.words[id] || (g.words[id] = { d: [], n: 0 });
  if (ok) {
    w.n++;
    if (!w.d.includes(d)) { w.d.push(d); if (w.d.length > 3) w.d = w.d.slice(-3); }
    if (!w.l && w.d.length >= 3) w.l = d;                 // learned: right on 3 different days
  }
  const run = { gender: id.startsWith('de:') ? 'gender' : null, plural: 'plural', case: 'case' }[mode];
  if (run) { g.runs[run] = ok ? (g.runs[run] || 0) + 1 : 0; g.best[run] = Math.max(g.best[run] || 0, g.runs[run]); }
  if (mode === 'aux' && ok && id.startsWith('de:')) g.aux[id] = 1;
  A.saveP();
  check();
}
function quizDone() { if (!A) return; prog().quizzes = (prog().quizzes || 0) + 1; A.saveP(); check(); }
function opened(e) {               // Explorer badge: the only badge that counts lookups
  if (!A || !e) return;
  const v = A.levelOf(e); if (!v) return;
  const g = prog(); if (g.opened[v.l]) return;
  g.opened[v.l] = day(); A.saveP(); check();
}
function saved() { if (A) check(); }

/* ---------- what counts ---------- */
// a word counts as learned when it was answered right on 3 different days, or when the reader marked it "I know this"
const isKnown = id => !!(A.P.known && A.P.known[id]);
const isLearned = id => { const w = prog().words[id]; return !!(w && w.l) || isKnown(id); };
const learnedIds = () => { const g = prog(); return [...new Set(Object.keys(g.words).filter(id => g.words[id].l).concat(Object.keys(A.P.known || {})))]; };
function coreLevels() {            // core entries per language and level (the totals of the level bars)
  if (coreLevels.c && coreLevels.n === A.D.byId.size) return coreLevels.c;
  const c = {}; ALL.forEach(l => { c[l] = {}; LEVELS.forEach(x => { c[l][x] = new Set(); }); });
  for (const e of A.D.byId.values()) if (e.tier === 'core') { const v = A.levelOf(e); if (v && c[e.lang]) c[e.lang][v.l].add(e.id); }
  coreLevels.c = c; coreLevels.n = A.D.byId.size; return c;
}
let REGIONAL = null;
async function loadRegional() {
  if (REGIONAL) return REGIONAL;
  if (!A.D.manifest) return {};
  const f = (A.D.manifest.files || []).find(x => x.tier === 'regional');
  try { REGIONAL = f ? await A.getFile(f.file, f.sha256) : {}; } catch (e) { return {}; }
  return REGIONAL;
}
function auxSet() {                 // the haben/sein practice set: German verbs at A1 and A2
  const s = [];
  for (const e of A.D.byId.values()) if (e.lang === 'de' && e.tier === 'core' && e.pos === 'verb' && e.verb && ['haben', 'sein'].includes(e.verb.aux)) { const v = A.levelOf(e); if (v && (v.l === 'A1' || v.l === 'A2')) s.push(e.id); }
  return s;
}
function irregularTop(lang) {
  return [...A.D.byId.values()].filter(e => e.lang === lang && e.tier === 'core' && e.pos === 'verb' && e.verb && e.verb.regular === false && e.verb.principal_parts && e.frequency_rank)
    .sort((a, b) => a.frequency_rank - b.frequency_rank).slice(0, 100).map(e => e.id);
}
function fourLang(learned) {        // the same word learned in all four languages
  const L = new Set(learned), seen = new Set(); let n = 0;
  for (const id of learned) {
    const e = A.D.byId.get(id); if (!e) continue;
    const s = A.visibleSenses(e)[0]; if (!s) continue;
    const ids = [id]; let ok = true;
    for (const l of ALL) { if (l === e.lang) continue; const x = A.trIds(s.s, l).find(y => L.has(y)); if (!x) { ok = false; break; } ids.push(x); }
    if (!ok) continue;
    const k = ids.sort().join('|'); if (!seen.has(k)) { seen.add(k); n++; }
  }
  return n;
}
function weeks(days) {              // calendar weeks (Monday to Sunday) with practice on at least 6 days
  const per = {};
  for (const d of Object.keys(days)) if (days[d] > 0) { const m = monday(d); per[m] = (per[m] || 0) + 1; }
  return Object.keys(per).filter(m => per[m] >= 6).sort();
}
function monthsOfWeeks(ws) {        // 4 perfect weeks in a row
  const set = new Set(ws); return ws.some(w => [1, 2, 3].every(k => set.has(addDays(w, 7 * k))));
}
function longestStreak(days, from, to) {   // practice days in a row; one rest day per week does not break it
  const ds = Object.keys(days).filter(d => days[d] > 0 && (!from || d >= from) && (!to || d <= to)).sort();
  if (!ds.length) return 0;
  let best = 0, cur = 0, prev = null, restWeek = null;
  for (const d of ds) {
    if (prev && addDays(prev, 1) === d) cur++;
    else if (prev && addDays(prev, 2) === d && restWeek !== monday(addDays(prev, 1))) { cur++; restWeek = monday(addDays(prev, 1)); }
    else { cur = 1; restWeek = null; }
    best = Math.max(best, cur); prev = d;
  }
  return best;
}

/* ---------- the 20 badges ---------- */
const PER = 'per';      // shown per language
const BADGES = [
  { k: 'first-save', g: 'first', icon: '🌱', name: 'First word saved', desc: 'Saved a word with ☆.', hint: 'Tap ☆ on any card.' },
  { k: 'first-quiz', g: 'first', icon: '✅', name: 'First quiz finished', desc: 'Finished a round of practice.', hint: 'Finish one round in Practice.' },
  { k: 'm50', gen: '50 words learned in a language.', g: 'mile', per: PER, icon: '🥉', name: '50 words learned', n: 50, desc: '50 words learned in {lang}.', hint: 'Answer 50 words right on 3 different days.' },
  { k: 'm100', gen: '100 words learned in a language.', g: 'mile', per: PER, icon: '🥈', name: '100 words learned', n: 100, desc: '100 words learned in {lang}.', hint: 'Answer 100 words right on 3 different days.' },
  { k: 'm500', gen: '500 words learned in a language.', g: 'mile', per: PER, icon: '🥇', name: '500 words learned', n: 500, desc: '500 words learned in {lang}.', hint: 'Answer 500 words right on 3 different days.' },
  { k: 'm1000', gen: '1,000 words learned in a language.', g: 'mile', per: PER, icon: '🏆', name: '1,000 words learned', n: 1000, desc: '1,000 words learned in {lang}.', hint: 'Answer 1,000 words right on 3 different days.' },
  { k: 'lA1', gen: 'Every A1 word of a language learned.', g: 'level', per: PER, icon: 'A1', lv: 'A1', name: 'All A1 words', desc: 'Every A1 word in {lang} learned.', hint: 'Learn every A1 word of a language.' },
  { k: 'lA2', gen: 'Every A2 word of a language learned.', g: 'level', per: PER, icon: 'A2', lv: 'A2', name: 'All A2 words', desc: 'Every A2 word in {lang} learned.', hint: 'Learn every A2 word of a language.' },
  { k: 'lB1', gen: 'Every B1 word of a language learned.', g: 'level', per: PER, icon: 'B1', lv: 'B1', name: 'All B1 words', desc: 'Every B1 word in {lang} learned.', hint: 'Learn every B1 word of a language.' },
  { k: 'four', g: 'four', icon: '🌍', name: 'Four languages', desc: 'The same 100 words learned in all four languages.', hint: 'Learn 100 words in all four languages.' },
  { k: 'gender50', g: 'grammar', icon: '⚖️', name: 'der, die, das master', desc: '50 German articles right in a row.', hint: 'Answer 50 der/die/das questions right in a row.' },
  { k: 'aux', g: 'grammar', icon: '🔀', name: 'haben or sein', desc: 'Every A1–A2 verb in the haben/sein set answered right.', hint: 'Answer each A1–A2 verb right once in “haben / sein”.' },
  { k: 'plural50', g: 'grammar', icon: '➕', name: 'Plural master', desc: '50 plurals right in a row.', hint: 'Answer 50 plural questions right in a row.' },
  { k: 'case50', g: 'grammar', icon: '🧭', name: 'Case master', desc: '50 prepositions and cases right in a row.', hint: 'Answer 50 “preposition + case” questions right in a row.' },
  { k: 'swiss', g: 'regional', icon: 'flag:ch', name: 'Swiss badge', desc: '50 Helvetisms learned (Velo, Billett, Znüni …).', hint: 'Learn 50 Swiss words: Practice › Words › Swiss words.' },
  { k: 'brazil', g: 'regional', icon: 'flag:br', name: 'Brazilian badge', desc: '50 Brazil vs. Portugal words learned.', hint: 'Learn 50 Brazilian or Portuguese words: Practice › Words › Brazil vs. Portugal.' },
  { k: 'irregular', g: 'collect', icon: '🔁', name: 'Irregular verb collector', desc: 'The 100 most common irregular verbs of {lang} learned.', hint: 'Learn the 100 most common irregular verbs of one language (Explore › Irregular verbs).' },
  { k: 'week', g: 'habit', icon: '📅', name: 'Perfect week', desc: 'Practised on 6 or 7 days of one week (one rest day is fine).', hint: 'Practise on at least 6 days of one week, Monday to Sunday.' },
  { k: 'month', g: 'habit', icon: '🗓️', name: 'Perfect month', desc: '4 perfect weeks in a row.', hint: 'Make 4 perfect weeks in a row.' },
  { k: 'explorer', g: 'curious', icon: '🔭', name: 'Explorer', desc: 'Opened words at every level from A1 to C2.', hint: 'Open at least one word at each level, A1 to C2.' },
];
const GROUPS = [['first', 'First steps'], ['mile', 'Milestones'], ['level', 'Level complete'], ['four', 'Four languages'], ['grammar', 'Grammar masters'], ['regional', 'Regional'], ['collect', 'Collections'], ['habit', 'Habits'], ['curious', 'Curiosity']];
const bname = b => t('bd.' + b.k, b.name), bdesc = (b, lang) => t('bd.' + b.k + '.d', b.desc, { lang: lang ? A.LNAME[lang] : '' }), bhint = b => t('bd.' + b.k + '.h', b.hint);

/* the state of every badge: {key: {ok, have, need, lang}} (per-language badges as key:lang) */
function evaluate(reg) {
  const g = prog(), P = A.P, out = {};
  const learned = learnedIds(), byLang = {}; ALL.forEach(l => { byLang[l] = learned.filter(id => id.startsWith(l + ':')); });
  const lv = coreLevels();
  out['first-save'] = { ok: Object.keys(P.favs).length > 0 || !!P.badges['first-save'] };
  out['first-quiz'] = { ok: (g.quizzes || 0) > 0 };
  for (const b of BADGES.filter(x => x.g === 'mile')) for (const l of ALL) out[b.k + ':' + l] = { ok: byLang[l].length >= b.n, have: byLang[l].length, need: b.n };
  for (const b of BADGES.filter(x => x.g === 'level')) for (const l of ALL) { const ids = lv[l][b.lv]; let n = 0; for (const id of ids) if (isLearned(id)) n++; out[b.k + ':' + l] = { ok: ids.size > 0 && n >= ids.size, have: n, need: ids.size }; }
  const four = fourLang(learned); out.four = { ok: ALL.length >= 4 && four >= 100, have: four, need: 100 };      // needs four languages on screen
  out.gender50 = { ok: (g.best.gender || 0) >= 50, have: g.best.gender || 0, need: 50 };
  out.plural50 = { ok: (g.best.plural || 0) >= 50, have: g.best.plural || 0, need: 50 };
  out.case50 = { ok: (g.best.case || 0) >= 50, have: g.best.case || 0, need: 50 };
  const as = auxSet(), an = as.filter(id => g.aux[id]).length; out.aux = { ok: as.length > 0 && an >= as.length, have: an, need: as.length };
  if (reg) {
    const ch = new Set((reg.de || {}).CH || []), br = new Set([...((reg.pt || {}).BR || []), ...((reg.pt || {}).PT || [])]);
    const nch = learned.filter(id => ch.has(id)).length, nbr = learned.filter(id => br.has(id)).length;
    out.swiss = { ok: nch >= 50, have: nch, need: 50 }; out.brazil = { ok: nbr >= 50, have: nbr, need: 50 };
  }
  let bestIrr = { have: 0, lang: 'de' };
  for (const l of ALL) { const top = irregularTop(l); if (top.length < 100) continue; const n = top.filter(id => isLearned(id)).length; if (n > bestIrr.have || (n === bestIrr.have && l === 'de')) bestIrr = { have: n, lang: l }; }
  out.irregular = { ok: bestIrr.have >= 100, have: bestIrr.have, need: 100, lang: bestIrr.lang };
  const ws = weeks(g.days); out.week = { ok: ws.length > 0 }; out.month = { ok: monthsOfWeeks(ws) };
  const ol = LEVELS.filter(x => g.opened[x]).length; out.explorer = { ok: ol === 6, have: ol, need: 6 };
  return out;
}
let checking = false;
async function check(quiet) {
  if (!A || checking || !A.D.ready) return; checking = true;
  try {
    const reg = await loadRegional(), st = evaluate(reg), P = A.P, fresh = [];
    for (const k in st) if (st[k].ok && !P.badges[k]) { P.badges[k] = { date: day(), lang: st[k].lang || (k.includes(':') ? k.split(':')[1] : undefined) }; fresh.push(k); }
    if (fresh.length) { A.saveP(); if (!quiet && on()) celebrate(fresh); }
    if (!$('#progress').hidden) paint();
  } finally { checking = false; }
}

/* ---------- celebration: star bounce and a soft chime ---------- */
function chime() {
  if (!A.S.sounds || !on()) return;
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ac = chime.ac || (chime.ac = new C()), now = ac.currentTime;
    [[784, 0], [1175, 0.12], [1568, 0.24]].forEach(([f, d]) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + d); g.gain.exponentialRampToValueAtTime(0.12, now + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + d + 0.9);
      o.connect(g); g.connect(ac.destination); o.start(now + d); o.stop(now + d + 1);
    });
  } catch (e) {}
}
function iconHtml(b, cls) { return b.icon.startsWith('flag:') ? `<span class="bicon ${cls || ''}">${A.flag(b.icon.slice(5))}</span>` : /^[ABC]\d$/.test(b.icon) ? `<span class="bicon lvlicon ${b.icon} ${cls || ''}">${b.icon}</span>` : `<span class="bicon ${cls || ''}">${b.icon}</span>`; }
function celebrate(keys) {
  const k = keys[0], b = BADGES.find(x => x.k === k.split(':')[0]); if (!b) return;
  const lang = k.split(':')[1] || (A.P.badges[k] && A.P.badges[k].lang);
  const el = $('#badge-pop');
  el.innerHTML = `${iconHtml(b, A.animOn() ? 'pop' : '')}<div><b>${esc(t('pg.unlocked', 'Badge earned'))}: ${esc(bname(b))}</b><span>${esc(bdesc(b, lang))}${keys.length > 1 ? ' ' + esc(t('pg.more', '(+{n} more)', { n: keys.length - 1 })) : ''}</span></div><button class="chip" data-pg="open">${esc(t('pg.see', 'See'))}</button><button class="chip" data-pg="pop-close" aria-label="${esc(t('btn.close', 'Close'))}">×</button>`;
  el.hidden = false;
  chime();
  clearTimeout(celebrate.t); celebrate.t = setTimeout(() => { el.hidden = true; }, 9000);
}

/* ---------- the page ---------- */
function heatmap() {
  const g = prog(), today = day(), start = monday(addDays(today, -364));
  let cols = '', d = start, months = '';
  const max = Math.max(1, ...Object.values(g.days));
  let lastMonth = -1, col = 0;
  while (d <= today) {
    let cells = '';
    const m = parseDay(d).getMonth();
    if (m !== lastMonth) { months += `<span style="grid-column:${col + 1}">${esc(parseDay(d).toLocaleDateString(A.S.ui, { month: 'short' }))}</span>`; lastMonth = m; }
    for (let i = 0; i < 7; i++) {
      const x = addDays(d, i), n = g.days[x] || 0;
      const lvl = x > today ? -1 : n === 0 ? 0 : n < max * 0.25 ? 1 : n < max * 0.5 ? 2 : n < max * 0.75 ? 3 : 4;
      cells += lvl < 0 ? '<i class="hm-x"></i>' : `<i class="hm${lvl}" title="${esc(parseDay(x).toLocaleDateString(A.S.ui, { dateStyle: 'medium' }))}: ${esc(t('pg.answers', '{n} answers', { n }))}"></i>`;
    }
    cols += `<div class="hm-col">${cells}</div>`;
    d = addDays(d, 7); col++;
  }
  return `<div class="hm-wrap" id="hm-wrap"><div class="hm-months" style="grid-template-columns:repeat(${col},14px)">${months}</div><div class="hm-grid">${cols}</div></div>
    <div class="hm-legend"><span>${esc(t('pg.less', 'less'))}</span><i class="hm0"></i><i class="hm1"></i><i class="hm2"></i><i class="hm3"></i><i class="hm4"></i><span>${esc(t('pg.more2', 'more'))}</span> · ${esc(t('pg.days', '{n} practice days in the last 12 months', { n: Object.keys(g.days).filter(x => x >= start && g.days[x] > 0).length }))} · ${esc(t('pg.streak', 'longest streak {n} days', { n: longestStreak(g.days) }))}</div>`;
}
function langsHtml() {
  const g = prog(), lv = coreLevels();
  return `<div class="pg-langs">${ALL.map(l => {
    const n = learnedIds().filter(id => id.startsWith(l + ':')).length;
    const m = Object.keys(g.words).filter(id => id.startsWith(l + ':') && !isLearned(id) && g.words[id].d.length).length;   // right on 1 or 2 days so far
    const bars = LEVELS.filter(x => lv[l][x].size).map(x => { const ids = lv[l][x]; let k = 0, h = 0; for (const id of ids) { const w = g.words[id]; if (isLearned(id)) k++; else if (w && w.d.length) h++; }
      const p = 100 * k / ids.size, q = 100 * h / ids.size, vis = v => v > 0 ? Math.max(v, 1.5) : 0;
      return `<div class="pg-bar"><span class="lvl sm ${x}">${x}</span><div class="pg-track" role="progressbar" aria-valuenow="${k}" aria-valuemax="${ids.size}" aria-label="${x}"><div style="width:${vis(p)}%"></div><div class="half" style="width:${vis(q)}%"></div></div><span class="pg-num">${A.num(k)} / ${A.num(ids.size)}${h ? `<small title="${esc(t('pg.half.tip', 'Answered right on 1 or 2 days so far'))}"> +${A.num(h)}</small>` : ''}</span></div>`; }).join('');
    return `<div class="pg-lang"><div class="pg-lang-h">${A.flag(A.S.main[l])}<b>${esc(A.LNAME[l])}</b><span>${esc((n === 1 ? t('pg.learned1', '1 word learned') : t('pg.learned', '{n} words learned', { n: A.num(n) })))}${m ? `<br><i>${esc(t('pg.half', '{n} on the way', { n: A.num(m) }))}</i>` : ''}</span></div>${bars}</div>`;
  }).join('')}</div>`;
}
function badgeTile(b, st) {
  const P = A.P;
  if (b.per) {
    const any = ALL.some(l => P.badges[b.k + ':' + l]);
    return `<div class="badge ${any ? 'on' : 'off'}">${iconHtml(b)}<div class="bt"><b>${esc(bname(b))}</b><span>${esc(any ? t('bd.' + b.k + '.g', b.gen) : bhint(b))}</span>
      <div class="bl">${ALL.map(l => { const x = P.badges[b.k + ':' + l], s = st[b.k + ':' + l] || {}; return `<span class="bll ${x ? 'on' : ''}" title="${esc(A.LNAME[l])}${x ? ' · ' + esc(parseDay(x.date).toLocaleDateString(A.S.ui, { dateStyle: 'medium' })) : s.need ? ' · ' + A.num(s.have) + ' / ' + A.num(s.need) : ''}">${A.flag(A.S.main[l], true)}${x ? `<small>${esc(parseDay(x.date).toLocaleDateString(A.S.ui, { day: 'numeric', month: 'short', year: '2-digit' }))}</small>${shareBtn(b.k + ':' + l)}` : s.need ? `<small>${A.num(s.have)}/${A.num(s.need)}</small>` : ''}</span>`; }).join('')}</div></div></div>`;
  }
  const x = P.badges[b.k], s = st[b.k] || {};
  return `<div class="badge ${x ? 'on' : 'off'}">${iconHtml(b)}<div class="bt"><b>${esc(bname(b))}</b><span>${esc(x ? bdesc(b, x.lang) : bhint(b))}</span>${x ? `<small>${esc(t('pg.earned', 'Earned {d}', { d: parseDay(x.date).toLocaleDateString(A.S.ui, { dateStyle: 'medium' }) }))} ${shareBtn(b.k)}</small>` : s.need ? `<small>${A.num(s.have)} / ${A.num(s.need)}</small>` : ''}</div></div>`;
}
const shareBtn = k => `<button class="lnk shareb" data-pg="share" data-k="${esc(k)}">${esc(t('pg.share', 'Share'))}</button>`;
function yearData(y) {
  const g = prog(), from = y + '-01-01', to = y + '-12-31';
  const per = {}; ALL.forEach(l => { per[l] = 0; });
  let total = 0, top = null;
  for (const id in g.words) { const w = g.words[id]; if (w.l && w.l >= from && w.l <= to) { per[id.slice(0, 2)]++; total++; } if (!top || w.n > g.words[top].n) top = id; }
  for (const [id, k] of Object.entries(A.P.known || {})) { const w = g.words[id], d = day(k.t); if (!(w && w.l) && d >= from && d <= to && per[id.slice(0, 2)] != null) { per[id.slice(0, 2)]++; total++; } }
  const badges = Object.entries(A.P.badges).filter(([, v]) => v.date >= from && v.date <= to).map(([k]) => k);
  const topE = top && A.D.byId.get(top);
  return { y, total, per, streak: longestStreak(g.days, from, to), badges, top: top ? { id: top, w: topE ? A.withTo(top, topE.lemma) : top.split(':')[1], n: g.words[top].n } : null };
}
function yearHtml(y) {
  const d = yearData(y);
  return `<div class="yr"><h3>${esc(t('yr.title', 'Your {y}', { y }))}</h3><p class="yr-big">${t('yr.words', 'In {y} you learned <b>{n}</b> words.', { y, n: A.num(d.total) })}</p>
    <div class="yr-row">${ALL.map(l => `<span>${A.flag(A.S.main[l], true)}${esc(A.LNAME[l])}: <b>${A.num(d.per[l])}</b></span>`).join('')}</div>
    <div class="yr-row"><span>${esc(t('yr.streak', 'Longest streak'))}: <b>${esc(t('yr.days', '{n} days', { n: d.streak }))}</b></span><span>${esc(t('yr.badges', 'Badges earned'))}: <b>${d.badges.length}</b></span>${d.top ? `<span>${esc(t('yr.top', 'Most practised word'))}: <b lang="${d.top.id.slice(0, 2)}">${esc(d.top.w)}</b></span>` : ''}</div>
    <button class="btn sm" data-pg="share-year" data-y="${y}">${esc(t('pg.share.img', 'Share as an image'))}</button></div>`;
}
function testHtml() {
  return `<details class="pg-test" open><summary>Test mode (hidden: open the app with ?progress-test)</summary><p class="hint">Each button adds practice data that earns the badge, then checks the badges.</p><div class="chips">${BADGES.map(b => `<button class="chip" data-pg="test" data-k="${b.k}">${esc(b.name)}</button>`).join('')}<button class="chip" data-pg="test-year">Yearly summary data</button><button class="chip" data-pg="test-reset">Reset progress</button></div></details>`;
}
async function paint() {
  const el = $('#progress'); if (!el || el.hidden) return;
  if (!A.D.ready) { el.innerHTML = `<h2>${esc(t('nav.progress', 'Progress'))}</h2><p class="hint">${esc(t('msg.loading', 'The dictionary data is still loading.'))}</p>`; return; }
  const reg = await loadRegional(), st = evaluate(reg), now = new Date();
  const showYear = now.getMonth() === 0 || TEST;
  const nEarned = Object.keys(A.P.badges).length;
  el.innerHTML = `<h2>${esc(t('nav.progress', 'Progress'))}</h2>
    <p class="hint">${esc(t('pg.intro2', 'A word counts as learned when you mark it “I know this” or answer it right in practice on 3 different days; the light part of each bar shows words on the way (right on 1 or 2 days so far).'))}</p>
    ${TEST ? testHtml() : ''}
    ${showYear ? yearHtml(now.getMonth() === 0 && !TEST ? now.getFullYear() - 1 : (TEST ? now.getFullYear() : now.getFullYear() - 1)) : ''}
    <h3 class="grp">${esc(t('pg.words', 'Words learned'))}</h3>${langsHtml()}
    <h3 class="grp">${esc(t('pg.cal', 'Practice days'))}</h3>${heatmap()}
    <h3 class="grp">${esc(t('pg.badges', 'Badges'))} <small class="hint">${nEarned} / ${BADGES.filter(b => !b.per).length + BADGES.filter(b => b.per).length * 4}</small></h3>
    ${GROUPS.map(([g, n]) => { const bs = BADGES.filter(b => b.g === g); return bs.length ? `<h4 class="pg-g">${esc(t('pg.g.' + g, n))}</h4><div class="badges">${bs.map(b => badgeTile(b, st)).join('')}</div>` : ''; }).join('')}`;
  const w = $('#hm-wrap'); if (w) w.scrollLeft = w.scrollWidth;
}

/* ---------- share images ---------- */
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function wrap(c, text, x, y, maxW, lh) { const words = String(text).split(' '); let line = ''; for (const w of words) { const tl = line ? line + ' ' + w : w; if (c.measureText(tl).width > maxW && line) { c.fillText(line, x, y); line = w; y += lh; } else line = tl; } if (line) c.fillText(line, x, y); return y + lh; }
const URL_ = 'glossarium-app.ch';
async function flagImg(code) {
  const svg = A.flag(code).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"');
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await new Promise(r => { img.onload = r; img.onerror = r; }); return img;
}
async function frame(c, W, H) {
  try { await document.fonts.ready; } catch (e) {}
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2a2e8f'); g.addColorStop(1, '#141633');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(W * (0.15 + i * 0.25), H * 0.08, 140, 0, 7); c.fill(); }
  const codes = ['us', 'de', 'fr', 'br'];
  for (let i = 0; i < 4; i++) { const im = await flagImg(codes[i]); c.save(); roundRect(c, W / 2 - 230 + i * 120, H - 230, 100, 66, 10); c.clip(); try { c.drawImage(im, W / 2 - 230 + i * 120, H - 230, 100, 66); } catch (e) {} c.restore(); }
  c.fillStyle = '#ffffff'; c.textAlign = 'center';
  c.font = '600 46px "Source Serif 4", Georgia, serif'; c.fillText('Glossarium', W / 2, H - 110);
  c.font = '400 32px "IBM Plex Sans", Arial, sans-serif'; c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillText(URL_, W / 2, H - 60);
}
async function badgeImage(k, withDate) {
  const b = BADGES.find(x => x.k === k.split(':')[0]), x = A.P.badges[k] || {}, lang = k.split(':')[1] || x.lang;
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  await frame(c, W, H);
  c.fillStyle = 'rgba(255,255,255,0.10)'; c.beginPath(); c.arc(W / 2, 470, 230, 0, 7); c.fill();
  c.strokeStyle = '#f4c542'; c.lineWidth = 10; c.beginPath(); c.arc(W / 2, 470, 230, 0, 7); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (b.icon.startsWith('flag:')) { const im = await flagImg(b.icon.slice(5)); c.save(); roundRect(c, W / 2 - 150, 370, 300, 200, 24); c.clip(); try { c.drawImage(im, W / 2 - 150, 370, 300, 200); } catch (e) {} c.restore(); }
  else if (/^[ABC]\d$/.test(b.icon)) { c.fillStyle = '#ffffff'; c.font = '700 190px "IBM Plex Mono", monospace'; c.fillText(b.icon, W / 2, 480); }
  else { c.font = '220px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.fillText(b.icon, W / 2, 485); }
  c.textBaseline = 'alphabetic'; c.fillStyle = '#ffffff';
  c.font = '700 72px "Source Serif 4", Georgia, serif'; let y = wrap(c, bname(b), W / 2, 820, W - 160, 84);
  c.font = '400 40px "IBM Plex Sans", Arial, sans-serif'; c.fillStyle = 'rgba(255,255,255,0.85)';
  y = wrap(c, bdesc(b, lang), W / 2, y + 10, W - 200, 54);
  if (withDate && x.date) { c.font = '500 34px "IBM Plex Mono", monospace'; c.fillStyle = '#f4c542'; c.fillText(parseDay(x.date).toLocaleDateString(A.S.ui, { dateStyle: 'long' }), W / 2, y + 30); }
  return cv;
}
async function yearImage(y) {
  const d = yearData(y), W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  await frame(c, W, H);
  c.textAlign = 'center'; c.fillStyle = '#f4c542'; c.font = '600 44px "IBM Plex Mono", monospace'; c.fillText(t('yr.title', 'Your {y}', { y }), W / 2, 230);
  c.fillStyle = '#ffffff'; c.font = '700 84px "Source Serif 4", Georgia, serif';
  wrap(c, t('yr.words.plain', 'In {y} you learned {n} words', { y, n: A.num(d.total) }), W / 2, 360, W - 140, 96);
  let yy = 590;
  for (const l of ALL) { const im = await flagImg(A.S.main[l]); c.save(); roundRect(c, 250, yy - 40, 66, 44, 6); c.clip(); try { c.drawImage(im, 250, yy - 40, 66, 44); } catch (e) {} c.restore();
    c.textAlign = 'left'; c.font = '400 42px "IBM Plex Sans", Arial, sans-serif'; c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillText(A.LNAME[l], 340, yy);
    c.textAlign = 'right'; c.font = '700 46px "IBM Plex Sans", Arial, sans-serif'; c.fillStyle = '#ffffff'; c.fillText(A.num(d.per[l]), 830, yy); yy += 72; }
  c.textAlign = 'center'; c.font = '400 38px "IBM Plex Sans", Arial, sans-serif'; c.fillStyle = 'rgba(255,255,255,0.9)';
  c.fillText(t('yr.streak', 'Longest streak') + ': ' + t('yr.days', '{n} days', { n: d.streak }) + '  ·  ' + t('yr.badges', 'Badges earned') + ': ' + d.badges.length, W / 2, yy + 30);
  if (d.top) c.fillText(t('yr.top', 'Most practised word') + ': ' + d.top.w, W / 2, yy + 90);
  return cv;
}
async function shareCanvas(cv, name, text) {
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], name, { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: text + ' https://' + URL_ + '/' }); return 'shared'; } } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
  return 'downloaded';
}
async function openShare(kind, key) {
  const el = $('#share-box'); el.hidden = false;
  const draw = async () => {
    const withDate = $('#sh-date') ? $('#sh-date').checked : true;
    const cv = kind === 'year' ? await yearImage(+key) : await badgeImage(key, withDate);
    const prev = $('#sh-prev'); prev.innerHTML = ''; cv.style.width = '100%'; cv.style.height = 'auto'; prev.appendChild(cv); el._cv = cv;
  };
  el.innerHTML = `<div class="row"><b>${esc(t('pg.share.img', 'Share as an image'))}</b><button class="chip" data-pg="share-close" aria-label="${esc(t('btn.close', 'Close'))}">×</button></div>
    <p class="hint">${esc(t('pg.share.p', 'The image shows the badge, the app name and its link. Nothing else about you, unless you add the date.'))}</p>
    ${kind === 'year' ? '' : `<label class="ck"><input type="checkbox" id="sh-date" checked> ${esc(t('pg.share.date', 'Show the date I earned it'))}</label>`}
    <div id="sh-prev" class="sh-prev"></div>
    <div class="row"><button class="btn primary" data-pg="share-go" data-kind="${kind}" data-k="${esc(key)}">${esc(t('pg.share.go', 'Share or save the image'))}</button></div><p class="hint" id="sh-msg" aria-live="polite"></p>`;
  const cb = $('#sh-date'); if (cb) cb.addEventListener('change', draw);
  await draw();
  el.scrollIntoView({ block: 'nearest' });
}

/* ---------- hidden test mode: data that earns each badge ---------- */
function fakeLearn(ids, onDays) {
  const g = prog(), ds = onDays || [addDays(day(), -2), addDays(day(), -1), day()];
  for (const id of ids) { const w = g.words[id] || (g.words[id] = { d: [], n: 0 }); w.d = ds.slice(-3); w.n += 3; w.l = w.l || ds[ds.length - 1]; for (const d of ds) g.days[d] = (g.days[d] || 0) + 1; }
}
async function testEarn(k) {
  const g = prog(), lang = A.S.learning || 'de', lv = coreLevels(), reg = await loadRegional();
  const core = l => [...A.D.byId.values()].filter(e => e.lang === l && e.tier === 'core' && e.frequency_rank).sort((a, b) => a.frequency_rank - b.frequency_rank).map(e => e.id);
  if (k === 'first-save') { const e = A.D.byId.get(core('de')[50]); A.P.favs[e.id] = { w: e.lemma, t: Date.now() }; }
  else if (k === 'first-quiz') g.quizzes = (g.quizzes || 0) + 1;
  else if (/^m\d+$/.test(k)) fakeLearn(core(lang).slice(0, +k.slice(1)));
  else if (/^l[ABC]\d$/.test(k)) fakeLearn([...lv[lang][k.slice(1)]]);
  else if (k === 'four') { const ids = []; for (const id of core('en')) { const e = A.D.byId.get(id), s = A.visibleSenses(e)[0]; if (!s) continue; const x = ['de', 'fr', 'pt'].map(l => A.trIds(s.s, l)[0]); if (x.every(Boolean)) { ids.push(id, ...x); if (ids.length >= 4 * 110) break; } } fakeLearn(ids); }
  else if (k === 'gender50') { g.best.gender = 50; g.runs.gender = 50; }
  else if (k === 'plural50') { g.best.plural = 50; g.runs.plural = 50; }
  else if (k === 'case50') { g.best.case = 50; g.runs.case = 50; }
  else if (k === 'aux') auxSet().forEach(id => { g.aux[id] = 1; });
  else if (k === 'swiss') fakeLearn(((reg.de || {}).CH || []).slice(0, 50));
  else if (k === 'brazil') fakeLearn(((reg.pt || {}).BR || []).slice(0, 50));
  else if (k === 'irregular') fakeLearn(irregularTop('de'));
  else if (k === 'week') { const m = monday(addDays(day(), -7)); for (let i = 0; i < 6; i++) g.days[addDays(m, i)] = (g.days[addDays(m, i)] || 0) + 5; }
  else if (k === 'month') { const m = monday(addDays(day(), -35)); for (let w = 0; w < 4; w++) for (let i = 0; i < 6; i++) { const d = addDays(m, 7 * w + i); g.days[d] = (g.days[d] || 0) + 4; } }
  else if (k === 'explorer') LEVELS.forEach(x => { g.opened[x] = day(); });
  A.saveP(); await check();
}
function testYear() {
  const y = new Date().getFullYear(), ids = [];
  for (const l of ALL) [...A.D.byId.values()].filter(e => e.lang === l && e.tier === 'core' && e.frequency_rank).sort((a, b) => a.frequency_rank - b.frequency_rank).slice(0, { de: 420, en: 310, fr: 260, pt: 250 }[l]).forEach(e => ids.push(e.id));
  fakeLearn(ids, [y + '-02-03', y + '-02-04', y + '-02-05']);
  const g = prog(); for (let i = 0; i < 23; i++) { const d = addDays(y + '-03-02', i); g.days[d] = (g.days[d] || 0) + 6; }
  const top = A.D.byId.get(ids[3]); if (top) g.words[top.id].n = 57;
  A.saveP(); paint();
}

/* ---------- clicks ---------- */
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-pg]'); if (!b || !A) return;
  const k = b.dataset.pg;
  if (k === 'open') { $('#badge-pop').hidden = true; window.FLTViews.togglePanel('progress', true); $('#progress').scrollIntoView({ block: 'start' }); }
  else if (k === 'pop-close') $('#badge-pop').hidden = true;
  else if (k === 'share') openShare('badge', b.dataset.k);
  else if (k === 'share-year') openShare('year', b.dataset.y);
  else if (k === 'share-close') $('#share-box').hidden = true;
  else if (k === 'share-go') { const cv = $('#share-box')._cv; if (!cv) return; const r = await shareCanvas(cv, b.dataset.kind === 'year' ? 'my-year.png' : 'badge.png', t('pg.share.text', 'Learning with the Four-Language Translator')); $('#sh-msg').textContent = r === 'downloaded' ? t('pg.share.saved', 'Saved as an image in your downloads.') : ''; }
  else if (k === 'test') testEarn(b.dataset.k);
  else if (k === 'test-year') testYear();
  else if (k === 'test-reset') { A.P.prog = null; A.P.badges = {}; prog(); A.saveP(); paint(); }
});

window.FLTProgress = {
  syncLangs(o) { ALL.length = 0; ALL.push(...o); },
  init(api) { A = api; prog(); },
  dataReady() { setTimeout(() => check(true), 6000); }, // after the first-visit downloads, so the badge check never slows them
  record, quizDone, opened, saved, paint, check, evaluate, BADGES, yearData,
  levelCount(e) {          // for the "I know this" message: how far this word's level bar is now
    const v = A.levelOf(e); if (!v) return null;
    const ids = (coreLevels()[e.lang] || {})[v.l]; if (!ids || !ids.has(e.id)) return null;
    let k = 0; for (const id of ids) if (isLearned(id)) k++;
    return { lvl: v.l, k, n: ids.size };
  },
  set test(v) { TEST = v; }, get test() { return TEST; },
  _testEarn: testEarn, _testYear: testYear, _badgeImage: badgeImage, _yearImage: yearImage
};
})();
