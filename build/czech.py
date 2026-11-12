"""Czech clean-up after the shared steps (written by Claude, Anthropic):
  - the English translation named in the word's own English definition comes first (jít "to go": go before do)
  - meanings added only the other way round whose translations are another word class are dropped
    (vidět "to see" got "handsaw" through the English noun "saw")
Runs after fix_verbs.py, before build_tiers.py; running it twice changes nothing.
Run:  python3 -I build/czech.py"""
import sys, os, re, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *


def main():
    core = rjson(os.path.join(WORK, 'core.json'))
    st = collections.Counter()
    for e in core.values():
        if e['lang'] != 'cs': continue
        keep = []
        for k, s in enumerate(e['senses']):
            ids = [i for v in s['translations'].values() for i in v]
            other = [i for i in ids if i.split(':')[2] != e['pos']]
            if k and s.get('reverse') and e['pos'] in ('verb', 'noun', 'adjective') and ids and len(other) * 2 > len(ids):
                st['wrong-class meanings dropped'] += 1; continue
            g = set(re.findall(r"[a-z][a-z' -]*[a-z]", (s.get('gloss_en') or '').lower().replace('to ', ' ')))
            g = {x.strip() for x in g}
            en = s['translations'].get('en') or []
            if en and g:
                new = sorted(en, key=lambda i: 0 if i.split(':')[1].lower() in g else 1)
                if new != en: s['translations']['en'] = new; st['English order fixed'] += 1
            keep.append(s)
        if keep: e['senses'] = keep
    wjson(os.path.join(WORK, 'core.json'), core)
    print(dict(st))


if __name__ == '__main__':
    main()
