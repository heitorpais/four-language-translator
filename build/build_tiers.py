"""Write the data files the app ships (app/data).  Phase 1 (pilot): every entry is "core".
  core-de.json, core-en.json, core-fr.json, core-pt.json   lists of entries (spec section 4)
  links.json      for every entry id, the ids it is linked to in the other languages
  manifest.json   files, versions, sizes, sources
Run:  python3 -I build/build_tiers.py"""
import sys, os, gzip, json, hashlib, collections, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

VERSION = '0.2.0-pilot'


def dump(name, obj):
    path = os.path.join(DATA, name)
    raw = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    with open(path, 'wb') as f: f.write(raw)
    return {'file': name, 'bytes': len(raw), 'gzip_bytes': len(gzip.compress(raw, 9)), 'sha256': hashlib.sha256(raw).hexdigest()[:16]}


def main():
    entries = rjson(os.path.join(WORK, 'entries_forms.json'))
    files = []
    links = collections.defaultdict(set)
    for e in entries.values():
        for s in e['senses']:
            for l, ids in s['translations'].items():
                for t in ids:
                    links[e['id']].add(t); links[t].add(e['id'])
    for lang in LANGS:
        es = sorted((e for e in entries.values() if e['lang'] == lang), key=lambda e: (e['frequency_rank'] or 10 ** 7, e['id']))
        info = dump('core-%s.json' % lang, es); info.update(tier='core', lang=lang, entries=len(es)); files.append(info)
    info = dump('links.json', {k: sorted(v) for k, v in sorted(links.items())}); info.update(tier='links'); files.append(info)
    wjson(os.path.join(DATA, 'source_gaps.json'), rjson(os.path.join(WORK, 'source_gaps.json')))
    files.append({'file': 'source_gaps.json', 'bytes': os.path.getsize(os.path.join(DATA, 'source_gaps.json')), 'tier': 'build-info'})
    manifest = {'version': VERSION, 'built': datetime.date.today().isoformat(), 'files': files,
                'sources': [
                    {'name': 'Wiktionary (English, German, French and Portuguese editions) via kaikki.org / Wiktextract', 'licence': 'CC BY-SA 4.0', 'url': 'https://kaikki.org/dictionary/rawdata.html'},
                    {'name': 'Tatoeba sentences and links', 'licence': 'CC BY 2.0 FR', 'url': 'https://tatoeba.org', 'export': '2026-11-07'},
                    {'name': 'FrequencyWords by Hermit Dave (OpenSubtitles 2018)', 'licence': 'CC BY-SA 4.0 (content), MIT (code)', 'url': 'https://github.com/hermitdave/FrequencyWords'}]}
    wjson(os.path.join(DATA, 'manifest.json'), manifest, indent=1)
    for f in files: print(f)
    print('total bytes', sum(f['bytes'] for f in files), 'gzip', sum(f.get('gzip_bytes', 0) for f in files))


if __name__ == '__main__':
    main()
