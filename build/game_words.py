"""Word lists for Quinque, the five-letter word game (app/game.js).

For each language writes app/data/game/game-<lang>.json.gz:
  answers: {"4" ... "8": [[id, lemma, frequency_rank, level, meaning], ...]}  everyday words that can be the hidden word
           meaning: a short definition in the word's own language (from that language's Wiktionary edition; English
           for English), with the word itself blanked out, so the hint never gives the answer away
  valid:   {"3" ... "9": ["casas"...]}                             every base form the player may type

Rules (shown in the game): only dictionary base forms count. Nouns in the singular, verbs in the infinitive (the
dictionary form), adjectives in the base form. No conjugated verbs, no plurals, no names, no abbreviations.
Accents are ignored (é = e); in Swedish å, ä and ö are letters of their own. Words with ß or other letters outside the
alphabet are left out.
Answers come from the core and extended tiers, by frequency; vulgar, offensive and derogatory words are never answers.
The files are added to data/manifest.json (tier "game"). Run after build_tiers.py.
"""
import glob, gzip, hashlib, json, os, re, sqlite3, unicodedata, zlib

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'data')
LANGS = ['en', 'de', 'fr', 'pt', 'cs', 'it', 'es', 'nl', 'sv', 'la']
LENS = tuple(range(3, 10))          # every length the games use: Quinque 5 and 6, the other games 3 to 9
ANSWER_LENS = tuple(range(4, 9))   # hidden words: 4 to 8 letters
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


DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'raw', 'db')
EDITION = {'en': 'enw-en', 'de': 'ed-de', 'fr': 'ed-fr', 'pt': 'ed-pt', 'es': 'ed-es', 'it': 'ed-it', 'cs': 'ed-cs', 'nl': 'ed-nl'}
POS_DB = {'noun': {'noun'}, 'verb': {'verb'}, 'adjective': {'adj', 'adjective'}, 'adverb': {'adv', 'adverb'}, 'numeral': {'num', 'numeral'}}
SKIP_TAGS = {'obsolete', 'archaic', 'dated', 'rare', 'veraltet', 'veraltend', 'selten', 'vulgar', 'derogatory', 'offensive'}
_DB = {}


def plain(t):
    return ''.join(c for c in unicodedata.normalize('NFD', t.lower()) if not unicodedata.combining(c))


def native_meaning(lang, lemma, pos):
    """the first everyday definition of the word in its own language, with the word blanked out"""
    src = EDITION.get(lang)
    if not src or not os.path.exists(os.path.join(DB_DIR, src + '.sqlite')):
        return ''
    if src not in _DB:
        _DB[src] = sqlite3.connect(os.path.join(DB_DIR, src + '.sqlite'))
    best = None
    for (data,) in _DB[src].execute('select data from entry where lang=? and word=?', (lang, lemma)):
        try:
            d = json.loads(zlib.decompress(data))
        except Exception:
            d = json.loads(data)
        if d.get('pos') not in POS_DB.get(pos, {pos}):
            continue
        for s in d.get('senses') or []:
            g = (s.get('gloss') or '').strip()
            if not g or s.get('form_of') or s.get('alt_of') or len(g) < 4:
                continue
            if SKIP_TAGS & {t.lower() for t in s.get('tags') or []}:
                if best is None: best = g
                continue
            best = g
            break
        else:
            continue
        break
    if not best:
        return ''
    stem = plain(lemma)[:max(4, len(lemma) - 2)]
    words = re.findall(r'\w+|\W+', best)
    out = ''.join('…' if re.match(r'\w', w) and plain(w).startswith(stem) else w for w in words)
    out = re.sub(r'\s+', ' ', out).strip()
    if len(out) > 180:
        out = out[:177].rsplit(' ', 1)[0] + ' …'
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
        if pos not in POS_ANSWER or n not in ANSWER_LENS:
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
            cand[n][key] = [e['id'], lem, r, e.get('level'), None, pos]
    answers = {}
    for n in ANSWER_LENS:
        a = sorted(cand[n].values(), key=lambda v: v[2])
        for v in a:
            if v[2] >= 10 ** 7:
                v[2] = None
            v[4] = native_meaning(lang, v[1], v[5])
            del v[5]
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
        print(lang, {n: (len(d['answers'][n]), len(d['valid'][n]), sum(1 for v in d['answers'][n] if v[4])) for n in d['answers']})
    man['files'] = files
    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
