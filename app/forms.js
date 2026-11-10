/* Word forms built by rule. JavaScript port of build/generate_forms.py: both must give the same
   result (build/test/test_forms.js checks every entry).
     FLTForms.forms(entry)         all forms: rules, then the entry's stored irregular_forms
     FLTForms.regularForms(entry)  what a fully regular word would have (used to mark irregular forms red) */
(function (root) {
  'use strict';
  const P = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'];
  const ends = (s, ...a) => a.some(x => s.endsWith(x));
  const six = (prefix, stem, endings) => { const o = {}; P.forEach((p, i) => { o[prefix + '.' + p] = stem + endings[i]; }); return o; };
  const last = s => s.slice(-1);

  /* ------------------------------------------------------------ German */
  function umlaut(s) {
    let m = null, x; const re = /au|a|o|u/g;
    while ((x = re.exec(s))) m = x;
    if (!m) return s;
    return s.slice(0, m.index) + { a: 'ä', o: 'ö', u: 'ü' }[s[m.index]] + s.slice(m.index + 1);
  }
  function deSep(lemma, v) {
    const pp = v.principal_parts || [lemma, null, null];
    const probe = pp[1] || v.present_3sg || '';
    if (probe.includes(' ')) { const t = probe.split(/\s+/).pop(); if (lemma.startsWith(t)) return t; }
    return '';
  }
  function deVerb(lemma, v, irr) {
    const pp = v.principal_parts || [lemma, null, null];
    const past = pp[1], part2 = pp[2];
    const sep = deSep(lemma, v);
    const cut = f => (sep && f && f.endsWith(' ' + sep)) ? f.slice(0, -(sep.length + 1)) : f;
    const base = lemma.slice(sep.length);
    const stem = base.endsWith('en') ? base.slice(0, -2) : base.slice(0, -1);
    const eln = ends(base, 'eln', 'ern');
    const eins = ('dt'.includes(last(stem)) || /[^aeiouäöüylrhmn][mn]$/.test(stem)) && !eln;
    const sib = ends(stem, 's', 'ß', 'z', 'x');
    const e = eins ? 'e' : '';
    const reg3 = stem + e + 't';
    let f = {};
    const p3 = cut(irr['praes.3sg'] || v.present_3sg || reg3);
    let one = base.endsWith('eln') ? stem.slice(0, -2) + last(stem) + 'e' : stem + 'e';
    let p2;
    if (p3 === reg3) p2 = stem + e + (sib ? 't' : 'st');
    else if (!p3.endsWith('t') || v.class === 'preterite-present') { one = p3; p2 = p3 + (ends(p3, 's', 'ß', 'z', 'x') ? 't' : 'st'); }
    else if ('dt'.includes(last(stem)) && !p3.endsWith('et')) p2 = p3 + 'st';
    else p2 = p3.slice(0, -1) + (ends(p3.slice(0, -1), 's', 'ß', 'z', 'x') ? 't' : 'st');
    one = cut(irr['praes.1sg'] || one); p2 = cut(irr['praes.2sg'] || p2);
    Object.assign(f, { 'praes.1sg': one, 'praes.2sg': p2, 'praes.3sg': p3, 'praes.1pl': base, 'praes.2pl': stem + e + 't', 'praes.3pl': base });
    const pt = cut(irr['praet.1sg'] || past);
    const weakpast = !!pt && pt.endsWith('te');
    if (pt) {
      if (weakpast) Object.assign(f, six('praet', pt, ['', 'st', '', 'n', 't', 'n']));
      else {
        const dt = 'dt'.includes(last(pt)), sb = ends(pt, 's', 'ß', 'z', 'x');
        Object.assign(f, six('praet', pt, ['', (dt || sb) ? 'est' : 'st', '', 'en', dt ? 'et' : 't', 'en']));
      }
    }
    const k1 = base.endsWith('eln') ? stem.slice(0, -2) + last(stem) : stem;
    Object.assign(f, six('konj1', k1, ['e', 'est', 'e', 'en', 'et', 'en']));
    if (ends(base, 'eln', 'ern')) { f['konj1.1pl'] = base; f['konj1.3pl'] = base; }
    let k2 = cut(irr['konj2.1sg']);
    if (!k2 && pt) k2 = (weakpast && v.class === 'weak') ? pt : (weakpast ? umlaut(pt) : umlaut(pt) + 'e');
    if (k2) Object.assign(f, six('konj2', k2, ['', 'st', '', 'n', 't', 'n']));
    let imp;
    if (p3 !== reg3 && p3.endsWith('t') && /e[^aeiouäöü]*$/.test(stem) && /i/.test(p3) && !/i/.test(stem)) {
      imp = (ends(p2.slice(0, -1), 's', 'ß', 'z', 'x') && !p2.endsWith('st')) ? p2.slice(0, -1) : (p2.endsWith('st') ? p2.slice(0, -2) : p2.slice(0, -1));
      if (p2.endsWith('sst') || p2.endsWith('ßt')) imp = p2.slice(0, -1);
    } else if (base.endsWith('eln')) imp = stem.slice(0, -2) + last(stem) + 'e';
    else if (eins || base.endsWith('ern') || stem.endsWith('ig')) imp = stem + 'e';
    else imp = stem;
    f['imp.sg'] = imp; f['imp.pl'] = f['praes.2pl'];
    if (sep) { const g = {}; for (const k in f) g[k] = f[k] + ' ' + sep; f = g; }
    f.inf = lemma; f.part1 = lemma + 'd';
    if (part2) f.part2 = part2;
    return f;
  }
  function deWeakParts(lemma, v) {          // principal parts a weak verb of this shape would have
    const sep = deSep(lemma, v);
    const base = lemma.slice(sep.length);
    const stem = base.endsWith('en') ? base.slice(0, -2) : base.slice(0, -1);
    const eln = ends(base, 'eln', 'ern');
    const e = (('dt'.includes(last(stem)) || /[^aeiouäöüylrhmn][mn]$/.test(stem)) && !eln) ? 'e' : '';
    const noge = base.endsWith('ieren') || (!sep && /^(be|ge|er|ver|zer|ent|emp|miss)/.test(base));
    return [lemma, stem + e + 'te' + (sep ? ' ' + sep : ''), sep + (noge ? '' : 'ge') + stem + e + 't'];
  }
  function deNoun(lemma, n) {
    const g = n.gender, gen = n.genitive, pl = n.plural, f = {};
    if (gen || g) {
      Object.assign(f, { 'nom.sg': lemma, 'acc.sg': lemma, 'dat.sg': lemma });
      if (gen) f['gen.sg'] = gen;
      if (g === 'm' && gen && gen !== lemma && gen.endsWith('n') && gen === (lemma.endsWith('e') ? lemma + 'n' : gen) && (gen === lemma + 'n' || gen === lemma + 'en')) { f['acc.sg'] = gen; f['dat.sg'] = gen; }
      else if (g === 'm' && gen && gen.endsWith('ns') && gen.slice(0, -1) === lemma + 'n') { f['acc.sg'] = gen.slice(0, -1); f['dat.sg'] = gen.slice(0, -1); }
    }
    if (pl) Object.assign(f, { 'nom.pl': pl, 'acc.pl': pl, 'gen.pl': pl, 'dat.pl': ends(pl, 'n', 's') ? pl : pl + 'n' });
    return f;
  }
  const DE_END = {
    strong: { nom: ['er', 'e', 'es', 'e'], gen: ['en', 'er', 'en', 'er'], dat: ['em', 'er', 'em', 'en'], acc: ['en', 'e', 'es', 'e'] },
    weak: { nom: ['e', 'e', 'e', 'en'], gen: ['en', 'en', 'en', 'en'], dat: ['en', 'en', 'en', 'en'], acc: ['en', 'e', 'e', 'en'] },
    mixed: { nom: ['er', 'e', 'es', 'en'], gen: ['en', 'en', 'en', 'en'], dat: ['en', 'en', 'en', 'en'], acc: ['en', 'e', 'es', 'en'] }
  };
  function deAdjStem(w) {
    if (w === 'hoch') return 'hoh';
    if (w.endsWith('e')) return w.slice(0, -1);
    if (/[^aeiouäöü]el$/.test(w)) return w.slice(0, -2) + 'l';
    if (/(au|eu|äu)er$/.test(w)) return w.slice(0, -2) + 'r';
    return w;
  }
  function deAdjRule(lemma) {
    const st = deAdjStem(lemma);
    return [st + 'er', 'am ' + (lemma.endsWith('e') ? st : lemma) + (/(d|t|s|ß|z|x|sch)$/.test(st) ? 'esten' : 'sten')];
  }
  function deAdj(lemma, a, irr) {
    const st = deAdjStem(lemma), r = deAdjRule(lemma);
    const f = { comp: irr.comp || r[0], sup: irr.sup || r[1] };
    if (a.comparison) { f.comp = irr.comp || a.comparison[0]; f.sup = irr.sup || a.comparison[1]; }
    const stems = { pos: st, comp: f.comp, sup: f.sup.replace(/^am /, '').slice(0, -2) };
    for (const deg in stems) for (const typ in DE_END) for (const c in DE_END[typ])
      ['m', 'f', 'n', 'pl'].forEach((g, i) => { f[deg + '.' + typ + '.' + c + '.' + g] = stems[deg] + DE_END[typ][c][i]; });
    return f;
  }

  /* ------------------------------------------------------------ English */
  const enDouble = w => /^[^aeiou]*[aeiou][^aeiouwxy]$/.test(w);
  function enS(w) {
    if (/(s|x|z|ch|sh)$/.test(w) || /[^aeiou]o$/.test(w)) return w + 'es';
    if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
    return w + 's';
  }
  function enVerb(lemma, v) {
    const i = lemma.indexOf(' ');
    const head = i < 0 ? lemma : lemma.slice(0, i), tail = i < 0 ? '' : ' ' + lemma.slice(i + 1);
    const pp = v.principal_parts || [lemma, null, null];
    let ing, ed;
    if (head.endsWith('ie')) ing = head.slice(0, -2) + 'ying';
    else if (head.endsWith('e') && !ends(head, 'ee', 'ye', 'oe')) ing = head.slice(0, -1) + 'ing';
    else if (enDouble(head)) ing = head + last(head) + 'ing';
    else ing = head + 'ing';
    if (head.endsWith('e')) ed = head + 'd';
    else if (/[^aeiou]y$/.test(head)) ed = head.slice(0, -1) + 'ied';
    else if (enDouble(head)) ed = head + last(head) + 'ed';
    else ed = head + 'ed';
    return { '3sg': enS(head) + tail, ing: ing + tail, past: pp[1] || ed + tail, pp: pp[2] || ed + tail };
  }
  const enNoun = (lemma, n) => ({ pl: n.plural || enS(lemma) });
  function enAdjRule(w) {
    const syl = (w.replace(/e$/, '').match(/[aeiouy]+/g) || []).length;
    if (w.includes(' ') || w.includes('-')) return ['more ' + w, 'most ' + w];
    if (syl <= 1 && !ends(w, 'ed', 'ing')) {
      if (w.endsWith('e')) return [w + 'r', w + 'st'];
      if (enDouble(w)) return [w + last(w) + 'er', w + last(w) + 'est'];
      if (/[^aeiou]y$/.test(w)) return [w.slice(0, -1) + 'ier', w.slice(0, -1) + 'iest'];
      return [w + 'er', w + 'est'];
    }
    if (syl === 2 && /[^aeiou]y$/.test(w)) return [w.slice(0, -1) + 'ier', w.slice(0, -1) + 'iest'];
    return ['more ' + w, 'most ' + w];
  }
  function enAdj(lemma, a) {
    const r = a.comparison || enAdjRule(lemma);
    return { comp: r[0], sup: r[1] };
  }

  /* ------------------------------------------------------------ French */
  function frSoft(stem, ending) {
    if ('aoâ'.includes(ending.slice(0, 1)) && ending) {
      if (stem.endsWith('g')) return stem + 'e' + ending;
      if (stem.endsWith('c')) return stem.slice(0, -1) + 'ç' + ending;
    }
    return stem + ending;
  }
  function frVerb(lemma, v, irr) {
    const pp = v.principal_parts || [lemma, null, null];
    const p1 = irr['pres.1sg'] || pp[1]; let part = irr.pp || pp[2];
    const cls = v.class || '';
    const f = { inf: lemma };
    const er = lemma.endsWith('er') && cls.startsWith('1st');
    const ir2 = cls.startsWith('2nd');
    let st, futstem, ps;
    if (er) {
      st = lemma.slice(0, -2);
      const s1 = (p1 && p1.endsWith('e')) ? p1.slice(0, -1) : st;
      Object.assign(f, { 'pres.1sg': s1 + 'e', 'pres.2sg': s1 + 'es', 'pres.3sg': s1 + 'e', 'pres.1pl': frSoft(st, 'ons'), 'pres.2pl': st + 'ez', 'pres.3pl': s1 + 'ent' });
      futstem = (s1 === st || /é[^aeiouéè]+$/.test(st)) ? lemma : s1 + 'er';
      ps = frSoft(st, 'ai'); part = part || st + 'é';
    } else if (ir2) {
      st = lemma.slice(0, -2);
      Object.assign(f, { 'pres.1sg': st + 'is', 'pres.2sg': st + 'is', 'pres.3sg': st + 'it', 'pres.1pl': st + 'issons', 'pres.2pl': st + 'issez', 'pres.3pl': st + 'issent' });
      futstem = lemma; ps = st + 'is'; part = part || st + 'i';
    } else {
      st = lemma.endsWith('oir') ? lemma.slice(0, -3) : lemma.slice(0, -2);
      const one = p1 || st + 's'; let two, three;
      if (one.endsWith('e')) { two = one + 's'; three = one; }
      else if (one.endsWith('x')) { two = one; three = one.slice(0, -1) + 't'; }
      else if (one.endsWith('s')) { two = one; three = ends(one.slice(0, -1), 'd', 't', 'c') ? one.slice(0, -1) : one.slice(0, -1) + 't'; }
      else { two = one + 's'; three = one; }
      Object.assign(f, { 'pres.1sg': one, 'pres.2sg': two, 'pres.3sg': three, 'pres.1pl': frSoft(st, 'ons'), 'pres.2pl': st + 'ez', 'pres.3pl': st + 'ent' });
      futstem = lemma.endsWith('re') ? lemma.slice(0, -1) : lemma;
      if (part && part.endsWith('u') && !ends(lemma, 'dre', 'pre', 'cre')) ps = part + 's';
      else if (part && part.endsWith('i')) ps = part + 's';
      else ps = st + 'is';
      part = part || (lemma.endsWith('re') ? st + 'u' : st + 'i');
    }
    for (const k of ['pres.2sg', 'pres.3sg', 'pres.1pl', 'pres.2pl', 'pres.3pl']) if (irr[k]) f[k] = irr[k];
    const n = f['pres.1pl'];
    let ns = n.endsWith('ons') ? n.slice(0, -3) : st;
    ns = ns.endsWith('ge') ? ns.slice(0, -1) : (ns.endsWith('ç') ? ns.slice(0, -1) + 'c' : ns);
    if (!irr['pres.2pl'] && !er && !ir2) f['pres.2pl'] = ns + 'ez';
    if (!irr['pres.3pl'] && !er && !ir2) f['pres.3pl'] = ns + 'ent';
    P.forEach((p, i) => { f['impf.' + p] = frSoft(ns, ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'][i]); });
    f.ppres = frSoft(ns, 'ant');
    const t = f['pres.3pl'], ss = t.endsWith('ent') ? t.slice(0, -3) : ns;
    Object.assign(f, { 'subj.1sg': ss + 'e', 'subj.2sg': ss + 'es', 'subj.3sg': ss + 'e', 'subj.1pl': f['impf.1pl'], 'subj.2pl': f['impf.2pl'], 'subj.3pl': ss + 'ent' });
    const fu = irr['fut.1sg']; if (fu && fu.endsWith('ai')) futstem = fu.slice(0, -2);
    Object.assign(f, six('fut', futstem, ['ai', 'as', 'a', 'ons', 'ez', 'ont']));
    Object.assign(f, six('cond', futstem, ['ais', 'ais', 'ait', 'ions', 'iez', 'aient']));
    ps = irr['ps.1sg'] || ps;
    if (ps.endsWith('ai')) {
      const b = ps.slice(0, -2);
      Object.assign(f, six('ps', b, ['ai', 'as', 'a', 'âmes', 'âtes', 'èrent']));
      const b2 = b.endsWith('ge') ? b.slice(0, -1) : (b.endsWith('ç') ? b.slice(0, -1) + 'c' : b);
      f['ps.3pl'] = b2 + 'èrent';
      Object.assign(f, six('subjimpf', b, ['asse', 'asses', 'ât', 'assions', 'assiez', 'assent']));
    } else if (ps.endsWith('ins')) {
      const b = ps.slice(0, -3);
      Object.assign(f, six('ps', b, ['ins', 'ins', 'int', 'înmes', 'întes', 'inrent']));
      Object.assign(f, six('subjimpf', b, ['insse', 'insses', 'înt', 'inssions', 'inssiez', 'inssent']));
    } else {
      const b = ps.slice(0, -2), vw = ps.slice(-2, -1);
      const hat = { i: 'î', u: 'û' }[vw] || vw;
      Object.assign(f, six('ps', b, [vw + 's', vw + 's', vw + 't', hat + 'mes', hat + 'tes', vw + 'rent']));
      Object.assign(f, six('subjimpf', b, [vw + 'sse', vw + 'sses', hat + 't', vw + 'ssions', vw + 'ssiez', vw + 'ssent']));
    }
    f['imp.2sg'] = f['pres.1sg'].endsWith('e') ? f['pres.1sg'] : f['pres.2sg'];
    f['imp.1pl'] = f['pres.1pl']; f['imp.2pl'] = f['pres.2pl'];
    if (part) f.pp = part;
    return f;
  }
  function frPlural(w) {
    if (ends(w, 's', 'x', 'z')) return w;
    if (ends(w, 'eau', 'au', 'eu')) return w + 'x';
    if (w.endsWith('al')) return w.slice(0, -2) + 'aux';
    return w + 's';
  }
  function frFem(w) {
    for (const [a, b] of [['er', 'ère'], ['eux', 'euse'], ['if', 'ive'], ['el', 'elle'], ['ien', 'ienne'], ['on', 'onne'], ['et', 'ette'], ['eur', 'euse'], ['c', 'che']])
      if (w.endsWith(a) && a !== 'c') return w.slice(0, -a.length) + b;
    return w.endsWith('e') ? w : w + 'e';
  }
  const frNoun = lemma => ({ pl: frPlural(lemma) });
  function frAdj(lemma, a, irr) {
    const fem = irr['f.sg'] || frFem(lemma);
    return { 'f.sg': fem, 'm.pl': frPlural(lemma), 'f.pl': fem + 's' };
  }

  /* ------------------------------------------------------------ Portuguese */
  const ACC = { a: 'á', e: 'é', i: 'í', o: 'ô', u: 'ú' };
  function ptSoft(stem, ending, conj) {
    const v = ending.slice(0, 1);
    if (conj === 'ar' && v && 'eé'.includes(v)) {
      if (stem.endsWith('c')) return stem.slice(0, -1) + 'qu' + ending;
      if (stem.endsWith('ç')) return stem.slice(0, -1) + 'c' + ending;
      if (stem.endsWith('g')) return stem + 'u' + ending;
    }
    if (conj !== 'ar' && v && 'ao'.includes(v)) {
      if (stem.endsWith('gu')) return stem.slice(0, -1) + ending;
      if (stem.endsWith('c')) return stem.slice(0, -1) + 'ç' + ending;
      if (stem.endsWith('g')) return stem.slice(0, -1) + 'j' + ending;
    }
    return stem + ending;
  }
  function ptVerb(lemma, v, irr) {
    const pp = v.principal_parts || [lemma, null, null, null];
    const l2 = lemma.slice(-2);
    const conj = ['ar', 'er', 'ir'].includes(l2) ? l2 : 'er';
    const st = lemma.slice(0, -2), T = conj[0];
    const f = { inf: lemma, ger: st + { a: 'ando', e: 'endo', i: 'indo' }[T], pp: (pp.length > 3 && pp[3]) ? pp[3] : st + (T === 'a' ? 'ado' : 'ido') };
    const p1 = irr['pres.1sg'] || pp[1] || ptSoft(st, 'o', conj);
    const pres = { ar: ['o', 'as', 'a', 'amos', 'ais', 'am'], er: ['o', 'es', 'e', 'emos', 'eis', 'em'], ir: ['o', 'es', 'e', 'imos', 'is', 'em'] }[conj];
    const rh = (conj === 'ar' && p1.endsWith('o') && p1.slice(0, -1) !== st && !ends(p1.slice(0, -1), 'qu', 'gu')) ? p1.slice(0, -1) : st;
    P.forEach((p, i) => { f['pres.' + p] = (['2sg', '3sg', '3pl'].includes(p) ? rh : st) + pres[i]; });
    f['pres.1sg'] = p1;
    Object.assign(f, six('impf', st, T === 'a' ? ['ava', 'avas', 'ava', 'ávamos', 'áveis', 'avam'] : ['ia', 'ias', 'ia', 'íamos', 'íeis', 'iam']));
    for (const k of ['pres.2sg', 'pres.3sg', 'pres.1pl', 'pres.2pl', 'pres.3pl']) if (irr[k]) f[k] = irr[k];
    const pr = irr['pret.1sg'] || (pp.length > 2 ? pp[2] : null) || ptSoft(st, T === 'a' ? 'ei' : 'i', conj);
    const regularPr = pr === ptSoft(st, 'ei', conj) || pr === st + 'i';
    if (regularPr) {
      const e = { a: ['ei', 'aste', 'ou', 'amos', 'astes', 'aram'], e: ['i', 'este', 'eu', 'emos', 'estes', 'eram'], i: ['i', 'iste', 'iu', 'imos', 'istes', 'iram'] }[T];
      P.forEach((p, i) => { f['pret.' + p] = p === '1sg' ? ptSoft(st, e[i], conj) : st + e[i]; });
    } else {
      const b = pr.endsWith('e') ? pr.slice(0, -1) : pr;
      Object.assign(f, { 'pret.1sg': pr, 'pret.2sg': b + 'este', 'pret.3sg': pr, 'pret.1pl': b + 'emos', 'pret.2pl': b + 'estes', 'pret.3pl': b + 'eram' });
    }
    for (const k of ['pret.2sg', 'pret.3sg', 'pret.1pl', 'pret.2pl', 'pret.3pl']) if (irr[k]) f[k] = irr[k];
    const t = f['pret.3pl'], b = t.endsWith('ram') ? t.slice(0, -3) : st + T;
    const vw = b.slice(-1), acc = b.slice(0, -1) + ((vw === 'e' && regularPr) ? 'ê' : (ACC[vw] || vw));
    Object.assign(f, { 'plup.1sg': b + 'ra', 'plup.2sg': b + 'ras', 'plup.3sg': b + 'ra', 'plup.1pl': acc + 'ramos', 'plup.2pl': acc + 'reis', 'plup.3pl': b + 'ram' });
    Object.assign(f, { 'subjimpf.1sg': b + 'sse', 'subjimpf.2sg': b + 'sses', 'subjimpf.3sg': b + 'sse', 'subjimpf.1pl': acc + 'ssemos', 'subjimpf.2pl': acc + 'sseis', 'subjimpf.3pl': b + 'ssem' });
    Object.assign(f, six('subjfut', b, ['r', 'res', 'r', 'rmos', 'rdes', 'rem']));
    Object.assign(f, six('infpers', lemma, ['', 'es', '', 'mos', 'des', 'em']));
    const fu = irr['fut.1sg'], fs = (fu && fu.endsWith('ei')) ? fu.slice(0, -2) : lemma;
    Object.assign(f, six('fut', fs, ['ei', 'ás', 'á', 'emos', 'eis', 'ão']));
    Object.assign(f, six('cond', fs, ['ia', 'ias', 'ia', 'íamos', 'íeis', 'iam']));
    const sj = irr['subj.1sg'];
    const ss = sj ? sj.slice(0, -1) : (p1.endsWith('o') ? p1.slice(0, -1) : st);
    const se = T === 'a' ? ['e', 'es', 'e', 'emos', 'eis', 'em'] : ['a', 'as', 'a', 'amos', 'ais', 'am'];
    P.forEach((p, i) => {
      const bs = (sj || conj !== 'ar' || ['1sg', '2sg', '3sg', '3pl'].includes(p)) ? ss : st;
      f['subj.' + p] = sj ? bs + se[i] : ptSoft(bs, se[i], conj);
    });
    Object.assign(f, { 'imp.2sg': f['pres.3sg'], 'imp.3sg': f['subj.3sg'], 'imp.1pl': f['subj.1pl'], 'imp.2pl': st + { a: 'ai', e: 'ei', i: 'i' }[T], 'imp.3pl': f['subj.3pl'] });
    return f;
  }
  function ptPlural(w) {
    if (w.endsWith('ão')) return w.slice(0, -2) + 'ões';
    if (w.endsWith('m')) return w.slice(0, -1) + 'ns';
    if (ends(w, 'r', 'z')) return w + 'es';
    if (w.endsWith('al')) return w.slice(0, -2) + 'ais';
    if (w.endsWith('el')) return w.slice(0, -2) + 'éis';
    if (w.endsWith('ol')) return w.slice(0, -2) + 'óis';
    if (w.endsWith('ul')) return w.slice(0, -2) + 'uis';
    if (w.endsWith('il')) return w.slice(0, -2) + 'is';
    if (w.endsWith('ês')) return w.slice(0, -2) + 'eses';
    if (w.endsWith('s')) return w;
    return w + 's';
  }
  function ptFem(w) {
    if (w.endsWith('ês')) return w.slice(0, -2) + 'esa';
    if (w.endsWith('or')) return w + 'a';
    if (w.endsWith('ão')) return w.slice(0, -2) + 'ã';
    return w.endsWith('o') ? w.slice(0, -1) + 'a' : w;
  }
  const ptNoun = lemma => ({ pl: ptPlural(lemma) });
  function ptAdj(lemma, a, irr) {
    const fem = irr['f.sg'] || ptFem(lemma);
    return { 'f.sg': fem, 'm.pl': ptPlural(lemma), 'f.pl': ptPlural(fem) };
  }

  const GEN = {
    'de verb': deVerb, 'de noun': deNoun, 'de adjective': deAdj, 'en verb': enVerb, 'en noun': enNoun, 'en adjective': enAdj,
    'fr verb': frVerb, 'fr noun': frNoun, 'fr adjective': frAdj, 'pt verb': ptVerb, 'pt noun': ptNoun, 'pt adjective': ptAdj
  };
  function run(e, blk, irr) {
    const g = GEN[e.lang + ' ' + e.pos];
    if (!g || !blk) return {};
    let out;
    try { out = g(e.lemma, blk, irr); } catch (err) { out = {}; }
    const res = {};
    for (const k in out) if (!k.startsWith('_') && out[k]) res[k] = out[k];
    Object.assign(res, irr);
    return res;
  }
  function forms(e) {
    const blk = e[e.pos];
    return run(e, blk, (blk && blk.irregular_forms) || {});
  }
  function regularForms(e) {
    const blk = e[e.pos];
    if (!blk) return {};
    const b = Object.assign({}, blk, { irregular_forms: {} });
    if (e.pos === 'verb') {
      if (e.lang === 'de') { b.principal_parts = deWeakParts(e.lemma, blk); b.present_3sg = null; b.class = 'weak'; }
      else if (e.lang === 'fr') { b.principal_parts = null; b.class = e.lemma.endsWith('er') ? '1st group' : (e.lemma.endsWith('ir') ? '2nd group' : '3rd group'); }
      else b.principal_parts = null;
      const r = run(e, b, {});
      if (e.lang === 'de') {            // keep the separable prefix on the regular forms
        const sep = deSep(e.lemma, blk);
        if (sep) for (const k in r) if (!['inf', 'part1', 'part2'].includes(k) && !r[k].endsWith(' ' + sep)) r[k] += ' ' + sep;
      }
      return r;
    }
    if (e.pos === 'adjective') {
      if (e.lang === 'de') { b.comparison = null; }
      if (e.lang === 'en') { b.comparison = null; }
      return run(e, b, {});
    }
    if (e.pos === 'noun') {
      if (e.lang === 'en') b.plural = null;
      return run(e, b, {});
    }
    return {};
  }
  const api = { forms, regularForms, deAdjRule, enAdjRule, enS, frPlural, ptPlural };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FLTForms = api;
})(typeof self !== 'undefined' ? self : this);
