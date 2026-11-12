"""Phase 4, step 3: build the entries of all four languages and all tiers from the indexed Wiktionary data.

  python3 -I build/build_entries.py LANG       pass 1 for one language (after inventory.py for all four)
  python3 -I build/build_entries.py --links    pass 2: reverse links, translation order, unused phrases

Tiers (from inventory.py):
  core      the 8,000 most frequent lemmas: full entry (spec section 4)
  ext       other lemmas found in the frequency list: lemma, pos, IPA, gender/plural or auxiliary, translations
  tail      all other lemmas: lemma, pos, translations

Translations of a sense, per target language, tried in this order (the "route" stored on the sense):
  <L>-edition          the word's own Wiktionary (German words: German Wiktionary, ...), or for English words
                       the English Wiktionary's translation tables ("en-edition")
  en-edition           English words named in the English Wiktionary's definition of the word (for English only)
  <T>-edition          the target language's Wiktionary lists this word as translation of one of its entries
  via-en               through English: an English entry's translation table row that also names this word
  via-en-unchecked     through English without sense check (kept in the data, never shown in the app)
Pass 2 adds the reverse direction (if gehen -> ir, then ir -> gehen) and sorts each list so that the
translation whose own Wiktionary entry names the source word comes first, then by frequency."""
import sys, os, re, json, zlib, sqlite3, collections, gzip
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import import_wiktionary as iw
from prep_targets import gloss_words, norm_target, split_targets

SOURCES = {'de': ['ed-de', 'enw-de'], 'en': ['enw-en'], 'fr': ['ed-fr', 'enw-fr'], 'pt': ['ed-pt', 'enw-pt'], 'cs': ['ed-cs', 'enw-cs'], 'it': ['ed-it', 'enw-it'], 'es': ['ed-es', 'enw-es'], 'nl': ['ed-nl', 'enw-nl'], 'sv': ['enw-sv'], 'la': ['enw-la']}
EDITION = {'de': 'ed-de', 'fr': 'ed-fr', 'pt': 'ed-pt', 'en': 'enw-en', 'cs': 'ed-cs', 'it': 'ed-it', 'es': 'ed-es', 'nl': 'ed-nl', 'sv': 'enw-sv', 'la': 'enw-la'}
MAX_SENSES = {'core': 6, 'ext': 3, 'tail': 2}
GROUP = {'noun': 'noun', 'verb': 'verb', 'adjective': 'adjective', 'adverb': 'adverb'}
_db = {}


def db(src):
    if src not in _db:
        _db[src] = sqlite3.connect('file:' + os.path.join(RAW, 'db', src + '.sqlite') + '?mode=ro', uri=True)
    return _db[src]


def recs(src, word):
    return [json.loads(zlib.decompress(b)) for (b,) in db(src).execute('select data from entry where word=?', (word,))]


INV = {}


def inv(lang):
    if lang not in INV:
        d = rjson(os.path.join(WORK, 'inv_%s.json' % lang))
        INV[lang] = (d['lemmas'], d['forms'])
    return INV[lang]


# ---------------------------------------------------------------- target resolution
def resolve(T, word, pc, src_lang=None):
    """word in language T -> entry id, or None if the word is not in the cleaned list"""
    lem, forms = inv(T)
    word = norm_target(T, word)
    if not word: return None
    cands = [word]
    if T != 'de' and word.lower() != word: cands.append(word.lower())
    if T == 'fr': cands.append(re.sub(r"^(se |s’|s')", '', word))
    if T == 'pt': cands.append(re.sub(r'-se$', '', word))
    for w in cands:
        if w in lem: break
    else:
        fl = forms.get(word)
        if fl and len(fl) == 1: w = fl[0]            # 'parents' -> parent
        else: return None
    ps = lem[w]['pos']
    want = POS_MAP.get(pc)
    p = next((x for x in ps if POS_MAP.get(x) == want), None) or next((x for x in ps if POS_MAP.get(x)), None)
    if not p: return None
    return eid(T, w, POS_MAP[p])


# ---------------------------------------------------------------- senses
def tr_groups(records):
    """translation rows of records -> ordered {sense key: {lang: [words]}}"""
    g = collections.OrderedDict()
    for d in records:
        for tl, tw, key in d['tr']:
            for w in split_targets(tl, tw):
                g.setdefault(key, collections.defaultdict(list))[tl].append(w)
    return g


def native_senses(L, N):
    out = []
    for d in N:
        by = collections.defaultdict(lambda: collections.defaultdict(list)); text = collections.OrderedDict()
        first_idx = next((i for s in d['senses'] for i in sorted(iw.parse_idx(s['idx']))), '1')
        for tl, tw, key in d['tr']:
            if tl == L: continue
            idx = iw.parse_idx(key) if re.fullmatch(r'[\d\s,;–\-a-z.]*\d[\d\s,;–\-a-z.]*', key or '') else set()
            for w in split_targets(tl, tw):
                if idx:
                    for i in idx: by[i][tl].append(w)
                elif key:
                    text.setdefault(key, collections.defaultdict(list))[tl].append(w)
                else:
                    by[first_idx][tl].append(w)
        used = set()
        for s in d['senses']:
            for i in sorted(iw.parse_idx(s['idx'])) or [first_idx]:
                if by.get(i) and i not in used:
                    used.add(i); out.append({'gloss': s['gloss'], 'idx': i, 'tr': by[i], 'base': EDITION[L]}); break
        for i, tr in by.items():
            if i not in used: out.append({'gloss': None, 'idx': i, 'tr': tr, 'base': EDITION[L]})
        for key, tr in text.items():
            out.append({'gloss': key, 'idx': None, 'tr': tr, 'base': EDITION[L]})
    return out


WORD = re.compile(r"[a-z]+")
STOP = {'to', 'a', 'an', 'the', 'of', 'or', 'and', 'in', 'on', 'for', 'with', 'by', 'as', 'be', 'something', 'someone', 'one', 'that', 'is'}


def english_senses(E, pc):
    """senses from the English Wiktionary's translation tables of an English word, in the order of the
    entry's definitions (a table is placed at the definition its heading shares most words with)"""
    out = []
    for d in E:
        g = tr_groups([d])
        glosses = [set(WORD.findall((s['raw'] or s['gloss'] or '').lower())) - STOP for s in d['senses'] if not s['form_of']]
        first = next((s['gloss'] for s in d['senses'] if s['gloss'] and not s['form_of']), None)
        for n, (key, tr) in enumerate(g.items()):
            kw = set(WORD.findall((key or '').lower())) - STOP
            best = max(range(len(glosses)), key=lambda i: (len(kw & glosses[i]), -i)) if glosses and kw else None
            pos = best if best is not None and kw & glosses[best] else len(glosses) + n
            out.append({'gloss': None, 'gloss_en': key or first, 'tr': tr, 'base': 'enw-en', '_pos': (pos, n)})
    out.sort(key=lambda s: s['_pos'])
    return out


def gloss_senses(E):
    """English words named in the English Wiktionary's definitions of a German/French/Portuguese word"""
    out = []
    for x in E:
        for s in x['senses']:
            if s['form_of'] or s['alt_of'] or iw.BAD & set(s['tags']): continue
            gw = [w for w in gloss_words(s['gloss']) if resolve('en', w, x['pos'])]
            if gw: out.append({'gloss': None, 'gloss_en': s['gloss'], 'tr': {'en': gw}, 'base': 'en-gloss'})
    return out


ROUTE = {'ed-de': 'de-edition', 'ed-fr': 'fr-edition', 'ed-pt': 'pt-edition', 'ed-cs': 'cs-edition', 'ed-it': 'it-edition', 'ed-es': 'es-edition', 'ed-nl': 'nl-edition', 'enw-en': 'en-edition', 'en-gloss': 'en-edition'}
stats = collections.Counter()


_TR = {}


def trmaps(src):
    """the translation rows of one source in memory:
       by_target[(tl, tw)] -> [(word, pos, sense)],  groups[(word, pos, sense)] -> {tl: [tw]},  by_word[word] -> [(pos, sense, tl, tw)]"""
    if src not in _TR:
        by_target = collections.defaultdict(list); groups = collections.defaultdict(lambda: collections.defaultdict(list)); by_word = collections.defaultdict(list)
        for word, pos, sense, tl, tw in db(src).execute('select word, pos, sense, tl, tw from tr'):
            by_target[(tl, tw)].append((word, pos, sense)); groups[(word, pos, sense)][tl].append(tw); by_word[word].append((pos, sense, tl, tw))
        _TR[src] = (by_target, groups, by_word)
    return _TR[src]


def other_edition(T, L, w, en_words, single):
    """T-edition entries that list (L, w) as translation; with a sense check on their English translations"""
    if T == 'en': return []
    by_target, groups, _ = trmaps(EDITION[T])
    out = []
    for key in by_target.get((L, w), ()):
        ens = {norm_target('en', x) for x in groups[key].get('en', ())}
        if (ens & set(en_words)) or (single and not ens):
            out.append(key[0])
    return uniq(out)


def via_en(T, L, w, en_words, pc):
    _, _, by_word = trmaps('enw-en')
    cands = []
    for ew in en_words:
        rows = by_word.get(ew, ())
        anysame = any(POS_MAP.get(r[0]) == POS_MAP.get(pc) for r in rows)
        groups = collections.defaultdict(list)
        for p, sense, tl, tw in rows:
            if POS_MAP.get(p) == POS_MAP.get(pc) or not anysame:
                groups[(p, sense)].append((tl, tw))
        for gr in groups.values():
            if (L, w) in gr: cands += [x for l, x in gr if l == T]
    return uniq(cands)


def via_en_unchecked(T, en_words, pc):
    if len(en_words) != 1: return []
    _, _, by_word = trmaps('enw-en')
    groups = collections.defaultdict(list)
    for p, sense, tl, tw in by_word.get(en_words[0], ()):
        if tl == T and POS_MAP.get(p) == POS_MAP.get(pc): groups[(p, sense)].append(tw)
    return list(groups.values())[0] if len(groups) == 1 else []


def make_senses(L, w, pc, N, E, tier):
    raw = english_senses(E, pc) if L == 'en' else native_senses(L, N)
    if L != 'en' and not any(s['tr'].get('en') for s in raw):
        gs = gloss_senses(E)
        if len(raw) == 1 and gs:            # one native sense without English: add the English definition words
            raw[0]['tr']['en'] = [x for s in gs for x in s['tr']['en']][:4]; raw[0]['gloss_en'] = gs[0]['gloss_en']; raw[0]['en_from_gloss'] = True
        elif not raw:
            raw = gs
    out = []; seen = set(); single = len(raw) == 1
    for s in raw:
        if len(out) >= MAX_SENSES[tier]: break
        tr, route = {}, {}
        en_words = uniq(norm_target('en', x) for x in s['tr'].get('en', [])) if L != 'en' else [w]
        for T in LANGS:
            if T == L: continue
            ids = uniq(x for x in (resolve(T, y, pc) for y in s['tr'].get(T, [])) if x)
            r = 'en-edition' if (T == 'en' and (s['base'] == 'en-gloss' or s.get('en_from_gloss'))) else ROUTE[s['base']]
            if not ids and L != 'en':
                ids = uniq(x for x in (resolve(T, y, pc) for y in other_edition(T, L, w, en_words, single)) if x); r = T + '-edition'
                if not ids and T != 'en':
                    ids = uniq(x for x in (resolve(T, y, pc) for y in via_en(T, L, w, en_words, pc)) if x); r = 'via-en'
                if not ids and T != 'en':
                    ids = uniq(x for x in (resolve(T, y, pc) for y in via_en_unchecked(T, en_words, pc)) if x); r = 'via-en-unchecked'
            tr[T] = ids[:4]; route[T] = r if ids else 'none'
        if not any(tr.values()): continue
        sig = tuple(tuple(tr[T]) for T in sorted(tr))
        if sig in seen: continue
        seen.add(sig)
        if L == 'en': gl = s.get('gloss_en') or None
        else:
            gl = s.get('gloss_en') or (', '.join(('to ' if pc == 'verb' else '') + lemma_of(x) for x in tr.get('en', [])[:4]) or None)
        out.append({'id': 's%d' % (len(out) + 1), 'gloss_en': gl, 'gloss': s.get('gloss'), 'register': None,
                    'translations': tr, 'route': route, 'origin': 'wiktionary'})
        for T in tr: stats[(L, T, route[T])] += 1
    return out


def lemma_of(i):
    return i.split(':')[1]


# ---------------------------------------------------------------- grammar
def de_gender(d):
    g = [iw.GENDER[t] for t in d['tags'] if t in iw.GENDER]
    return g[0] if g else None


def two(forms):
    return [(f[0], f[1]) for f in forms]


def grammar(L, w, pc, N, E, e, disagreements):
    """fills e['noun'|'verb'|'adjective'] and e['ipa']; reuses the Phase 1 rules"""
    o = e['origin']
    if L == 'de':
        dforms = [tuple(f[:4]) for d in N for f in d['forms']]
        eforms = [tuple(f[:2]) for d in E for f in d['forms']]
        ipa, reg = iw.pick_ipa('de', [x for d in N for x in d['ipa']] + [x for d in E for x in d['ipa']])
        e['ipa'] = {'default': ipa, 'regional': reg}
        if ipa: o['ipa'] = 'wiktionary'
        g = _de_grammar(w, pc, N, E, dforms, eforms, e, disagreements)
        return
    srcs = [x for d in E for x in d['ipa']] + [x for d in N for x in d['ipa']]
    ipa, reg = iw.pick_ipa(L, srcs)
    e['ipa'] = {'default': ipa, 'regional': reg}
    if ipa and any(clean_ipa(r) == ipa and r.strip().startswith('[') for r, _ in srcs) and not any(clean_ipa(r) == ipa and r.strip()[:1] in '/\\' for r, _ in srcs):
        e['ipa']['narrow'] = True
    if ipa: o['ipa'] = 'wiktionary'
    _linked_grammar(L, w, pc, N, E, e)


class _Shim:
    """minimal stand-in for the pilot's source object, so the Phase 1 grammar code can be reused"""
    def __init__(self, L, w, N, E):
        self.enw = {L: {w: [dict(d, forms=two(d['forms'])) for d in E]}}
        self.native = {L: {w: [dict(d, forms=two(d['forms'])) for d in N]}}
        self.freq = {L: {}}


def _linked_grammar(L, w, pc, N, E, e):
    iw.S = _Shim(L, w, N, E)
    tmp = iw.build_linked(L, w, pc)
    for k in ('noun', 'verb', 'adjective'): e[k] = tmp[k]
    for k, v in tmp['origin'].items():
        if k.split('.')[0] in ('noun', 'verb', 'adjective'): e['origin'][k] = v
    if not e['more']['definition'] and tmp['more']['definition']: e['more']['definition'] = tmp['more']['definition']; e['origin']['more.definition'] = 'wiktionary'
    if not e['more']['etymology'] and tmp['more']['etymology']: e['more']['etymology'] = tmp['more']['etymology']; e['origin']['more.etymology'] = 'wiktionary'


def _de_grammar(lemma, pc, D, E, dforms, eforms, e, disagreements):
    """German noun/verb/adjective blocks and prepositions + case: the Phase 1 code, run on one entry"""
    if 'de' not in _CODE:
        src = open(iw.__file__, encoding='utf-8').read()
        a = src.index("    dforms = [f for d in D for f in d['forms']]"); b = src.index("    def emit(senses):")
        body = src[a:b].replace("    dforms = [f for d in D for f in d['forms']]\n    eforms = [f for d in E for f in d['forms']]\n", "")
        ns = dict(vars(iw))
        exec(compile('def _f(lemma, pc, D, E, dforms, eforms, e, o, disagreements):\n' + body + '    return e\n', 'de_grammar', 'exec'), ns)
        _CODE['de'] = ns['_f']
    _CODE['de'](lemma, pc, D, E, dforms, eforms, e, e['origin'], disagreements)


_CODE = {}


# ---------------------------------------------------------------- entries
def new(L, w, pos, tier, rank, n=1):
    e = iw.new_entry(L, w, pos, n)
    e['tier'] = tier; e['frequency_rank'] = rank
    for k in ('noun', 'verb', 'adjective'):
        e[k] = None
    return e


def background(L, w, pc, N, E, e, senses_raw_idx):
    o = e['origin']; D = N
    if L == 'en': D = E
    gl = uniq(s['gloss'] for x in E for s in x['senses'] if s['gloss'] and not s['form_of'] and not iw.BAD & set(s['tags']))
    if gl: e['more']['definition'] = '; '.join(gl[:3]); o['more.definition'] = 'wiktionary'
    et = next((iw.etym_text(x['etym']) for x in E if iw.etym_text(x['etym'])), None) or next((iw.etym_text(d['etym']) for d in N if iw.etym_text(d['etym'])), None)
    if et: e['more']['etymology'] = et; o['more.etymology'] = 'wiktionary'
    idi = uniq((x + (' — ' + n if n else '')) for d in D for x, n in d['expr'])[:6]
    if idi: e['more']['idioms'] = idi; o['more.idioms'] = 'wiktionary'
    fam = uniq(x for d in D for x in d['derived'] if ' ' not in x)[:8] or uniq(x for d in E for x in d['derived'] + d['related'] if ' ' not in x)[:8]
    if fam: e['more']['word_family'] = fam; o['more.word_family'] = 'wiktionary'
    ant = uniq(x for d in D for x, idx in d['ant'])[:5] or uniq(x for d in E for s in d['senses'] for x in s['ant'])[:5]
    if ant: e['more']['antonyms'] = ant; o['more.antonyms'] = 'wiktionary'
    syn = uniq(x for d in D for x, idx, tags in d['syn'] if not set(tags) & iw.BAD)[:6] or uniq(x for d in E for s in d['senses'] for x in s['syn'])[:6]
    for x in syn:
        i = resolve(L, x, pc)
        if i and i != e['id']: e['synonyms'].append(i)
        elif not i: e['synonyms_text'].append(x)
    e['synonyms'] = uniq(e['synonyms'])
    if e['synonyms'] or e['synonyms_text']: o['synonyms'] = 'wiktionary'


def slim_tier(e):
    """drop the fields the extended and long-tail tiers do not carry"""
    keep = {'id', 'lang', 'lemma', 'pos', 'tier', 'senses', 'origin'}
    if e['tier'] == 'ext':
        keep |= {'level', 'frequency_rank', 'ipa'}
        if e['noun']: e['noun'] = {'gender': e['noun']['gender'], 'plural': e['noun']['plural']}; keep.add('noun')
        if e['verb']: e['verb'] = {'aux': e['verb']['aux'], 'aux_regional': e['verb']['aux_regional']}; keep.add('verb')
    for s in e['senses']:
        s.pop('gloss', None); s.pop('register', None)
        if e['tier'] == 'tail': s.pop('gloss_en', None)
    out = {k: v for k, v in e.items() if k in keep}
    out['origin'] = {k: v for k, v in e['origin'].items() if k.split('.')[0] in out}
    return out


def build_language(L):
    lem, forms = inv(L)
    out = gzip.open(os.path.join(WORK, 'p1_%s.jsonl.gz' % L), 'wt', encoding='utf-8')
    links = gzip.open(os.path.join(WORK, 'links_%s.jsonl.gz' % L), 'wt', encoding='utf-8')
    tables = gzip.open(os.path.join(WORK, 'tables_%s.jsonl.gz' % L), 'wt', encoding='utf-8')     # core: Wiktionary form tables
    disagreements = []; n = 0; tiers = collections.Counter()
    order = sorted(lem, key=lambda w: (lem[w]['rank'] or 10 ** 9, w))
    if os.environ.get('LIMIT'): order = order[:int(os.environ['LIMIT'])]
    for w in order:
        info = lem[w]; tier = info['tier']
        R = {s: recs(s, w) for s in SOURCES[L]}
        for pos in uniq(POS_MAP[p] for p in info['pos'] if p in POS_MAP and POS_MAP[p] != 'name'):
            codes = [p for p in info['pos'] if POS_MAP.get(p) == pos]
            pc = codes[0]
            N = [d for s in SOURCES[L] if s.startswith('ed-') for d in R[s] if POS_MAP.get(d['pos']) == pos]
            E = [d for s in SOURCES[L] if s.startswith('enw-') for d in R[s] if POS_MAP.get(d['pos']) == pos]
            if L == 'en': N = []
            groups = [(N, E)]
            if L == 'de' and pos == 'noun' and tier != 'tail':
                gs = uniq(de_gender(d) for d in N if de_gender(d))
                if len(gs) > 1:
                    groups = [([d for d in N if de_gender(d) == g], [x for x in E if (iw.en_gender(x) or g) == g]) for g in gs]
            k = 0
            for Ng, Eg in groups:
                k += 1
                e = new(L, w, pos, tier, info['rank'], k)
                if tier != 'tail':
                    grammar(L, w, pc, Ng, Eg, e, disagreements)
                e['senses'] = make_senses(L, w, pc, Ng, Eg, tier)
                if e['senses']: e['origin']['senses'] = 'wiktionary'
                if tier == 'core':
                    background(L, w, pc, Ng, Eg, e, None)
                    t = {'dewikt': [list(f[:4]) for d in Ng for f in d['forms']], 'enwikt': [[f[0], f[1]] for d in Eg for f in d['forms']],
                         'enw': [{'pos': d['pos'], 'forms': [[f[0], f[1]] for f in d['forms']]} for d in Eg]}
                    tables.write(json.dumps([e['id'], t], ensure_ascii=False) + '\n')
                    if L != 'de': e['governs'] = []
                else:
                    e = slim_tier(e)
                if k > 1 and not e['senses']: continue
                out.write(json.dumps(e, ensure_ascii=False) + '\n'); n += 1; tiers[tier] += 1
                for s in e['senses']:
                    for T, ids in s['translations'].items():
                        for t in ids:
                            links.write(json.dumps([e['id'], t, info['rank'] or 10 ** 9, s.get('gloss_en'), s['translations'], s['route']], ensure_ascii=False) + '\n')
        if n and n % 20000 == 0: print(L, n, 'entries', flush=True)
    out.close(); links.close(); tables.close()
    wjson(os.path.join(WORK, 'p1_stats_%s.json' % L), {'entries': n, 'tiers': tiers, 'routes': {'/'.join(k): v for k, v in stats.items()}, 'disagreements': disagreements}, indent=1)
    print(L, 'entries', n, dict(tiers), flush=True)


def build_one(L, w, pos):
    """a full (core-tier) entry for one word, used when the saved library needs a word outside the core"""
    lem, _ = inv(L)
    info = lem.get(w)
    if not info: return None
    codes = [p for p in info['pos'] if POS_MAP.get(p) == pos] or [p for p in info['pos'] if p in POS_MAP]
    if not codes: return None
    pc = codes[0]; pos = POS_MAP[pc]
    R = {s: recs(s, w) for s in SOURCES[L]}
    N = [d for s in SOURCES[L] if s.startswith('ed-') for d in R[s] if POS_MAP.get(d['pos']) == pos]
    E = [d for s in SOURCES[L] if s.startswith('enw-') for d in R[s] if POS_MAP.get(d['pos']) == pos]
    if L == 'en': N = []
    e = new(L, w, pos, 'core', info['rank'])
    grammar(L, w, pc, N, E, e, [])
    e['senses'] = make_senses(L, w, pc, N, E, 'core')
    if e['senses']: e['origin']['senses'] = 'wiktionary'
    background(L, w, pc, N, E, e, None)
    if L != 'de': e['governs'] = []
    t = {'dewikt': [list(f[:4]) for d in N for f in d['forms']], 'enwikt': [[f[0], f[1]] for d in E for f in d['forms']],
         'enw': [{'pos': d['pos'], 'forms': [[f[0], f[1]] for f in d['forms']]} for d in E]}
    return e, t


if __name__ == '__main__':
    if sys.argv[1] == '--links':
        import link_entries; link_entries.main()
    else:
        build_language(sys.argv[1])
