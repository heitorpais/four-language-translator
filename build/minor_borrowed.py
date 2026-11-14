"""After review.py: an entry whose meanings all came in through other languages' links (no meaning of its own in
Wiktionary) is a minor use of its spelling when the same spelling has another entry with meanings of its own
(Spanish "no" as a noun next to the adverb, Dutch "alleen" as a noun, English "own" as a noun).
Such an entry keeps its meanings and can still be looked up, but opens last and loses its frequency rank and level,
so it no longer shows in Explore, practice or the word of the day. The entry chosen to open first and articles are kept.
Reads and writes build/work/core.json.  Run:  python3 -I build/minor_borrowed.py"""
import sys, os, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *


def main():
    path = os.path.join(WORK, 'core.json')
    core = rjson(path)
    groups = collections.defaultdict(list)
    for e in core.values(): groups[(e['lang'], e['lemma'])].append(e)
    st = collections.Counter()
    for (L, w), g in groups.items():
        if len(g) < 2: continue
        own = [e for e in g if any(not s.get('reverse') for s in e['senses'])]
        if not own: continue
        for e in g:
            if e in own: continue
            # the entry the earlier steps chose to open first (an article, en:a) keeps its place
            if e['pos'] == 'article' or (e.get('pos_order') or 0) == 0: continue
            if e.get('frequency_rank') is None and (e.get('pos_order') or 0) >= 50: continue
            e['frequency_rank'] = None; e['level'] = None
            e['pos_order'] = max(50, (e.get('pos_order') or 0) + 50)
            st[L] += 1
    # hand-checked list (build/claude/minor.tsv)
    for line in open(os.path.join(ROOT, 'build', 'claude', 'minor.tsv'), encoding='utf-8'):
        i = line.strip()
        if not i or i.startswith('#') or i not in core: continue
        e = core[i]; e['frequency_rank'] = None; e['level'] = None; e['pos_order'] = (e.get('pos_order') or 0) + (50 if (e.get('pos_order') or 0) < 50 else 0); st['listed'] += 1
    print('entries made minor (borrowed meanings only):', dict(st), sum(st.values()))
    wjson(path, core)


if __name__ == '__main__':
    main()
