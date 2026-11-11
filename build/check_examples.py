"""Checks the example sentences of the core entries: every translation must be a direct Tatoeba link of the
source sentence (not through a third language). Compares with an earlier core.json when one is given and reports
how many translations changed or were removed per language, and how many Portuguese ones are European.
Run:  python3 -I build/check_examples.py [earlier core.json]"""
import sys, os, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from examples import tsv, PAIRS, pt_european

direct = set()
for a, b in PAIRS:
    for p in tsv('%s-%s_links.tsv.bz2' % (a, b)):
        x, y = int(p[0]), int(p[1]); direct.add((x, y)); direct.add((y, x))
core = rjson(os.path.join(WORK, 'core.json'))
old = rjson(sys.argv[1]) if len(sys.argv) > 1 else None
st = collections.defaultdict(collections.Counter)
for i, e in core.items():
    before = {x['id']: x for x in (old or {}).get(i, {}).get('examples', []) if x['origin'] == 'tatoeba'}
    for x in e['examples']:
        if x['origin'] != 'tatoeba': continue
        sid = int(x['id'][2:])
        for o, tid in (x.get('translation_ids') or {}).items():
            st[o]['translations'] += 1
            if (sid, int(tid[2:])) not in direct: st[o]['NOT DIRECT'] += 1
            if o == 'pt' and pt_european(x['translations'][o]): st[o]['European Portuguese (marked)'] += 1
        if old is not None and x['id'] in before:
            b = before[x['id']]
            for o in set((b.get('translation_ids') or {})) | set((x.get('translation_ids') or {})):
                bt, nt = (b.get('translation_ids') or {}).get(o), (x.get('translation_ids') or {}).get(o)
                if bt and not nt: st[o]['removed'] += 1
                elif bt and nt and bt != nt: st[o]['changed'] += 1
                elif nt and not bt: st[o]['added'] += 1
for o in sorted(st): print(o, dict(st[o]))
wjson(os.path.join(REPORTS, 'examples_check.json'), {o: dict(v) for o, v in st.items()}, indent=1)
