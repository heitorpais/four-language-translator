"""Phase 4, step 2: the cleaned word list of one language, with frequency ranks and tiers.

  python3 -I build/inventory.py LANG        (de, en, fr or pt; after index_sources.py)

Lemmas: every Wiktionary entry of the language (English Wiktionary and, for de/fr/pt, the language's own
Wiktionary) with a dictionary part of speech.  Dropped:
  - proper names (part of speech "name": people, places, brands)
  - abbreviations, acronyms and initialisms, unless listed in build/common_abbreviations.txt
  - entries that are only an inflected form, a variant spelling or a misspelling of another word
  - words with digits or other non-letter characters
Inflected forms: the forms in Wiktionary's own tables and form-of entries, single words only.
Frequency: FrequencyWords (OpenSubtitles 2018) full list.  A corpus word that Wiktionary calls a form of
another word counts for that word ("vai" for ir).  If the spelling is also a word of its own, the count is
shared, and the more common the other word is in the corpus, the bigger its share ("é": mostly ser, a little
the letter name; "mais": almost all "but", very little the plural of "mai"); one spelled like a lemma counts for that lemma; any other corpus word is shared out among the lemmas Wiktionary lists it as a form of (25 rounds of
expectation-maximisation; capital vs. small letter split by Tatoeba).  A core or extended word must itself
occur in the corpus.
Tiers: core = the 8,000 most frequent lemmas; extended = other lemmas that occur at least MIN_EXT times in
the corpus; long tail = all other lemmas.

Writes build/work/inv_LANG.json and prints the counts."""
import unicodedata, sys, os, re, json, zlib, bz2, sqlite3, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

CORE_N = 8000
MIN_EXT = 3.0
ALLOWED = {'noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'conj', 'det', 'article', 'num', 'particle', 'intj',
           'contraction', 'postp', 'phrase', 'prep_phrase', 'adv_phrase'}
ABBR_TAGS = {'abbreviation', 'acronym', 'initialism', 'clipping-abbreviation', 'Abkürzung', 'abréviation', 'sigle', 'acronyme', 'abreviatura', 'sigla'}
BAD_SENSE = {'misspelling', 'proscribed-spelling', 'obsolete-spelling'}
FREQ = {'de': 'de_full.txt', 'en': 'en_full.txt', 'fr': 'fr_full.txt', 'pt': 'pt_br_full.txt', 'cs': 'cs_full.txt',
        'it': 'it_full.txt', 'es': 'es_full.txt', 'nl': 'nl_full.txt', 'sv': 'sv_full.txt', 'la': 'la_full.txt'}     # la: counted in Tatoeba (no subtitle list exists)
TATO = {'de': 'deu', 'en': 'eng', 'fr': 'fra', 'pt': 'por', 'cs': 'ces', 'it': 'ita', 'es': 'spa', 'nl': 'nld', 'sv': 'swe', 'la': 'lat'}
LAT = 'a-zA-Z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f'
LETTERS = {l: LAT for l in ('de', 'en', 'fr', 'pt', 'cs', 'it', 'es', 'nl', 'sv', 'la')}
# senses with these labels do not make a word count as an everyday word, and forms with them are not used for frequency
MARGINAL = {'obsolete', 'archaic', 'rare', 'dialectal', 'nonstandard', 'misspelling', 'pronunciation-spelling', 'eye-dialect',
            'uncommon', 'Internet', 'text-messaging', 'alternative', 'alt-of', 'historical', 'poetic', 'veraltet', 'selten', 'archaïque', 'vieilli',
            'désuet', 'arcaico', 'obsoleto', 'raro', 'regional', 'zastarale', 'zastaralé', 'knižně', 'nářečně', 'expresivně-zastarale', 'Southern-US', 'Appalachia', 'Scotland', 'Northern-England', 'Multicultural-London-English'}
# definitions that only describe an inflected form ("terceira pessoa do singular do presente de ser")
FORM_GLOSS = re.compile(r'pessoa do (singular|plural)|particípio|gerúndio|^(plural|feminino|masculino) de |^forma (flexionada|verbal|do|de) |conjugação'
                        r'|personne du (singulier|pluriel)|^participe|^(pluriel|féminin|masculin)( singulier| pluriel)? de |forme (conjuguée|du verbe|de) |^(première|deuxième|troisième) personne'
                        r'|^(plural|past tense|present participle|past participle|third-person singular|comparative|superlative) (form )?of '
                        r'|^(genitiv|dativ|akuzativ|vokativ|lokál|instrumentál|nominativ) (jednotného|množného) čísla|^(\d\. )?osoba (jednotného|množného)|^tvar |^přechodník|^příčestí'
                        r'|^(plurale|femminile|participio|forma|voce verbale) |^(plural|femenino|forma|participio) de |^(meervoud|verkleinwoord|vervoeging|verbuiging|vrouwelijke vorm) van ', re.I)
FORM_GLOSS_DE = re.compile(r'^(Nominativ|Genitiv|Dativ|Akkusativ)|\d\. Person (Singular|Plural)|^Partizip|flektierte Form|^(Plural|Variante) (von|zu|des|der)|Komparativ|Superlativ|^Imperativ|^Präteritum')
SINGLE_OK = {'en': {'a', 'I'}, 'fr': {'a', 'à', 'y'}, 'pt': {'a', 'à', 'e', 'o'}, 'de': set(), 'cs': {'a', 'i', 'k', 'o', 's', 'u', 'v', 'z'},
             'it': {'a', 'e', 'è', 'i', 'o'}, 'es': {'a', 'e', 'o', 'u', 'y'}, 'nl': set(), 'sv': {'i', 'å', 'ö'}, 'la': {'a', 'ā', 'e', 'ē'}}
NAME_RESCUE = re.compile(r'month of the|day of the week|calendar', re.I)
# pieces left when the frequency list splits words at the apostrophe (don't -> don + t)
FRAGMENTS = {'en': {'don', 'didn', 'doesn', 'isn', 'wasn', 'aren', 'couldn', 'wouldn', 'shouldn', 'haven', 'hasn', 'weren', 'hadn', 'mustn', 'ain', 'll', 've', 're', 'won'}}
SOURCES = {'de': ['ed-de', 'enw-de'], 'en': ['enw-en'], 'fr': ['ed-fr', 'enw-fr'], 'pt': ['ed-pt', 'enw-pt'], 'cs': ['ed-cs', 'enw-cs'],
           'it': ['ed-it', 'enw-it'], 'es': ['ed-es', 'enw-es'], 'nl': ['ed-nl', 'enw-nl'], 'sv': ['enw-sv'], 'la': ['enw-la']}


def dbs(lang):
    return [(s, sqlite3.connect('file:' + os.path.join(RAW, 'db', s + '.sqlite') + '?mode=ro', uri=True)) for s in SOURCES[lang]]


def word_ok(lang, w, abbr_ok):
    L = LETTERS[lang]
    if w in abbr_ok: return True
    if len(w) > 40 or len(w.split()) > 4: return False
    return bool(re.fullmatch(r"[%s]+(?:['’\- ][%s]+)*" % (L, L), w))


def classify(rec):
    """-> 'lemma', 'form' (only a form/variant of another word), 'abbr', 'name', 'bad' or 'skip'"""
    pos = rec['pos']
    if pos in ('name',) or 'próprio' in rec['tags'] or 'proper-noun' in rec['tags']:
        if any(NAME_RESCUE.search(x['gloss'] or '') for x in rec['senses'][:1]): return 'lemma'
        return 'name'
    if pos in ('abbrev',): return 'abbr'
    if pos not in ALLOWED: return 'skip'
    ss = rec['senses']
    if not ss: return 'skip'
    if all(s['form_of'] or s['alt_of'] for s in ss) or 'form-of' in rec['tags']: return 'form'
    main = [s for s in ss if not set(s['tags']) & MARGINAL]
    if main and main[0]['form_of'] and all(' ' not in x for x in main[0]['form_of']): return 'form'   # "is": third-person singular of be
    # a definition that only describes an inflected form; pronouns ("ich: 1. Person Singular") are words of their own
    if main and pos in ('verb', 'noun', 'adj') and (FORM_GLOSS.search(main[0]['gloss'] or '') or FORM_GLOSS_DE.search(main[0]['gloss'] or '')): return 'formgloss'
    if all(BAD_SENSE & set(s['tags']) for s in ss): return 'bad'
    if all(ABBR_TAGS & set(s['tags']) for s in ss) or ABBR_TAGS & set(rec['tags']): return 'abbr'
    if rec.get('pos_title') and re.search(r'Abkürzung|Abréviation|Sigle|Abreviatura|Sigla|Vorname|Nachname|Toponym|Prénom|Nom de famille|Nome próprio|Antropônimo|Topônimo', rec['pos_title'] or ''): return 'name'
    return 'lemma'


def main(lang):
    abbr_ok = set()
    for l in open(os.path.join(ROOT, 'build', 'common_abbreviations.txt'), encoding='utf-8'):
        l = l.strip()
        if l and not l.startswith('#') and l.split('|')[0] == lang: abbr_ok.add(l.split('|', 1)[1])
    block = set()
    bl = os.path.join(ROOT, 'build', 'lemma_blocklist_%s.txt' % lang)
    if lang == 'de': bl = os.path.join(ROOT, 'build', 'lemma_blocklist.txt')
    if os.path.exists(bl):
        block = {w for l in open(bl, encoding='utf-8') if not l.startswith('#') for w in l.split()}

    lem = collections.defaultdict(lambda: {'pos': set(), 'src': set()})
    why = collections.Counter(); dropped = collections.defaultdict(list)
    forms = collections.defaultdict(set); cforms = collections.defaultdict(set); strong = collections.defaultdict(set); glossform = set()
    names = set()          # lower-case spellings of proper names (Erica, Tommy, Ryo)
    for s, db in dbs(lang):
        for w, pos, blob in db.execute('select word, pos, data from entry'):
            rec = json.loads(zlib.decompress(blob))
            c = classify(rec)
            if c == 'lemma' and not word_ok(lang, w, abbr_ok): c = 'chars'
            if c == 'abbr' and w in abbr_ok: c = 'lemma'
            why[c] += 1
            if c == 'lemma':
                lem[w]['pos'].add(pos); lem[w]['src'].add(s)
                if not all(set(x['tags']) & MARGINAL for x in rec['senses']): lem[w]['main'] = True
                if s.startswith('ed-') or rec['tr']: lem[w]['tr'] = lem[w].get('tr', 0) + len({t[0] for t in rec['tr']})
                for f, tg, _, _, _ in rec['forms']:
                    if not (set(tg) & (MARGINAL | {'table-tags', 'inflection-template', 'class', 'romanization', 'auxiliary', 'multiword-construction', 'abbreviation', 'diminutive', 'feminine'} - ({'feminine'} if pos != 'noun' else set()))) and f != w:
                        f = f.rstrip('!')
                        if (('-' in w or ' ' in w) and not ('-' in f or ' ' in f)): continue   # parts of a compound are not its forms
                        cforms[f].add(w)
            elif c == 'formgloss':
                glossform.add(w)
            elif c == 'form':
                for x in rec['senses']:
                    if not set(x['tags']) & MARGINAL:
                        for fo in x['form_of']: cforms[w].add(fo); strong[w].add((fo, pos))
            elif c in ('name', 'abbr', 'bad', 'chars') and len(dropped[c]) < 30: dropped[c].append(w)
            if c == 'name' and w[:1].isupper(): names.add(w.lower())
    if lang != 'de':      # English names (Tommy, Erica) also fill French and Portuguese film subtitles
        en_db = sqlite3.connect('file:' + os.path.join(RAW, 'db', 'enw-en.sqlite') + '?mode=ro', uri=True)
        names |= {w.lower() for (w,) in en_db.execute("select word from entry where pos='name'") if w[:1].isupper()}
    for w in list(lem):
        if w in block: del lem[w]; why['blocklist'] += 1
    # inflected forms: single words of included lemmas, not themselves a lemma spelling
    fl = {}
    for f, ls in cforms.items():
        ls = sorted(l for l in ls if l in lem)
        if ls and ' ' not in f and word_ok(lang, f, set()) and not (set(ls) == {f}):   # "went" is a word of its own and a form of go
            fl[f] = ls
    print(lang, 'lemmas', len(lem), 'forms', len(fl), dict(why), flush=True)

    # ---- frequency
    # Latin dictionaries mark long vowels (amō, rosā); texts usually do not: compare without the marks
    lk = (lambda w: ''.join(ch for ch in unicodedata.normalize('NFD', w.lower()) if not unicodedata.combining(ch))) if lang == 'la' else (lambda w: w.lower())
    # spellings by lower-case key: lemmas and words that Wiktionary calls a form of another word
    spell = collections.defaultdict(set)
    for w in lem: spell[lk(w)].add(w)
    GROUP = {'noun': 'n', 'verb': 'v', 'adj': 'a', 'adv': 'adv', 'pron': 'p', 'det': 'p', 'article': 'p', 'num': 'p'}
    def compat(fpos, l):          # a form of a verb must be a verb form, etc.  ("du" is no form of the noun "article")
        g = GROUP.get(fpos)
        return g is None or any(GROUP.get(p) in (g, None) for p in lem[l]['pos'])
    strong = {w: {l for l, fp in ls if l in lem and compat(fp, l)} for w, ls in strong.items()}
    strong = {w: ls for w, ls in strong.items() if ls}
    # described as a form but not linked to its lemma: use the tables it appears in
    tables = collections.defaultdict(set)
    for f, ls in cforms.items():
        for l in ls:
            if l in lem: tables[f].add(l)
    for w in glossform:
        ls = {l for l in tables.get(w, ()) if l != w}
        if ls and w not in strong: strong[w] = ls
    for w in strong: spell[lk(w)].add(w)
    weak = collections.defaultdict(set)                 # forms found only in another word's table
    for f, ls in cforms.items():
        for l in ls:
            if l in lem: weak[lk(f)].add(l)
    cap = collections.Counter(); low = collections.Counter()
    tok = re.compile(r"[%s]+" % LETTERS[lang])
    with bz2.open(os.path.join(RAW, 'tatoeba', '%s_sentences_detailed.tsv.bz2' % TATO[lang]), 'rt', encoding='utf-8') as fh:
        for line in fh:
            p = line.split('\t')
            if len(p) < 3: continue
            s = p[2]
            for m in tok.finditer(s):
                before = s[:m.start()].rstrip()
                if not before or before[-1] in '.!?:;"„“”»«‚‘’\'(–—-…¿¡': continue
                t = m.group(); (cap if t[0].isupper() else low)[t.lower()] += 1
    freq_of = {}
    for line in open(os.path.join(RAW, 'frequency', FREQ[lang]), encoding='utf-8'):
        p = line.split()
        if len(p) == 2: freq_of[p[0]] = int(p[1])
    tokens = []; toklist = []; total = 0; seen_tok = collections.Counter(); contrib = collections.defaultdict(list)
    for line in open(os.path.join(RAW, 'frequency', FREQ[lang]), encoding='utf-8'):
        p = line.split()
        if len(p) != 2: continue
        t, c = p[0], int(p[1]); total += c; seen_tok[t] += c
        # Each spelling of the corpus word gets its reading: if Wiktionary calls that spelling a form of another
        # word ("est" of être, "habe" of haben) it counts for that word, otherwise for the lemma itself ("dans").
        # Only if no spelling is known are the tables of other words used ("ging" of gehen).
        groups = {'cap': set(), 'low': set()}; split = []
        if t in FRAGMENTS.get(lang, ()): continue
        # The lists are lower case, so "erica" is mostly the name Erica: the share Tatoeba writes with a
        # capital letter goes to the name and is dropped (without Tatoeba evidence the name gets 90%).
        if lang != 'de' and t in names:
            n_ev = cap[t] + low[t]
            share = (cap[t] + 0.5) / (n_ev + 1) if n_ev >= 3 else 0.9
            tokens.append((c * share, ['\x00name'])); toklist.append(t); c = c * (1 - share)
        for v in spell.get(t, ()):
            # a real word with its own everyday senses keeps the corpus word ("tu", "mais", "para");
            # otherwise the word it is a form of gets it ("is", "est", "habe")
            st = strong.get(v)
            if v in lem and lem[v].get('main') and st:
                # both readings exist ("é": letter name, or form of ser; "mais": but, or plural of mai).
                # The form reading wins when the word it is a form of is itself common in the corpus.
                r = max(freq_of.get(l.lower(), 0) for l in st) / max(freq_of.get(t, 1), 1)
                share = min(1.0, r / 0.2)
                split.append((share, sorted(st), [v])); continue
            else:
                tgt = {v} if (v in lem and lem[v].get('main')) else (st or ({v} if v in lem else set()))
            groups['cap' if v[0].isupper() else 'low'] |= tgt
        if not groups['cap'] and not groups['low'] and not split:
            for l in weak.get(t, ()): groups['cap' if l[0].isupper() else 'low'].add(l)
        caps, lows = sorted(groups['cap']), sorted(groups['low'])
        if split and not caps and not lows:
            for share, st, own in split:
                k = c / len(split)
                if share > 0: tokens.append((k * share, st)); toklist.append(t)
                if share < 1: tokens.append((k * (1 - share), own)); toklist.append(t)
            continue
        for share, st, own in split:
            (groups['cap'] if own[0][0].isupper() else groups['low']).update(own if share < 0.5 else st)
        caps, lows = sorted(groups['cap']), sorted(groups['low'])
        if not caps and not lows: continue
        if caps and lows:
            pc = (cap[t] + 0.5) / (cap[t] + low[t] + 1)
            tokens.append((c * pc, caps)); tokens.append((c * (1 - pc), lows)); toklist.extend([t, t])
        else:
            tokens.append((c, caps or lows)); toklist.append(t)
    weight = collections.defaultdict(lambda: 1.0)
    for _ in range(25):
        new = collections.defaultdict(float)
        for c, cands in tokens:
            z = sum(weight[x] for x in cands)
            for x in cands: new[x] += c * weight[x] / z
        weight = collections.defaultdict(lambda: 1e-9, new)
    # everyday words only: not multi-word, at least one sense without archaic/rare/dialect labels, and for
    # en/fr/pt a capitalised word only if Wiktionary translates it (Monday, French, but not Oprah)
    def everyday(w):
        v = lem[w]
        if ' ' in w or not v.get('main'): return False
        if not seen_tok.get(w.lower()): return False        # the word itself must occur in the corpus, not only words that look like its forms
        if len(w) == 1 and w not in SINGLE_OK[lang]: return False
        if lang != 'de' and w[0].isupper() and v.get('tr', 0) < 2: return False
        return True
    single = [w for w in lem if everyday(w)]
    ranked = sorted((w for w in single if weight.get(w, 0) > 0), key=lambda w: -weight[w])
    rank = {w: i for i, w in enumerate(ranked, 1)}
    core = set(ranked[:CORE_N])
    out = {}
    for w, v in lem.items():
        wt = weight.get(w, 0.0)
        tier = 'core' if w in core else ('ext' if wt >= MIN_EXT and w in rank else 'tail')
        out[w] = {'pos': sorted(v['pos']), 'src': sorted(v['src']), 'rank': rank.get(w), 'per_million': round(wt * 1e6 / total, 3), 'tier': tier}
    tiers = collections.Counter(x['tier'] for x in out.values())
    wjson(os.path.join(WORK, 'inv_%s.json' % lang), {'lemmas': out, 'forms': fl, 'dropped_examples': dropped, 'counts': dict(why)})
    print(lang, 'tiers', dict(tiers), '| multiword', sum(1 for w in out if ' ' in w), '| words for suggestions (lemmas + forms)', len(out) + len(fl), flush=True)
    print('  core sample:', ' '.join(ranked[:80]))
    for w in filter(None, os.environ.get('WHY', '').split(',')):
        top = sorted(((c * weight[w] / sum(weight[x] for x in cands), i) for i, (c, cands) in enumerate(tokens) if w in cands), reverse=True)[:5]
        print('  why', w, [(toklist[i], round(v)) for v, i in top])
    for k, v in dropped.items(): print('  dropped', k, ':', ' '.join(v[:20]))


if __name__ == '__main__':
    main(sys.argv[1])
