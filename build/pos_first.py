"""Hand-checked order of parts of speech (build/claude/pos_first.tsv, one entry id per line): the listed entry opens
first for its spelling, the others keep their order after it. Run after minor_borrowed.py.
Reads and writes build/work/core.json.  Run:  python3 -I build/pos_first.py"""
import sys, os, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *


def main():
    path = os.path.join(WORK, 'core.json')
    core = rjson(path)
    groups = collections.defaultdict(list)
    for e in core.values(): groups[(e['lang'], e['lemma'])].append(e)
    done, missing = 0, []
    for line in open(os.path.join(ROOT, 'build', 'claude', 'pos_first.tsv'), encoding='utf-8'):
        i = line.strip()
        if not i or i.startswith('#'): continue
        e = core.get(i)
        if not e: missing.append(i); continue
        g = groups[(e['lang'], e['lemma'])]
        ranks = [x['frequency_rank'] for x in g if x.get('frequency_rank')]
        if e.get('frequency_rank') is None and ranks: e['frequency_rank'] = min(ranks)
        rest = sorted((x for x in g if x is not e), key=lambda x: x.get('pos_order') or 0)
        e['pos_order'] = 0
        for k, x in enumerate(rest):
            if (x.get('pos_order') or 0) < 50: x['pos_order'] = k + 1
        done += 1
    print('put first:', done, '| not found:', missing)
    wjson(path, core)


if __name__ == '__main__':
    main()
