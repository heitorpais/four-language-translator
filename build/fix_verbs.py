"""Hand checks of the irregular verb tables (Explore › Irregular verbs, Practice › Principal parts), written by Claude (Anthropic).
Wiktionary's verb tables give a few wrong or misleading principal parts; this fixes them in build/work/core.json.
Runs after generate_forms.py (and swiss.py), before build_tiers.py; running it twice changes nothing.
Run:  python3 -I build/fix_verbs.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

PARTS = {
    'de:können:verb': ['können', 'konnte', 'gekonnt'],
    'en:get:verb': ['get', 'got', 'gotten'],                # American English (the app's English); British: got
    'en:strike:verb': ['strike', 'struck', 'struck'],
    'en:be:verb': ['be', 'was / were', 'been'],
}
# not irregular verbs at all: a contraction, a parsing error, a dialect form, or only a spelling rule (panic -> panicked)
REGULAR = {
    'en:gotta:verb': None, 'en:partial:verb': None, 'en:rin:verb': None,
    'en:fix:verb': ['fix', 'fixed', 'fixed'], 'en:bless:verb': ['bless', 'blessed', 'blessed'],
    'en:traffic:verb': ['traffic', 'trafficked', 'trafficked'], 'en:panic:verb': ['panic', 'panicked', 'panicked'],
    'en:picnic:verb': ['picnic', 'picnicked', 'picnicked'], 'en:mimic:verb': ['mimic', 'mimicked', 'mimicked'],
}
# French impersonal verbs have no "je" form: the table shows the "il" form
FR_IMPERSONAL = {'fr:falloir:verb': 'il faut', 'fr:pleuvoir:verb': 'il pleut', 'fr:advenir:verb': 'il advient'}


def main():
    core = rjson(os.path.join(WORK, 'core.json'))
    n = 0
    for i, p in PARTS.items():
        e = core.get(i)
        if e and e.get('verb'): e['verb']['principal_parts'] = p; n += 1
    for i, p in REGULAR.items():
        e = core.get(i)
        if not (e and e.get('verb')): continue
        e['verb']['regular'] = True; e['verb']['class'] = 'regular'
        if p: e['verb']['principal_parts'] = p
        n += 1
    for i, f in FR_IMPERSONAL.items():
        e = core.get(i)
        if e and e.get('verb') and e['verb'].get('principal_parts'): e['verb']['principal_parts'][1] = f; n += 1
    wjson(os.path.join(WORK, 'core.json'), core)
    print('verbs fixed:', n)


if __name__ == '__main__':
    main()
