"""Phase 5 fix: which part of speech comes first when one spelling is both a noun and a verb
(poder, pouvoir, can, water, walk). The frequency list counts the spelling, not the part of speech, so both entries
have the same rank and the lookup used to pick the one with more translations ("poder" opened as the noun "power").

For each such pair of core entries this step counts, in the Tatoeba sentences of the language:
  * forms only one of the two has (posso, pode, could, can't  ->  verb;  poderes, cans  ->  noun), and
  * the shared spelling after typical words: a/the/my/le/la/o/a/um … -> noun; to/I/we/je/vou/posso/para … -> verb.
It stores pos_share (0..1, the verb's or the noun's share of those uses) on both entries; the app puts the higher
share first when the frequency rank is the same. German needs none: nouns are capitalised.
Reads and writes build/work/core.json.  Run:  python3 -I build/pos_share.py"""
import sys, os, re, bz2, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from generate_forms import forms, NEGATIVE

T = os.path.join(RAW, 'tatoeba')
L3 = {'en': 'eng', 'fr': 'fra', 'pt': 'por'}
TOK = re.compile(r"[a-zà-ÿœç]+(?:['’][a-z]+)?")
NOUN_CUE = {
    'en': 'a an the my your his her its our their this that these those some any no every each another',
    'fr': "le la les l' un une des du au aux mon ton son ma ta sa mes tes ses notre votre nos vos leur leurs ce cet cette ces",
    'pt': 'o a os as um uma uns umas do da dos das no na nos nas meu minha meus minhas seu sua seus suas nosso nossa esse essa este esta pelo pela ao aos',
}
VERB_CUE = {
    'en': "to i you we they he she it not will would can could should must might may don't doesn't didn't won't let's never also just",
    'fr': "je j' tu il elle on nous vous ils elles ne pas peux peut pouvons pouvez peuvent veux veut voulons voulez veulent dois doit devons devez doivent vais va allons allez vont faut pour sans",
    'pt': 'eu tu ele ela nós vocês eles elas não vou vai vamos vão quero quer queremos posso pode podemos preciso precisa devo deve para sem consigo consegue',
}


def main():
    core = rjson(os.path.join(WORK, 'core.json'))
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
    wjson(os.path.join(WORK, 'core.json'), core)
    print(dict(st))
    for L, w in [('en', 'can'), ('en', 'may'), ('pt', 'poder'), ('en', 'water'), ('en', 'walk'), ('en', 'love'), ('fr', 'pouvoir'),
                 ('fr', 'devoir'), ('fr', 'être'), ('pt', 'jantar'), ('en', 'drink'), ('pt', 'dever'), ('en', 'work'), ('en', 'run'), ('en', 'dance')]:
        g = pairs.get((L, w))
        if g: print(L, w, 'verb', g['verb']['pos_share'], 'noun', g['noun']['pos_share'])


if __name__ == '__main__':
    main()
