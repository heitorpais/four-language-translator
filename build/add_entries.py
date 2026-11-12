"""Phase 4, before review.py: everyday words that the Wiktionary extracts do not give as entries of their own
(English months, which Wiktionary files as proper names; Swedish "i"; German "Reis", filed only as a plural of "Real").
build/claude/added_entries.json lists them; each becomes a core entry with one meaning. Its translations come from
the hand-checked word table (build/claude/concepts.tsv) in review.py.  Run:  python3 -I build/add_entries.py"""
import sys, os, json, copy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *


def main():
    core = rjson(os.path.join(WORK, 'core.json'))
    adds = rjson(os.path.join(ROOT, 'build', 'claude', 'added_entries.json'))
    n = 0
    for a in adds:
        L, lemma, pos = a['id'].split(':')
        if a['id'] in core: continue
        tpl = next(e for e in core.values() if e['lang'] == L and e['pos'] == pos and e['senses'])
        e = copy.deepcopy(tpl)
        e.update(id=a['id'], lemma=lemma, level=a.get('level'), frequency_rank=a.get('rank'), ipa={'default': None, 'regional': {}},
                 governs=[], regional_variants=[], swiss_german=None, synonyms=[], synonyms_text=[], examples=[], usage_note=None, verified=False)
        for k in ('used_in', 'pos_share', 'pos_order', 'level_ch', 'standard'): e.pop(k, None)
        if e.get('noun') is not None:
            e['noun'] = dict({k: None for k in e['noun']}, gender=a.get('gender'), plural=a.get('plural'), plural_alt=[], irregular_forms={})
            for k in ('plural_regular',):
                if k in e['noun']: e['noun'][k] = None
        e['more'] = {k: ([] if isinstance(v, list) else None) for k, v in tpl['more'].items()}
        e['more']['definition'] = a.get('gloss_en')
        e['origin'] = {'senses': 'claude', 'level': 'claude', 'more.definition': 'claude'}  # no IPA: the validator only accepts IPA taken from Wiktionary
        e['senses'] = [{'id': 's1', 'gloss_en': a.get('gloss_en'), 'gloss': None, 'register': None,
                        'translations': {X: [] for X in LANGS if X != L}, 'route': {X: 'none' for X in LANGS if X != L}, 'origin': 'claude'}]
        core[a['id']] = e; n += 1
    wjson(os.path.join(WORK, 'core.json'), core)
    print('entries added', n)


if __name__ == '__main__':
    main()
