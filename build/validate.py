"""Check the shipped data (app/data), all tiers.  Exits with status 1 if any check fails.
  1. every entry matches the format of its tier (spec section 4: core full, extended and long tail reduced)
  2. every id that an entry points to exists (translations, synonyms, links.json)
  3. no core entry is missing IPA, gender (nouns), plural (nouns) or aux (verbs) unless the source has none
     (such gaps must be listed in source_gaps.json; a listed gap that is filled is an error too)
  4. no duplicate ids
  5. manifest.json matches the files, and every extended/long-tail entry and form is in the bucket of its first letters
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
       'origin': dict, 'verified': bool, 'tier': str}
SLIM = {'ext': {'id', 'lang', 'lemma', 'pos', 'tier', 'level', 'frequency_rank', 'ipa', 'senses', 'origin'},
        'tail': {'id', 'lang', 'lemma', 'pos', 'tier', 'senses', 'origin'}}
SENSE = {'core': {'id', 'gloss_en', 'gloss', 'register', 'translations', 'route', 'origin'},
         'ext': {'id', 'gloss_en', 'translations', 'route', 'origin'}, 'tail': {'id', 'translations', 'route', 'origin'}}
ROUTES = {'de-edition', 'fr-edition', 'pt-edition', 'en-edition', 'via-en', 'via-en-unchecked', 'library', 'none'}
NOUN = {'gender', 'plural', 'plural_alt', 'plural_rule', 'plural_regular', 'genitive', 'irregular_forms'}
VERB = {'regular', 'class', 'aux', 'aux_regional', 'principal_parts', 'present_3sg', 'irregular_forms'}
ADJ = {'agreement', 'comparison', 'comparison_regular', 'irregular_forms'}
MORE = {'definition', 'collocations', 'idioms', 'word_family', 'antonyms', 'etymology', 'learner_mistake'}
OFFERED = {'de': ['DE', 'CH', 'AT'], 'en': ['US', 'GB'], 'fr': ['FR', 'CA', 'BE', 'CH'], 'pt': ['BR', 'PT']}
errors = collections.defaultdict(list)
CORR_KEYS = {'entry', 'issue', 'date', 'note', 'hide', 'set', 'sense', 'remove_translation', 'add_translation', 'hide_example', 'example_translation'}


def check_used_in(e, F):
    if 'used_in' in e and (not isinstance(e['used_in'], list) or any(r not in OFFERED[e['lang']] for r in e['used_in'])): F('bad used_in')


def err(check, msg):
    errors[check].append(msg)


def check_senses(e, F):
    sid = set(); tier = e.get('tier')
    for s in e['senses']:
        keys = set(s) - {'reverse', 'regional', 'regional_origin'}
        if keys != SENSE.get(tier, set()): F('bad sense keys %s' % sorted(keys ^ SENSE.get(tier, set()))); continue
        if s['id'] in sid: F('duplicate sense id')
        sid.add(s['id'])
        for l, ids in s['translations'].items():
            if l not in LANGS or l == e['lang'] or not isinstance(ids, list): F('bad translations in ' + s['id'])
            if s['route'].get(l) not in ROUTES: F('bad route in ' + s['id'])
            if ids and s['route'].get(l) == 'none': F('translations with route none in ' + s['id'])
        listed = {x for ids in s['translations'].values() for x in ids}
        for t, mk in s.get('regional', {}).items():
            if t not in listed: F('regional marker for a word not in the sense: ' + t)
            if not isinstance(mk, list) or any(not re.fullmatch(r'[+-]?(%s)' % '|'.join(OFFERED[t.split(':')[0]]), x) for x in mk): F('bad regional marker for ' + t)
        for t, o in s.get('regional_origin', {}).items():
            if t not in s.get('regional', {}) or o != 'claude': F('bad regional_origin for ' + t)


def check_slim(e):
    i = e.get('id', '?'); tier = e.get('tier')
    F = lambda m: err('1 format', '%s: %s' % (i, m))
    if tier not in SLIM: F('bad tier'); return
    allowed = SLIM[tier] | ({'noun', 'verb'} if tier == 'ext' else set())
    if not SLIM[tier] <= set(e): F('missing fields %s' % sorted(SLIM[tier] - set(e)))
    if set(e) - allowed - {'used_in', 'pos_share', 'pos_order', 'level_ch'}: F('unknown fields %s' % sorted(set(e) - allowed - {'used_in', 'pos_share', 'pos_order', 'level_ch'}))
    if 'pos_order' in e and not isinstance(e['pos_order'], int): F('bad pos_order')
    if 'pos_share' in e and not (isinstance(e['pos_share'], (int, float)) and 0 <= e['pos_share'] <= 1): F('bad pos_share')
    check_used_in(e, F)
    if 'level_ch' in e and e['level_ch'] not in CEFR: F('bad level_ch')
    if e.get('lang') not in LANGS: F('bad lang')
    if e.get('pos') not in POS: F('bad pos')
    if not re.fullmatch(re.escape('%s:%s:%s' % (e.get('lang'), e.get('lemma'), e.get('pos'))) + r'(:\d+)?', i): F('id does not match lang:lemma:pos')
    if 'noun' in e and set(e['noun']) != {'gender', 'plural'}: F('bad noun block')
    if 'verb' in e and set(e['verb']) != {'aux', 'aux_regional'}: F('bad verb block')
    if tier == 'ext':
        if e['level'] is not None and e['level'] not in CEFR: F('bad level')
        if set(e['ipa']) - {'narrow'} != {'default', 'regional'}: F('bad ipa block')
    for k, v in e['origin'].items():
        if v not in ORIGINS: F('bad origin value')
        if k.split('.')[0] not in e: F('origin for a field the entry does not have: ' + k)
    check_senses(e, F)


def check_entry(e):
    i = e.get('id', '?')
    F = lambda m: err('1 format', '%s: %s' % (i, m))
    for k, t in TOP.items():
        if k not in e: F('missing field ' + k)
        elif not isinstance(e[k], t): F('wrong type for ' + k)
    extra = set(e) - set(TOP) - {'used_in', 'pos_share', 'pos_order', 'level_ch'}
    if extra: F('unknown fields %s' % sorted(extra))
    check_used_in(e, F)
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
    if e['tier'] != 'core': F('tier must be core in a core file')
    check_senses(e, F)
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


def bkey(word, n):
    import unicodedata
    f = unicodedata.normalize('NFD', word.lower())
    f = ''.join(c for c in f if unicodedata.category(c) != 'Mn').replace('ß', 'ss').replace('’', "'").strip()
    return ''.join(c if 'a' <= c <= 'z' else '_' for c in f[:n]).ljust(n, '_')


def main():
    manifest = rjson(os.path.join(DATA, 'manifest.json'))
    for k, c in enumerate(manifest.get('corrections') or []):          # docs/CORRECTIONS.md
        if not isinstance(c, dict) or not c.get('entry') or set(c) - CORR_KEYS: err('6 corrections', 'correction %d: bad keys %s' % (k, sorted(set(c) - CORR_KEYS) if isinstance(c, dict) else c))
    ids = collections.Counter(); entries = {}; forms_ref = []; pending_core = []; details = {}
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
                if e.get('examples') != [] or e.get('more') is not None or e.get('origin') is not None: err('1 format', '%s: examples/more/origin belong in the details file' % e.get('id'))
                pending_core.append(e)
        elif f.get('tier') == 'details':
            d = rjson(path)
            if len(d) != f['entries']: err('5 manifest', 'entry count differs for ' + f['file'])
            details.update(d)
        elif f.get('tier') == 'ext':
            d = rjson(path); k = f['prefix']
            if len(d['entries']) != f['entries']: err('5 manifest', 'entry count differs for ' + f['file'])
            if manifest['buckets'][f['lang']].get(k) != f['sha256'] or f['file'] != manifest['bucket_file'].replace('<lang>', f['lang']).replace('<prefix>', k): err('5 manifest', 'bucket not listed: ' + f['file'])
            for e in d['entries']:
                ids[e.get('id')] += 1; entries[e.get('id')] = e
                if e.get('lang') != f['lang']: err('1 format', '%s is in the wrong file' % e.get('id'))
                if bkey(e['lemma'], len(k)) != k: err('5 manifest', '%s is not in the bucket of its first letters (%s)' % (e['id'], k))
                check_slim(e)
            for w, fid in d['forms'].items():
                if bkey(w, len(k)) != k: err('5 manifest', 'form %s is not in the bucket of its first letters (%s)' % (w, k))
                forms_ref.append((w, fid))
    # a core entry is checked in its full form: card data plus its details
    for e in pending_core:
        d = details.pop(e['id'], None)
        if d is None: err('1 format', '%s has no details' % e['id']); continue
        e['examples'] = d['examples']; e['more'] = d['more']; e['origin'] = d['origin']
        if len(d['senses']) != len(e['senses']): err('1 format', '%s: details and card have different senses' % e['id']); continue
        for s, x in zip(e['senses'], d['senses']):
            hidden = s.pop('hidden', [])
            s.update(x)
            if sorted(hidden) != sorted(X for X, r in s.get('route', {}).items() if r == 'via-en-unchecked'):
                err('1 format', '%s %s: hidden languages do not match the routes' % (e['id'], s['id']))
        check_entry(e)
    for i in details: err('1 format', 'details for unknown entry ' + i)
    for L, bs in manifest['buckets'].items():
        ks = sorted(bs)
        for a in ks:
            for b in ks:
                if a != b and b.startswith(a): err('5 manifest', 'overlapping buckets %s %s/%s' % (L, a, b))
    for i, n in ids.items():
        if n > 1: err('4 duplicate ids', i)
    for e in entries.values():
        for s in e.get('senses', []):
            for l, tids in s.get('translations', {}).items():
                for t in tids:
                    if t not in entries: err('2 ids exist', '%s %s -> %s' % (e['id'], s['id'], t))
                    elif entries[t]['lang'] != l: err('2 ids exist', '%s %s -> %s is not a %s entry' % (e['id'], s['id'], t, l))
        for t in e.get('synonyms', []):
            if t not in entries: err('2 ids exist', '%s synonym -> %s' % (e['id'], t))
    for w, fid in forms_ref:
        for t in fid:
            if t not in entries: err('2 ids exist', 'form %s -> %s' % (w, t))
    links = rjson(os.path.join(DATA, 'links.json'))
    for k, v in links.items():
        for t in [k] + v:
            if t not in entries: err('2 ids exist', 'links.json -> ' + t)
    gaps = rjson(os.path.join(DATA, 'source_gaps.json'))
    ngaps = collections.Counter()
    core = [e for e in entries.values() if e.get('tier') == 'core']
    for e in core:
        actual = set(source_gaps(e)); listed = set(gaps.get(e['id'], []))
        for g in actual - listed: err('3 core fields', '%s: %s is empty but the source gap is not recorded' % (e['id'], g))
        for g in listed - actual: err('3 core fields', '%s: %s is listed as a source gap but is filled' % (e['id'], g))
        for g in actual: ngaps[(e['lang'], g)] += 1
    for i in gaps:
        if i not in entries: err('3 core fields', 'source_gaps.json names unknown entry ' + i)

    print('entries checked:', len(entries), dict(collections.Counter((e['lang'], e.get('tier')) for e in entries.values())), '| forms', len(forms_ref))
    print('recorded source gaps in core (empty in Wiktionary):', {'%s %s' % k: v for k, v in sorted(ngaps.items())})
    names = ['1 format', '2 ids exist', '3 core fields', '4 duplicate ids', '5 manifest']
    for n in names:
        print('%-16s %s' % (n, 'PASS' if not errors[n] else 'FAIL (%d)' % len(errors[n])))
        for m in errors[n][:15]: print('     ', m)
    ok = not any(errors.values())
    print('RESULT:', 'PASS' if ok else 'FAIL')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
