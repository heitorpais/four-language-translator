"""Write the data files the app ships (app/data).

  core-<lang>.json                core entries without examples and background, loaded first on the first visit
  details-<lang>.json             {id: {examples, more, origin, senses: [{route, origin, gloss}]}} for the core
                                  entries, loaded right after (the card keeps senses[].hidden: languages not to show)
  ext/<lang>/<prefix>.json        extended and long-tail entries whose word starts with <prefix>, plus the
                                  inflected forms (of all tiers) that start with <prefix>; loaded when needed
  links.json                      links between core entries
  source_gaps.json                core fields that are empty because Wiktionary has no value
  manifest.json                   files, sizes, versions, buckets, word counts

A bucket is one first letter ("a").  A letter whose file would be larger than SPLIT bytes is split into
two-letter buckets ("sa", "sc", ...), and so on.  Letters are folded: lower case, accents removed, ß -> ss.
Run:  python3 -I build/build_tiers.py"""
import sys, os, gzip, json, hashlib, collections, datetime, unicodedata, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

VERSION = '0.4.0'
SPLIT = 1_500_000          # bytes of JSON per bucket file


def fold(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.replace('ß', 'ss').replace('’', "'").strip()


def bkey(word, n):
    f = fold(word)
    k = ''.join(c if 'a' <= c <= 'z' else '_' for c in f[:n])
    return k.ljust(n, '_')


def dump(path, obj, rel):
    raw = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f: f.write(raw)
    return {'file': rel, 'bytes': len(raw), 'gzip_bytes': len(gzip.compress(raw, 6)), 'sha256': hashlib.sha256(raw).hexdigest()[:16]}


def buckets(items, keyword, n=1):
    """items -> {prefix: [items]}, splitting prefixes whose JSON would exceed SPLIT"""
    groups = collections.defaultdict(list)
    for it in items: groups[bkey(keyword(it), n)].append(it)
    out = {}
    for k, v in groups.items():
        size = sum(len(json.dumps(x, ensure_ascii=False)) for x in v)
        if size > SPLIT and n < 4 and k[-1] != '_':
            out.update(buckets(v, keyword, n + 1))
        else:
            out[k] = v
    return out


def main():
    core = rjson(os.path.join(WORK, 'core.json'))
    for d in ('ext',):
        p = os.path.join(DATA, d)
        if os.path.exists(p): shutil.rmtree(p)
    files = []; counts = {}; bucket_index = {}
    links = collections.defaultdict(set)
    for e in core.values():
        for s in e['senses']:
            for ids in s['translations'].values():
                for t in ids:
                    if t in core: links[e['id']].add(t); links[t].add(e['id'])
    for L in LANGS:
        ce = sorted((e for e in core.values() if e['lang'] == L), key=lambda e: (e['frequency_rank'] or 10 ** 9, e['id']))
        # the card data loads first; examples and background ("more") follow in a second file
        details = {}
        card = []
        for e in ce:
            # bookkeeping (where each field comes from, how each translation was found) waits in the details file;
            # the card keeps per sense only the languages whose translations must not be shown
            details[e['id']] = {'examples': e['examples'], 'more': e['more'], 'origin': e['origin'],
                                'senses': [{k: s[k] for k in ('route', 'origin', 'gloss', 'reverse', 'regional_origin') if k in s} for s in e['senses']]}
            senses = []
            for s in e['senses']:
                c = {k: v for k, v in s.items() if k not in ('route', 'origin', 'gloss', 'reverse', 'regional_origin')}
                hidden = sorted(X for X, r in s.get('route', {}).items() if r == 'via-en-unchecked')
                if hidden: c['hidden'] = hidden
                senses.append(c)
            card.append(dict(e, examples=[], more=None, origin=None, senses=senses))
        info = dump(os.path.join(DATA, 'core-%s.json' % L), card, 'core-%s.json' % L); info.update(tier='core', lang=L, entries=len(ce)); files.append(info)
        info = dump(os.path.join(DATA, 'details-%s.json' % L), details, 'details-%s.json' % L); info.update(tier='details', lang=L, entries=len(details)); files.append(info)
        rest = []
        for line in gzip.open(os.path.join(WORK, 'entries_%s.jsonl.gz' % L), 'rt', encoding='utf-8'):
            e = json.loads(line)
            if e['tier'] != 'core' and e['id'] not in core: rest.append(e)
        inv = rjson(os.path.join(WORK, 'inv_%s.json' % L))
        ids_by_lemma = collections.defaultdict(list)
        for e in list(ce) + rest: ids_by_lemma[e['lemma']].append(e['id'])
        forms = []
        for f, ls in inv['forms'].items():
            ids = uniq(i for l in ls for i in ids_by_lemma.get(l, ()))
            if ids: forms.append((f, ids))
        items = [('e', e) for e in rest] + [('f', x) for x in forms]
        bk = buckets(items, lambda it: it[1]['lemma'] if it[0] == 'e' else it[1][0])
        bucket_index[L] = {}
        for k in sorted(bk):
            v = bk[k]
            obj = {'entries': sorted((x for t, x in v if t == 'e'), key=lambda e: fold(e['lemma'])),
                   'forms': {f: ids for t, (f, ids) in ((t, x) for t, x in v if t == 'f')}}
            rel = 'ext/%s/%s.json' % (L, k)
            info = dump(os.path.join(DATA, rel), obj, rel); info.update(tier='ext', lang=L, prefix=k, entries=len(obj['entries']), forms=len(obj['forms']))
            files.append(info); bucket_index[L][k] = info['sha256']
        tiers = collections.Counter(e['tier'] for e in rest)
        counts[L] = {'core': len(ce), 'extended': tiers['ext'], 'long_tail': tiers['tail'], 'entries': len(ce) + len(rest),
                     'lemmas': len({e['lemma'] for e in list(ce) + rest}), 'inflected_forms': len(forms),
                     'words_for_suggestions': len({e['lemma'] for e in list(ce) + rest} | {f for f, _ in forms})}
        print(L, counts[L], 'buckets', len(bk), flush=True)
    info = dump(os.path.join(DATA, 'links.json'), {k: sorted(v) for k, v in sorted(links.items())}, 'links.json'); info.update(tier='links'); files.append(info)
    gaps = {i: source_gaps(e) for i, e in core.items() if source_gaps(e)}
    info = dump(os.path.join(DATA, 'source_gaps.json'), gaps, 'source_gaps.json'); info.update(tier='build-info'); files.append(info)
    manifest = {'version': VERSION, 'built': datetime.date.today().isoformat(), 'files': files, 'buckets': bucket_index, 'counts': counts,
                'fold': 'lower case, accents removed, ß -> ss; a character outside a-z counts as _',
                'bucket_file': 'ext/<lang>/<prefix>.json',
                'sources': [
                    {'name': 'Wiktionary (English, German, French and Portuguese editions) via kaikki.org / Wiktextract', 'licence': 'CC BY-SA 4.0', 'url': 'https://kaikki.org/dictionary/rawdata.html'},
                    {'name': 'Tatoeba sentences and links', 'licence': 'CC BY 2.0 FR', 'url': 'https://tatoeba.org', 'export': '2026-11-07'},
                    {'name': 'FrequencyWords by Hermit Dave (OpenSubtitles 2018)', 'licence': 'CC BY-SA 4.0 (content), MIT (code)', 'url': 'https://github.com/hermitdave/FrequencyWords'}]}
    wjson(os.path.join(DATA, 'manifest.json'), manifest, indent=1)
    core_raw = sum(f['bytes'] for f in files if f['tier'] == 'core'); core_gz = sum(f['gzip_bytes'] for f in files if f['tier'] == 'core')
    det = [f for f in files if f['tier'] == 'details']
    print('core details: %.1f MB raw, %.1f MB gzip' % (sum(f['bytes'] for f in det) / 1e6, sum(f['gzip_bytes'] for f in det) / 1e6))
    ext = [f for f in files if f['tier'] == 'ext']
    print('core files: %.1f MB raw, %.1f MB gzip' % (core_raw / 1e6, core_gz / 1e6))
    print('extended files: %d files, %.1f MB raw, %.1f MB gzip, largest %.2f MB gzip' % (len(ext), sum(f['bytes'] for f in ext) / 1e6, sum(f['gzip_bytes'] for f in ext) / 1e6, max(f['gzip_bytes'] for f in ext) / 1e6))


if __name__ == '__main__':
    main()
