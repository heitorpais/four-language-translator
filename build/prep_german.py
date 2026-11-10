"""Stage 1 of import_wiktionary: read the German Wiktionary extract (German entries only) and the
English Wiktionary's German entries, and cache slim copies.  Run:  python3 -I build/prep_german.py"""
import sys, os, json, gzip, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

TL = ('en', 'fr', 'pt')


def slim_dewikt(d):
    return {
        'word': d['word'], 'pos': d.get('pos'), 'tags': d.get('tags', []),
        'senses': [{'gloss': (s.get('glosses') or [''])[-1], 'idx': s.get('sense_index'),
                    'tags': s.get('tags', []), 'raw_tags': s.get('raw_tags', [])}
                   for s in d.get('senses', [])],
        'tr': [(t['lang_code'], t['word'], t.get('sense_index')) for t in d.get('translations', [])
               if t.get('lang_code') in TL and t.get('word')],
        'ipa': [(x['ipa'], x.get('tags', []) + x.get('raw_tags', [])) for x in d.get('sounds', []) if x.get('ipa')],
        'forms': [(f['form'], tuple(f.get('tags', [])), tuple(f.get('pronouns', [])), f.get('article'))
                  for f in d.get('forms', []) if f.get('form')],
        'syn': [(x['word'], x.get('sense_index'), x.get('tags', []) + x.get('raw_tags', [])) for x in d.get('synonyms', []) if x.get('word')],
        'ant': [(x['word'], x.get('sense_index')) for x in d.get('antonyms', []) if x.get('word')],
        'expr': [(x['word'], x.get('note')) for x in d.get('expressions', []) if x.get('word')][:12],
        'derived': [x['word'] for x in d.get('derived', []) if x.get('word')][:40],
        'etym': d.get('etymology_texts', []),
        'notes': d.get('notes', []),
    }


def slim_enwikt(d):
    return {
        'word': d['word'], 'pos': d.get('pos'), 'etym_no': d.get('etymology_number'),
        'head': [h.get('expansion', '') for h in d.get('head_templates', [])],
        'head_args': [h.get('args', {}) for h in d.get('head_templates', [])],
        'forms': [(f['form'], tuple(f.get('tags', []))) for f in d.get('forms', []) if f.get('form')],
        'senses': [{'gloss': (s.get('glosses') or [''])[-1], 'raw': (s.get('raw_glosses') or [''])[-1],
                    'tags': s.get('tags', []), 'links': [l[0] for l in s.get('links', [])],
                    'syn': [x['word'] for x in s.get('synonyms', []) if x.get('word')],
                    'ant': [x['word'] for x in s.get('antonyms', []) if x.get('word')],
                    'form_of': [x['word'] for x in s.get('form_of', [])],
                    'alt_of': [x['word'] for x in s.get('alt_of', [])]}
                   for s in d.get('senses', [])],
        'ipa': [(x['ipa'], x.get('tags', [])) for x in d.get('sounds', []) if x.get('ipa')],
        'etym': d.get('etymology_text'),
        'tr': [(t.get('lang_code') or t.get('code'), t['word'], t.get('sense')) for t in d.get('translations', [])
               if (t.get('lang_code') or t.get('code')) in ('de', 'fr', 'pt', 'en') and t.get('word')],
        'derived': [x['word'] for x in d.get('derived', []) if x.get('word')][:40],
        'related': [x['word'] for x in d.get('related', []) if x.get('word')][:20],
    }


def main():
    freq = set(l.split()[0] for l in open(os.path.join(RAW, 'frequency', 'de_50k.txt'), encoding='utf-8') if l.strip())
    de_index = collections.defaultdict(set)        # word -> {pos}
    out = gzip.open(os.path.join(CACHE, 'dewikt_de.jsonl.gz'), 'wt', encoding='utf-8', compresslevel=3)

    class Forms(collections.defaultdict):          # keep only forms that occur in the frequency list
        pass
    forms = collections.defaultdict(set)           # lowercased form -> {(lemma, pos)}

    def addform(f, lemma, pos):
        if f in freq:
            forms[f].add((lemma, pos))
    poscount = collections.Counter()
    n = 0
    for line in lines(os.path.join(RAW, 'editions', 'de-extract.jsonl.gz')):
        if '"lang_code": "de"' not in line:
            continue
        d = json.loads(line)
        if d.get('lang_code') != 'de':
            continue
        n += 1
        pos = d.get('pos'); w = d['word']
        if 'form-of' in d.get('tags', []) or all(s.get('form_of') for s in d.get('senses', [{}])):
            for s in d.get('senses', []):
                for fo in s.get('form_of', []):
                    addform(w.lower(), fo['word'], pos)
            continue
        poscount[pos] += 1
        de_index[w].add(pos)
        out.write(json.dumps(slim_dewikt(d), ensure_ascii=False) + '\n')
        for f in d.get('forms', []):
            t = f.get('tags', [])
            if f.get('form') and not ({'abbreviation', 'diminutive', 'variant', 'auxiliary', 'feminine', 'masculine'} & set(t) and 'nominative' not in t and 'strong' not in t):
                addform(f['form'].rstrip('!').lower(), w, pos)
    out.close()
    print('dewikt German records', n, 'lemma words', len(de_index), 'forms', len(forms), flush=True)
    print('pos', poscount.most_common(40))
    save('dewikt_de_index.pkl', dict(de_index))

    en_index = collections.defaultdict(set)
    out = gzip.open(os.path.join(CACHE, 'enwikt_de.jsonl.gz'), 'wt', encoding='utf-8', compresslevel=3)
    for d in jl(os.path.join(RAW, 'enwiktionary', 'German.jsonl.gz')):
        s = slim_enwikt(d)
        fo = [x for se in s['senses'] for x in se['form_of']]
        if fo and all(se['form_of'] for se in s['senses']):
            for x in fo:
                addform(d['word'].lower(), x, d.get('pos'))
            continue
        en_index[d['word']].add(d.get('pos'))
        out.write(json.dumps(s, ensure_ascii=False) + '\n')
        for f, t in s['forms']:
            if 'table-tags' in t or 'inflection-template' in t or 'class' in t or 'auxiliary' in t or 'diminutive' in t or 'alternative' in t:
                continue
            addform(f.lower(), d['word'], d.get('pos'))
    out.close()
    print('enwikt German lemma words', len(en_index), 'forms now', len(forms))
    save('enwikt_de_index.pkl', dict(en_index))
    save('de_forms.pkl', dict(forms))


if __name__ == '__main__':
    main()
