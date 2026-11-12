"""Phase 4, step 1: index every Wiktionary source for the four languages in SQLite, so later steps can
read any word quickly without holding the big files in memory.

  python3 -I build/index_sources.py SOURCE      SOURCE is one of:
    enw-en enw-de enw-fr enw-pt enw-cs   English Wiktionary, entries for English / German / French / Portuguese / Czech words
    ed-de ed-fr ed-pt ed-cs              German / French / Portuguese / Czech Wiktionary, entries for words of their own language

Writes build/raw/db/SOURCE.sqlite with three tables:
  entry(lang, word, pos, data)   one slim JSON record per Wiktionary entry (zlib-compressed)
  form(lang, form, lemma, pos)   inflected or variant forms Wiktionary lists, and form-of entries
  tr(lang, word, pos, sense, tl, tw)   translation-table rows into the other three languages"""
import sys, os, re, json, zlib, sqlite3, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

SRC = {'enw-en': ('enwiktionary/English.jsonl.gz', 'en'), 'enw-de': ('enwiktionary/German.jsonl.gz', 'de'),
       'enw-fr': ('enwiktionary/French.jsonl.gz', 'fr'), 'enw-pt': ('enwiktionary/Portuguese.jsonl.gz', 'pt'),
       'ed-de': ('editions/de-extract.jsonl.gz', 'de'), 'ed-fr': ('editions/fr-extract.jsonl.gz', 'fr'),
       'ed-pt': ('editions/pt-extract.jsonl.gz', 'pt'),
       'enw-cs': ('enwiktionary/Czech.jsonl.gz', 'cs'), 'ed-cs': ('editions/cs-extract.jsonl.gz', 'cs'),
       'enw-it': ('enwiktionary/Italian.jsonl.gz', 'it'), 'ed-it': ('editions/it-extract.jsonl.gz', 'it'),
       'enw-es': ('enwiktionary/Spanish.jsonl.gz', 'es'), 'ed-es': ('editions/es-extract.jsonl.gz', 'es'),
       'enw-nl': ('enwiktionary/Dutch.jsonl.gz', 'nl'), 'ed-nl': ('editions/nl-extract.jsonl.gz', 'nl'),
       'enw-sv': ('enwiktionary/Swedish.jsonl.gz', 'sv'), 'enw-la': ('enwiktionary/Latin.jsonl.gz', 'la')}
NOFORM = {'table-tags', 'inflection-template', 'class', 'romanization', 'auxiliary', 'multiword-construction'}


def tags(x):
    return list(x.get('tags', []) or []) + list(x.get('raw_tags', []) or [])


def slim(d):
    senses = []
    for s in d.get('senses', []) or []:
        senses.append({'gloss': (s.get('glosses') or [''])[-1], 'raw': (s.get('raw_glosses') or [''])[-1],
                       'idx': s.get('sense_index'), 'tags': tags(s),
                       'form_of': [x['word'] for x in s.get('form_of', []) or [] if x.get('word')],
                       'alt_of': [x['word'] for x in s.get('alt_of', []) or [] if x.get('word')],
                       'syn': [x['word'] for x in s.get('synonyms', []) or [] if x.get('word')][:12],
                       'ant': [x['word'] for x in s.get('antonyms', []) or [] if x.get('word')][:8]})
    tr = []
    for t in list(d.get('translations', []) or []) + [t for s in d.get('senses', []) or [] for t in s.get('translations', []) or []]:
        tl = t.get('lang_code') or t.get('code')
        if tl in LANGS and t.get('word'):
            tr.append((tl, t['word'], str(t.get('sense_index') or t.get('sense') or '')))
    et = d.get('etymology_text') or d.get('etymology_texts') or None
    return {
        'word': d['word'], 'pos': d.get('pos') or '', 'pos_title': d.get('pos_title'), 'tags': tags(d),
        'etym_no': d.get('etymology_number'),
        'head': [h.get('expansion', '') for h in d.get('head_templates', []) or []],
        'senses': senses, 'tr': tr,
        'ipa': [(x['ipa'], tags(x)) for x in d.get('sounds', []) or [] if x.get('ipa')],
        'forms': [(f['form'], list(f.get('tags', []) or []), f.get('pronouns', []) or [], f.get('article'), list(f.get('raw_tags', []) or []))
                  for f in d.get('forms', []) or [] if f.get('form')],
        'syn': [(x['word'], x.get('sense_index'), tags(x)) for x in d.get('synonyms', []) or [] if x.get('word')][:30],
        'ant': [(x['word'], x.get('sense_index')) for x in d.get('antonyms', []) or [] if x.get('word')][:15],
        'expr': [(x['word'], x.get('note')) for x in d.get('expressions', []) or [] if x.get('word')][:15],
        'derived': [x['word'] for x in d.get('derived', []) or [] if x.get('word')][:40],
        'related': [x['word'] for x in d.get('related', []) or [] if x.get('word')][:20],
        'etym': et, 'notes': d.get('notes', []) or [],
        'cats': [c if isinstance(c, str) else c.get('name', '') for c in d.get('categories', []) or []][:40],
    }


def main(src):
    path, lang = SRC[src]
    os.makedirs(os.path.join(RAW, 'db'), exist_ok=True)
    dst = os.path.join(RAW, 'db', src + '.sqlite')
    if os.path.exists(dst): os.remove(dst)
    db = sqlite3.connect(dst)
    db.execute('pragma journal_mode=off'); db.execute('pragma synchronous=off')
    db.execute('create table entry(lang text, word text, pos text, data blob)')
    db.execute('create table form(lang text, form text, lemma text, pos text)')
    db.execute('create table tr(lang text, word text, pos text, sense text, tl text, tw text)')
    need = '"lang_code": "%s"' % lang
    E, F, T = [], [], []; n = kept = 0; t0 = time.time()
    for line in lines(os.path.join(RAW, path)):
        n += 1
        if need not in line: continue
        d = json.loads(line)
        if d.get('lang_code') != lang or not d.get('word'): continue
        s = slim(d); w, pos = s['word'], s['pos']
        E.append((lang, w, pos, zlib.compress(json.dumps(s, ensure_ascii=False).encode(), 3)))
        for x in s['senses']:
            for fo in x['form_of'] + x['alt_of']:
                F.append((lang, w, fo, pos))
        for f, tg, _, _, _ in s['forms']:
            if NOFORM & set(tg) or f == w or f.startswith('-'): continue
            F.append((lang, f.rstrip('!'), w, pos))
        for tl, tw, sense in s['tr']:
            if tl != lang: T.append((lang, w, pos, sense, tl, tw))
        kept += 1
        if len(E) >= 20000:
            db.executemany('insert into entry values(?,?,?,?)', E); db.executemany('insert into form values(?,?,?,?)', F)
            db.executemany('insert into tr values(?,?,?,?,?,?)', T); db.commit(); E, F, T = [], [], []
            print(src, n, kept, int(time.time() - t0), 's', flush=True)
    db.executemany('insert into entry values(?,?,?,?)', E); db.executemany('insert into form values(?,?,?,?)', F)
    db.executemany('insert into tr values(?,?,?,?,?,?)', T)
    db.execute('create index e1 on entry(word)'); db.execute('create index f1 on form(form)'); db.execute('create index f2 on form(lemma)')
    db.execute('create index t1 on tr(word)'); db.execute('create index t2 on tr(tl, tw)')
    db.commit(); db.close()
    print(src, 'done', n, 'lines', kept, 'entries', int(time.time() - t0), 's', flush=True)


if __name__ == '__main__':
    main(sys.argv[1])
