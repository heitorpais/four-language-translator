"""Phase 5 fix: which part of speech comes first when one spelling is both a noun and a verb
(poder, pouvoir, can, water, walk). The frequency list counts the spelling, not the part of speech, so both entries
have the same rank and the lookup used to pick the one with more translations ("poder" opened as the noun "power").

For each such pair of core entries this step counts, in the Tatoeba sentences of the language:
  * forms only one of the two has (posso, pode, could, can't  ->  verb;  poderes, cans  ->  noun), and
  * the shared spelling after typical words: a/the/my/le/la/o/a/um … -> noun; to/I/we/je/vou/posso/para … -> verb.
It stores pos_share (0..1, the verb's or the noun's share of those uses) on both entries; the app puts the higher
share first when the frequency rank is the same. German needs none: nouns are capitalised.
Then, for every spelling that has several core entries with the same frequency rank (and: conjunction, noun, verb),
it decides the order in which they open (pos_order, 0 first):
  * minor entries go last and lose their frequency rank (so no level, no place in browse or practice): entries with no
    sense left, entries whose Wiktionary senses are all rare, obsolete, archaic, dialectal, nonstandard or uncommon
    ("to and"), and all-capital abbreviations of a lower-case word (AND, CAN);
  * the others by their most common translation (well, adverb -> gut comes before well, noun -> Brunnen), then by the
    number of senses; noun and verb of a pair swapped by pos_share where needed.
Reads and writes build/work/core.json.  Run:  python3 -I build/pos_share.py"""
import sys, os, re, bz2, json, collections, sqlite3, zlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from generate_forms import forms, NEGATIVE

T = os.path.join(RAW, 'tatoeba')
L3 = {'en': 'eng', 'fr': 'fra', 'pt': 'por', 'cs': 'ces', 'it': 'ita', 'es': 'spa', 'nl': 'nld', 'sv': 'swe', 'la': 'lat'}
TOK = re.compile(r"[a-zà-ÿœçā-ž]+(?:['’][a-z]+)?")
NOUN_CUE = {
    'en': 'a an the my your his her its our their this that these those some any no every each another',
    'fr': "le la les l' un une des du au aux mon ton son ma ta sa mes tes ses notre votre nos vos leur leurs ce cet cette ces",
    'pt': 'o a os as um uma uns umas do da dos das no na nos nas meu minha meus minhas seu sua seus suas nosso nossa esse essa este esta pelo pela ao aos',
    'cs': 'můj moje tvůj tvoje jeho její náš naše váš vaše jejich ten ta to ty ti tento tato toto ten jeden jedna jedno nějaký nějaká žádný žádná',
    'it': 'il lo la i gli le un uno una del della dei degli delle al alla mio mia miei mie tuo tua suo sua nostro nostra questo questa quel quella',
    'es': 'el la los las un una unos unas del al mi mis tu tus su sus nuestro nuestra este esta ese esa aquel',
    'nl': 'de het een mijn jouw zijn haar ons onze hun deze dit die dat geen elke',
    'sv': 'en ett min mitt mina din ditt dina hans hennes vår vårt våra deras den det denna detta',
    'la': 'meus mea meum tuus tua tuum suus sua suum noster nostra hic haec hoc ille illa illud',
}
VERB_CUE = {
    'en': "to i you we they he she it not will would can could should must might may don't doesn't didn't won't let's never also just",
    'fr': "je j' tu il elle on nous vous ils elles ne pas peux peut pouvons pouvez peuvent veux veut voulons voulez veulent dois doit devons devez doivent vais va allons allez vont faut pour sans",
    'pt': 'eu tu ele ela nós vocês eles elas não vou vai vamos vão quero quer queremos posso pode podemos preciso precisa devo deve para sem consigo consegue',
    'cs': 'já ty on ona my vy oni chci chce chceme můžu může můžeme musím musí musíme budu bude budeme nechci nemůžu se si',
    'it': 'io tu lui lei noi voi loro non voglio vuole posso può devo deve mi ti si ci vi',
    'es': 'yo tú él ella nosotros ellos ellas no quiero quiere puedo puede debo debe voy va vamos me te se nos',
    'nl': 'ik jij je hij zij we wij jullie ze niet wil kan moet ga gaat zal te',
    'sv': 'jag du han hon vi ni de inte vill kan måste ska skulle att',
    'la': 'ego tu nos vos non volo vult possum potest debeo debet',
}


RARE = {'rare', 'obsolete', 'archaic', 'dialectal', 'nonstandard', 'uncommon', 'nonce-word', 'proscribed', 'dated', 'misspelling', 'eye-dialect', 'pronunciation-spelling'}
PRIO = ['article', 'pronoun', 'preposition', 'conjunction', 'determiner', 'verb', 'noun', 'adjective', 'adverb', 'particle', 'numeral', 'interjection']
DBPOS = {'adjective': 'adj', 'adverb': 'adv', 'numeral': 'num', 'pronoun': 'pron', 'preposition': 'prep', 'conjunction': 'conj',
         'interjection': 'intj', 'determiner': 'det', 'article': 'article', 'particle': 'particle'}
_db = {}
SAVED = {}


def all_rare(e):
    """True when every Wiktionary (English edition) sense of the entry carries a rare/obsolete/dialectal … label"""
    L = e['lang']
    if L not in _db: _db[L] = sqlite3.connect('file:' + os.path.join(RAW, 'db', 'enw-%s.sqlite' % L) + '?mode=ro', uri=True)
    tags = []
    for (b,) in _db[L].execute('select data from entry where word=? and pos=?', (e['lemma'], DBPOS.get(e['pos'], e['pos']))):
        for x in json.loads(zlib.decompress(b))['senses']:
            if x.get('form_of') or x.get('alt_of'): continue
            tags.append(set(x['tags']))
    return bool(tags) and all(t & RARE for t in tags)


def best_tr(core, e):
    """the frequency rank of the most common word this entry translates to, counting only translations of the same
    part of speech (well, adverb -> gut comes before well, noun -> Brunnen); many distinct translations count in its favour, one lone link a hundred times less"""
    t = {x for s in e['senses'] for ids in s['translations'].values() for x in ids
         if x in core and core[x]['frequency_rank'] and core[x].get('pos_order', 0) < 50 and core[x]['pos'] == e['pos']}
    if not t: return 10 ** 9
    best = min(core[x]['frequency_rank'] for x in t)
    return best * 100 if len(t) < 2 else best / min(len(t), 10)        # more distinct translations: the main use


def fix_examples(core, pairs, st):
    """A noun and a verb with one spelling found their example sentences by spelling only ("I can speak" under the noun
    can). Each keeps the sentences where the word follows a typical word of its own kind, or is a form only it has."""
    for (L, w), g in pairs.items():
        ncue, vcue = set(NOUN_CUE[L].split()), set(VERB_CUE[L].split())
        for pos, own, other in (('noun', ncue, vcue), ('verb', vcue, ncue)):
            e = g[pos]; keep = []
            for x in e['examples']:
                if x.get('origin') != 'tatoeba' or not x.get('hl'): keep.append(x); continue
                a, b = x['hl']; word = x['text'][a:b].lower()
                prev = TOK.findall(x['text'][:a].lower().replace('’', "'"))
                prev = prev[-1] if prev else ''
                if word != w.lower(): keep.append(x)                      # a form of its own (cans, could)
                elif prev in own: keep.append(x)
                elif prev in other: st[L + ' example sentences moved off the wrong part of speech'] += 1
                elif pos == 'verb' and g['verb'].get('pos_share', 0.5) >= 0.5: keep.append(x)   # unclear: the more common one keeps it
                elif pos == 'noun' and g['noun'].get('pos_share', 0.5) > 0.5: keep.append(x)
                else: st[L + ' example sentences moved off the wrong part of speech'] += 1
            e['examples'] = keep


def order_ties(core, st):
    groups = collections.defaultdict(list)
    for e in core.values(): groups[(e['lang'], e['lemma'].lower())].append(e)
    for (L, w), g in groups.items():
        if len(g) < 2: continue
        for e in g: e.pop('pos_order', None)
        lower = any(x['lemma'] == x['lemma'].lower() for x in g)
        major, minor = [], []
        for e in g:
            caps = len(e['lemma']) > 1 and e['lemma'].isupper() and lower
            (minor if (not e['senses'] or caps or all_rare(e)) else major).append(e)
        if not major: major, minor = minor, []
        # an article is always the main use of its spelling (ein, un, um, a); otherwise the most common translation decides
        major.sort(key=lambda e: (0 if e['pos'] == 'article' and len(e['senses']) else 1, best_tr(core, e), -len(e['senses']), PRIO.index(e['pos']) if e['pos'] in PRIO else 99))
        poss = [e['pos'] for e in major]
        if 'noun' in poss[:2] and 'verb' in poss[:2]:      # the noun/verb evidence from the sentences decides between the two
            i, j = sorted((poss.index('noun'), poss.index('verb')))
            a, b = major[i], major[j]
            first = max((a, b), key=lambda e: e.get('pos_share', 0.5))
            major[i], major[j] = first, (b if first is a else a)
        for k, e in enumerate(major): e['pos_order'] = k
        for k, e in enumerate(minor):
            if e['frequency_rank'] is not None: SAVED[e['id']] = e['frequency_rank']
            e['pos_order'] = 50 + k; e['frequency_rank'] = None; st[L + ' minor entries'] += 1


def main():
    core = rjson(os.path.join(WORK, 'core.json'))
    # a second run starts from the ranks before the first one (minor entries lose theirs)
    keep = os.path.join(WORK, 'minor_ranks.json')
    saved = rjson(keep) if os.path.exists(keep) else {}
    for i, r in saved.items():
        if i in core: core[i]['frequency_rank'] = r
    groups = collections.defaultdict(dict)
    for e in core.values():
        if e['lang'] in L3 and e['pos'] in ('noun', 'verb'): groups[(e['lang'], e['lemma'])][e['pos']] = e
    pairs = {k: g for k, g in groups.items() if len(g) == 2 and g['noun']['frequency_rank'] == g['verb']['frequency_rank']}
    st = collections.Counter()
    for L, l3 in L3.items():
        mine = {k[1]: g for k, g in pairs.items() if k[0] == L}
        if not mine: continue
        uniq = {}; watch = collections.defaultdict(set)          # token -> lemmas it is evidence for
        for w, g in mine.items():
            fv = {w} | {x.lower() for x in forms(g['verb']).values() if isinstance(x, str) and ' ' not in x}
            fn = {w} | {x.lower() for x in forms(g['noun']).values() if isinstance(x, str) and ' ' not in x}
            if L == 'en' and w in NEGATIVE: fv |= {x.strip() for x in re.split('[/]', NEGATIVE[w]) if ' ' not in x.strip()}
            uniq[w] = (fv - fn, fn - fv)
            for x in fv | fn: watch[x].add(w)
        count = {w: collections.Counter() for w in mine}
        ncue, vcue = set(NOUN_CUE[L].split()), set(VERB_CUE[L].split())
        with bz2.open(os.path.join(T, '%s_sentences_detailed.tsv.bz2' % l3), 'rt', encoding='utf-8') as f:
            for line in f:
                p = line.split('\t', 3)
                if len(p) < 3: continue
                toks = TOK.findall(p[2].lower().replace('’', "'"))
                for k, x in enumerate(toks):
                    if x not in watch: continue
                    prev = toks[k - 1] if k else ''
                    for w in watch[x]:
                        uv, un = uniq[w]
                        if x in uv: count[w]['verb'] += 1
                        elif x in un: count[w]['noun'] += 1
                        elif prev in ncue or (L == 'fr' and prev.endswith("'") and prev in ncue): count[w]['noun'] += 1
                        elif prev in vcue: count[w]['verb'] += 1
        for w, g in mine.items():
            v, n = count[w]['verb'], count[w]['noun']
            share = round((v + 1) / (v + n + 2), 3)
            g['verb']['pos_share'] = share; g['noun']['pos_share'] = round(1 - share, 3)
            st[L + (' verb first' if share > 0.5 else ' noun first')] += 1
    fix_examples(core, pairs, st)
    SAVED.update(saved)
    order_ties(core, st)
    wjson(keep, SAVED)
    wjson(os.path.join(WORK, 'core.json'), core)
    print(dict(st))
    for L, w in [('en', 'can'), ('en', 'may'), ('pt', 'poder'), ('en', 'water'), ('en', 'walk'), ('en', 'love'), ('fr', 'pouvoir'),
                 ('fr', 'devoir'), ('fr', 'être'), ('pt', 'jantar'), ('en', 'drink'), ('pt', 'dever'), ('en', 'work'), ('en', 'run'), ('en', 'dance')]:
        g = pairs.get((L, w))
        if g: print(L, w, 'verb', g['verb']['pos_share'], 'noun', g['noun']['pos_share'])


if __name__ == '__main__':
    main()
