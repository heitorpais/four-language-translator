"""Choose the N most frequent German lemmas.

Frequency source: FrequencyWords (Hermit Dave), OpenSubtitles 2018, content/2018/de/de_50k.txt.
That list counts lower-cased word FORMS.  Each form's count is credited to the lemma(s) Wiktionary
lists it under.  Because the list is lower-cased, a form like "essen" could be the verb or the noun
"Essen"; the count is split by how often the form is capitalised mid-sentence in Tatoeba's German
sentences.   Run:  python3 -I build/select_lemmas.py [N]"""
import sys, os, re, bz2, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

N = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
ALLOWED = {'noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'conj', 'det', 'article', 'num', 'particle',
           'intj', 'postp', 'contraction'}
WORD = re.compile(r"[A-Za-zÄÖÜäöüß]{2,}")


def main():
    de_index = load('dewikt_de_index.pkl'); en_index = load('enwikt_de_index.pkl'); forms = load('de_forms.pkl')
    lemma_pos = collections.defaultdict(set)
    for idx in (de_index, en_index):
        for w, ps in idx.items():
            if WORD.fullmatch(w):
                for p in ps:
                    if p in ALLOWED:
                        lemma_pos[w].add(p)
    lower = collections.defaultdict(set)
    for w in lemma_pos:
        lower[w.lower()].add(w)

    # capitalisation statistics from Tatoeba (tokens that do not start a sentence or a quotation)
    cap = collections.Counter(); low = collections.Counter()
    tok = re.compile(r"[A-Za-zÄÖÜäöüß]+")
    with bz2.open(os.path.join(RAW, 'tatoeba', 'deu_sentences_detailed.tsv.bz2'), 'rt', encoding='utf-8') as f:
        for line in f:
            p = line.split('\t')
            if len(p) < 3: continue
            s = p[2]
            for m in tok.finditer(s):
                before = s[:m.start()].rstrip()
                if not before or before[-1] in '.!?:;"„“”»«‚‘’\'(–—-…':
                    continue
                t = m.group()
                (cap if t[0].isupper() else low)[t.lower()] += 1

    # candidate lemmas per form
    tokens = []; total = 0
    for line in open(os.path.join(RAW, 'frequency', 'de_50k.txt'), encoding='utf-8'):
        p = line.split()
        if len(p) != 2: continue
        t, c = p[0], int(p[1]); total += c
        cands = set(lower.get(t, ()))
        for (w, ps) in forms.get(t, ()):
            if w in lemma_pos and ps in lemma_pos[w]:
                cands.add(w)
        if not cands: continue
        caps = [x for x in cands if x[0].isupper()]; lows = [x for x in cands if not x[0].isupper()]
        if caps and lows:
            pc = (cap[t] + 0.5) / (cap[t] + low[t] + 1)
            tokens.append((c * pc, caps)); tokens.append((c * (1 - pc), lows))
        else:
            tokens.append((c, list(cands)))
    # A form with several candidate lemmas ("hat": haben or haten) is shared out in proportion to
    # the weight each lemma earns overall (5 rounds of expectation-maximisation).
    weight = collections.defaultdict(lambda: 1.0)
    for _ in range(5):
        new = collections.defaultdict(float)
        for c, cands in tokens:
            z = sum(weight[x] for x in cands)
            for x in cands:
                new[x] += c * weight[x] / z
        weight = collections.defaultdict(lambda: 1e-9, new)
    best = dict(weight)
    block = set(w for l in open(os.path.join(ROOT, 'build', 'lemma_blocklist.txt'), encoding='utf-8') if not l.startswith('#') for w in l.split())
    ranked = [w for w in sorted(best, key=lambda w: -best[w]) if w not in block][:N]
    out = []
    for i, w in enumerate(ranked, 1):
        norm = lambda ps: {('det' if p == 'article' else p) for p in ps}
        both = [p for p in lemma_pos[w] if norm([p]) & norm(de_index.get(w, ())) and norm([p]) & norm(en_index.get(w, ())) and p in en_index.get(w, ())]
        pos = sorted(both or [p for p in lemma_pos[w] if p in de_index.get(w, ())] or lemma_pos[w])
        out.append({'lemma': w, 'rank': i, 'pos': pos, 'per_million': round(best[w] * 1e6 / total, 1)})
    wjson(os.path.join(WORK, 'de_lemmas.json'), out, indent=0)
    print('lemmas', len(out), 'entries (lemma+pos)', sum(len(x['pos']) for x in out))
    for a, b in ((0, 30), (915, 1000)):
        print(a, ' '.join(f"{x['lemma']}({'/'.join(x['pos'])})" for x in out[a:b]))


if __name__ == '__main__':
    main()
