"""Build entries in the app's data format (spec section 4) from the cached Wiktionary records.

German entries: German Wiktionary (de edition) first, English Wiktionary to fill gaps and for the
English-language fields.  Linked en/fr/pt entries: English Wiktionary first, then the fr/pt editions.

Translation routes, tried in this order for every German sense and target language:
  de-edition   translation table of the German Wiktionary entry (direct)
  fr-edition / pt-edition   a French/Portuguese Wiktionary entry lists the German word as translation (direct)
  en-edition   English words named in the English Wiktionary's gloss of the German word (direct, en only)
  via-en       pivot through English: the English entry's translation table, used only when the same
               table row also names the German word (sense check)
  via-en-unchecked   pivot without sense check, only when the sense has one English word and that
               word has exactly one translation row for the language
  none         nothing found; the list stays empty

Run:  python3 -I build/import_wiktionary.py      (after prep_german.py, select_lemmas.py, prep_targets.py)"""
import sys, os, re, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from prep_targets import gloss_words, norm_target, split_targets

GENDER = {'masculine': 'm', 'feminine': 'f', 'neuter': 'n'}
CASE = {'accusative': 'Akk', 'dative': 'Dat', 'genitive': 'Gen'}
BAD = {'obsolete', 'archaic', 'dated', 'nonstandard', 'rare', 'misspelling', 'proscribed', 'dialectal', 'alternative', 'uncommon'}
MAX_SENSES = 6


def same_pos(a, b):
    n = lambda p: 'det' if p == 'article' else ('prep' if p == 'postp' else p)
    return n(a) == n(b)


def new_entry(lang, lemma, pos, n=1):
    return {'id': eid(lang, lemma, pos, n), 'lang': lang, 'lemma': lemma, 'pos': pos, 'level': None,
            'frequency_rank': None, 'ipa': {'default': None, 'regional': {}},
            'noun': None, 'verb': None, 'adjective': None, 'governs': [], 'senses': [],
            'regional_variants': [], 'swiss_german': None, 'synonyms': [], 'synonyms_text': [],
            'examples': [],
            'more': {'definition': None, 'collocations': [], 'idioms': [], 'word_family': [],
                     'antonyms': [], 'etymology': None, 'learner_mistake': None},
            'usage_note': None, 'origin': {}, 'verified': False}


def etym_text(t, limit=420):
    if not t: return None
    if isinstance(t, list): t = ' '.join(t)
    parts = [l.strip() for l in t.split('\n') if l.strip()]
    if parts and parts[0].startswith('Etymology tree'):
        parts = [l for l in parts[1:] if ' ' in l and (l[:5] in ('From ', 'Borro', 'Inher', 'Learn', 'Compo', 'Cogna', 'Uncer', 'Unkno', 'Clipp', 'Short', 'Blend', 'Calqu', 'Back-', 'Deriv', 'Ultim', 'Onoma', 'Proba', 'Perha') or '. ' in l or l.endswith('.'))]
    t = ' '.join(parts).strip()
    t = re.sub(r'\s*\^\(→ \w+\)', '', t)
    if not t: return None
    if len(t) > limit:
        cut = t[:limit]
        t = (cut[:cut.rfind('. ') + 1] if '. ' in cut[80:] else cut.rsplit(' ', 1)[0] + ' …')
    return t


def parse_idx(s):
    out = set()
    for part in re.split(r'[,;]', str(s or '')):
        part = part.strip()
        m = re.fullmatch(r'(\d+)\s*[–-]\s*(\d+)', part)
        if m:
            out.update(str(i) for i in range(int(m.group(1)), int(m.group(2)) + 1))
        elif part:
            out.add(part)
    return out


# ---------------------------------------------------------------- IPA
def pick_ipa(lang, lists):
    """lists: [(ipa, tags)] in priority order -> (default, regional dict).
    Phonemic transcriptions (/.../) are preferred to narrow phonetic ones ([...])."""
    items = []
    for raw, tags in lists:
        c = clean_ipa(raw)
        if c: items.append((c, {t.lower() for t in tags}, raw.strip()[:1] in '/\\'))
    if not items: return None, {}
    items.sort(key=lambda x: not x[2])                       # stable: phonemic first
    def sel(want=(), avoid=()):
        want = {w.lower() for w in want}; avoid = {a.lower() for a in avoid}
        return [i for i, t, _ in items if (not want or want & t) and not (avoid & t)]
    plain = [i for i, t, _ in items if not t]
    regional = {}
    WEAK = ('weak', 'unstressed', 'weak form')
    if lang == 'en':
        us = sel(['General-American'], WEAK) or sel(['US'], WEAK + ('Southern-US', 'New-York', 'Boston', 'AAVE'))
        gb = sel(['Received-Pronunciation'], WEAK) or sel(['UK'], WEAK + ('Northumbria', 'West-Midlands', 'Scotland', 'Northern-England', 'Ireland'))
        default = (us or plain or [items[0][0]])[0]
        if gb and gb[0] != default: regional['GB'] = gb[0]
    elif lang == 'pt':
        # Brazilian Portuguese is the default.  Where Wiktionary gives a narrow Brazilian transcription
        # ([ˈhu.ɐ] next to the phonemic /ˈʁu.ɐ/) that one is used, because it shows the actual
        # Brazilian sounds.  A word with no Brazilian transcription gets no default.
        BR = {'brazil', 'carioca', 'paulista', 'brasil'}
        def first(pred, narrow):
            return next((i for i, t, ph in items if pred(t) and ph != narrow), None)
        is_br = lambda t: t == {'brazil'} or (t & BR and not t & {'southern-brazil', 'northeast-brazil', 'caipira', 'rio-de-janeiro', 'são-paulo'})
        is_pt = lambda t: 'portugal' in t and not t & {'northern', 'southern', 'northern-portugal'}
        default = first(is_br, True) or first(is_br, False) or first(lambda t: t & (BR | {'rio-de-janeiro', 'são-paulo'}), False)
        if default is None and plain: default = plain[0]          # untagged = valid for both countries
        pt = first(is_pt, False) or first(lambda t: 'portugal' in t or 'lisboa' in t, False)
        if pt and pt != default: regional['PT'] = pt
        return default, regional
    elif lang == 'fr':
        OTHER = ['Quebec', 'Québec', 'Canada', 'Louisiana', 'Switzerland', 'Belgium', 'Canadian-French', 'Quebec-City', 'Montreal']
        ca = sel(['Quebec', 'Québec', 'Canada', 'Canadian-French'])
        default = (plain or sel((), OTHER) or [items[0][0]])[0]
        if ca and ca[0] != default: regional['CA'] = ca[0]
    else:
        AT = ['Austria', 'Austrian', 'österreichisch', 'Österreich']; CH = ['Switzerland', 'Swiss', 'schweizerisch', 'Schweiz', 'Swiss Standard German']
        at = sel(AT); ch = sel(CH)
        default = (plain or sel((), AT + CH) or [items[0][0]])[0]
        if at and at[0] != default: regional['AT'] = at[0]
        if ch and ch[0] != default: regional['CH'] = ch[0]
    return default, regional


# ---------------------------------------------------------------- generated rules (checked against Wiktionary)
UML = str.maketrans('aouAOU', 'äöüÄÖÜ')


def de_plural_rule(sg, pl):
    if pl == sg: return 'no change'
    def um(s):          # umlaut the last a/o/u (au -> äu)
        m = None
        for m in re.finditer(r'au|a|o|u', s, re.I): pass
        return s if not m else s[:m.start()] + s[m.start()].translate(UML) + s[m.start() + 1:]
    for suf in ('', 'e', 'er', 'en', 'n', 's', 'se', 'nen', 'ien'):
        if pl == sg + suf: return 'adds -' + suf + (', the s doubles' if suf == 'se' else '')
        if pl == um(sg) + suf and um(sg) != sg: return 'umlaut' + (' + -' + suf if suf else '')
    return None


def de_plural_regular(sg, pl, g):
    """Default rules a learner can rely on: feminine -(e)n; -er/-el/-en/-chen/-lein no change;
    words ending in a full vowel -s; otherwise -e.  Umlaut and -er plurals count as irregular."""
    if g == 'f':
        exp = [sg + 'n'] if sg.endswith(('e', 'el', 'er')) else [sg + 'en', sg + 'nen' if sg.endswith('in') else sg + 'en']
    elif sg.endswith(('chen', 'lein', 'er', 'el', 'en')):
        exp = [sg]
    elif sg[-1] in 'aiouy':
        exp = [sg + 's']
    elif sg.endswith('e'):
        exp = [sg + 'n']
    else:
        exp = [sg + 'e', sg + 'se' if sg.endswith(('nis', 'us', 'as', 'is')) else sg + 'e']
    return pl in exp


INSEP = ('be', 'ge', 'er', 'ver', 'zer', 'ent', 'emp', 'miss', 'über', 'unter', 'wider', 'hinter', 'durch', 'um', 'voll', 'wieder')


def de_weak(inf, sep=''):
    """Forms a weak verb would have.  sep = separable prefix ('' if none)."""
    base = inf[len(sep):] if sep else inf
    stem = base[:-2] if base.endswith('en') else base[:-1]
    e = 'e' if (stem[-1] in 'dt' or re.search(r'[^aeiouäöülrhmn][mn]$', stem)) else ''
    st = 't' if stem[-1] in 'sßzx' else 'st'
    noge = base.endswith('ieren') or (not sep and base.startswith(('be', 'ge', 'er', 'ver', 'zer', 'ent', 'emp', 'miss')))
    pp = sep + ('' if noge else 'ge') + stem + e + 't'
    tail = (' ' + sep) if sep else ''
    return {'praes.2sg': stem + e + st + tail, 'praes.3sg': stem + e + 't' + tail, 'praet.1sg': stem + e + 'te' + tail,
            'konj2.1sg': stem + e + 'te' + tail, 'imp.sg': stem + ('e' if e or stem.endswith(('ig', 'el', 'er')) else '') + tail, 'part2': pp}


def simple_plural(lang, sg, pl):
    if pl is None: return None, None
    if lang == 'en':
        if pl == sg + 's': return 'adds -s', True
        if pl == sg + 'es' and sg.endswith(('s', 'x', 'z', 'ch', 'sh', 'o')): return 'adds -es', True
        if sg.endswith('y') and pl == sg[:-1] + 'ies': return '-y → -ies', True
        if sg.endswith('fe') and pl == sg[:-2] + 'ves' or sg.endswith('f') and pl == sg[:-1] + 'ves': return '-f(e) → -ves', False
        if pl == sg: return 'no change', False
        return None, False
    if lang == 'fr':
        if sg.endswith(('s', 'x', 'z')) and pl == sg: return 'no change, already ends in -' + sg[-1], True
        if pl == sg + 's': return 'adds -s', True
        if sg.endswith(('eau', 'au', 'eu')) and pl == sg + 'x': return 'adds -x', True
        if sg.endswith('al') and pl == sg[:-2] + 'aux': return '-al → -aux', False
        if sg.endswith('ail') and pl == sg[:-3] + 'aux': return '-ail → -aux', False
        if pl == sg + 'x': return 'adds -x', False
        return None, False
    if lang == 'pt':
        if sg.endswith('s') and pl == sg: return 'no change, already ends in -s', True
        if sg[-1] in 'aeiouáéíóúãõ' and pl == sg + 's': return 'adds -s', True
        if sg.endswith(('r', 'z', 's')) and pl == sg + 'es': return 'adds -es after ' + sg[-1], True
        if sg.endswith('m') and pl == sg[:-1] + 'ns': return '-m → -ns', True
        if sg.endswith('ão') and pl == sg[:-2] + 'ões': return '-ão → -ões', True
        if sg.endswith('ão') and pl in (sg[:-2] + 'ães', sg + 's'): return '-ão → ' + pl[len(sg) - 2:].join(('-', '')), False
        if sg.endswith(('al', 'ol', 'ul')) and pl == sg[:-1] + 'is': return '-l → -is', True
        if sg.endswith('el') and pl == sg[:-2] + 'éis': return '-el → -éis', True
        if sg.endswith('el') and pl == sg[:-2] + 'eis': return '-el → -eis', True
        if sg.endswith('il') and pl == sg[:-1] + 's': return '-il → -is', True
        if pl == sg + 's': return 'adds -s', True
        return None, False
    return None, None


# ---------------------------------------------------------------- loading
class Src:
    def __init__(self):
        raw = load('pilot_de_raw.pkl')
        self.dew, self.enw_de = raw['dewikt'], raw['enwikt']
        self.en = load('en_entries.pkl')
        self.en_formof = load('en_formof.pkl')
        self.enw = {'en': self.en, 'fr': load('enw_fr.pkl'), 'pt': load('enw_pt.pkl')}
        nat = {l: load('native_%s.pkl' % l) for l in ('fr', 'pt')}
        self.native = {l: nat[l]['entries'] for l in nat}
        self.rev = {l: collections.defaultdict(list) for l in nat}
        for l in nat:
            for de, w, pos, en in nat[l]['reverse']:
                self.rev[l][de].append((w, pos, set(norm_target('en', x) for x in en)))
        self.freq = {}
        for l, fn in (('en', 'en_50k.txt'), ('fr', 'fr_50k.txt'), ('pt', 'pt_br_50k.txt')):
            self.freq[l] = {ln.split()[0]: i for i, ln in enumerate(open(os.path.join(RAW, 'frequency', fn), encoding='utf-8'), 1) if ln.strip()}

    def target_pos(self, lang, word):
        """poscodes available for a target word, English Wiktionary first."""
        out = []
        for d in self.enw[lang].get(word, []):
            if d['pos'] in POS_MAP and d['pos'] not in out: out.append(d['pos'])
        for d in self.native.get(lang, {}).get(word, []):
            if d['pos'] in POS_MAP and d['pos'] not in out and not any(same_pos(d['pos'], p) for p in out): out.append(d['pos'])
        return [p for p in out if p != 'name']


S = None
linked_needed = {}          # id -> (lang, word, poscode)
stats = collections.Counter()
unresolved = collections.Counter()


def resolve(lang, word, poscode):
    word = norm_target(lang, word)
    if not word: return None
    if lang == 'en' and word not in S.en and word in S.en_formof: word = S.en_formof[word]
    avail = S.target_pos(lang, word)
    if not avail:
        unresolved[(lang, word)] += 1
        return None
    pc = next((p for p in avail if same_pos(p, poscode)), avail[0])
    i = eid(lang, word, POS_MAP[pc])
    linked_needed[i] = (lang, word, pc)
    return i


# ---------------------------------------------------------------- German entries
def de_gender(d):
    g = [GENDER[t] for t in d['tags'] if t in GENDER]
    return g[0] if g else None


def en_gender(e):
    for h in e['head']:
        m = re.match(r'^\S+ (m|f|n)\b', h)
        if m: return m.group(1)
    for s in e['senses']:
        for t in s['tags']:
            if t in GENDER: return GENDER[t]
    return None


def build_german(lemma, pc, D, E, n, rank, disagreements, D_other=()):
    pos = POS_MAP[pc]
    e = new_entry('de', lemma, pos, n)
    o = e['origin']
    e['frequency_rank'] = rank
    ipa, reg = pick_ipa('de', [x for d in D for x in d['ipa']] + [x for x in (y for d in E for y in d['ipa'])])
    e['ipa'] = {'default': ipa, 'regional': reg}
    if ipa: o['ipa'] = 'wiktionary'

    dforms = [f for d in D for f in d['forms']]
    eforms = [f for d in E for f in d['forms']]
    if pc == 'noun':
        g = next((de_gender(d) for d in D if de_gender(d)), None)
        g2 = next((en_gender(x) for x in E if en_gender(x)), None)
        art = lambda w: re.sub(r'^(der|die|das|des|dem|den) ', '', w)
        dforms = [(art(f[0]),) + tuple(f[1:]) for f in dforms]
        pls = uniq(f[0] for f in dforms if set(f[1]) == {'nominative', 'plural'})
        pls2 = uniq(f[0] for f in eforms if 'plural' in f[1] and not BAD & set(f[1]) and 'diminutive' not in f[1])
        gens = uniq(f[0] for f in dforms if set(f[1]) == {'genitive', 'singular'}) or uniq(f[0] for f in eforms if 'genitive' in f[1] and not BAD & set(f[1]))
        if g and g2 and g != g2: disagreements.append((e['id'], 'gender', g, g2))
        if pls and pls2 and pls[0] not in pls2 and pls2[0] not in pls: disagreements.append((e['id'], 'plural', ', '.join(pls), ', '.join(pls2)))
        gender = g or g2
        pl = (pls or pls2 or [None])[0]
        alt = [x for x in (pls or pls2)[1:]]
        rule = de_plural_rule(lemma, pl) if pl else None
        e['noun'] = {'gender': gender, 'plural': pl, 'plural_alt': alt, 'plural_rule': rule,
                     'plural_regular': de_plural_regular(lemma, pl, gender) if pl and gender else None,
                     'genitive': gens[0] if gens else None, 'irregular_forms': {}}
        if gender or pl: o['noun'] = 'wiktionary'
        if pl:
            o['noun.plural_rule'] = 'generated'; o['noun.plural_regular'] = 'generated'
    elif pc == 'verb':
        head = next((h for x in E for h in x['head'] if '(' in h), '')
        m = re.search(r'\(([^,()]*?)(?:, third-person|, past|, auxiliary|\))', head)
        cls = m.group(1).strip() if m else None
        if cls and not re.search(r'weak|strong|mixed|irregular|preterite', cls): cls = None
        aux = uniq(f[0] for f in dforms if 'auxiliary' in f[1] and len(f[1]) == 2) or uniq(f[0] for f in eforms if set(f[1]) == {'auxiliary'})
        aux = [a for a in aux if a in ('haben', 'sein')]
        aux_regional = {}
        notes = ' '.join(n for d in D for n in d.get('notes', []) if 'Hilfsverb' in n and 'sein' in n)
        if len(aux) == 2 and re.search(r'Süddeutschland|Österreich|Schweiz|oberdeutsch', notes):
            aux = ['haben']; aux_regional = {'CH': 'sein', 'AT': 'sein'}        # stehen, sitzen, liegen, hängen
        elif len(aux) == 2 and re.search(r'nordwestdeutsch|norddeutsch', notes):
            aux = ['haben']                                                      # anfangen: "bin angefangen" is regional colloquial
        aux2 = uniq(f[0] for f in eforms if set(f[1]) == {'auxiliary'} and f[0] in ('haben', 'sein'))
        if aux and aux2 and set(aux) != set(aux2): disagreements.append((e['id'], 'aux', '/'.join(aux), '/'.join(aux2)))
        if len(aux) == 2 and len(aux2) == 1 and aux2[0] in aux and not aux_regional:
            aux = aux2          # the German edition lists two, the English edition one of them: keep the shared one (laufen: sein)
        first = lambda tags, pron=None: next((f[0].rstrip('!') for f in dforms if tuple(f[1]) == tags and (pron is None or pron in f[2])), None)
        p3 = first(('present',), 'er'); p2 = first(('present',), 'du')
        past = first(('past',), 'ich') or next((f[0] for f in eforms if set(f[1]) == {'past'}), None)
        pp = first(('participle-2', 'perfect')) or next((f[0] for f in eforms if set(f[1]) == {'participle', 'past'}), None)
        k2 = first(('subjunctive-ii',), 'ich'); imp = first(('imperative', 'singular'))
        past2 = next((f[0] for f in eforms if set(f[1]) == {'past'}), None)
        if past and past2 and past.split()[0] != past2.split()[0] and not past2.endswith(past.split()[0]):
            disagreements.append((e['id'], 'past tense', past, past2))
        p1 = first(('present',), 'ich')
        sep = p1.split()[-1] if p1 and ' ' in p1 and lemma.startswith(p1.split()[-1]) else ''
        actual = {'praes.2sg': p2, 'praes.3sg': p3, 'praet.1sg': past, 'konj2.1sg': k2, 'imp.sg': imp, 'part2': pp}
        weak = de_weak(lemma, sep) if lemma.endswith('n') else {}
        diff = {k: v for k, v in actual.items() if v and weak.get(k) and v != weak[k] and not (k == 'imp.sg' and v.rstrip('e') == weak[k].rstrip('e'))}
        if sep:      # compare separable verbs loosely: 'fängt an' vs predicted 'fangt an'
            diff = {k: v for k, v in diff.items() if v.replace(' ', '') != weak[k].replace(' ', '')}
        if cls is None and (past or pp):
            cls = 'weak' if not {'praet.1sg', 'part2'} & set(diff) else 'strong'
            o['verb.class'] = 'generated'
        regular = None if cls is None else cls == 'weak'
        if aux_regional: o['verb.aux_regional'] = 'wiktionary'
        e['verb'] = {'regular': regular, 'class': cls, 'aux': '/'.join(aux) if aux else None, 'aux_regional': aux_regional,
                     'principal_parts': [lemma, past, pp] if (past or pp) else None, 'present_3sg': p3,
                     'irregular_forms': {}}
        if past or pp or aux: o['verb'] = 'wiktionary'
        if regular is not None: o['verb.regular'] = 'generated' if o.get('verb.class') else 'wiktionary'
    elif pc == 'adj':
        comp = next((f[0] for f in dforms if tuple(f[1]) == ('comparative',)), None) or next((f[0] for f in eforms if 'comparative' in f[1] and not BAD & set(f[1])), None)
        sup = next((f[0] for f in dforms if tuple(f[1]) == ('superlative',)), None) or next((f[0] for f in eforms if 'superlative' in f[1] and not BAD & set(f[1])), None)
        if sup and not sup.startswith('am '): sup = 'am ' + sup
        if comp and sup:
            reg = comp == lemma + ('r' if lemma.endswith('e') else 'er') and sup in ('am ' + lemma + 'sten', 'am ' + lemma + 'esten', 'am ' + lemma[:-1] + 'esten')
            e['adjective'] = {'agreement': None, 'comparison': [comp, sup], 'comparison_regular': reg, 'irregular_forms': {}}
            o['adjective'] = 'wiktionary'; o['adjective.comparison_regular'] = 'generated'
        else:
            e['adjective'] = {'agreement': None, 'comparison': None, 'comparison_regular': None, 'irregular_forms': {}}

    # prepositions + case, from the English Wiktionary's sense labels
    gov = []
    for x in E:
        for s in x['senses']:
            for m in re.finditer(r'with ([a-zäöüß]+) \(?\+ (accusative|dative|genitive)', s['raw']):
                gov.append({'prep': m.group(1), 'case': CASE[m.group(2)], 'example_id': None})
            for m in re.finditer(r'(?:\[|\(|, )with (?:the )?(accusative|dative|genitive)(?: or (accusative|dative|genitive))?', s['raw']):
                gov.append({'prep': None, 'case': '/'.join(CASE[c] for c in m.groups() if c), 'example_id': None})
            if pc in ('prep', 'postp'):
                for m in re.finditer(r'\+ (accusative|dative|genitive)', s['raw']):
                    gov.append({'prep': None, 'case': CASE[m.group(1)], 'example_id': None})
    seen = set(); e['governs'] = [g for g in gov if not ((g['prep'], g['case']) in seen or seen.add((g['prep'], g['case'])))][:5]
    if e['governs']: o['governs'] = 'wiktionary'

    def emit(senses):
        single = len(senses) == 1
        k = 0; seen_sig = set()
        for s in senses[:MAX_SENSES]:
            tr = {}; route = {}
            en_words = uniq(norm_target('en', w) for w in s['tr'].get('en', []))
            ids = uniq(x for x in (resolve('en', w, pc) for w in en_words) if x)
            tr['en'] = ids; route['en'] = ('de-edition' if s['base'] == 'de' else 'en-edition') if ids else 'none'
            if not ids: continue
            for lang in ('fr', 'pt'):
                ids = uniq(x for x in (resolve(lang, w, pc) for w in s['tr'].get(lang, [])) if x); r = 'de-edition'
                if not ids:
                    cands = [w for (w, p, en) in S.rev[lang].get(lemma, []) if (en & set(en_words)) or (single and not en)]
                    ids = uniq(x for x in (resolve(lang, w, pc) for w in cands) if x); r = lang + '-edition'
                if not ids:
                    cands = []
                    for ew in en_words:
                        ents = S.en.get(ew, [])
                        ents = [x for x in ents if same_pos(x['pos'], pc)] or ents
                        for x in ents:
                            groups = collections.defaultdict(list)
                            for l, w, sense in x['tr']: groups[sense].append((l, w))
                            for gr in groups.values():
                                if ('de', lemma) in gr:
                                    cands += [w for l, w in gr if l == lang]
                    ids = uniq(x for x in (resolve(lang, w, pc) for w in cands) if x); r = 'via-en'
                if not ids and len(en_words) == 1:
                    # last resort: the single English word has exactly one translation row for this language
                    ents = [x for x in S.en.get(en_words[0], []) if same_pos(x['pos'], pc)]
                    groups = collections.defaultdict(list)
                    for x in ents:
                        for l, w, sense in x['tr']:
                            if l == lang: groups[(id(x), sense)].append(w)
                    if len(groups) == 1:
                        ids = uniq(x for x in (resolve(lang, w, pc) for w in list(groups.values())[0]) if x); r = 'via-en-unchecked'
                tr[lang] = ids[:4]; route[lang] = r if ids else 'none'
            sig = (tuple(tr['en'][:4]), tuple(tr['fr']), tuple(tr['pt']))
            if sig in seen_sig: continue
            seen_sig.add(sig)
            k += 1
            verb = pc == 'verb'
            gl = s.get('gloss_en') or ', '.join(('to ' if verb else '') + w for w in en_words[:4])
            senses_out = {'id': 's%d' % k, 'gloss_en': gl, 'gloss': s.get('gloss'), 'register': None,
                          'translations': {'en': tr['en'][:4], 'fr': tr['fr'], 'pt': tr['pt']}, 'route': route, 'origin': 'wiktionary'}
            e['senses'].append(senses_out)
            for lang in ('en', 'fr', 'pt'): stats[(lang, route[lang])] += 1

    # ---- senses and translations
    def de_senses(src):
        out = []
        for d in src:
            by = collections.defaultdict(lambda: collections.defaultdict(list))
            first_idx = next((i for s in d['senses'] for i in sorted(parse_idx(s['idx']))), '1')
            for lang, w0, idx in d['tr']:
                for w in split_targets(lang, w0):
                    for i in parse_idx(idx) or {first_idx}: by[i][lang].append(w)
            for s in d['senses']:
                for i in sorted(parse_idx(s['idx'])) or [first_idx]:
                    if by[i].get('en'):
                        out.append({'gloss': s['gloss'], 'idx': i, 'tr': by[i], 'base': 'de'})
                        break
        return out

    def en_senses():
        out = []
        for x in E:
            for s in x['senses']:
                if s['form_of'] or s['alt_of'] or BAD & set(s['tags']): continue
                gw = [w for w in gloss_words(s['gloss']) if S.target_pos('en', w) or w in S.en_formof]
                if gw: out.append({'gloss': None, 'gloss_en': s['gloss'], 'tr': {'en': gw}, 'base': 'en'})
        return out

    attempts = [lambda: de_senses(D)]
    if D_other: attempts.append(lambda: de_senses(D_other))
    attempts.append(en_senses)
    senses = []
    for attempt in attempts:
        senses = attempt()
        emit(senses)
        if e['senses']: break
    if e['senses']: o['senses'] = 'wiktionary'

    # ---- more
    gl = uniq(s['gloss'] for x in E for s in x['senses'] if s['gloss'] and not s['form_of'] and not BAD & set(s['tags']))
    if gl: e['more']['definition'] = '; '.join(gl[:3]); o['more.definition'] = 'wiktionary'
    et = next((etym_text(x['etym']) for x in E if etym_text(x['etym'])), None) or next((etym_text(d['etym']) for d in D if etym_text(d['etym'])), None)
    if et: e['more']['etymology'] = et; o['more.etymology'] = 'wiktionary'
    idi = uniq((w + (' — ' + n if n else '')) for d in D for w, n in d['expr'])[:6]
    if idi: e['more']['idioms'] = idi; o['more.idioms'] = 'wiktionary'
    fam = uniq(w for d in D for w in d['derived'] if ' ' not in w)[:8] or uniq(w for x in E for w in x['derived'] + x['related'] if ' ' not in w)[:8]
    if fam: e['more']['word_family'] = fam; o['more.word_family'] = 'wiktionary'
    kept = {s2['idx'] for s2 in senses[:MAX_SENSES] if 'idx' in s2}
    ant = uniq(w for d in D for w, idx in d['ant'] if not kept or not idx or parse_idx(idx) & kept)[:5] or uniq(w for x in E for s in x['senses'] for w in s['ant'])[:5]
    if ant: e['more']['antonyms'] = ant; o['more.antonyms'] = 'wiktionary'
    syn = uniq(w for d in D for w, idx, tags in d['syn'] if not tags and (not kept or parse_idx(idx) & kept or not idx))[:6] \
        or uniq(w for x in E for s in x['senses'] for w in s['syn'])[:6]
    e['_syn'] = syn
    return e, dforms, eforms


# ---------------------------------------------------------------- linked entries
def form_with(forms, need, forbid=()):
    need = set(need); forbid = set(forbid) | BAD
    for f, t in forms:
        ts = set(t)
        if need <= ts and not (forbid & ts) and 'multiword-construction' not in ts:
            return f
    return None


CASES = ('nominative', 'genitive', 'dative', 'accusative', 'vocative', 'locative', 'instrumental')


def czech_grammar(e, word, pc, forms, nforms, head, N, o):
    """Czech: gender and animacy, the seven cases; aspect, present tense, past (l-participle), imperative; adjective agreement.
    From the English Wiktionary's head line and inflection tables, with the Czech Wiktionary's forms as a fallback."""
    allf = forms + [(f[0], f[1]) for f in nforms]
    good = lambda f: f and f != '-' and not f.startswith('no-') and ' ' not in f.strip()
    def fw(need, forbid=()):
        for f, t in allf:
            ts = set(t)
            if set(need) <= ts and not (set(forbid) & ts) and good(f) and not ts & {'table-tags', 'inflection-template', 'error-unrecognized-form'}: return f
        return None
    if pc == 'noun':
        g = None; anim = None
        m = re.search(r'(?:^|\s)' + re.escape(word) + r' (m|f|n)(?: (anim|inan))?\b', head)
        if m: g = m.group(1); anim = {'anim': True, 'inan': False}.get(m.group(2))
        if not g:
            gs = [GENDER[t] for d in N for t in d['tags'] if t in GENDER]
            if gs: g = gs[0]
            if 'animate' in [t for d in N for t in d['tags']]: anim = True
            elif 'inanimate' in [t for d in N for t in d['tags']]: anim = False
        cases = {}
        for c in CASES:
            sg = fw([c, 'singular']) or (word if c == 'nominative' else None); pl = fw([c, 'plural'])
            if sg or pl: cases[c[:3]] = [sg, pl]
        pl = (cases.get('nom') or [None, None])[1]
        e['noun'] = {'gender': g, 'plural': pl, 'plural_alt': [], 'plural_rule': None, 'plural_regular': None, 'genitive': (cases.get('gen') or [None])[0],
                     'irregular_forms': {}, 'animate': anim if g == 'm' else None, 'cases': cases or None}
        if g or pl: o['noun'] = 'wiktionary'
    elif pc == 'verb':
        asp = 'perfective' if re.search(r'(?:^|\s)' + re.escape(word) + r' pf\b', head) else 'imperfective' if re.search(r'(?:^|\s)' + re.escape(word) + r' impf\b', head) else \
              'biaspectual' if re.search(r'(?:^|\s)' + re.escape(word) + r' (biasp|impf or pf|pf or impf)\b', head) else None
        if not asp:
            ts = {t for d in N for t in d['tags']}
            asp = 'perfective' if 'perfective' in ts else 'imperfective' if ('imperfective' in ts or 'imperfect' in ts) else None
        pair = re.search(r'\((?:imperfective|perfective) ([^\s,)]+)', head)
        pres = [fw([p, n, 'present', 'indicative'], ('imperative',)) for n in ('singular', 'plural') for p in ('first-person', 'second-person', 'third-person')]
        past = {k: fw(['participle', 'past', 'singular'] + t, ('passive',)) for k, t in (('m', ['masculine']), ('f', ['feminine']), ('n', ['neuter']))}
        past['pl'] = fw(['participle', 'past', 'plural', 'masculine', 'animate'], ('passive',))
        imp = [fw(['imperative', 'second-person', 'singular']), fw(['imperative', 'second-person', 'plural'])]
        fut = [fw(['first-person', 'singular'], ('present', 'imperative', 'participle', 'past'))] if asp != 'perfective' else []
        v = {'regular': None, 'class': asp, 'aux': None, 'aux_regional': {}, 'principal_parts': [word, pres[0], past['m']] if (pres[0] or past['m']) else None,
             'present_3sg': pres[2], 'irregular_forms': {}, 'aspect_pair': pair.group(1) if pair else None,
             'conj': {'present': pres if any(pres) else None, 'past': past if any(past.values()) else None, 'imperative': imp if any(imp) else None, 'future_1sg': fut[0] if fut else None}}
        e['verb'] = v
        if asp or v['principal_parts']: o['verb'] = 'wiktionary'
    elif pc == 'adj':
        a = {'agreement': None, 'comparison': None, 'comparison_regular': None, 'irregular_forms': {}}
        f = fw(['feminine', 'nominative', 'singular']); n = fw(['neuter', 'nominative', 'singular']); pl = fw(['animate', 'masculine', 'nominative', 'plural'])
        if f or n: a['agreement'] = [word, f or word, n or word, pl]; o['adjective'] = 'wiktionary'
        comp = fw(['comparative']); sup = fw(['superlative'])
        if comp and sup: a['comparison'] = [comp, sup]; a['comparison_regular'] = None
        e['adjective'] = a


def build_linked(lang, word, pc):
    pos = POS_MAP[pc]
    e = new_entry(lang, word, pos)
    o = e['origin']
    E = [d for d in S.enw[lang].get(word, []) if same_pos(d['pos'], pc)]
    N = [d for d in S.native.get(lang, {}).get(word, []) if same_pos(d['pos'], pc)]
    e['frequency_rank'] = S.freq[lang].get(word.lower())
    srcs = [x for d in E for x in d['ipa']] + [x for d in N for x in d['ipa']]
    ipa, reg = pick_ipa(lang, srcs)
    e['ipa'] = {'default': ipa, 'regional': reg}
    if ipa and any(clean_ipa(r) == ipa and r.strip().startswith('[') for r, _ in srcs) and not any(clean_ipa(r) == ipa and r.strip()[:1] in '/\\' for r, _ in srcs):
        e['ipa']['narrow'] = True
    if ipa: o['ipa'] = 'wiktionary'
    forms = [f for d in E for f in d['forms']]
    nforms = [f for d in N for f in d['forms']]
    head = ' '.join(h for d in E for h in d['head'])
    if lang == 'cs':
        czech_grammar(e, word, pc, forms, nforms, head, N, o)
        pc = None                     # the blocks below are for the other languages
    if pc == 'noun':
        gender = None
        if lang != 'en':
            m = re.search(r'(?:^|\s)' + re.escape(word) + r' (m or f|mf|m|f)\b', head)
            if m: gender = {'m or f': 'm/f', 'mf': 'm/f'}.get(m.group(1), m.group(1))
            if not gender:
                gs = [GENDER[t] for d in N for t in d['tags'] if t in GENDER]
                if gs: gender = gs[0] if len(set(gs)) == 1 else 'm/f'
        pl = form_with(forms, ['plural'], ['feminine', 'diminutive', 'augmentative']) or form_with(nforms, ['plural'])
        if lang == 'en' and ('uncountable' in head and 'countable and' not in head and 'usually' not in head): pl = None
        if not pl and re.search(r'\binvariable\b', head): pl = word
        if pl and (pl.startswith('no-') or ' ' in pl and ' ' not in word): pl = None
        rule, regular = simple_plural(lang, word, pl)
        e['noun'] = {'gender': gender, 'plural': pl, 'plural_alt': [], 'plural_rule': rule, 'plural_regular': regular, 'genitive': None, 'irregular_forms': {}}
        if gender or pl: o['noun'] = 'wiktionary'
        if pl: o['noun.plural_rule'] = 'generated'; o['noun.plural_regular'] = 'generated'
    elif pc == 'verb':
        v = {'regular': None, 'class': None, 'aux': None, 'aux_regional': {}, 'principal_parts': None, 'present_3sg': None, 'irregular_forms': {}}
        if lang == 'en':
            past = form_with(forms, ['past'], ['participle']); pp = form_with(forms, ['participle', 'past'])
            if past or pp:
                v['principal_parts'] = [word, past, pp]
                base = word.split()[0]
                exp = {base + 'ed', base + 'd', base[:-1] + 'ied' if base.endswith('y') else '', base + base[-1] + 'ed'}
                v['regular'] = bool(past and pp and past == pp and past.split()[0] in exp)
                v['class'] = 'regular' if v['regular'] else 'irregular'
                o['verb'] = 'wiktionary'; o['verb.regular'] = 'generated'
            v['aux'] = 'have'; o['verb.aux'] = 'generated'
        elif lang == 'fr':
            p1 = form_with(forms, ['first-person', 'indicative', 'present', 'singular'])
            pp = form_with(forms, ['participle', 'past']); ppres = form_with(forms, ['participle', 'present'])
            aux = [f for f, t in forms if 'multiword-construction' in t and 'infinitive' in t]
            if any(a.startswith('être') for a in aux): v['aux'] = 'être'
            elif any(a.startswith('avoir') for a in aux): v['aux'] = 'avoir'
            elif re.match(r"(se |s'|s’)", word):
                v['aux'] = 'être'; o['verb.aux'] = 'generated'      # rule: reflexive verbs take être
            if p1 or pp:
                v['principal_parts'] = [word, p1, pp]; o['verb'] = 'wiktionary'
                core = word.split()[-1] if word.startswith(("se ", "s'")) else word
                if core.endswith('er') and core not in ('aller', 'envoyer', 'renvoyer'): v['regular'], v['class'] = True, '1st group (-er)'
                elif core.endswith('ir') and ppres and ppres.endswith('issant'): v['regular'], v['class'] = True, '2nd group (-ir, -issant)'
                else: v['regular'], v['class'] = False, '3rd group'
                o['verb.regular'] = 'generated'
            elif aux and v['aux']: o['verb'] = 'wiktionary'
        else:
            p1 = form_with(forms, ['first-person', 'indicative', 'present', 'singular'])
            pr = form_with(forms, ['first-person', 'indicative', 'preterite', 'singular'])
            pp = form_with(forms, ['participle', 'past'], ['feminine', 'plural'])
            if p1 or pp:
                v['principal_parts'] = [word, p1, pr, pp]; o['verb'] = 'wiktionary'
                st, end = word[:-2], word[-2:]
                if end in ('ar', 'er', 'ir') and p1 and pr and pp:
                    s1 = st[:-1] + 'ç' if end == 'er' and st.endswith('c') else st
                    s2 = (st[:-1] + 'qu' if st.endswith('c') else st + 'u' if st.endswith('g') else st[:-1] + 'c' if st.endswith('ç') else st) if end == 'ar' else st
                    exp = (s1 + 'o', s2 + ('ei' if end == 'ar' else 'i'), st + ('ado' if end == 'ar' else 'ido'))
                    v['regular'] = (p1, pr, pp) == exp
                    v['class'] = ('regular -' + end + ' verb') if v['regular'] else 'irregular'
                    o['verb.regular'] = 'generated'
            v['aux'] = 'ter'; o['verb.aux'] = 'generated'
        e['verb'] = v
    elif pc == 'adj':
        a = {'agreement': None, 'comparison': None, 'comparison_regular': None, 'irregular_forms': {}}
        if lang == 'en':
            comp = form_with(forms, ['comparative']); sup = form_with(forms, ['superlative'])
            if comp and sup:
                a['comparison'] = [comp, sup]
                a['comparison_regular'] = comp in ('more ' + word, word + 'er', word + 'r', word[:-1] + 'ier', word + word[-1] + 'er')
                o['adjective'] = 'wiktionary'; o['adjective.comparison_regular'] = 'generated'
        else:
            f = form_with(forms, ['feminine'], ['plural']); mp = form_with(forms, ['masculine', 'plural']); fp = form_with(forms, ['feminine', 'plural'])
            pl = form_with(forms, ['plural'], ['masculine', 'feminine'])
            if f or mp or pl:
                a['agreement'] = [word, f or word, mp or pl, fp or pl]
                o['adjective'] = 'wiktionary'
        e['adjective'] = a
    gl = uniq(s['gloss'] for d in E for s in d['senses'] if s['gloss'] and not s['form_of'] and not BAD & set(s['tags']))
    if gl: e['more']['definition'] = '; '.join(gl[:3]); o['more.definition'] = 'wiktionary'
    et = next((etym_text(d['etym']) for d in E if etym_text(d['etym'])), None)
    if et: e['more']['etymology'] = et; o['more.etymology'] = 'wiktionary'
    return e


def main():
    global S
    S = Src()
    sel = rjson(os.path.join(WORK, 'de_lemmas.json'))
    extra = [l.strip() for l in open(os.path.join(ROOT, 'build', 'library_words_de.txt'), encoding='utf-8') if l.strip()] if os.path.exists(os.path.join(ROOT, 'build', 'library_words_de.txt')) else []
    have = {x['lemma'] for x in sel}
    for w in extra:
        if w not in have:
            pcs = uniq([d['pos'] for d in S.dew.get(w, []) if d['pos'] in POS_MAP] + [d['pos'] for d in S.enw_de.get(w, []) if d['pos'] in POS_MAP])
            sel.append({'lemma': w, 'rank': None, 'pos': [p for p in pcs if p != 'name'][:1], 'library': True})
    entries = {}; tables = {}; disagreements = []; skipped = []
    for x in sel:
        lemma = x['lemma']
        for pc in x['pos']:
            D = [d for d in S.dew.get(lemma, []) if same_pos(d['pos'], pc)]
            E = [d for d in S.enw_de.get(lemma, []) if same_pos(d['pos'], pc)]
            if not D and not E:
                skipped.append((lemma, pc)); continue
            groups = [(D, E)]
            if pc == 'noun':
                gs = uniq(de_gender(d) for d in D)
                if len(gs) > 1:
                    groups = [([d for d in D if de_gender(d) == g], [y for y in E if en_gender(y) == g]) for g in gs]
            n = 0
            other = [d for d in S.dew.get(lemma, []) if not same_pos(d['pos'], pc) and d['pos'] in ('particle', 'intj', 'phrase', 'adv', 'conj', 'prep', 'pron', 'det', 'num')] if pc != 'noun' and pc != 'verb' else []
            built = [build_german(lemma, pc, Dg, Eg, 1, x['rank'], disagreements, other) for Dg, Eg in groups]
            if any(b[0]['senses'] for b in built) or len(x['pos']) > 1:
                for b in built:
                    if not b[0]['senses'] and (len(built) > 1 or (len(x['pos']) > 1 and not x.get('library'))):
                        skipped.append((lemma, pc, 'no senses with translations'))
                built = [b for b in built if b[0]['senses'] or (len(built) == 1 and (len(x['pos']) == 1 or x.get('library')))]
            for e, dforms, eforms in built:
                n += 1
                e['id'] = eid('de', lemma, POS_MAP[pc], n)
                entries[e['id']] = e
                tables[e['id']] = {'dewikt': [[f[0], list(f[1]), list(f[2]), f[3]] for f in dforms], 'enwikt': [[f[0], list(f[1])] for f in eforms]}
    # German synonyms -> ids where the word is part of the data set
    by_lemma = collections.defaultdict(list)
    for i, e in entries.items(): by_lemma[e['lemma']].append(e)
    for e in entries.values():
        for w in e.pop('_syn'):
            c = [x for x in by_lemma.get(w, []) if x['pos'] == e['pos']] or by_lemma.get(w, [])
            if c and c[0]['id'] != e['id']: e['synonyms'].append(c[0]['id'])
            elif not c: e['synonyms_text'].append(w)
        if e['synonyms'] or e['synonyms_text']: e['origin']['synonyms'] = 'wiktionary'
    n_de = len(entries)

    # linked entries, plus the reverse links (so a lookup from en/fr/pt finds the German word)
    linked = {i: build_linked(*v) for i, v in linked_needed.items()}
    for e in sorted(entries.values(), key=lambda e: e['frequency_rank'] or 10 ** 6):
        for s in e['senses']:
            for lang in ('en', 'fr', 'pt'):
                for t in s['translations'][lang]:
                    le = linked[t]
                    if len(le['senses']) >= 8 or any(e['id'] in x['translations']['de'] for x in le['senses']): continue
                    tr = {'de': [e['id']]}
                    for l2 in ('en', 'fr', 'pt'):
                        if l2 != lang: tr[l2] = list(s['translations'][l2])
                    le['senses'].append({'id': 's%d' % (len(le['senses']) + 1), 'gloss_en': s['gloss_en'], 'gloss': None, 'register': None,
                                         'translations': tr, 'route': dict({'de': s['route'][lang]}, **{l2: s['route'][l2] for l2 in tr if l2 != 'de'}), 'origin': 'wiktionary'})
                    le['origin']['senses'] = 'wiktionary'
    entries.update(linked)
    for ov in rjson(os.path.join(ROOT, 'build', 'owner_overrides.json')):
        if ov['id'] in entries:
            blk, key = ov['field'].split('.')
            entries[ov['id']][blk][key] = ov['value']
    wjson(os.path.join(WORK, 'entries.json'), entries)
    wjson(os.path.join(WORK, 'source_gaps.json'), {i: source_gaps(e) for i, e in entries.items() if source_gaps(e)})
    wjson(os.path.join(WORK, 'de_tables.json'), tables)
    routes = {l: {r: stats[(l, r)] for r in ('de-edition', l + '-edition', 'via-en', 'via-en-unchecked', 'none') if stats[(l, r)] or r != l + '-edition' or l != 'en'} for l in ('en', 'fr', 'pt')}
    wjson(os.path.join(REPORTS, 'import_stats.json'), {
        'german_entries': n_de, 'linked_entries': {l: sum(1 for e in linked.values() if e['lang'] == l) for l in ('en', 'fr', 'pt')},
        'translation_routes_per_sense': routes,
        'target_words_not_in_wiktionary_data': {l: sum(1 for (a, _) in unresolved if a == l) for l in ('en', 'fr', 'pt')},
        'skipped': skipped, 'edition_disagreements': disagreements}, indent=1)
    print('German entries', n_de, '| linked', {l: sum(1 for e in linked.values() if e['lang'] == l) for l in ('en', 'fr', 'pt')})
    print('routes', json.dumps(routes, ensure_ascii=False))
    print('skipped', len(skipped), skipped[:25])
    print('edition disagreements', len(disagreements), disagreements[:12])
    print('unresolved sample', [k for k, _ in unresolved.most_common(25)])


if __name__ == '__main__':
    main()
