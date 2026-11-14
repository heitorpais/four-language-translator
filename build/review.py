"""Phase 4, after czech.py: the hand-checked core vocabulary (build/claude/concepts.tsv) and corrections
(build/claude/review.tsv) are applied to build/work/core.json.

concepts.tsv: one meaning per row with the usual word in each language. For each of those words that is a core entry,
the meaning that matches the row (its English translations or English gloss name the row's English word) gets the row's
words first in each other language (added if missing) and becomes the entry's first meaning. Route "claude".

review.tsv (one change per line, tab-separated):
  drop-tr   <entry id>  <sense id or *>  <language or *>  <word id or word>   remove a translation
  drop-sense <entry id> <sense id>                                            remove a meaning
  first     <entry id>  <sense id or *>  <word id>                            put this translation first (add if missing)
  gloss     <entry id>  <sense id>  <English gloss>                           replace the English gloss of a meaning
  sense-first <entry id> <sense id>                                           show this meaning first
Run:  python3 -I build/review.py"""
import sys, os, re, json, gzip, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

POS_ORDER = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'determiner', 'preposition', 'conjunction', 'interjection',
             'numeral', 'article', 'particle', 'phrase', 'contraction', 'name']


def load_ids():
    ids = set()
    for L in LANGS:
        for line in gzip.open(os.path.join(WORK, 'entries_%s.jsonl.gz' % L), 'rt', encoding='utf-8'):
            ids.add(line[8:line.index('"', 8)])
    return ids


def main():
    core = rjson(os.path.join(WORK, 'core.json'))
    ids = load_ids() | set(core)
    by_lemma = collections.defaultdict(list)
    for i in ids:
        p = i.split(':')
        if len(p) == 3: by_lemma[(p[0], p[1])].append(p[2])

    def resolve(L, w, pos):
        ps = by_lemma.get((L, w))
        if not ps:
            if L == 'de' and w and w[0].islower():                                   # German nouns are capitalised
                ps2 = by_lemma.get((L, w[0].upper() + w[1:]))
                if ps2: w, ps = w[0].upper() + w[1:], ps2
            if not ps: return None
        order = [pos] + [x for x in POS_ORDER if x != pos]
        ps = sorted(ps, key=lambda x: order.index(x) if x in order else 99)
        # prefer the core entry when several parts of speech exist
        for x in ps:
            if '%s:%s:%s' % (L, w, x) in core and x == ps[0]: return '%s:%s:%s' % (L, w, x)
        return '%s:%s:%s' % (L, w, ps[0])

    st = collections.Counter(); missing = collections.Counter(); touched = set(); notfound = []; fixed = set()
    # 1. a meaning that names a letter of the alphabet keeps only letters as translations (not "avere" for Spanish "de")
    MAJOR = {'noun', 'verb', 'adjective'}
    # parts of speech that may stand for each other; a phrase or a name fits any meaning (None)
    GROUPS = {'noun': 'n', 'verb': 'v', 'adjective': 'a', 'adverb': 'adv', 'particle': 'adv', 'pronoun': 'p', 'determiner': 'p',
              'article': 'p', 'numeral': 'num', 'preposition': 'prep', 'contraction': 'prep', 'conjunction': 'conj', 'interjection': 'intj'}
    pos_of = lambda i: i.split(':')[2] if i.count(':') == 2 else ''
    for e in core.values():
        for s in e['senses']:
            g = (s.get('gloss_en') or '').lower()
            if re.search(r'name of the (latin[- ]script )?letter|^the letter ', g):
                for T, tr in s['translations'].items():
                    keep = [y for y in tr if len(y.split(':')[1]) <= 2]
                    st['letter meaning: translations dropped'] += len(tr) - len(keep); s['translations'][T] = keep
            # 2. a meaning translated by words of its own part of speech does not also list words of another one
            #    (a noun's meaning lists no verbs; Swedish "på" lists no German adjective "ein")
            grp = GROUPS.get(e['pos'])
            if grp:
                for T, tr in s['translations'].items():
                    if any(GROUPS.get(pos_of(y)) == grp for y in tr):
                        keep = [y for y in tr if GROUPS.get(pos_of(y)) in (grp, None)]
                        if len(keep) < len(tr): st['other part of speech dropped'] += len(tr) - len(keep); s['translations'][T] = keep
    cols = None
    for line in open(os.path.join(ROOT, 'build', 'claude', 'concepts.tsv'), encoding='utf-8'):
        if line.startswith('# pos'): cols = line[2:].rstrip('\n').split('\t'); continue
        if line.startswith('#') or not line.strip(): continue
        f = line.rstrip('\n').split('\t')
        if len(f) != len(cols): print('bad row', f); continue
        pos = f[0]; words = {L: w.strip() for L, w in zip(cols[1:], f[1:]) if w.strip() and w.strip() != '-'}
        rid = {}
        for L, w in words.items():
            r = resolve(L, w, pos)
            if r: rid[L] = r
            else: missing[L] += 1; st['word not in dictionary'] += 1; notfound.append('%s\t%s\t%s' % (L, w, pos))
        en = words.get('en', '').lower()
        for L, X in rid.items():
            e = core.get(X)
            if not e: continue
            def score(s):
                tr = s['translations']
                n = sum(1 for T, Y in rid.items() if T != L and Y in tr.get(T, []))
                g = (s.get('gloss_en') or '').lower()
                m = en and (re.search(r'(^|[ ,;(])(to )?%s($|[ ,;)])' % re.escape(en), g) is not None)
                return (n + (3 if m else 0))
            best = max(e['senses'], key=score) if e['senses'] else None
            if best is None: continue
            if score(best) == 0: best = e['senses'][0]
            for T, Y in rid.items():
                if T == L: continue
                if (X, best['id'], T) in fixed: continue          # an earlier row already chose the word for this meaning
                fixed.add((X, best['id'], T))
                tr = best['translations'].setdefault(T, [])
                if tr[:1] == [Y]: continue
                if Y in tr: tr.remove(Y); st['moved first'] += 1
                else: st['added'] += 1
                tr.insert(0, Y)
                best.setdefault('route', {})[T] = 'claude'
            if X not in touched and e['senses'][0] is not best:
                e['senses'].remove(best); e['senses'].insert(0, best); st['meaning moved first'] += 1
            touched.add(X)
        st['rows'] += 1
    # single corrections
    rp = os.path.join(ROOT, 'build', 'claude', 'review.tsv')
    if os.path.exists(rp):
        for line in open(rp, encoding='utf-8'):
            if line.startswith('#') or not line.strip(): continue
            f = line.rstrip('\n').split('\t'); op, X = f[0], f[1]
            e = core.get(X)
            if not e: st['review: entry missing'] += 1; print('review: no entry', X); continue
            if op == 'drop-sense':
                n = len(e['senses']); e['senses'] = [s for s in e['senses'] if s['id'] != f[2]] or e['senses']
                st['senses dropped'] += n - len(e['senses'])
            elif op == 'sense-first':
                m = [x for x in e['senses'] if x['id'] == f[2]]
                if m: e['senses'] = m + [x for x in e['senses'] if x['id'] != f[2]]; st['senses moved first'] += 1
            elif op == 'gloss':
                for s in e['senses']:
                    if s['id'] == f[2]: s['gloss_en'] = f[3]; st['glosses'] += 1
            elif op == 'drop-tr':
                sid, T, Y = f[2], f[3], f[4]
                for s in e['senses']:
                    if sid != '*' and s['id'] != sid: continue
                    for T2, tr in s['translations'].items():
                        if T != '*' and T2 != T: continue
                        keep = [] if Y == '*' else [y for y in tr if y != Y and y.split(':')[1] != Y]
                        st['translations dropped'] += len(tr) - len(keep); s['translations'][T2] = keep
            elif op == 'first':
                sid, Y = f[2], f[3]; T = Y.split(':')[0]
                if Y not in ids: print('review: no such word', Y); st['review: word missing'] += 1; continue
                for s in e['senses']:
                    if sid != '*' and s['id'] != sid: continue
                    tr = s['translations'].setdefault(T, [])
                    if Y in tr: tr.remove(Y)
                    tr.insert(0, Y); s.setdefault('route', {})[T] = 'claude'; st['first'] += 1
                    if sid == '*': break
    # regional markers only for words still in the meaning
    for e in core.values():
        for s in e['senses']:
            listed = {x for ids in s['translations'].values() for x in ids}
            for k in ('regional', 'regional_origin'):
                if k in s:
                    s[k] = {t: v for t, v in s[k].items() if t in listed}
                    if not s[k]: del s[k]
            if 'regional_origin' in s:
                s['regional_origin'] = {t: v for t, v in s['regional_origin'].items() if t in s.get('regional', {})}
                if not s['regional_origin']: del s['regional_origin']
    # a meaning left without translations is dropped (the entry keeps at least one)
    for e in core.values():
        keep = [s for s in e['senses'] if any(s['translations'].values())]
        if keep and len(keep) < len(e['senses']): st['empty meanings dropped'] += len(e['senses']) - len(keep); e['senses'] = keep
    with open(os.path.join(ROOT, 'build', 'reports', 'review_notfound.txt'), 'w', encoding='utf-8') as fo: fo.write('\n'.join(notfound) + '\n')
    if '--check' not in sys.argv: wjson(os.path.join(WORK, 'core.json'), core)
    print(dict(st)); print('words not found per language', dict(missing))


if __name__ == '__main__':
    main()
