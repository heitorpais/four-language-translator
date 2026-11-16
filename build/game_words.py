"""Word lists for Quinque, the five-letter word game (app/game.js).

For each language writes app/data/game/game-<lang>.json.gz:
  answers: {"5": [[id, lemma, frequency_rank, level], ...], "6": [...]}  everyday words that can be the hidden word
  valid:   {"5": ["casas"...], "6": [...]}                             every base form the player may type

Rules (shown in the game): only dictionary base forms count. Nouns in the singular, verbs in the infinitive (the
dictionary form), adjectives in the base form. No conjugated verbs, no plurals, no names, no abbreviations.
Accents are ignored (é = e); in Swedish å, ä and ö are letters of their own. Words with ß or other letters outside the
alphabet are left out.
Answers come from the core and extended tiers, by frequency; vulgar, offensive and derogatory words are never answers.
The files are added to data/manifest.json (tier "game"). Run after build_tiers.py.
"""
import glob, gzip, hashlib, json, os, unicodedata

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'data')
LANGS = ['en', 'de', 'fr', 'pt', 'cs', 'it', 'es', 'nl', 'sv', 'la']
LENS = (5, 6)
POS_ANSWER = {'noun', 'verb', 'adjective', 'adverb', 'numeral'}
POS_SKIP = {'name', 'proper noun', 'abbreviation', 'symbol', 'letter', 'prefix', 'suffix', 'affix', 'character', 'phrase', 'contraction', 'particle'}
BAD = ('vulgar', 'offensive', 'derogatory')
KEEP = {'sv': 'åäö'}


def letters(word, lang):
    if not isinstance(word, str):
        return None
    if lang == 'de':
        word = word.replace('ß', 'ss')           # Swiss spelling: groß is played as GROSS
    keep, out = KEEP.get(lang, ''), []
    for ch in word.lower():
        if ch in keep:
            out.append(ch)
            continue
        b = ''.join(c for c in unicodedata.normalize('NFD', ch) if not unicodedata.combining(c))
        if len(b) != 1 or not ('a' <= b <= 'z'):
            return None
        out.append(b)
    return out


def entries(lang):
    with gzip.open(os.path.join(ROOT, 'core-%s.json.gz' % lang)) as f:
        for e in json.load(f):
            yield e
    for p in sorted(glob.glob(os.path.join(ROOT, 'ext', lang, '*.json.gz'))):
        with gzip.open(p) as f:
            d = json.load(f)
        for e in (d.get('entries') if isinstance(d, dict) else d) or []:
            yield e


def build(lang):
    valid = {n: set() for n in LENS}
    cand = {n: {} for n in LENS}
    for e in entries(lang):
        lem, pos = e.get('lemma'), e.get('pos')
        if not lem or pos in POS_SKIP or ' ' in lem:
            continue
        x = letters(lem, lang)
        if not x or len(x) not in LENS:
            continue
        n = len(x)
        if (lang != 'de' and lem[0] != lem[0].lower()) or lem.isupper():
            continue
        key = ''.join(x)
        valid[n].add(key)
        if pos not in POS_ANSWER:
            continue
        senses = e.get('senses') or []
        if any(any(b in (s.get('register') or '') for b in BAD) for s in senses):
            continue
        if not any(s.get('gloss_en') or any(v for v in (s.get('translations') or {}).values()) for s in senses):
            continue
        rank = e.get('frequency_rank')
        if not rank and e.get('tier') != 'core':
            continue                               # unranked extended words are too rare to be the hidden word
        r = rank or 10 ** 7
        old = cand[n].get(key)
        if old is None or r < old[2]:              # one answer per spelling: the most frequent entry
            cand[n][key] = [e['id'], lem, r, e.get('level')]
    answers = {}
    for n in LENS:
        a = sorted(cand[n].values(), key=lambda v: v[2])
        for v in a:
            if v[2] >= 10 ** 7:
                v[2] = None
        answers[str(n)] = a
    return {'lang': lang, 'answers': answers, 'valid': {str(n): sorted(valid[n]) for n in LENS}}


def main():
    out_dir = os.path.join(ROOT, 'game')
    os.makedirs(out_dir, exist_ok=True)
    mpath = os.path.join(ROOT, 'manifest.json')
    with open(mpath, encoding='utf-8') as f:
        man = json.load(f)
    files = [f for f in man['files'] if f.get('tier') != 'game']
    for lang in LANGS:
        d = build(lang)
        raw = json.dumps(d, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        name = 'game/game-%s.json.gz' % lang
        with open(os.path.join(ROOT, name), 'wb') as f:
            f.write(gzip.compress(raw, 9, mtime=0))
        files.append({'file': name, 'bytes': len(raw), 'stored_bytes': os.path.getsize(os.path.join(ROOT, name)),
                      'sha256': hashlib.sha256(raw).hexdigest()[:16], 'tier': 'game', 'lang': lang,
                      'entries': sum(len(v) for v in d['answers'].values()), 'forms': sum(len(v) for v in d['valid'].values())})
        print(lang, {n: (len(d['answers'][n]), len(d['valid'][n])) for n in d['answers']})
    man['files'] = files
    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
