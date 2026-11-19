"""Phase 4, right after add_entries.py: everyday words that the frequency list left in the extended tier although
they are the usual translation of a core word (Czech "horník", "měna", "sako" …). build/claude/promoted.txt lists
their ids; each moves into the core with all it already has (meanings, IPA, forms, translations).
Run:  python3 -I build/promote_entries.py"""
import sys, os, json, gzip, copy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *


def normalize(e):
    BL = {'noun': ('noun', {'gender', 'plural', 'plural_alt', 'plural_rule', 'plural_regular', 'genitive', 'irregular_forms'}),
          'verb': ('verb', {'regular', 'class', 'aux', 'aux_regional', 'principal_parts', 'present_3sg', 'irregular_forms'}),
          'adjective': ('adjective', {'agreement', 'comparison', 'comparison_regular', 'irregular_forms'})}
    OPT = {'animate', 'cases', 'gender_regional', 'aspect_pair', 'conj'}
    for pos, (blk, keys) in BL.items():
        if e['pos'] != pos: e[blk] = None; continue
        b = e.get(blk) if isinstance(e.get(blk), dict) else {}
        for k in keys:
            if k not in b: b[k] = [] if k == 'plural_alt' else ({} if k in ('irregular_forms', 'aux_regional', 'principal_parts') else None)
        e[blk] = {k: v for k, v in b.items() if k in keys or k in OPT}
    for s in e['senses']:
        for k in ('gloss_en', 'gloss', 'register', 'origin'): s.setdefault(k, None)
        s.setdefault('translations', {}); s.setdefault('route', {})
        for k in list(s):
            if k not in {'id', 'gloss_en', 'gloss', 'register', 'translations', 'route', 'origin', 'reverse', 'regional', 'regional_origin'}: del s[k]



def main():
    core = rjson(os.path.join(WORK, 'core.json'))
    want = {}
    for line in open(os.path.join(ROOT, 'build', 'claude', 'promoted.txt'), encoding='utf-8'):
        line = line.strip()
        if line and not line.startswith('#') and line not in core: want.setdefault(line.split(':')[0], set()).add(line)
    n = 0
    for L, ids in want.items():
        tpl = next(e for e in core.values() if e['lang'] == L and e['senses'])
        for line in gzip.open(os.path.join(WORK, 'entries_%s.jsonl.gz' % L), 'rt', encoding='utf-8'):
            x = json.loads(line)
            if x['id'] not in ids: continue
            e = {k: (copy.deepcopy(v) if not isinstance(v, (list, dict)) else type(v)()) for k, v in tpl.items()}
            e.update(copy.deepcopy(x))
            e['tier'] = 'core'
            e.setdefault('level', None); e['frequency_rank'] = e.get('frequency_rank') or 7999
            for k in ('governs', 'regional_variants', 'synonyms', 'synonyms_text', 'examples'):
                if not isinstance(e.get(k), list): e[k] = []
            for k in ('more', 'usage_note', 'swiss_german'):
                e.setdefault(k, None)
            e['origin'] = e.get('origin') or {}
            e['ipa'] = dict({'default': None, 'regional': {}}, **(e.get('ipa') or {}))
            more = e['more'] if isinstance(e.get('more'), dict) else {}
            for k, v in (tpl.get('more') or {}).items():
                if k not in more: more[k] = [] if isinstance(v, list) else None
            e['more'] = more
            for sub in ('noun', 'verb', 'adjective'):              # the same fields a core entry of that kind has
                if isinstance(e.get(sub), dict):
                    ref = next((c[sub] for c in core.values() if c['lang'] == L and isinstance(c.get(sub), dict)), {})
                    for k, v in ref.items(): e[sub].setdefault(k, [] if isinstance(v, list) else ({} if isinstance(v, dict) else None))
            for s in e['senses']:
                s.setdefault('translations', {}); s.setdefault('route', {}); s.setdefault('register', None); s.setdefault('gloss', None)
                for X in LANGS:
                    if X != L: s['translations'].setdefault(X, [])
            normalize(e)
            core[e['id']] = e; n += 1
    wjson(os.path.join(WORK, 'core.json'), core)
    print('entries promoted', n)


if __name__ == '__main__':
    main()
