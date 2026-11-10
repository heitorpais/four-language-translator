"""Check the shipped data (app/data).  Exits with status 1 if any check fails.
  1. every entry matches the format (spec section 4)
  2. every id that an entry points to exists (translations, synonyms, links.json)
  3. no core entry is missing IPA, gender (nouns), plural (nouns) or aux (verbs) unless the source has none
     (such gaps must be listed in source_gaps.json; a listed gap that is filled is an error too)
  4. no duplicate ids
  5. manifest.json matches the files
Run:  python3 -I build/validate.py"""
import sys, os, re, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

CEFR = {'A1', 'A2', 'B1', 'B2', 'C1', 'C2'}
POS = set(POS_MAP.values()) - {'name'}
TOP = {'id': str, 'lang': str, 'lemma': str, 'pos': str, 'level': (str, type(None)), 'frequency_rank': (int, type(None)),
       'ipa': dict, 'noun': (dict, type(None)), 'verb': (dict, type(None)), 'adjective': (dict, type(None)),
       'governs': list, 'senses': list, 'regional_variants': list, 'swiss_german': (dict, type(None)),
       'synonyms': list, 'synonyms_text': list, 'examples': list, 'more': dict, 'usage_note': (str, type(None)),
       'origin': dict, 'verified': bool}
NOUN = {'gender', 'plural', 'plural_alt', 'plural_rule', 'plural_regular', 'genitive', 'irregular_forms'}
VERB = {'regular', 'class', 'aux', 'aux_regional', 'principal_parts', 'present_3sg', 'irregular_forms'}
ADJ = {'agreement', 'comparison', 'comparison_regular', 'irregular_forms'}
MORE = {'definition', 'collocations', 'idioms', 'word_family', 'antonyms', 'etymology', 'learner_mistake'}
errors = collections.defaultdict(list)


def err(check, msg):
    errors[check].append(msg)


def check_entry(e):
    i = e.get('id', '?')
    F = lambda m: err('1 format', '%s: %s' % (i, m))
    for k, t in TOP.items():
        if k not in e: F('missing field ' + k)
        elif not isinstance(e[k], t): F('wrong type for ' + k)
    extra = set(e) - set(TOP)
    if extra: F('unknown fields %s' % sorted(extra))
    if any(k not in e for k in TOP): return
    if e['lang'] not in LANGS: F('bad lang')
    if e['pos'] not in POS: F('bad pos ' + e['pos'])
    if not re.fullmatch(re.escape('%s:%s:%s' % (e['lang'], e['lemma'], e['pos'])) + r'(:\d+)?', i): F('id does not match lang:lemma:pos')
    if e['level'] is not None and e['level'] not in CEFR: F('bad level')
    if set(e['ipa']) - {'narrow'} != {'default', 'regional'} or not isinstance(e['ipa']['regional'], dict): F('bad ipa block')
    elif e['ipa']['default'] is not None and (not e['ipa']['default'] or e['ipa']['default'][0] in '/[\\'): F('ipa not cleaned')
    for blk, keys, pos in (('noun', NOUN, 'noun'), ('verb', VERB, 'verb'), ('adjective', ADJ, 'adjective')):
        if (e[blk] is not None) != (e['pos'] == pos): F('%s block must be present exactly for pos %s' % (blk, pos))
        if e[blk] is not None and set(e[blk]) != keys: F('bad keys in %s block' % blk)
    if e['noun'] and e['noun']['gender'] not in (None, 'm', 'f', 'n', 'm/f'): F('bad gender')
    if e['verb'] and e['verb']['principal_parts'] is not None and not isinstance(e['verb']['principal_parts'], list): F('principal_parts')
    if e['verb'] and not isinstance(e['verb']['irregular_forms'], dict): F('irregular_forms')
    if set(e['more']) != MORE: F('bad keys in more')
    for g in e['governs']:
        if not {'prep', 'case', 'example_id'} <= set(g): F('bad governs item')
        elif g['example_id'] and g['example_id'] not in {x['id'] for x in e['examples']}: F('governs.example_id not among examples')
    sid = set()
    for s in e['senses']:
        if not {'id', 'gloss_en', 'register', 'translations'} <= set(s): F('bad sense'); continue
        if s['id'] in sid: F('duplicate sense id')
        sid.add(s['id'])
        for l, ids in s['translations'].items():
            if l not in LANGS or l == e['lang'] or not isinstance(ids, list): F('bad translations in ' + s['id'])
    xid = set()
    for x in e['examples']:
        if not {'id', 'text', 'translations', 'origin'} <= set(x): F('bad example'); continue
        if x['id'] in xid: F('duplicate example id')
        xid.add(x['id'])
        if x['origin'] not in ORIGINS: F('bad example origin')
        if x['origin'] == 'tatoeba' and not re.fullmatch(r't:\d+', x['id']): F('tatoeba example without tatoeba id')
        if x.get('hl') and not (0 <= x['hl'][0] < x['hl'][1] <= len(x['text'])): F('bad highlight range')
    for k, v in e['origin'].items():
        if v not in ORIGINS: F('bad origin value %s=%s' % (k, v))
    if e['swiss_german'] is not None and (set(e['swiss_german']) != {'form', 'origin', 'approximate'} or e['lang'] != 'de'): F('bad swiss_german')
    # a filled field needs an origin
    need = [('ipa', e['ipa']['default']), ('senses', e['senses']), ('level', e['level']), ('swiss_german', e['swiss_german']),
            ('usage_note', e['usage_note']), ('more.learner_mistake', e['more']['learner_mistake']),
            ('more.definition', e['more']['definition']), ('more.etymology', e['more']['etymology'])]
    for k, v in need:
        if v and k not in e['origin']: F('filled field without origin: ' + k)
    for k in ('level', 'swiss_german', 'more.learner_mistake', 'usage_note'):
        if e['origin'].get(k) not in (None, 'claude'): F(k + ' must have origin claude')
    for k in ('ipa',):
        if e['origin'].get(k) not in (None, 'wiktionary'): F('ipa must come from wiktionary')


def main():
    manifest = rjson(os.path.join(DATA, 'manifest.json'))
    ids = collections.Counter(); entries = {}
    for f in manifest['files']:
        path = os.path.join(DATA, f['file'])
        if not os.path.exists(path): err('5 manifest', 'missing file ' + f['file']); continue
        if os.path.getsize(path) != f['bytes']: err('5 manifest', 'size differs for ' + f['file'])
        if f.get('tier') == 'core':
            es = rjson(path)
            if len(es) != f['entries']: err('5 manifest', 'entry count differs for ' + f['file'])
            for e in es:
                ids[e.get('id')] += 1; entries[e.get('id')] = e
                if e.get('lang') != f['lang']: err('1 format', '%s is in the wrong file' % e.get('id'))
    for i, n in ids.items():
        if n > 1: err('4 duplicate ids', i)
    for e in entries.values(): check_entry(e)
    for e in entries.values():
        for s in e.get('senses', []):
            for l, tids in s.get('translations', {}).items():
                for t in tids:
                    if t not in entries: err('2 ids exist', '%s %s -> %s' % (e['id'], s['id'], t))
                    elif entries[t]['lang'] != l: err('2 ids exist', '%s %s -> %s is not a %s entry' % (e['id'], s['id'], t, l))
        for t in e.get('synonyms', []):
            if t not in entries: err('2 ids exist', '%s synonym -> %s' % (e['id'], t))
    links = rjson(os.path.join(DATA, 'links.json'))
    for k, v in links.items():
        for t in [k] + v:
            if t not in entries: err('2 ids exist', 'links.json -> ' + t)
    gaps = rjson(os.path.join(DATA, 'source_gaps.json'))
    ngaps = collections.Counter()
    for e in entries.values():
        actual = set(source_gaps(e)); listed = set(gaps.get(e['id'], []))
        for g in actual - listed: err('3 core fields', '%s: %s is empty but the source gap is not recorded' % (e['id'], g))
        for g in listed - actual: err('3 core fields', '%s: %s is listed as a source gap but is filled' % (e['id'], g))
        for g in actual: ngaps[(e['lang'], g)] += 1
    for i in gaps:
        if i not in entries: err('3 core fields', 'source_gaps.json names unknown entry ' + i)

    print('entries checked:', len(entries), dict(collections.Counter(e['lang'] for e in entries.values())))
    print('recorded source gaps (empty in Wiktionary):', {'%s %s' % k: v for k, v in sorted(ngaps.items())})
    names = ['1 format', '2 ids exist', '3 core fields', '4 duplicate ids', '5 manifest']
    for n in names:
        print('%-16s %s' % (n, 'PASS' if not errors[n] else 'FAIL (%d)' % len(errors[n])))
        for m in errors[n][:15]: print('     ', m)
    ok = not any(errors.values())
    print('RESULT:', 'PASS' if ok else 'FAIL')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
