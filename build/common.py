"""Shared helpers for the build scripts. Paths are relative to the repo root."""
import os, re, gzip, json, pickle, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'build', 'raw')
CACHE = os.path.join(RAW, 'cache')
WORK = os.path.join(ROOT, 'build', 'work')       # intermediate entry files
REPORTS = os.path.join(ROOT, 'build', 'reports')
DATA = os.path.join(ROOT, 'app', 'data')
for d in (CACHE, WORK, REPORTS, DATA):
    os.makedirs(d, exist_ok=True)

LANGS = ('de', 'en', 'fr', 'pt')
ORIGINS = ('wiktionary', 'tatoeba', 'generated', 'claude')

# part-of-speech names used in entry ids
POS_MAP = {
    'noun': 'noun', 'verb': 'verb', 'adj': 'adjective', 'adv': 'adverb', 'pron': 'pronoun',
    'prep': 'preposition', 'conj': 'conjunction', 'det': 'determiner', 'article': 'article',
    'num': 'numeral', 'particle': 'particle', 'intj': 'interjection', 'contraction': 'contraction',
    'postp': 'preposition', 'adv_phrase': 'adverb', 'prep_phrase': 'phrase', 'phrase': 'phrase',
    'proverb': 'phrase', 'name': 'name',
}
SKIP_POS = {'name', 'abbrev', 'symbol', 'character', 'prefix', 'suffix', 'affix', 'infix', 'interfix',
            'circumfix', 'punct', 'proverb', 'combining_form', 'root', 'romanization', 'letter'}


def jl(path):
    """Iterate over the JSON objects of a .jsonl or .jsonl.gz file."""
    op = gzip.open if path.endswith('.gz') else open
    with op(path, 'rt', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def lines(path):
    op = gzip.open if path.endswith('.gz') else open
    with op(path, 'rt', encoding='utf-8') as f:
        yield from f


def save(name, obj):
    with open(os.path.join(CACHE, name), 'wb') as f:
        pickle.dump(obj, f, protocol=4)


def load(name):
    with open(os.path.join(CACHE, name), 'rb') as f:
        return pickle.load(f)


def wjson(path, obj, **kw):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, **kw)


def rjson(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def clean_ipa(s):
    """'[haʊ̯s]' or '/haʊs/' -> 'haʊ̯s'. Returns None for empty or placeholder values."""
    if not s:
        return None
    s = s.strip()
    s = re.split(r'\s+[\[/]', s)[0]          # '/ɡu/ [ɡʊw]' -> '/ɡu/'
    s = s.strip('[]/\\ ').strip()
    if not s or '…' in s or s in ('-', '?'):
        return None
    return unicodedata.normalize('NFC', s)


def eid(lang, lemma, pos, n=1):
    return f'{lang}:{lemma}:{pos}' + (f':{n}' if n > 1 else '')


def uniq(seq):
    seen = set(); out = []
    for x in seq:
        if x not in seen:
            seen.add(x); out.append(x)
    return out


def source_gaps(e):
    """Core fields that are empty because the sources have no value for them."""
    out = []
    if not e['ipa']['default']: out.append('ipa')
    if e['noun'] is not None:
        if e['lang'] != 'en' and not e['noun']['gender']: out.append('noun.gender')
        if not e['noun']['plural']: out.append('noun.plural')
    if e['verb'] is not None and not e['verb']['aux']: out.append('verb.aux')
    return out
