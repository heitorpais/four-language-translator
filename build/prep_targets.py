"""Stage 2 of import_wiktionary: for the chosen German lemmas, pull every record the import needs
out of the big source files and cache it.

  German records (both editions)            -> cache/pilot_de_raw.pkl
  English Wiktionary: English entries       -> cache/en_entries.pkl      (for links and for the pivot route)
  French / Portuguese Wiktionary editions   -> cache/native_fr.pkl, native_pt.pkl (+ reverse links to German)
  English Wiktionary: French / Portuguese   -> cache/enw_fr.pkl, enw_pt.pkl

Run:  python3 -I build/prep_targets.py"""
import sys, os, re, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from prep_german import slim_enwikt

WORDKEY = re.compile(r'"word": "([^"]*)"')
# extra words that must be available because the saved library uses them (lang:word)
EXTRA = [l.strip() for l in open(os.path.join(ROOT, 'build', 'library_words.txt'), encoding='utf-8') if l.strip()] \
    + ['de:' + l.strip() for l in open(os.path.join(ROOT, 'build', 'library_words_de.txt'), encoding='utf-8') if l.strip()]


def gloss_words(gloss):
    """'to walk, to go (on foot)' -> ['walk', 'go']"""
    g = re.sub(r'\([^)]*\)|\[[^\]]*\]', '', gloss)
    out = []
    for part in re.split(r'[,;/]| or ', g):
        w = re.sub(r'^(to|a|an|the)\s+', '', part.strip().strip('.!?'), flags=re.I).strip()
        if w and len(w.split()) <= 3 and re.fullmatch(r"[A-Za-z' -]+", w):
            out.append(w)
    return out


def split_targets(lang, w):
    """'function , to work , to operate' -> ['function', 'work', 'operate']"""
    out = []
    for part in re.split(r'\s*[,;]\s+|\s+,\s*', w):
        part = norm_target(lang, part)
        if part and not part.startswith('-') and '…' not in part and '...' not in part:
            out.append(part)
    return out


def norm_target(lang, w):
    w = re.sub(r'\([^)]*\)', '', w).strip(' !?.¡¿')
    if lang == 'en':
        w = re.sub(r'^to\s+', '', w)
    return w


def slim_native(d):
    return {
        'word': d['word'], 'pos': d.get('pos'), 'tags': d.get('tags', []),
        'ipa': [(x['ipa'], x.get('tags', []) + x.get('raw_tags', [])) for x in d.get('sounds', [])
                if x.get('ipa') and 'X-SAMPA' not in x.get('tags', []) and not x.get('audio')],
        'forms': [(f['form'], tuple(f.get('tags', []))) for f in d.get('forms', []) or [] if f.get('form')],
        'gloss': [(s.get('glosses') or [''])[-1] for s in d.get('senses', [])][:4],
        'form_of': all(s.get('form_of') for s in d.get('senses', [])) if d.get('senses') else False,
        'tr': [(t['lang_code'], t['word'], str(t.get('sense_index') or t.get('sense') or '')) for t in d.get('translations', [])
               if t.get('lang_code') in ('de', 'en') and t.get('word')],
    }


def main():
    sel = rjson(os.path.join(WORK, 'de_lemmas.json'))
    words = {x['lemma'] for x in sel} | {e.split(':', 1)[1] for e in EXTRA if e.startswith('de:')}
    raw = {'dewikt': collections.defaultdict(list), 'enwikt': collections.defaultdict(list)}
    for name, fn in (('dewikt', 'dewikt_de.jsonl.gz'), ('enwikt', 'enwikt_de.jsonl.gz')):
        for line in lines(os.path.join(CACHE, fn)):
            w = line[10:line.index('"', 10)]
            if w in words:
                d = json.loads(line)
                if d['word'] in words:
                    raw[name][d['word']].append(d)
    save('pilot_de_raw.pkl', {k: dict(v) for k, v in raw.items()})
    print('German words with dewikt data', len(raw['dewikt']), 'with enwikt data', len(raw['enwikt']), flush=True)

    need = {'en': set(), 'fr': set(), 'pt': set()}
    for e in EXTRA:
        l, w = e.split(':', 1)
        if l in need: need[l].add(w)
    for w, ents in raw['dewikt'].items():
        for d in ents:
            for lang, tw, _ in d['tr']:
                need[lang].update(split_targets(lang, tw))
    for w, ents in raw['enwikt'].items():
        for d in ents:
            for s in d['senses']:
                need['en'].update(gloss_words(s['gloss']))
    print('needed so far', {k: len(v) for k, v in need.items()}, flush=True)

    # --- English entries (English Wiktionary) ---
    en = collections.defaultdict(list); en_formof = {}
    for w in list(need['en']):                    # plural given as translation: make sure the singular is cached too
        if w.endswith('s') and ' ' not in w: need['en'].update({w[:-1], w[:-2]} - {''})
    for line in lines(os.path.join(RAW, 'enwiktionary', 'English.jsonl.gz')):
        # the top-level "word" key is not the first one in these files, so test every "word" value
        if not any(w in need['en'] for w in WORDKEY.findall(line)):
            continue
        d = json.loads(line)
        if d.get('word') not in need['en']:
            continue
        s = slim_enwikt(d)
        if s['senses'] and all(x['form_of'] for x in s['senses']):
            en_formof.setdefault(d['word'], s['senses'][0]['form_of'][0])     # 'parents' -> 'parent'
            continue
        en[d['word']].append(s)
    save('en_entries.pkl', dict(en))
    save('en_formof.pkl', {w: l for w, l in en_formof.items() if w not in en and l in en})
    print('English entries', sum(len(v) for v in en.values()), 'words', len(en), flush=True)
    # pivot candidates: translation groups of an English entry that contain one of our German lemmas
    for w, ents in en.items():
        for d in ents:
            groups = collections.defaultdict(list)
            for lang, tw, sense in d['tr']:
                groups[sense].append((lang, tw))
            for g in groups.values():
                if any(l == 'de' and t in words for l, t in g):
                    for l, t in g:
                        if l in ('fr', 'pt'):
                            need[l].add(norm_target(l, t))
    print('needed after pivot', {k: len(v) for k, v in need.items()}, flush=True)

    # --- native editions: reverse links + fallback entries ---
    for lang in ('fr', 'pt'):
        ents = collections.defaultdict(list); rev = []
        tag = '"lang_code": "%s"' % lang
        for line in lines(os.path.join(RAW, 'editions', lang + '-extract.jsonl.gz')):
            if tag not in line:
                continue
            w = line[10:line.index('"', 10)] if line.startswith('{"word": "') else None
            has_de = '"lang_code": "de"' in line
            if not has_de and w not in need[lang]:
                continue
            d = json.loads(line)
            if d.get('lang_code') != lang:
                continue
            s = slim_native(d)
            hit = [t for t in s['tr'] if t[0] == 'de' and t[1] in words]
            if hit:
                groups = collections.defaultdict(lambda: {'de': [], 'en': []})
                for l, t, k in s['tr']:
                    groups[k][l].append(t)
                for k, g in groups.items():
                    for t in g['de']:
                        if t in words:
                            rev.append((t, d['word'], d.get('pos'), tuple(g['en'])))
                need[lang].add(d['word'])
            if d['word'] in need[lang] and not s['form_of']:
                ents[d['word']].append(s)
        save('native_%s.pkl' % lang, {'entries': dict(ents), 'reverse': rev})
        print(lang, 'edition: fallback entries', len(ents), 'reverse links', len(rev), flush=True)

    # --- French / Portuguese entries in the English Wiktionary ---
    for lang, fn in (('fr', 'French'), ('pt', 'Portuguese')):
        ents = collections.defaultdict(list)
        for line in lines(os.path.join(RAW, 'enwiktionary', fn + '.jsonl.gz')):
            if not any(w in need[lang] for w in WORDKEY.findall(line)):
                continue
            d = json.loads(line)
            if d.get('word') not in need[lang]:
                continue
            s = slim_enwikt(d)
            if s['senses'] and all(x['form_of'] for x in s['senses']):
                continue
            ents[d['word']].append(s)
        save('enw_%s.pkl' % lang, dict(ents))
        print(lang, 'entries in English Wiktionary', len(ents), 'of', len(need[lang]), 'needed', flush=True)


if __name__ == '__main__':
    main()
