"""Numbers and samples for the Phase 1 report.  Run:  python3 -I build/report_phase1.py"""
import sys, os, json, gzip, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

SAMPLES = ['de:Haus:noun', 'de:Kind:noun', 'de:Zeit:noun', 'de:Frage:noun',
           'de:gehen:verb', 'de:helfen:verb', 'de:anfangen:verb', 'de:warten:verb',
           'de:gut:adjective', 'de:schön:adjective']


def main():
    E = {}
    for l in LANGS:
        for e in rjson(os.path.join(DATA, 'core-%s.json' % l)): E[e['id']] = e
    out = {}
    for lang in LANGS:
        es = [e for e in E.values() if e['lang'] == lang]
        nouns = [e for e in es if e['noun']]; verbs = [e for e in es if e['verb']]; adjs = [e for e in es if e['adjective']]
        pct = lambda sub, f: (round(100 * sum(1 for e in sub if f(e)) / len(sub), 1) if sub else None)
        t = lambda l2: (lambda e: any(s['translations'].get(l2) for s in e['senses']))
        rows = [
            ('entries', len(es)), ('nouns / verbs / adjectives', '%d / %d / %d' % (len(nouns), len(verbs), len(adjs))),
            ('IPA', pct(es, lambda e: e['ipa']['default'])), ('CEFR level', pct(es, lambda e: e['level'])),
            ('frequency rank', pct(es, lambda e: e['frequency_rank'])),
            ('nouns: gender', pct(nouns, lambda e: e['noun']['gender']) if lang != 'en' else 'n/a'),
            ('nouns: plural', pct(nouns, lambda e: e['noun']['plural'])),
            ('verbs: auxiliary', pct(verbs, lambda e: e['verb']['aux'])),
            ('verbs: principal parts', pct(verbs, lambda e: e['verb']['principal_parts'])),
            ('verbs: regular/irregular', pct(verbs, lambda e: e['verb']['regular'] is not None)),
            ('adjectives: comparison or agreement', pct(adjs, lambda e: e['adjective']['comparison'] or e['adjective']['agreement'])),
            ('preposition + case (verbs)', pct(verbs, lambda e: e['governs'])),
            ('at least one sense with translations', pct(es, lambda e: e['senses'])),
        ] + [('translation into ' + l2, pct(es, t(l2))) for l2 in LANGS if l2 != lang] + [
            ('examples: at least 1', pct(es, lambda e: e['examples'])),
            ('examples: 4 or more', pct(es, lambda e: len(e['examples']) >= 4)),
            ('synonyms', pct(es, lambda e: e['synonyms'] or e['synonyms_text'])),
            ('definition', pct(es, lambda e: e['more']['definition'])), ('etymology', pct(es, lambda e: e['more']['etymology'])),
            ('idioms', pct(es, lambda e: e['more']['idioms'])), ('word family', pct(es, lambda e: e['more']['word_family'])),
            ('antonyms', pct(es, lambda e: e['more']['antonyms'])), ('collocations', pct(es, lambda e: e['more']['collocations'])),
            ('learner mistake', pct(es, lambda e: e['more']['learner_mistake'])), ('usage note', pct(es, lambda e: e['usage_note'])),
            ('regional variants', pct(es, lambda e: e['regional_variants'])),
            ('Swiss German form', pct(es, lambda e: e['swiss_german']) if lang == 'de' else 'n/a'),
        ]
        out[lang] = rows
    de = [e for e in E.values() if e['lang'] == 'de']
    ex = [x for e in de for x in e['examples'] if x['origin'] == 'tatoeba']
    routes = collections.defaultdict(collections.Counter)
    for e in de:
        for s in e['senses']:
            for l2, r in s['route'].items(): routes[l2][r] += 1
    man = rjson(os.path.join(DATA, 'manifest.json'))
    stats = {'fill_percent': {l: dict(out[l]) for l in out},
             'tatoeba_examples': len(ex), 'tatoeba_examples_with_en_fr_pt': sum(1 for x in ex if all(x['translations'].get(l) for l in ('en', 'fr', 'pt'))),
             'routes_per_german_sense': {l: dict(c) for l, c in routes.items()},
             'german_senses': sum(len(e['senses']) for e in de),
             'origin_counts': dict(collections.Counter(v for e in E.values() for v in e['origin'].values())),
             'files': man['files']}
    wjson(os.path.join(REPORTS, 'phase1_stats.json'), stats, indent=1)
    with open(os.path.join(REPORTS, 'phase1_samples.md'), 'w', encoding='utf-8') as f:
        f.write('# Phase 1: ten sample entries\n\n4 nouns, 4 verbs, 2 adjectives. Irregular: Haus, Kind (plural), gehen, helfen, anfangen (strong verbs), gut (comparison).\n\n')
        for i in SAMPLES:
            f.write('## %s\n\n```json\n%s\n```\n\n' % (i, json.dumps(E[i], ensure_ascii=False, indent=1)))
    print('%-38s %8s %8s %8s %8s' % ('field (% of entries filled)', 'de', 'en', 'fr', 'pt'))
    for k in range(len(out['de'])):
        name = out['de'][k][0]
        if name.startswith('translation into'): continue
        print('%-38s %8s %8s %8s %8s' % (name, *[str(dict(out[l]).get(name, '')) for l in LANGS]))
    for l in LANGS:
        print(l, {k: v for k, v in out[l] if k.startswith('translation into')})
    print(json.dumps({k: stats[k] for k in ('tatoeba_examples', 'tatoeba_examples_with_en_fr_pt', 'routes_per_german_sense', 'german_senses', 'origin_counts')}, ensure_ascii=False))
    raw = sum(f['bytes'] for f in man['files']); gz = sum(f.get('gzip_bytes', 0) for f in man['files'])
    print('data files raw %.2f MB, gzip %.2f MB' % (raw / 1e6, gz / 1e6))


if __name__ == '__main__':
    main()
