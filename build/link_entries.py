"""Phase 4, pass 2 of build_entries: reverse links, translation order, unused multi-word entries.

For every link A -> B found in pass 1, B gets a sense pointing back to A unless it already has one
(gehen -> ir, so ir -> gehen).  Then every list of translations is sorted: first the translations whose
own Wiktionary entry names the source word (the "ir" entry lists "gehen"; "andar" may not), then by
frequency.  Multi-word entries (phrases) are kept only if some entry links to them.
Writes build/work/entries_<lang>.jsonl.gz."""
import sys, os, json, gzip, sqlite3, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

SOURCES = {'de': ['ed-de', 'enw-de'], 'en': ['enw-en'], 'fr': ['ed-fr', 'enw-fr'], 'pt': ['ed-pt', 'enw-pt']}
MAX_REV = {'core': 3, 'ext': 2, 'tail': 2}
_db = {}


def db(src):
    if src not in _db: _db[src] = sqlite3.connect('file:' + os.path.join(RAW, 'db', src + '.sqlite') + '?mode=ro', uri=True)
    return _db[src]


_named = {}


def names(i):
    """(lang, word) pairs that entry i's own Wiktionary entries give as translations"""
    if i not in _named:
        lang, w = i.split(':')[0], i.split(':')[1]
        out = set()
        for s in SOURCES[lang]:
            for tl, tw in db(s).execute('select tl, tw from tr where word=?', (w,)):
                out.add((tl, norm(tl, tw)))
        _named[i] = out
    return _named[i]


def norm(lang, w):
    import re
    w = re.sub(r'\([^)]*\)', '', w).strip(' !?.¡¿')
    return re.sub(r'^to\s+', '', w) if lang == 'en' else w


def main():
    rank = {}
    for L in LANGS:
        lem = rjson(os.path.join(WORK, 'inv_%s.json' % L))['lemmas']
        rank[L] = {w: v['rank'] for w, v in lem.items() if v['rank']}
        del lem
    incoming = collections.defaultdict(list)
    for L in LANGS:
        for line in gzip.open(os.path.join(WORK, 'links_%s.jsonl.gz' % L), 'rt', encoding='utf-8'):
            src, tgt, r, gloss, tr, route = json.loads(line)
            incoming[tgt].append((r, src, gloss, tr, route))
    print('links', sum(len(v) for v in incoming.values()), flush=True)
    rk = lambda i: rank[i.split(':')[0]].get(i.split(':')[1], 10 ** 9)
    # every id that will exist after this pass (phrases nobody links to are dropped)
    exists = set()
    for L in LANGS:
        for line in gzip.open(os.path.join(WORK, 'p1_%s.jsonl.gz' % L), 'rt', encoding='utf-8'):
            i = line[8:line.index('"', 8)]
            lemma = i.split(':')[1]
            if ' ' in lemma and '"tier": "core"' not in line and i not in incoming and i.rsplit(':', 1)[0] not in incoming:
                continue
            exists.add(i)
    print('entries kept', len(exists), flush=True)
    # a phrase is kept only if some entry links to it; a back-link from a phrase only if the phrase is kept
    kept_phrase = lambda i: i in exists
    st = collections.Counter()
    for L in LANGS:
        out = gzip.open(os.path.join(WORK, 'entries_%s.jsonl.gz' % L), 'wt', encoding='utf-8')
        n = 0
        for line in gzip.open(os.path.join(WORK, 'p1_%s.jsonl.gz' % L), 'rt', encoding='utf-8'):
            e = json.loads(line)
            base = e['id'] if e['id'].count(':') == 2 else e['id'].rsplit(':', 1)[0]
            inc = sorted(incoming.get(base, []) + (incoming.get(e['id'], []) if base != e['id'] else []), key=lambda x: (x[0], x[1]))
            if ' ' in e['lemma'] and not inc and e['tier'] != 'core':
                st['phrase dropped'] += 1; continue
            have = {(l, x) for s in e['senses'] for l, ids in s['translations'].items() for x in ids}
            own = {(id(s), X): {t: k for k, t in enumerate(ids)} for s in e['senses'] for X, ids in s['translations'].items()}   # the entry's own order
            added = 0
            for r, src, gloss, tr, route in inc:
                sl = src.split(':')[0]
                if (sl, src) in have or not kept_phrase(src): continue
                # the source's sense shares a translation with one of this entry's senses: add it there
                others = {x for X, ids in tr.items() if X not in (L, sl) for x in ids}
                fit = next((s for s in e['senses'] if others & {x for X, ids in s['translations'].items() for x in ids}
                            or (gloss and s.get('gloss_en') == gloss)), None)
                if fit is not None and len(fit['translations'].get(sl, [])) < 4:
                    fit['translations'].setdefault(sl, []).append(src)
                    if fit['route'].get(sl, 'none') == 'none': fit['route'][sl] = route.get(L, 'none')
                    have.add((sl, src)); st['reverse merged'] += 1
                    continue
                if added >= MAX_REV[e['tier']]: continue
                rt = route.get(L, 'none')
                new = {sl: [src]}; rroute = {sl: rt}
                for X, ids in tr.items():
                    if X not in (L, sl): new[X] = list(ids); rroute[X] = route.get(X, 'none')
                for X in LANGS:
                    if X != L and X not in new: new[X] = []; rroute[X] = 'none'
                s = {'id': 's%d' % (len(e['senses']) + 1), 'gloss_en': gloss if (sl == 'en' or L == 'en' or gloss) else None,
                     'translations': new, 'route': rroute, 'origin': 'wiktionary', 'reverse': True}
                if e['tier'] == 'core': s['gloss'] = None; s['register'] = None
                if e['tier'] == 'tail': s.pop('gloss_en')
                e['senses'].append(s); have.add((sl, src)); added += 1; st['reverse senses'] += 1
                e['origin']['senses'] = 'wiktionary'
            # drop ids that do not exist (dropped phrases), then empty senses
            for s in e['senses']:
                for X in s['translations']:
                    ids = s['translations'][X]
                    keep = [x for x in ids if x in exists]
                    if len(keep) != len(ids): st['dangling ids removed'] += len(ids) - len(keep); s['translations'][X] = keep
                    if not keep and s['route'].get(X) not in (None, 'none'): s['route'][X] = 'none'
            e['senses'] = [s for s in e['senses'] if any(s['translations'].values())]
            if e.get('synonyms'):          # a synonym whose entry was dropped stays as plain text
                gone = [x for x in e['synonyms'] if x not in exists]
                if gone:
                    e['synonyms'] = [x for x in e['synonyms'] if x in exists]
                    e['synonyms_text'] = uniq(e.get('synonyms_text', []) + [x.split(':')[1] for x in gone])
                    st['synonym ids made text'] += len(gone)
            # no English gloss: name the English translations ("to go, to walk")
            for s in e['senses']:
                if 'gloss_en' in s and not s['gloss_en']:
                    en = [x.split(':')[1] for x in s['translations'].get('en', [])[:3]]
                    if en: s['gloss_en'] = ', '.join(('to ' if e['pos'] == 'verb' else '') + w for w in en)
                    elif L == 'en': s['gloss_en'] = None
            # at most 8 senses on a core entry; the best-translated ones are kept, in their order
            cap = {'core': 8, 'ext': 4, 'tail': 3}[e['tier']]
            if len(e['senses']) > cap:
                filled = lambda s: sum(1 for X, ids in s['translations'].items() if ids and s['route'].get(X) != 'via-en-unchecked')
                keep = sorted(range(len(e['senses'])), key=lambda k: (-filled(e['senses'][k]), k))[:cap]
                st['senses capped'] += len(e['senses']) - cap
                e['senses'] = [e['senses'][k] for k in sorted(keep)]
            for k, s in enumerate(e['senses'], 1): s['id'] = 's%d' % k
            if not e['senses']: e['origin'].pop('senses', None)
            # order: translation that names this word back first, then by frequency
            for s in e['senses']:
                for X, ids in s['translations'].items():
                    if len(ids) > 1:
                        old = list(ids)
                        pos = own.get((id(s), X), {})
                        # 1. a translation whose own entry names this word back ("ir" lists "gehen")
                        # 2. the entry's own translations before those added from other entries' links ("so" for sehr)
                        # 3. frequency ("ir" before "andar"), then the order the entry's own Wiktionary gives
                        ids.sort(key=lambda t: (0 if (L, e['lemma']) in names(t) else 1, 0 if t in pos else 1, rk(t), pos.get(t, 0)))
                        if ids != old: st['lists reordered'] += 1
            out.write(json.dumps(e, ensure_ascii=False) + '\n'); n += 1
        out.close()
        print(L, 'entries', n, flush=True)
    wjson(os.path.join(WORK, 'p2_stats.json'), dict(st), indent=1)
    print(dict(st))


if __name__ == '__main__':
    main()
