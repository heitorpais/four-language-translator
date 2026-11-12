"""Phase 4, after generate_forms: which translations are regional, so the app can put first the word of the
region the reader chose (celular in Brazil, telemóvel in Portugal; laufen for "walk" in Switzerland).

For every translation T in a sense S (S's meaning = its English gloss and English translations):
  * T's Wiktionary senses (English edition) whose definition names that meaning are looked up;
    if every one of them carries a region label ("Brazil", "Switzerland", ...), T is regional for S:
    senses[].regional[T] = ["BR"]   used in these regions only; [] = only in regions the app does not offer
  * no sense names the meaning: T counts as regional only if all its senses (English edition, else its own
    language's edition) carry a region label.
  * build/claude/regional_words.tsv adds what Wiktionary does not label: "+CH" = the usual word in that region,
    "-CH" = not used for this meaning there.  Those markers are listed in senses[].regional_origin = "claude".
  * a list whose first word is regional and that has no word for region R gets R's word from that word's
    Wiktionary synonyms (telemóvel -> celular) or, in English, its other spelling (favourite -> favorite).
The app puts a word marked for the reader's region before unmarked ones only if the list also holds a word
marked for another region (café da manhã / pequeno-almoço) or the marker is Claude's "+"; words marked only for
other regions go last.
Each entry whose senses are all regional gets used_in: ["PT"].
A core sense whose matching Wiktionary senses all carry the same register label (colloquial, formal, slang …) gets it
in senses[].register.
Rewrites build/work/core.json and build/work/entries_<lang>.jsonl.gz in place.  Run:  python3 -I build/regions.py"""
import sys, os, re, json, gzip, sqlite3, zlib, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

SEL = {   # labels -> region the app offers
    'de': {'Switzerland': 'CH', 'Swiss': 'CH', 'Swiss Standard German': 'CH', 'Austria': 'AT', 'Austrian': 'AT',
           'Austrian German': 'AT', 'Germany': 'DE'},
    'en': {'US': 'US', 'American': 'US', 'UK': 'GB', 'British': 'GB', 'England': 'GB', 'Commonwealth': 'GB'},
    'fr': {'France': 'FR', 'Quebec': 'CA', 'Québec': 'CA', 'Canada': 'CA', 'Canadian': 'CA', 'North-America': 'CA',
           'Montreal': 'CA', 'Belgium': 'BE', 'Belgique': 'BE', 'Switzerland': 'CH', 'Suisse': 'CH'},
    'pt': {'Brazil': 'BR', 'Brazilian': 'BR', 'Portugal': 'PT', 'Portuguese': 'PT', 'Lusitanian': 'PT'},
    'cs': {},
    'it': {'Switzerland': 'CH', 'Swiss': 'CH', 'Ticino': 'CH', 'Italy': 'IT'},
    'es': {'Spain': 'ES', 'in Spain': 'ES', 'Mexico': 'MX', 'Mexican': 'MX', 'Mexico-City': 'MX', 'in Mexico': 'MX',
           'Argentina': 'AR', 'in Argentina': 'AR', 'Rioplatense': 'AR', 'Río-de-la-Plata': 'AR', 'Northwestern-Argentina': 'AR', 'Northern-Argentina': 'AR',
           'Latin-America': ('MX', 'AR'), 'in Latin America': ('MX', 'AR'), 'America': ('MX', 'AR'), 'South-America': ('AR',)},
    'nl': {'Netherlands': 'NL', 'Belgium': 'BE', 'Flemish': 'BE', 'Flanders': 'BE'},
    'sv': {}, 'la': {'Ecclesiastical': 'EC', 'Classical': 'CL'},
}
OTHER = {  # region labels for places the app does not offer
    'de': 'Liechtenstein Bavaria Bavarian Bayern Southern-Germany South-German South German Süddeutschland Northern-Germany '
          'North German Norddeutschland Rhineland Westphalia Berlin Upper-German Namibia Ruhrgebiet Luxembourg South-Tyrol '
          'Swabian Belgium',
    'en': 'Australia Canada Scotland Ireland India New-Zealand Philippines Northern-England South-Africa Singapore Malaysia '
          'Singlish Southern-US Multicultural-London-English Hong-Kong Geordie Cockney Caribbean South-Asia Jamaica Yorkshire '
          'Nigeria Cornwall Pakistan Manglish West-Country Wales Appalachia Northern-Ireland Africa Texas',
    'fr': 'Louisiana Africa Rwanda Morocco Antilles Congo Congo-Kinshasa Lyon Lyonnais Luxembourg Vietnam Alsace Normandy '
          'Normandie Lorraine New-England Picardy Occitanie Régionalisme Acadie',
    'pt': 'Azores Angola Mozambique Moçambique Madeira São-Paulo Rio-de-Janeiro North-Brazil Northeast-Brazil South-Brazil '
          'Southern-Brazil Bahia Minas-Gerais Paraná Guinea-Bissau Africa Macau Uruguay Caipira Trás-os-Montes Galicia Minho '
          'Alentejo Beira Regionalismo',
    'cs': 'Moravia Moravian Silesia Silesian Bohemia Bohemian Common-Czech Slovakia',
    'it': 'Tuscany Rome Romanesco Naples Neapolitan Sicily Sicilian Venice Northern-Italy Southern-Italy',
    'es': 'Uruguay Chile Colombia Peru Venezuela Cuba Caribbean Andalusia Canary Andes Central-America Puerto-Rico Dominican-Republic Ecuador Bolivia Paraguay',
    'nl': 'Suriname Limburg Brabant Holland',
    'sv': 'Finland Finland-Swedish Gotland Skåne Norrland',
    'la': 'Medieval New-Latin Late-Latin Vulgar',
}
OTHER = {L: set(v.split(' ')) | {'South German', 'North German', 'Swiss Standard German', 'Austrian German', 'Rio Grande do Sul'} for L, v in OTHER.items()}
SOURCES = {'de': ['enw-de', 'ed-de'], 'en': ['enw-en'], 'fr': ['enw-fr', 'ed-fr'], 'pt': ['enw-pt', 'ed-pt'], 'cs': ['enw-cs', 'ed-cs'], 'it': ['enw-it', 'ed-it'], 'es': ['enw-es', 'ed-es'], 'nl': ['enw-nl', 'ed-nl'], 'sv': ['enw-sv'], 'la': ['enw-la']}
DBPOS = {'adjective': 'adj', 'adverb': 'adv', 'numeral': 'num', 'pronoun': 'pron', 'preposition': 'prep',
         'conjunction': 'conj', 'interjection': 'intj', 'determiner': 'det'}
OFFERED = {'de': ['DE', 'CH', 'AT'], 'en': ['US', 'GB'], 'fr': ['FR', 'CA', 'BE', 'CH'], 'pt': ['BR', 'PT'], 'cs': ['CZ'], 'it': ['IT', 'CH'], 'es': ['ES', 'MX', 'AR'], 'nl': ['NL', 'BE'], 'sv': ['SE'], 'la': ['CL', 'EC']}
_db = {}


def db(src):
    if src not in _db: _db[src] = sqlite3.connect('file:' + os.path.join(RAW, 'db', src + '.sqlite') + '?mode=ro', uri=True)
    return _db[src]


def labels(lang, tags):
    """None: no region label; else the set of offered regions (may be empty: only elsewhere)"""
    sel = set()
    for t in tags:
        v = SEL[lang].get(t)
        if v: sel.update((v,) if isinstance(v, str) else v)
    if sel or any(t in OTHER[lang] for t in tags): return sel
    return None


_senses = {}
REGISTER = {'colloquial': 'colloquial', 'informal': 'colloquial', 'slang': 'slang', 'vulgar': 'vulgar', 'offensive': 'offensive',
            'derogatory': 'derogatory', 'pejorative': 'derogatory', 'formal': 'formal', 'literary': 'literary', 'poetic': 'literary',
            'dated': 'dated', 'archaic': 'archaic', 'obsolete': 'archaic', 'humorous': 'humorous', 'childish': 'childish', 'euphemistic': 'euphemistic'}
_regs = {}


def register_of(i, ks):
    """the register label shared by all of entry i's English-edition senses that name one of ks"""
    if i not in _regs:
        p = i.split(':'); lang, word, pos = p[0], p[1], p[2] if len(p) > 2 else ''
        out = []
        for (b,) in db('enw-' + lang).execute('select data from entry where word=? and pos=?', (word, DBPOS.get(pos, pos))):
            d = json.loads(zlib.decompress(b))
            for x in d['senses']:
                if x.get('form_of') or x.get('alt_of'): continue
                out.append(((x.get('gloss') or '').lower(), [REGISTER[t] for t in x['tags'] if t in REGISTER]))
        _regs[i] = out
    m = [x for x in _regs[i] if match(x[0], ks)]
    if not m or not all(x[1] for x in m): return None
    common = set(m[0][1]).intersection(*[set(x[1]) for x in m[1:]])
    return sorted(common)[0] if common else None


def senses_of(i):
    """[(source, gloss lower, regions or None, synonyms)] for entry id i, English edition first"""
    if i in _senses: return _senses[i]
    p = i.split(':')
    lang, word, pos = p[0], p[1], p[2] if len(p) > 2 else ''
    out = []
    for src in SOURCES[lang]:
        for (b,) in db(src).execute('select data from entry where word=? and pos=?', (word, DBPOS.get(pos, pos))):
            d = json.loads(zlib.decompress(b))
            for s in d['senses']:
                if s.get('form_of') or s.get('alt_of') or 'form-of' in s['tags'] or 'alt-of' in s['tags']: continue
                out.append((src[:3], (s.get('gloss') or '').lower(), labels(lang, s['tags']), s.get('syn') or []))
    if len(_senses) > 400000: _senses.clear()
    _senses[i] = out
    return out


def entry_regions(i):
    """offered regions if every sense of i (English edition, else own edition) is region-labelled"""
    ss = senses_of(i)
    for src in ('enw', 'ed-'):
        x = [s for s in ss if s[0] == src]
        if x:
            if all(s[2] is not None for s in x): return sorted(set().union(*(s[2] for s in x)))
            return None
    return None


def keys_of(e, s):
    ks = set()
    for part in re.split(r'[,;]', s.get('gloss_en') or ''):
        part = re.sub(r'\([^)]*\)', '', part).strip().lower()
        part = re.sub(r'^to ', '', part)
        if part and len(part) > 1: ks.add(part)
    for t in s['translations'].get('en', []):
        ks.add(t.split(':')[1].lower())
    if e['lang'] == 'en': ks.add(e['lemma'].lower())
    return ks


_kre = {}


def match(gloss, ks):
    for k in ks:
        r = _kre.get(k)
        if r is None:
            r = _kre[k] = re.compile(r'(?<![\w-])' + re.escape(k) + r'(?![\w-])')
        if r.search(gloss): return True
    return False


def sense_regions(t, ks, own_lemma):
    ss = senses_of(t)
    en = [s for s in ss if s[0] == 'enw']
    m = [s for s in en if match(s[1], ks - {own_lemma})] if en else []
    if m:
        if all(s[2] is not None for s in m): return sorted(set().union(*(s[2] for s in m))), m
        return None, m
    return entry_regions(t), en


def load_claude():
    rows = []
    for line in open(os.path.join(ROOT, 'build', 'claude', 'regional_words.tsv'), encoding='utf-8'):
        if line.startswith('#') or not line.strip(): continue
        lang, reg, means, word, pos, mark, beside, notwith = line.rstrip('\n').split('\t')
        rows.append((lang, reg, set(means.split('/')), '%s:%s:%s' % (lang, word, {'num': 'numeral'}.get(pos, pos)), mark,
                     '%s:%s:%s' % (lang, beside, {'num': 'numeral'}.get(pos, pos)) if beside else None, set(filter(None, notwith.split('/')))))
    return rows


def main():
    exists = set()
    for L in LANGS:
        for line in gzip.open(os.path.join(WORK, 'entries_%s.jsonl.gz' % L), 'rt', encoding='utf-8'):
            exists.add(line[8:line.index('"', 8)])
    core = rjson(os.path.join(WORK, 'core.json'))
    exists |= set(core)
    claude = load_claude()
    for c in claude:
        if c[3] not in exists: print('claude list: not in the dictionary', c[3])
    st = collections.Counter()
    used = {}

    def do(e):
        L = e['lang']
        r = entry_regions(e['id']) if L in SOURCES else None
        if r is not None: e['used_in'] = r; st['entries used_in ' + L] += 1
        else: e.pop('used_in', None)
        for s in e['senses']:
            s.pop('regional', None); s.pop('regional_origin', None)
            if e['tier'] == 'core' and 'register' in s:
                reg_ks = keys_of(e, s) - ({e['lemma'].lower()} if L != 'en' else set())
                if L == 'en': reg_ks = {k for k in reg_ks if k != e['lemma'].lower()} or reg_ks
                r = register_of(e['id'], reg_ks) if reg_ks else None
                s['register'] = r
                if r: st['register ' + r] += 1
            ks = None
            reg, orig = {}, {}
            for X, ids in s['translations'].items():
                if not ids and not any(c[0] == X for c in claude): continue
                if ks is None: ks = keys_of(e, s)
                syn = {}
                for t in ids:
                    rr, ms = sense_regions(t, ks, t.split(':')[1].lower() if X == 'en' else '')
                    if rr is not None:
                        reg[t] = rr; st['marked %s' % X] += 1
                        syn[t] = [w for m in ms if m[2] is not None for w in m[3]]
                # the first word is regional and the list has nothing for region R: look for R's word among the
                # first word's synonyms (telemóvel -> celular) or, in English, its other spelling (favourite -> favorite)
                if ids and ids[0] in reg:
                    for R in OFFERED[X]:
                        if any(R in reg.get(t, ()) for t in ids) or R in reg[ids[0]]: continue
                        if not all(t in reg for t in ids) and not (X == 'en'): continue
                        t = ids[0]; w0, pos = t.split(':')[1], t.split(':')[2]
                        cands = list(syn.get(t, []))
                        if X == 'en':
                            for a, b in (('our', 'or'), ('ise', 'ize'), ('isation', 'ization'), ('tre', 'ter'), ('ogue', 'og'), ('ll', 'l')):
                                if a in w0: cands.insert(0, w0.replace(a, b))
                                if b in w0 and R == 'GB': cands.insert(0, w0.replace(b, a))
                        for w in cands:
                            c = '%s:%s:%s' % (X, w, pos)
                            if c in exists and c not in ids:
                                rc, _ = sense_regions(c, ks, w.lower() if X == 'en' else '')
                                if (rc is None and X != 'en') or (rc is not None and R in rc):
                                    ids.insert(ids.index(t) + 1, c); st['counterparts added %s' % X] += 1
                                    if rc is not None: reg[c] = rc
                                    break
                # Claude's list; a sense that matches two meanings of the list ("marcher": walk and run) is left alone
                rows = [c for c in claude if c[0] == X and ks & c[2] and not ks & c[6]]
                amb = {(c[1]) for c in rows if len({frozenset(d[2]) for d in rows if d[1] == c[1]}) > 1}
                for lang, R, means, w, mark, beside, notwith in rows:
                    if R in amb: continue
                    if mark == '+' and w not in ids and beside in ids and w in exists:
                        ids.insert(ids.index(beside) + 1, w); st['claude words added'] += 1
                    if w not in ids: continue
                    if mark == '+' and R in reg.get(w, ()): continue          # Wiktionary says so already
                    reg[w] = sorted(set(reg.get(w, [])) | {mark + R})
                    orig[w] = 'claude'; st['claude markers'] += 1
            if reg: s['regional'] = reg
            if orig: s['regional_origin'] = orig

    for e in core.values(): do(e)
    wjson(os.path.join(WORK, 'core.json'), core)
    print('core done', dict(st), flush=True)
    for L in LANGS:
        p = os.path.join(WORK, 'entries_%s.jsonl.gz' % L)
        out = gzip.open(p + '.tmp', 'wt', encoding='utf-8')
        for line in gzip.open(p, 'rt', encoding='utf-8'):
            e = json.loads(line)
            if e['tier'] != 'core' and e['id'] not in core: do(e)
            out.write(json.dumps(e, ensure_ascii=False) + '\n')
        out.close(); os.replace(p + '.tmp', p)
        print(L, 'done', flush=True)
    wjson(os.path.join(ROOT, 'build', 'reports', 'regions_report.json'), dict(st), indent=1)
    print(dict(st))


if __name__ == '__main__':
    main()
