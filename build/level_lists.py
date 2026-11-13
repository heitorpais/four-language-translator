"""Explore → By level: the rarer words (outside the core list) that have a level, per language.
The core words are in data/core-<lang>.json.gz already; the rarer ones are spread over many small files
(data/ext/<lang>/<prefix>.json.gz) that load only when a word is looked up. Explore needs their names and levels
without loading all of them, so this writes data/levels/<lang>.json: for each level, the most common words
as [id, frequency rank, gender] (at most 2,000 per level). Run after build_tiers.py:  python3 -I build/level_lists.py
"""
import gzip, json, glob, os
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'app', 'data')
BANDS = [(600, 'A1'), (1500, 'A2'), (3000, 'B1'), (5500, 'B2'), (9000, 'C1'), (float('inf'), 'C2')]   # the same as app/learn.js
MAX = 2000
def level(e):
    if e.get('level'): return e['level']
    r = e.get('frequency_rank')
    if not r: return None
    for n, l in BANDS:
        if r <= n: return l
for lang in ['en', 'de', 'fr', 'pt', 'cs', 'it', 'es', 'nl', 'sv', 'la']:
    by = {}
    for f in glob.glob(os.path.join(DATA, 'ext', lang, '*.json.gz')):
        for e in json.load(gzip.open(f)).get('entries', []):
            if e.get('hidden'): continue
            l = level(e)
            if not l: continue
            g = (e.get('noun') or {}).get('gender') if e.get('pos') == 'noun' else None
            by.setdefault(l, []).append([e['id'], e.get('frequency_rank') or 0, g or ''])
    out = {l: sorted(v, key=lambda x: x[1] or 1e9)[:MAX] for l, v in by.items()}
    json.dump(out, open(os.path.join(DATA, 'levels', lang + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print(lang, {l: len(v) for l, v in sorted(by.items())})
