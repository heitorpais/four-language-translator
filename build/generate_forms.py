"""Phase 2: build full conjugation, declension and adjective tables from an entry's class and pattern.

  forms(entry)                 -> {slot: form}   rules + the entry's irregular_forms
  forms(entry, use_irregular=False)              rules only

The pattern of a word is what a dictionary prints after the headword:
  German verb    infinitive, 3rd sg present, past, past participle  (helfen: hilft, half, geholfen)
  German noun    gender, genitive singular, plural                  (das Haus, des Hauses, die Häuser)
  adjective      comparative and superlative / feminine and plural
  English verb   base, past, past participle
  French verb    infinitive, 1st sg present, past participle
  Portuguese verb  infinitive, 1st sg present, 1st sg preterite, past participle
Everything else is derived by rule.  A form the rules do not produce is stored in
irregular_forms.  A few stored forms act as keys from which other forms are derived
(French "nous" form -> imperfect; Portuguese "eles" preterite -> three more tenses).

Run:  python3 -I build/generate_forms.py     tests against the Wiktionary tables, stores irregular_forms,
                                              writes build/reports/phase2_*.  (after enrich_with_claude.py)

Slot names.  Persons: 1sg 2sg 3sg 1pl 2pl 3pl.
  de verb: inf part1 part2 praes.* praet.* konj1.* konj2.* imp.sg imp.pl
  de noun: nom.sg acc.sg dat.sg gen.sg nom.pl acc.pl dat.pl gen.pl
  de adj : comp sup  and  pos|comp|sup . strong|weak|mixed . nom|gen|dat|acc . m|f|n|pl
  en     : verb 3sg ing past pp;  noun pl;  adj comp sup
  fr verb: inf ppres pp pres.* impf.* ps.* fut.* cond.* subj.* subjimpf.* imp.2sg imp.1pl imp.2pl
  pt verb: inf ger pp pres.* impf.* pret.* plup.* fut.* cond.* subj.* subjimpf.* subjfut.* infpers.* imp.2sg imp.3sg imp.1pl imp.2pl imp.3pl
  fr/pt  : noun pl;  adj f.sg m.pl f.pl"""
import sys, os, re, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

P = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl']
PT = {'1sg': ('first-person', 'singular'), '2sg': ('second-person', 'singular'), '3sg': ('third-person', 'singular'),
      '1pl': ('first-person', 'plural'), '2pl': ('second-person', 'plural'), '3pl': ('third-person', 'plural')}


def six(prefix, stem, endings):
    return {prefix + '.' + p: stem + e for p, e in zip(P, endings)}


# =============================================================== German
def umlaut(s):
    m = None
    for m in re.finditer(r'au|a|o|u', s): pass
    if not m: return s
    return s[:m.start()] + {'a': 'ä', 'o': 'ö', 'u': 'ü'}[s[m.start()]] + s[m.start() + 1:]


def de_verb(lemma, v, irr):
    pp = (v.get('principal_parts') or [lemma, None, None])
    past, part2 = pp[1], pp[2]
    sep = ''
    probe = past or v.get('present_3sg') or ''
    if ' ' in probe and lemma.startswith(probe.split()[-1]): sep = probe.split()[-1]
    cut = lambda f: f[:-len(sep) - 1] if sep and f and f.endswith(' ' + sep) else f
    base = lemma[len(sep):]
    stem = base[:-2] if base.endswith('en') else base[:-1]
    eln = base.endswith(('eln', 'ern'))
    eins = (stem[-1] in 'dt' or bool(re.search(r'[^aeiouäöüylrhmn][mn]$', stem))) and not eln
    sib = stem.endswith(('s', 'ß', 'z', 'x'))
    e = 'e' if eins else ''
    reg3 = stem + e + 't'
    f = {}
    # ---- present
    p3 = cut(irr.get('praes.3sg') or v.get('present_3sg') or reg3)
    one = stem[:-2] + stem[-1] + 'e' if base.endswith('eln') else stem + 'e'      # handeln -> handle
    if p3 == reg3:
        p2 = stem + e + ('t' if sib else 'st')
    elif not p3.endswith('t') or v.get('class') == 'preterite-present':             # kann, will, weiß, mag
        one = p3; p2 = p3 + ('t' if p3.endswith(('s', 'ß', 'z', 'x')) else 'st')
    elif stem[-1] in 'dt' and not p3.endswith('et'):                               # hält -> hältst
        p2 = p3 + 'st'
    else:                                                                          # hilft -> hilfst, isst -> isst
        p2 = p3[:-1] + ('t' if p3[:-1].endswith(('s', 'ß', 'z', 'x')) else 'st')
    one = cut(irr.get('praes.1sg') or one); p2 = cut(irr.get('praes.2sg') or p2)
    plural = base if (base.endswith('n') and base != 'sein') else base
    f.update({'praes.1sg': one, 'praes.2sg': p2, 'praes.3sg': p3, 'praes.1pl': plural,
              'praes.2pl': stem + e + 't', 'praes.3pl': plural})
    # ---- preterite
    pt = cut(irr.get('praet.1sg') or past)
    weakpast = bool(pt) and pt.endswith('te')
    if pt:
        if weakpast:
            f.update(six('praet', pt, ['', 'st', '', 'n', 't', 'n']))
        else:
            dt = pt[-1] in 'dt'; sb = pt.endswith(('s', 'ß', 'z', 'x'))
            f.update(six('praet', pt, ['', 'est' if dt or sb else 'st', '', 'en', 'et' if dt else 't', 'en']))
    # ---- Konjunktiv I and II
    k1 = stem[:-2] + stem[-1] if base.endswith('eln') else stem
    f.update(six('konj1', k1, ['e', 'est', 'e', 'en', 'et', 'en']))
    if base.endswith(('eln', 'ern')):
        f['konj1.1pl'] = f['konj1.3pl'] = base
    k2 = cut(irr.get('konj2.1sg'))
    if not k2 and pt:
        k2 = pt if (weakpast and v.get('class') == 'weak') else (umlaut(pt) if weakpast else umlaut(pt) + 'e')
    if k2:
        f.update(six('konj2', k2, ['', 'st', '', 'n', 't', 'n']))
    # ---- imperative, participles
    if p3 != reg3 and p3.endswith('t') and re.search(r'e[^aeiouäöü]*$', stem) and re.search(r'i', p3) and not re.search(r'i', stem):
        imp = p2[:-1] if p2[:-1].endswith(('s', 'ß', 'z', 'x')) and not p2.endswith('st') else (p2[:-2] if p2.endswith('st') else p2[:-1])
        if p2.endswith('sst') or p2.endswith('ßt'): imp = p2[:-1]
    elif base.endswith('eln'): imp = stem[:-2] + stem[-1] + 'e'
    elif eins or base.endswith('ern') or stem.endswith('ig'): imp = stem + 'e'
    else: imp = stem
    f['imp.sg'] = imp; f['imp.pl'] = f['praes.2pl']
    if sep: f = {k: x + ' ' + sep for k, x in f.items()}
    f['inf'] = lemma; f['part1'] = lemma + 'd'
    if part2: f['part2'] = part2
    return f


def de_noun(lemma, n, irr):
    g, gen, pl = n.get('gender'), n.get('genitive'), n.get('plural')
    f = {}
    if gen or g:
        f.update({'nom.sg': lemma, 'acc.sg': lemma, 'dat.sg': lemma})
        if gen: f['gen.sg'] = gen
        if g == 'm' and gen and gen != lemma and gen.endswith('n') and gen == (lemma + 'n' if lemma.endswith('e') else gen) and gen in (lemma + 'n', lemma + 'en'):
            f['acc.sg'] = f['dat.sg'] = gen                       # weak masculine: den Menschen, dem Herrn
        elif g == 'm' and gen and gen.endswith('ns') and gen[:-1] == lemma + 'n':
            f['acc.sg'] = f['dat.sg'] = gen[:-1]                  # der Name, des Namens, den Namen
    if pl:
        f.update({'nom.pl': pl, 'acc.pl': pl, 'gen.pl': pl, 'dat.pl': pl if pl.endswith(('n', 's')) else pl + 'n'})
    return f


DE_END = {'strong': {'nom': ('er', 'e', 'es', 'e'), 'gen': ('en', 'er', 'en', 'er'), 'dat': ('em', 'er', 'em', 'en'), 'acc': ('en', 'e', 'es', 'e')},
          'weak': {'nom': ('e', 'e', 'e', 'en'), 'gen': ('en',) * 4, 'dat': ('en',) * 4, 'acc': ('en', 'e', 'e', 'en')},
          'mixed': {'nom': ('er', 'e', 'es', 'en'), 'gen': ('en',) * 4, 'dat': ('en',) * 4, 'acc': ('en', 'e', 'es', 'en')}}


def de_adj_stem(w):
    if w == 'hoch': return 'hoh'
    if w.endswith('e'): return w[:-1]
    if re.search(r'[^aeiouäöü]el$', w): return w[:-2] + 'l'                  # dunkel -> dunkl-
    if re.search(r'(au|eu|äu)er$', w): return w[:-2] + 'r'                   # teuer -> teur-
    return w


def de_adj(lemma, a, irr):
    st = de_adj_stem(lemma)
    f = {'comp': irr.get('comp') or st + 'er',
         'sup': irr.get('sup') or 'am ' + (st if lemma.endswith('e') else lemma) + ('esten' if re.search(r'(d|t|s|ß|z|x|sch)$', st) else 'sten')}
    if a.get('comparison'):
        f['comp'], f['sup'] = irr.get('comp') or a['comparison'][0], irr.get('sup') or a['comparison'][1]
    stems = {'pos': st, 'comp': re.sub(r'(?<=[^aeiouäöü])er$', 'er', f['comp']), 'sup': re.sub(r'^am ', '', f['sup'])[:-2]}
    for deg, s in stems.items():
        for typ, cases in DE_END.items():
            for case, ends in cases.items():
                for gnd, end in zip(('m', 'f', 'n', 'pl'), ends):
                    f['%s.%s.%s.%s' % (deg, typ, case, gnd)] = s + end
    return f


def de_adj_rule(lemma):
    """Regular comparison, used when no pattern is stored (and to tell regular from irregular)."""
    st = de_adj_stem(lemma)
    return st + 'er', 'am ' + (st if lemma.endswith('e') else lemma) + ('esten' if re.search(r'(d|t|s|ß|z|x|sch)$', st) else 'sten')


# =============================================================== English
VOW = 'aeiou'


def en_double(w):
    return bool(re.fullmatch(r'[^aeiou]*[aeiou][^aeiouwxy]', w))                # stop, plan (one syllable, CVC)


def en_s(w):
    if re.search(r'(s|x|z|ch|sh)$', w) or re.search(r'[^aeiou]o$', w): return w + 'es'
    if re.search(r'[^aeiou]y$', w): return w[:-1] + 'ies'
    return w + 's'


# English modal verbs: no -s, no -ing, no participle, no perfect; only a past / conditional form where one exists
MODALS = {'can': 'could', 'may': 'might', 'shall': 'should', 'will': 'would', 'must': None, 'should': None, 'would': None,
          'might': None, 'could': None, 'ought': None}
NEGATIVE = {'can': "cannot / can't", 'could': "could not / couldn't", 'may': 'may not', 'might': "might not / mightn't",
            'must': "must not / mustn't", 'shall': "shall not / shan't", 'should': "should not / shouldn't", 'will': "will not / won't",
            'would': "would not / wouldn't", 'ought': "ought not to / oughtn't to"}


def en_verb(lemma, v, irr):
    if v.get('class') == 'modal':
        pp = v.get('principal_parts') or [lemma, None, None]
        return {k: x for k, x in {'3sg': lemma, 'past': pp[1]}.items() if x}
    head, _, rest = lemma.partition(' ')
    tail = (' ' + rest) if rest else ''
    pp = v.get('principal_parts') or [lemma, None, None]
    if head.endswith('ie'): ing = head[:-2] + 'ying'
    elif head.endswith('e') and not head.endswith(('ee', 'ye', 'oe')): ing = head[:-1] + 'ing'
    elif en_double(head): ing = head + head[-1] + 'ing'
    else: ing = head + 'ing'
    if head.endswith('e'): ed = head + 'd'
    elif re.search(r'[^aeiou]y$', head): ed = head[:-1] + 'ied'
    elif en_double(head): ed = head + head[-1] + 'ed'
    else: ed = head + 'ed'
    return {'3sg': en_s(head) + tail, 'ing': ing + tail, 'past': pp[1] or ed + tail, 'pp': pp[2] or ed + tail,
            '_rule_past': ed + tail}


def en_noun(lemma, n, irr):
    return {'pl': n.get('plural') or en_s(lemma), '_rule_pl': en_s(lemma)}


def en_adj_rule(w):
    syl = len(re.findall(r'[aeiouy]+', re.sub(r'e$', '', w)))
    if ' ' in w or '-' in w: return 'more ' + w, 'most ' + w
    if syl <= 1 and not w.endswith(('ed', 'ing')):
        if w.endswith('e'): return w + 'r', w + 'st'
        if en_double(w): return w + w[-1] + 'er', w + w[-1] + 'est'
        if re.search(r'[^aeiou]y$', w): return w[:-1] + 'ier', w[:-1] + 'iest'
        return w + 'er', w + 'est'
    if syl == 2 and re.search(r'[^aeiou]y$', w): return w[:-1] + 'ier', w[:-1] + 'iest'
    return 'more ' + w, 'most ' + w


def en_adj(lemma, a, irr):
    c, s = en_adj_rule(lemma)
    if a.get('comparison'): c, s = a['comparison']
    return {'comp': c, 'sup': s}


# =============================================================== French
def fr_soft(stem, ending):
    if ending[:1] in 'aoâ':
        if stem.endswith('g'): return stem + 'e' + ending
        if stem.endswith('c'): return stem[:-1] + 'ç' + ending
    return stem + ending


def fr_verb(lemma, v, irr):
    pp = v.get('principal_parts') or [lemma, None, None]
    p1 = irr.get('pres.1sg') or pp[1]; part = irr.get('pp') or pp[2]
    cls = v.get('class') or ''
    f = {'inf': lemma}
    er = lemma.endswith('er') and cls.startswith('1st')
    ir2 = cls.startswith('2nd')
    if er:
        st = lemma[:-2]
        s1 = p1[:-1] if p1 and p1.endswith('e') else st                 # achète -> achèt-, appelle -> appell-
        f.update({'pres.1sg': s1 + 'e', 'pres.2sg': s1 + 'es', 'pres.3sg': s1 + 'e', 'pres.1pl': fr_soft(st, 'ons'),
                  'pres.2pl': st + 'ez', 'pres.3pl': s1 + 'ent'})
        futstem = lemma if (s1 == st or re.search(r'é[^aeiouéè]+$', st)) else s1 + 'er'
        ps = fr_soft(st, 'ai'); part = part or st + 'é'
    elif ir2:
        st = lemma[:-2]
        f.update({'pres.1sg': st + 'is', 'pres.2sg': st + 'is', 'pres.3sg': st + 'it', 'pres.1pl': st + 'issons',
                  'pres.2pl': st + 'issez', 'pres.3pl': st + 'issent'})
        futstem = lemma; ps = st + 'is'; part = part or st + 'i'
    else:
        st = lemma[:-3] if lemma.endswith('oir') else lemma[:-2]
        one = p1 or st + 's'
        if one.endswith('e'): two, three = one + 's', one
        elif one.endswith('x'): two, three = one, one[:-1] + 't'
        elif one.endswith('s'): two, three = one, (one[:-1] if one[:-1].endswith(('d', 't', 'c')) else one[:-1] + 't')
        else: two, three = one + 's', one
        f.update({'pres.1sg': one, 'pres.2sg': two, 'pres.3sg': three, 'pres.1pl': fr_soft(st, 'ons'), 'pres.2pl': st + 'ez', 'pres.3pl': st + 'ent'})
        futstem = lemma[:-1] if lemma.endswith('re') else lemma
        if part and part.endswith('u') and not lemma.endswith(('dre', 'pre', 'cre')): ps = part + 's'          # reçu -> reçus
        elif part and part.endswith('i'): ps = part + 's'
        else: ps = st + 'is'
        part = part or (st + 'u' if lemma.endswith('re') else st + 'i')
    for k in ('pres.2sg', 'pres.3sg', 'pres.1pl', 'pres.2pl', 'pres.3pl'):
        if irr.get(k): f[k] = irr[k]
    # nous form -> vous form, imperfect, present participle
    n = f['pres.1pl']
    ns = n[:-3] if n.endswith('ons') else st
    ns = ns[:-1] if ns.endswith('ge') else (ns[:-1] + 'c' if ns.endswith('ç') else ns)
    if not irr.get('pres.2pl') and not er and not ir2: f['pres.2pl'] = ns + 'ez'
    if not irr.get('pres.3pl') and not er and not ir2: f['pres.3pl'] = ns + 'ent'
    for p, e in zip(P, ['ais', 'ais', 'ait', 'ions', 'iez', 'aient']): f['impf.' + p] = fr_soft(ns, e)
    f['ppres'] = fr_soft(ns, 'ant')
    # ils form -> present subjunctive
    t = f['pres.3pl']; ss = t[:-3] if t.endswith('ent') else ns
    f.update({'subj.1sg': ss + 'e', 'subj.2sg': ss + 'es', 'subj.3sg': ss + 'e', 'subj.1pl': f['impf.1pl'], 'subj.2pl': f['impf.2pl'], 'subj.3pl': ss + 'ent'})
    # future and conditional
    fu = irr.get('fut.1sg'); futstem = fu[:-2] if fu and fu.endswith('ai') else futstem
    f.update(six('fut', futstem, ['ai', 'as', 'a', 'ons', 'ez', 'ont']))
    f.update(six('cond', futstem, ['ais', 'ais', 'ait', 'ions', 'iez', 'aient']))
    # passé simple -> imperfect subjunctive
    ps = irr.get('ps.1sg') or ps
    if ps.endswith('ai'):
        b = ps[:-2]
        f.update(six('ps', b, ['ai', 'as', 'a', 'âmes', 'âtes', 'èrent']))
        b2 = b[:-1] if b.endswith('ge') else (b[:-1] + 'c' if b.endswith('ç') else b)
        f['ps.3pl'] = b2 + 'èrent'
        f.update(six('subjimpf', b, ['asse', 'asses', 'ât', 'assions', 'assiez', 'assent']))
    elif ps.endswith('ins'):
        b = ps[:-3]
        f.update(six('ps', b, ['ins', 'ins', 'int', 'înmes', 'întes', 'inrent']))
        f.update(six('subjimpf', b, ['insse', 'insses', 'înt', 'inssions', 'inssiez', 'inssent']))
    else:
        b, vw = ps[:-2], ps[-2:-1]
        hat = {'i': 'î', 'u': 'û'}.get(vw, vw)
        f.update(six('ps', b, [vw + 's', vw + 's', vw + 't', hat + 'mes', hat + 'tes', vw + 'rent']))
        f.update(six('subjimpf', b, [vw + 'sse', vw + 'sses', hat + 't', vw + 'ssions', vw + 'ssiez', vw + 'ssent']))
    f['imp.2sg'] = f['pres.1sg'] if f['pres.1sg'].endswith('e') else f['pres.2sg']
    f['imp.1pl'] = f['pres.1pl']; f['imp.2pl'] = f['pres.2pl']
    if part: f['pp'] = part
    return f


def fr_plural(w):
    if w.endswith(('s', 'x', 'z')): return w
    if w.endswith(('eau', 'au', 'eu')): return w + 'x'
    if w.endswith('al'): return w[:-2] + 'aux'
    return w + 's'


def fr_fem(w):
    for a, b in (('er', 'ère'), ('eux', 'euse'), ('if', 'ive'), ('el', 'elle'), ('ien', 'ienne'), ('on', 'onne'), ('et', 'ette'), ('eur', 'euse'), ('c', 'che')):
        if w.endswith(a) and not (a == 'c'): return w[:-len(a)] + b
    return w if w.endswith('e') else w + 'e'


def fr_noun(lemma, n, irr):
    return {'pl': fr_plural(lemma)}


def fr_adj(lemma, a, irr):
    fem = irr.get('f.sg') or fr_fem(lemma)
    return {'f.sg': fem, 'm.pl': fr_plural(lemma), 'f.pl': fem + 's'}


# =============================================================== Portuguese
ACC = {'a': 'á', 'e': 'é', 'i': 'í', 'o': 'ô', 'u': 'ú'}


def pt_soft(stem, ending, conj):
    v = ending[:1]
    if conj == 'ar' and v in 'eé':
        if stem.endswith('c'): return stem[:-1] + 'qu' + ending
        if stem.endswith('ç'): return stem[:-1] + 'c' + ending
        if stem.endswith('g'): return stem + 'u' + ending
    if conj != 'ar' and v in 'ao':
        if stem.endswith('gu'): return stem[:-1] + ending
        if stem.endswith('c'): return stem[:-1] + 'ç' + ending
        if stem.endswith('g'): return stem[:-1] + 'j' + ending
    return stem + ending


def pt_verb(lemma, v, irr):
    pp = v.get('principal_parts') or [lemma, None, None, None]
    conj = lemma[-2:] if lemma[-2:] in ('ar', 'er', 'ir') else 'er'            # pôr and compounds behave like -er
    st = lemma[:-2]
    T = conj[0]                                                                # thematic vowel
    f = {'inf': lemma, 'ger': st + {'a': 'ando', 'e': 'endo', 'i': 'indo'}[T], 'pp': pp[3] if len(pp) > 3 and pp[3] else st + ('ado' if T == 'a' else 'ido')}
    p1 = irr.get('pres.1sg') or pp[1] or pt_soft(st, 'o', conj)
    pres = {'ar': ['o', 'as', 'a', 'amos', 'ais', 'am'], 'er': ['o', 'es', 'e', 'emos', 'eis', 'em'], 'ir': ['o', 'es', 'e', 'imos', 'is', 'em']}[conj]
    rh = p1[:-1] if (conj == 'ar' and p1.endswith('o') and p1[:-1] != st and not p1[:-1].endswith(('qu', 'gu'))) else st     # passeio -> passei-
    for p, e in zip(P, pres): f['pres.' + p] = (rh if p in ('2sg', '3sg', '3pl') else st) + e
    f['pres.1sg'] = p1
    f.update(six('impf', st, ['ava', 'avas', 'ava', 'ávamos', 'áveis', 'avam'] if T == 'a' else ['ia', 'ias', 'ia', 'íamos', 'íeis', 'iam']))
    for k in ('pres.2sg', 'pres.3sg', 'pres.1pl', 'pres.2pl', 'pres.3pl'):
        if irr.get(k): f[k] = irr[k]
    # preterite
    pr = irr.get('pret.1sg') or (pp[2] if len(pp) > 2 else None) or pt_soft(st, 'ei' if T == 'a' else 'i', conj)
    regular_pr = pr in (pt_soft(st, 'ei', conj), st + 'i')
    if regular_pr:
        ends = {'a': ['ei', 'aste', 'ou', 'amos', 'astes', 'aram'], 'e': ['i', 'este', 'eu', 'emos', 'estes', 'eram'], 'i': ['i', 'iste', 'iu', 'imos', 'istes', 'iram']}[T]
        for p, e in zip(P, ends): f['pret.' + p] = pt_soft(st, e, conj) if p == '1sg' else st + e
    else:
        b = pr[:-1] if pr.endswith('e') else pr                                # fiz, tive -> tiv-, disse -> diss-
        f.update({'pret.1sg': pr, 'pret.2sg': b + 'este', 'pret.3sg': pr, 'pret.1pl': b + 'emos', 'pret.2pl': b + 'estes', 'pret.3pl': b + 'eram'})
    for k in ('pret.2sg', 'pret.3sg', 'pret.1pl', 'pret.2pl', 'pret.3pl'):
        if irr.get(k): f[k] = irr[k]
    # eles preterite -> pluperfect, imperfect subjunctive, future subjunctive
    t = f['pret.3pl']; b = t[:-3] if t.endswith('ram') else st + T
    vw = b[-1:]; acc = b[:-1] + ('ê' if (vw == 'e' and regular_pr) else ACC.get(vw, vw))
    f.update({'plup.1sg': b + 'ra', 'plup.2sg': b + 'ras', 'plup.3sg': b + 'ra', 'plup.1pl': acc + 'ramos', 'plup.2pl': acc + 'reis', 'plup.3pl': b + 'ram'})
    f.update({'subjimpf.1sg': b + 'sse', 'subjimpf.2sg': b + 'sses', 'subjimpf.3sg': b + 'sse', 'subjimpf.1pl': acc + 'ssemos', 'subjimpf.2pl': acc + 'sseis', 'subjimpf.3pl': b + 'ssem'})
    f.update(six('subjfut', b, ['r', 'res', 'r', 'rmos', 'rdes', 'rem']))
    f.update(six('infpers', lemma, ['', 'es', '', 'mos', 'des', 'em']))
    fu = irr.get('fut.1sg'); fs = fu[:-2] if fu and fu.endswith('ei') else lemma
    f.update(six('fut', fs, ['ei', 'ás', 'á', 'emos', 'eis', 'ão']))
    f.update(six('cond', fs, ['ia', 'ias', 'ia', 'íamos', 'íeis', 'iam']))
    # eu present -> present subjunctive
    sj = irr.get('subj.1sg')
    if sj: ss, se = sj[:-1], None
    else: ss = p1[:-1] if p1.endswith('o') else st
    ends = ['e', 'es', 'e', 'emos', 'eis', 'em'] if T == 'a' else ['a', 'as', 'a', 'amos', 'ais', 'am']
    for p, e in zip(P, ends):
        base = ss if (sj or conj != 'ar' or p in ('1sg', '2sg', '3sg', '3pl')) else st
        f['subj.' + p] = (base + e) if sj else pt_soft(base, e, conj)
    f.update({'imp.2sg': f['pres.3sg'], 'imp.3sg': f['subj.3sg'], 'imp.1pl': f['subj.1pl'],
              'imp.2pl': st + {'a': 'ai', 'e': 'ei', 'i': 'i'}[T], 'imp.3pl': f['subj.3pl']})
    return f


def pt_plural(w):
    if w.endswith('ão'): return w[:-2] + 'ões'
    if w.endswith('m'): return w[:-1] + 'ns'
    if w.endswith(('r', 'z')): return w + 'es'
    if w.endswith('al'): return w[:-2] + 'ais'
    if w.endswith('el'): return w[:-2] + 'éis'
    if w.endswith('ol'): return w[:-2] + 'óis'
    if w.endswith('ul'): return w[:-2] + 'uis'
    if w.endswith('il'): return w[:-2] + 'is'
    if w.endswith('ês'): return w[:-2] + 'eses'
    if w.endswith('s'): return w
    return w + 's'


def pt_fem(w):
    if w.endswith('ês'): return w[:-2] + 'esa'
    if w.endswith('or'): return w + 'a'
    if w.endswith('ão'): return w[:-2] + 'ã'
    return w[:-1] + 'a' if w.endswith('o') else w


def pt_noun(lemma, n, irr):
    return {'pl': pt_plural(lemma)}


def pt_adj(lemma, a, irr):
    fem = irr.get('f.sg') or pt_fem(lemma)
    return {'f.sg': fem, 'm.pl': pt_plural(lemma), 'f.pl': pt_plural(fem)}


GEN = {('de', 'verb'): de_verb, ('de', 'noun'): de_noun, ('de', 'adjective'): de_adj,
       ('en', 'verb'): en_verb, ('en', 'noun'): en_noun, ('en', 'adjective'): en_adj,
       ('fr', 'verb'): fr_verb, ('fr', 'noun'): fr_noun, ('fr', 'adjective'): fr_adj,
       ('pt', 'verb'): pt_verb, ('pt', 'noun'): pt_noun, ('pt', 'adjective'): pt_adj}
# stored forms from which other forms are derived, in the order they are fixed
KEYS = {('de', 'verb'): ['praes.3sg', 'praes.1sg', 'praes.2sg', 'praet.1sg', 'konj2.1sg'],
        ('de', 'adjective'): ['comp', 'sup'],
        ('fr', 'verb'): ['pres.1sg', 'pres.1pl', 'pres.2pl', 'pres.3pl', 'fut.1sg', 'ps.1sg', 'pp'],
        ('fr', 'adjective'): ['f.sg'], ('pt', 'adjective'): ['f.sg'],
        ('pt', 'verb'): ['pres.1sg', 'pres.3sg', 'pret.1sg', 'pret.3sg', 'pret.3pl', 'fut.1sg', 'subj.1sg']}


def forms(e, use_irregular=True, irr=None):
    """All forms of an entry: rules, then the stored irregular forms on top."""
    g = GEN.get((e['lang'], e['pos']))
    blk = e.get(e['pos'])
    if not g or blk is None: return {}
    if irr is None: irr = (blk.get('irregular_forms') or {}) if use_irregular else {}
    try:
        out = g(e['lemma'], blk, irr)
    except Exception:
        out = {}
    out = {k: v for k, v in out.items() if not k.startswith('_') and v}
    out.update(irr)
    return out


# =============================================================== reference tables from Wiktionary
def pick(fl, need, forbid=()):
    need = set(need); forbid = set(forbid) | {'multiword-construction', 'subordinate-clause', 'negative', 'obsolete', 'archaic', 'nonstandard', 'dated', 'misspelling'}
    return uniq(f[0] for f in fl if need <= set(f[1]) and not forbid & set(f[1]))


def ref_table(e, src):
    """{slot: [forms Wiktionary lists]} for an entry; src gives the raw form lists."""
    lang, pos = e['lang'], e['pos']; r = {}
    if lang == 'de':
        t = src['de'].get(e['id'])
        if not t: return {}
        en, dw = t['enwikt'], t['dewikt']
        if pos == 'verb':
            if not any('subjunctive-i' in f[1] for f in en): return {}
            r['inf'] = [f[0] for f in en if f[1] == ['infinitive']]
            r['part1'] = pick(en, ['participle', 'present']); r['part2'] = pick(en, ['participle', 'past'])
            for p, tg in PT.items():
                r['praes.' + p] = pick(en, ('indicative', 'present') + tg)
                r['praet.' + p] = pick(en, ('indicative', 'preterite') + tg)
                r['konj1.' + p] = pick(en, ('subjunctive-i',) + tg)
                r['konj2.' + p] = pick(en, ('subjunctive-ii',) + tg)
            r['imp.sg'] = pick(en, ['imperative', 'singular']); r['imp.pl'] = pick(en, ['imperative', 'plural'])
        elif pos == 'noun':
            art = lambda w: re.sub(r'^(der|die|das|des|dem|den) ', '', w)
            for c in ('nominative', 'accusative', 'dative', 'genitive'):
                for n in ('singular', 'plural'):
                    r['%s.%s' % (c[:3], n[:2] if n == 'plural' else 'sg')] = uniq(art(f[0]) for f in dw if set(f[1]) == {c, n})
            r = {k.replace('.pl', '.pl'): v for k, v in r.items()}
        elif pos == 'adjective':
            r['comp'] = [f[0] for f in dw if f[1] == ['comparative']]; r['sup'] = [f[0] for f in dw if f[1] == ['superlative']]
            G = {'m': ('masculine', 'singular'), 'f': ('feminine', 'singular'), 'n': ('neuter', 'singular'), 'pl': ('plural',)}
            C = {'nom': 'nominative', 'gen': 'genitive', 'dat': 'dative', 'acc': 'accusative'}
            D = {'pos': 'positive', 'comp': 'comparative', 'sup': 'superlative'}
            idx = collections.defaultdict(list)
            for f in dw: idx[frozenset(f[1])].append(f[0])
            for d, dt in D.items():
                for typ in ('strong', 'weak', 'mixed'):
                    for c, ct in C.items():
                        for g, gt in G.items():
                            r['%s.%s.%s.%s' % (d, typ, c, g)] = uniq(idx.get(frozenset((dt, typ, ct) + gt), []))
    else:
        fl = [f for d in src[lang].get(e['lemma'], []) if POS_MAP.get(d['pos']) == pos for f in d['forms']]
        if not fl or ' ' in e['lemma'] or "'" in e['lemma'] or '’' in e['lemma']:
            if not (lang == 'en' and fl): return {}
        if pos == 'noun':
            r['pl'] = pick(fl, ['plural'], ['feminine', 'diminutive', 'augmentative'])
        elif pos == 'adjective':
            if lang == 'en':
                r['comp'] = pick(fl, ['comparative']); r['sup'] = pick(fl, ['superlative'])
            else:
                r['f.sg'] = [f[0] for f in fl if set(f[1]) in ({'feminine'}, {'feminine', 'singular'}, {'feminine', 'positive', 'singular'})]
                r['m.pl'] = [f[0] for f in fl if set(f[1]) in ({'masculine', 'plural'}, {'plural'}, {'masculine', 'plural', 'positive'})]
                r['f.pl'] = [f[0] for f in fl if set(f[1]) in ({'feminine', 'plural'}, {'plural'}, {'feminine', 'plural', 'positive'})]
        elif pos == 'verb' and lang == 'en':
            r['3sg'] = pick(fl, ['present', 'singular', 'third-person']); r['ing'] = pick(fl, ['participle', 'present'])
            r['past'] = pick(fl, ['past'], ['participle']); r['pp'] = pick(fl, ['participle', 'past'])
        elif pos == 'verb' and lang == 'fr':
            if not any('historic' in f[1] for f in fl): return {}
            r['inf'] = [f[0] for f in fl if list(f[1]) == ['infinitive']]
            r['ppres'] = pick(fl, ['participle', 'present']); r['pp'] = pick(fl, ['participle', 'past'])
            for p, tg in PT.items():
                r['pres.' + p] = pick(fl, ('indicative', 'present') + tg); r['impf.' + p] = pick(fl, ('imperfect', 'indicative') + tg)
                r['ps.' + p] = pick(fl, ('historic', 'past') + tg); r['fut.' + p] = pick(fl, ('future', 'indicative') + tg)
                r['cond.' + p] = pick(fl, ('conditional',) + tg); r['subj.' + p] = pick(fl, ('present', 'subjunctive') + tg)
                r['subjimpf.' + p] = pick(fl, ('imperfect', 'subjunctive') + tg)
                if p in ('2sg', '1pl', '2pl'): r['imp.' + p] = pick(fl, ('imperative',) + tg)
        elif pos == 'verb' and lang == 'pt':
            if not any('pluperfect' in f[1] for f in fl): return {}
            r['inf'] = pick(fl, ['impersonal', 'infinitive']); r['ger'] = pick(fl, ['gerund'])
            r['pp'] = pick(fl, ['participle', 'past', 'masculine', 'singular'])
            for p, tg in PT.items():
                r['pres.' + p] = pick(fl, ('indicative', 'present') + tg); r['impf.' + p] = pick(fl, ('imperfect', 'indicative') + tg)
                r['pret.' + p] = pick(fl, ('indicative', 'preterite') + tg); r['plup.' + p] = pick(fl, ('indicative', 'pluperfect') + tg)
                r['fut.' + p] = pick(fl, ('future', 'indicative') + tg); r['cond.' + p] = pick(fl, ('conditional',) + tg)
                r['subj.' + p] = pick(fl, ('present', 'subjunctive') + tg); r['subjimpf.' + p] = pick(fl, ('imperfect', 'subjunctive') + tg)
                r['subjfut.' + p] = pick(fl, ('future', 'subjunctive') + tg); r['infpers.' + p] = pick(fl, ('infinitive',) + tg, ['impersonal'])
                if p != '1sg': r['imp.' + p] = pick(fl, ('imperative',) + tg)
            for k in list(r):                                  # Brazilian first: 'falamos' before 'falámos'
                br = [f[0] for f in fl if 'Brazil' in f[1] and f[0] in r[k]]
                if br: r[k] = uniq(br + r[k])
    clean = lambda w: w.rstrip('!').strip()
    return {k: uniq(clean(x) for x in v if x and x != '-' and '—' not in x) for k, v in r.items() if v and any(x and x != '-' for x in v)}


def fit(e, ref):
    """irregular_forms for an entry: the stored forms needed so that forms(e) reproduces Wiktionary."""
    key = (e['lang'], e['pos']); irr = {}
    for k in KEYS.get(key, []):
        out = forms(e, irr=dict(irr))
        if k in ref and out.get(k) not in ref[k]: irr[k] = ref[k][0]
    out = forms(e, irr=dict(irr))
    for k, alts in ref.items():
        if out.get(k) not in alts: irr[k] = alts[0]
    return irr


def main():
    entries = rjson(os.path.join(WORK, 'core.json'))
    src = {'de': {}, 'en': collections.defaultdict(list), 'fr': collections.defaultdict(list), 'pt': collections.defaultdict(list), 'cs': collections.defaultdict(list), 'it': collections.defaultdict(list), 'es': collections.defaultdict(list), 'nl': collections.defaultdict(list), 'sv': collections.defaultdict(list), 'la': collections.defaultdict(list)}
    import gzip
    for L in list(LANGS) + ['library']:
        fn = os.path.join(WORK, 'tables_%s.jsonl.gz' % L)
        if not os.path.exists(fn): continue
        for line in gzip.open(fn, 'rt', encoding='utf-8'):
            i, t = json.loads(line)
            if i not in entries: continue
            lang = i.split(':')[0]
            if lang == 'de': src['de'][i] = {'dewikt': t['dewikt'], 'enwikt': t['enwikt']}
            else:
                lemma = entries[i]['lemma']
                if not src[lang].get(lemma) or all(POS_MAP.get(d['pos']) != entries[i]['pos'] for d in src[lang][lemma]):
                    src[lang][lemma] += t['enw']
    stat = collections.defaultdict(collections.Counter); mism = []
    for i, e in entries.items():
        key = (e['lang'], e['pos'])
        if key not in GEN or e.get(e['pos']) is None: continue
        blk = e[e['pos']]
        blk['irregular_forms'] = {}
        if key == ('en', 'verb') and e['lemma'] in MODALS:      # modal verb: Wiktionary's rule forms (canned, mayed) are wrong
            blk.update({'regular': None, 'class': 'modal', 'aux': None, 'aux_regional': {}, 'present_3sg': e['lemma'],
                        'principal_parts': [e['lemma'], MODALS[e['lemma']], None]})
            # the modal meaning first (can: "to be able to" before "to preserve in cans"); hidden senses keep their place
            first = {'can': r'\bable\b', 'should': r'obligation'}.get(e['lemma'])
            if first:
                e['senses'].sort(key=lambda x: 0 if re.search(first, x.get('gloss_en') or '') else 1)
            # senses of the other, ordinary verb with the same spelling (to can = to preserve in cans; to will = to bequeath)
            # do not belong to the modal verb; they are dropped here
            other = {'can': r'preserv|discard|shut up|fire or dismiss|^to can\b', 'will': r'bequeath|^to will$'}.get(e['lemma'])
            if other:
                keep = [x for x in e['senses'] if not re.search(other, x.get('gloss_en') or '')]
                if keep: st_drop = len(e['senses']) - len(keep); e['senses'] = keep; stat[key]['senses of the ordinary verb dropped'] += st_drop
            stat[key]['modal verbs'] += 1
            continue
        ref = ref_table(e, src)
        if not ref:
            stat[key]['entries without a Wiktionary table'] += 1; continue
        rule = forms(e, use_irregular=False)
        irr = fit(e, ref)
        blk['irregular_forms'] = irr
        final = forms(e)
        s = stat[key]; s['entries'] += 1; s['forms'] += len(ref)
        bad_rule = [k for k in ref if rule.get(k) not in ref[k]]
        bad_final = [k for k in ref if final.get(k) not in ref[k]]
        s['rule ok'] += len(ref) - len(bad_rule); s['final ok'] += len(ref) - len(bad_final); s['stored'] += len(irr)
        if bad_rule: s['entries with a rule mismatch'] += 1
        for k in bad_rule: mism.append((i, k, rule.get(k, ''), ' / '.join(ref[k]), 'stored' if k in irr else 'derived from a stored form', 'ok' if k not in bad_final else 'STILL WRONG'))
        if irr: e['origin'][e['pos'] + '.irregular_forms'] = 'wiktionary'
        if e['pos'] == 'verb' and e['lang'] == 'de' and blk.get('class') != 'weak': pass
    wjson(os.path.join(WORK, 'core.json'), entries)
    rows = []
    for key in sorted(stat):
        s = stat[key]
        if not s['forms']: rows.append((key[0], key[1], 0, s['entries without a Wiktionary table'], 0, None, None, 0, 0)); continue
        rows.append((key[0], key[1], s['entries'], s['entries without a Wiktionary table'], s['forms'],
                     round(100 * s['rule ok'] / s['forms'], 2), round(100 * s['final ok'] / s['forms'], 2), s['stored'], s['entries with a rule mismatch']))
    tot = collections.Counter()
    for s in stat.values(): tot.update(s)
    summary = {'rows': rows, 'total_forms': tot['forms'], 'rule_match_percent': round(100 * tot['rule ok'] / tot['forms'], 2),
               'final_match_percent': round(100 * tot['final ok'] / tot['forms'], 2), 'stored_irregular_forms': tot['stored'], 'rule_mismatches': len(mism)}
    wjson(os.path.join(REPORTS, 'phase2_stats.json'), summary, indent=1)
    with open(os.path.join(REPORTS, 'phase2_mismatches.tsv'), 'w', encoding='utf-8') as f:
        f.write('entry\tslot\trule gives\tWiktionary\thandled by\tafter irregular_forms\n')
        for m in sorted(mism): f.write('\t'.join(m) + '\n')
    print('%-4s %-10s %7s %8s %8s %8s %8s %8s %8s' % ('lang', 'pos', 'entries', 'no table', 'forms', 'rule %', 'final %', 'stored', 'irr.ent'))
    for r in rows: print('%-4s %-10s %7s %8s %8s %8s %8s %8s %8s' % r)
    print(json.dumps({k: v for k, v in summary.items() if k != 'rows'}))


if __name__ == '__main__':
    main()
