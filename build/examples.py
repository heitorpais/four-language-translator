"""Phase 4: attach up to 4 Tatoeba sentences to every core entry, in all five languages.

A sentence qualifies when it contains the lemma or one of its forms from the Wiktionary tables.
Sentences with a direct translation into all three other languages are preferred, then short everyday
sentences (4 to 10 words).  Each example keeps its Tatoeba number and the authors' user names
(CC BY 2.0 FR).  Translations are only Tatoeba's direct links between the two sentences (never through a third
language); a Portuguese translation is Brazilian where Tatoeba has one, and is marked variant "PT" when it is
European Portuguese.  Reads and writes build/work/core.json (all core entries)."""
import sys, os, re, bz2, gzip, json, heapq, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import unicodedata

T = os.path.join(RAW, 'tatoeba')
L3 = {'de': 'deu', 'en': 'eng', 'fr': 'fra', 'pt': 'por', 'cs': 'ces', 'it': 'ita', 'es': 'spa', 'nl': 'nld', 'sv': 'swe', 'la': 'lat'}
_T3 = ['deu', 'eng', 'fra', 'por', 'ces', 'ita', 'spa', 'nld', 'swe', 'lat']
# every pair of the ten languages, read from whichever link file Tatoeba offers (deu-eng or eng-deu)
PAIRS = [(a, b) if os.path.exists(os.path.join(RAW, 'tatoeba', '%s-%s_links.tsv.bz2' % (a, b))) else (b, a)
         for i, a in enumerate(_T3) for b in _T3[i + 1:]
         if os.path.exists(os.path.join(RAW, 'tatoeba', '%s-%s_links.tsv.bz2' % (a, b))) or os.path.exists(os.path.join(RAW, 'tatoeba', '%s-%s_links.tsv.bz2' % (b, a)))]
TOK = re.compile(r"[A-Za-zÀ-ÖØ-öø-ɏ]+")
SKIP = {'table-tags', 'inflection-template', 'class', 'auxiliary', 'abbreviation', 'diminutive', 'multiword-construction', 'romanization'}
PRON = {'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'man', 'zu', 'am'}
PARTICLES = {'ab', 'an', 'auf', 'aus', 'bei', 'ein', 'fest', 'her', 'hin', 'los', 'mit', 'nach', 'vor', 'weg', 'zu', 'zurück', 'zusammen',
             'weiter', 'um', 'durch', 'vorbei', 'raus', 'rein', 'heraus', 'herein', 'hinaus', 'statt', 'teil', 'wieder', 'über', 'unter',
             'nieder', 'fort', 'heim', 'kennen', 'da', 'dabei', 'herum', 'hoch', 'runter', 'rüber', 'frei'}
PER_ENTRY = 4


# European Portuguese signs (Portugal) and Brazilian signs. A Portuguese translation counts as European when it shows more
# signs of Portugal than of Brazil; Brazilian ones are preferred, European ones are marked variant "PT".
PT_SIGNS = [re.compile(x, re.I) for x in [
    r"\b(estou|est[áa]s|est[áa]|estamos|est[ãa]o|estava|estavas|est[áa]vamos|estavam|estive|esteve|continu[oa]|continuam|ando|anda|andam|fic[oa]|ficam|ficou|passo|passa)\s+a\s+\w+(ar|er|ir|or)\b",
    r"\b(tens|est[áa]s|és|podes|queres|vais|fazes|sabes|vês|dizes|tinhas|foste|querias|gostas|precisas|deves|consegues|achas|vens|sabias|estiveste|fizeste|disseste|viste|pensas|falas|comes|bebes|moras|trabalhas|chamas|pareces|lembras|importas|tiveste|percebes)\b",
    r"\bvós\b", r"\bvosso|vossa|vossos|vossas\b",
    r"\b(comboios?|autocarros?|telemóve(l|is)|pequeno-almoço|casa de banho|frigorífico|sumos?|ecrã|equipas?|utilizador(es)?|raparigas?|rapaz(es)?|miúd[oa]s?|fixe|talho|guarda-redes|apelidos?|contactos?|facto|óptim[oa]s?|acç[ãa]o|actua(l|is)|direcç[ãa]o|connosco|registo|percebo|percebes|bicha|casa-de-banho|pequeno almoço|propina|carris|pastelaria|portagem|telemovel|camioneta|esplanada)\b",
    r"\w*(ónic|ómic|ómen|ónom|énc|ténis|bebé|génio|António|económ|polémic|académic|cómod|fenómen|anónim|sinónim)\w*",
    r"\b\w+-(lo|la|los|las)-(ei|ás|á|emos|ão)\b", r"\b(dar-te-ei|dir-te-ei|far-te-ei)\b"]]
BR_SIGNS = [re.compile(x, re.I) for x in [
    r"\b(estou|est[áa]|estamos|est[ãa]o|estava|estavam|estive|esteve|fico|fica|ficou|continu[oa]|vou|vai|vamos|v[ãa]o)\s+\w+(ando|endo|indo|ondo)\b",
    r"\b(você|vocês|pra|pro|né|tá|tô|a gente|cadê|legal|ônibus|trem|celular|café da manhã|banheiro|geladeira|sucos?|tela|times?|usuári[oa]s?|garot[oa]s?|moleques?|menin[oa]s?|bonde|açougue|goleiro|sobrenomes?|contato|fato|ótim[oa]s?|ação|atua(l|is)|direção|conosco|registro|entendo|fila)\b",
    r"\w*(ônic|ômic|ômen|ênci|tênis|bebê|gênio|Antônio|econôm|polêmic|acadêmic|cômod|fenômen|anônim|sinônim)\w*"]]


def pt_european(text):
    p = sum(1 for r in PT_SIGNS if r.search(text)); b = sum(1 for r in BR_SIGNS if r.search(text))
    return p > b


def T_(v): return v.split('\x00', 1)[0]           # a stored sentence is "text" or "text\x00user" (less memory than a pair)
def U_(v): return v.split('\x00', 1)[1] if '\x00' in v else None


def pick(o, ids, text, sent_o):
    """the direct translation to show: Brazilian Portuguese first, then the length closest to the source sentence"""
    if o == 'pt':
        return min(ids, key=lambda x: (pt_european(T_(sent_o[x])), abs(len(T_(sent_o[x])) - len(text)), x))
    return min(ids, key=lambda x: (abs(len(T_(sent_o[x])) - len(text)), x))


def tsv(name):
    with bz2.open(os.path.join(T, name), 'rt', encoding='utf-8') as f:
        for line in f:
            yield line.rstrip('\n').split('\t')


def prepare():
    """first process: only the parts of the entries this step reads, written to a file, so that the process that holds
    the Tatoeba sentences never has the full entries in memory"""
    core = rjson(os.path.join(WORK, 'core.json'))
    tables = {}
    for L in list(LANGS) + ['library']:
        fn = os.path.join(WORK, 'tables_%s.jsonl.gz' % L)
        if not os.path.exists(fn): continue
        for line in gzip.open(fn, 'rt', encoding='utf-8'):
            i, t = json.loads(line)
            if i in core: tables[i] = t
    light = {i: {k: e.get(k) for k in ('lang', 'pos', 'lemma', 'frequency_rank', 'examples', 'governs', 'origin')} for i, e in core.items()}
    wjson(os.path.join(WORK, 'examples_in.json'), {'core': light, 'tables': tables})


def main():
    d = rjson(os.path.join(WORK, 'examples_in.json')); core, tables = d['core'], d['tables']; del d
    import gc
    sent = {}
    for l in L3.values():
        d = {}
        for p in tsv('%s_sentences_detailed.tsv.bz2' % l):
            if len(p) >= 4: d[int(p[0])] = p[2] if p[3] == r'\N' else p[2] + '\x00' + p[3]
        sent[l] = d
    def usable(text):        # the sentences that can become examples (the same test as below)
        if len(text) > 90 or len(text) < 8 or re.search(r'[\d"„“”»«:;()\[\]/]', text): return False
        return 3 <= sum(1 for _ in TOK.finditer(text)) <= 13
    ok = {l: {i for i, v in d.items() if usable(T_(v))} for l, d in sent.items()}
    # sentence -> linked sentence ids of every language in one list (the language is found from the id), kept only for
    # sentences that can become examples: a nested dict for every sentence does not fit in memory with ten languages
    links = {l: collections.defaultdict(list) for l in L3.values()}
    for a, b in PAIRS:
        for p in tsv('%s-%s_links.tsv.bz2' % (a, b)):
            x, y = int(p[0]), int(p[1])
            if x in ok[a]: links[a][x].append(y)
            if y in ok[b]: links[b][y].append(x)
    del ok; gc.collect()
    print('sentences', {l: len(v) for l, v in sent.items()}, flush=True)
    stats = {}
    for L in LANGS:
        l3 = L3[L]; others = [x for x in LANGS if x != L]
        # Latin dictionaries mark long vowels (amō); Tatoeba sentences do not: compare without the marks
        lkey = (lambda w: ''.join(ch for ch in unicodedata.normalize('NFD', w.lower()) if not unicodedata.combining(ch))) if L == 'la' else (lambda w: w.lower())
        ents = {i: e for i, e in core.items() if e['lang'] == L and e['pos'] in POS_MAP.values()}
        exact = collections.defaultdict(set); lower = collections.defaultdict(set); pairs = collections.defaultdict(set)
        for i, e in ents.items():
            lemma = e['lemma']; t = tables.get(i, {'dewikt': [], 'enwikt': []})
            if ' ' in lemma: continue
            forms = {lemma}
            for f in t['dewikt']:
                if SKIP & set(f[1]): continue
                w = re.sub(r'^(der|die|das|des|dem|den) ', '', f[0].rstrip('!'))
                toks = w.split()
                if len(toks) == 1: forms.add(w)
                elif L == 'de' and len(toks) == 2 and e['pos'] == 'verb' and lemma.startswith(toks[1]) and len(toks[1]) >= 2 \
                        and toks[0].lower() not in PRON and len(lemma) > len(toks[1]) + 3:
                    pairs[toks[0].lower()].add((toks[1].lower(), i))
            for f, tg in t['enwikt']:
                if SKIP & set(tg) or ' ' in f or 'obsolete' in tg or 'archaic' in tg: continue
                forms.add(f)
            for w in forms:
                if not TOK.fullmatch(w): continue
                if L == 'de' and lemma[0].isupper(): exact[w].add(i)
                else: lower[lkey(w)].add(i)
        cand = collections.defaultdict(list)
        own = sent[l3]
        for sid, v in own.items():
            text, user = T_(v), U_(v)
            if len(text) > 90 or len(text) < 8 or re.search(r'[\d"„“”»«:;()\[\]/]', text): continue
            toks = [(m.group(), m.start(), m.end()) for m in TOK.finditer(text)]
            n = len(toks)
            if n < 3 or n > 13: continue
            lk = links[l3].get(sid, ())
            ntr = sum(1 for o in others if any(x in sent[L3[o]] for x in lk))
            # more translated languages, better (de/en/fr/pt matter most)
            base = (100 + 3 * (ntr - 3) if ntr >= 3 else {2: 40, 1: 10, 0: 0}[ntr]) - abs(n - 7) * 2 - (4 if not user else 0)
            lows = [t[0].lower() for t in toks]
            for k, (w, a, b) in enumerate(toks):
                first = k == 0 or text[:a].rstrip()[-1:] in '.!?¿¡'
                hits = set(exact.get(w, ()))
                if L != 'de' or w.islower() or first: hits |= lower.get(lkey(w), set())
                amb = len({ents[i]['lemma'] for i in hits})
                for i in hits:
                    sc = base + (15 if amb == 1 else 0) - (6 if first else 0)
                    if L == 'de' and ents[i]['pos'] == 'verb' and lows[-1] in PARTICLES and k < n - 1 and not ents[i]['lemma'].lower().startswith(lows[-1]): sc -= 80
                    heapq.heappush(cand[i], (sc, sid, a, b, w.lower()))
                    if len(cand[i]) > 40: heapq.heappop(cand[i])
                if L == 'de' and (w.islower() or first) and w.lower() in pairs:
                    for part, i in pairs[w.lower()]:
                        if part in lows[k + 1:]:
                            heapq.heappush(cand[i], (base + 20, sid, a, b, w.lower()))
                            if len(cand[i]) > 40: heapq.heappop(cand[i])
        used = collections.Counter(); nex = 0; full = 0
        for i in sorted(cand, key=lambda i: ents[i]['frequency_rank'] or 10 ** 9):
            e = ents[i]; chosen = []; seen_forms = set(); starts = set()
            pool = sorted(cand[i], reverse=True)
            while pool and len(chosen) < PER_ENTRY:
                best = max(pool, key=lambda c: c[0] - 12 * used[c[1]] - (8 if c[4] in seen_forms else 0) - (25 if ' '.join(T_(own[c[1]]).split()[:3]) in starts else 0))
                pool.remove(best)
                if any(best[1] == c[1] for c in chosen): continue
                chosen.append(best); seen_forms.add(best[4]); used[best[1]] += 1; starts.add(' '.join(T_(own[best[1]]).split()[:3]))
            e['examples'] = [x for x in e['examples'] if x['origin'] != 'tatoeba']
            for sc, sid, a, b, w in chosen:
                text, user = T_(own[sid]), U_(own[sid])
                tr, tid, credit, variant = {}, {}, {L: user}, {}
                if L == 'pt' and pt_european(text): variant['pt'] = 'PT'
                for o in others:
                    ids = sorted(x for x in links[l3].get(sid, ()) if x in sent[L3[o]])
                    if ids:
                        best = pick(o, ids, text, sent[L3[o]])
                        tr[o] = T_(sent[L3[o]][best]); tid[o] = 't:%d' % best; credit[o] = U_(sent[L3[o]][best])
                        if o == 'pt' and pt_european(tr[o]): variant['pt'] = 'PT'
                    else:
                        tr[o] = None
                e['examples'].append({'id': 't:%d' % sid, 'text': text, 'hl': [a, b], 'translations': tr, 'translation_ids': tid,
                                      'credits': credit, 'origin': 'tatoeba', **({'variant': variant} if variant else {})})
                nex += 1; full += all(tr.values())
            if e['examples']: e['origin']['examples'] = 'tatoeba'
            for g in e['governs']:
                if g.get('example_id') and not any(x['id'] == g['example_id'] for x in e['examples']): g['example_id'] = None
                if g['prep']:
                    ex = next((x for x in e['examples'] if re.search(r'\b' + re.escape(g['prep']) + r'\b', x['text'], re.I)), None)
                    if ex: g['example_id'] = ex['id']
        stats[L] = {'core entries': len(ents), 'with examples': sum(1 for e in ents.values() if e['examples']),
                    'with 4': sum(1 for e in ents.values() if len(e['examples']) >= 4), 'examples': nex, 'with all three translations': full}
        print(L, stats[L], flush=True)
    # the full entries are merged in a fresh process: this one keeps the memory of the sentences
    wjson(os.path.join(WORK, 'examples_tmp.json'), core)
    wjson(os.path.join(REPORTS, 'tatoeba_stats.json'), stats, indent=1)


def merge():
    core = rjson(os.path.join(WORK, 'core.json')); light = rjson(os.path.join(WORK, 'examples_tmp.json'))
    for i, e in light.items():
        core[i]['examples'] = e['examples']; core[i]['governs'] = e['governs']; core[i]['origin'] = e['origin']
    wjson(os.path.join(WORK, 'core.json'), core)
    os.remove(os.path.join(WORK, 'examples_tmp.json')); os.remove(os.path.join(WORK, 'examples_in.json'))
    print('merged', len(light))


if __name__ == '__main__':
    me = [sys.executable, '-I', os.path.abspath(__file__)]
    if sys.argv[1:] == ['--merge']: merge()
    elif sys.argv[1:] == ['--run']:
        main(); sys.stdout.flush(); os.execv(sys.executable, me + ['--merge'])
    else:
        prepare(); sys.stdout.flush(); os.execv(sys.executable, me + ['--run'])
