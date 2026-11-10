"""Attach up to 4 Tatoeba sentences to every German entry.

A sentence qualifies when it contains the lemma or one of its inflected forms (taken from the
Wiktionary form tables).  Sentences with a direct translation in all of en, fr and pt are preferred,
then short everyday sentences (4-10 words).  Each example keeps the Tatoeba ids and user names
needed for attribution (CC BY 2.0 FR).

Run:  python3 -I build/import_tatoeba.py"""
import sys, os, re, bz2, heapq, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

TOK = re.compile(r"[A-Za-zÄÖÜäöüß]+")
T = os.path.join(RAW, 'tatoeba')
SKIP_TAGS = {'table-tags', 'inflection-template', 'class', 'auxiliary', 'abbreviation', 'diminutive', 'multiword-construction'}
PER_ENTRY = 4
PARTICLES = {'ab', 'an', 'auf', 'aus', 'bei', 'ein', 'fest', 'her', 'hin', 'los', 'mit', 'nach', 'vor', 'weg', 'zu', 'zurück', 'zusammen', 'weiter', 'um', 'durch', 'vorbei', 'raus', 'rein', 'heraus', 'herein', 'hinaus', 'statt', 'teil', 'wieder', 'über', 'unter', 'nieder', 'fort', 'heim', 'kennen', 'da', 'dabei', 'herum', 'hoch', 'runter', 'rüber', 'frei'}
PRON = {'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'man', 'zu', 'am'}


def read_tsv(name):
    with bz2.open(os.path.join(T, name), 'rt', encoding='utf-8') as f:
        for line in f:
            yield line.rstrip('\n').split('\t')


def main():
    entries = rjson(os.path.join(WORK, 'entries.json'))
    tables = rjson(os.path.join(WORK, 'de_tables.json'))
    exact = collections.defaultdict(set)      # capitalised form -> entry ids (nouns)
    lower = collections.defaultdict(set)      # lower-case form -> entry ids
    pairs = collections.defaultdict(set)      # verb part -> {(particle, entry id)}  (separable verbs)
    for i, t in tables.items():
        e = entries[i]; lemma = e['lemma']
        forms = {lemma}
        for f in t['dewikt']:
            if SKIP_TAGS & set(f[1]): continue
            w = re.sub(r'^(der|die|das|des|dem|den) ', '', f[0].rstrip('!'))
            toks = w.split()
            if len(toks) == 1: forms.add(w)
            elif len(toks) == 2 and e['pos'] == 'verb' and lemma.startswith(toks[1]) and len(toks[1]) >= 2 \
                    and toks[0].lower() not in PRON and len(lemma) > len(toks[1]) + 3:
                pairs[toks[0].lower()].add((toks[1].lower(), i))
        for f in t['enwikt']:
            if SKIP_TAGS & set(f[1]) or ' ' in f[0]: continue
            if e['pos'] == 'verb' or set(f[1]) & {'plural', 'genitive', 'comparative', 'superlative'} or len(f[1]) > 1:
                forms.add(f[0])
        for w in forms:
            if not TOK.fullmatch(w): continue
            (exact if lemma[0].isupper() else lower)[w if lemma[0].isupper() else w.lower()].add(i)

    de = {}
    for p in read_tsv('deu_sentences_detailed.tsv.bz2'):
        if len(p) >= 4: de[int(p[0])] = (p[2], p[3])
    links = {}
    need = {l: set() for l in ('eng', 'fra', 'por')}
    for l in need:
        m = collections.defaultdict(list)
        for p in read_tsv('deu-%s_links.tsv.bz2' % l):
            m[int(p[0])].append(int(p[1])); need[l].add(int(p[1]))
        links[l] = m
    other = {}
    for l in need:
        d = {}
        for p in read_tsv('%s_sentences_detailed.tsv.bz2' % l):
            if len(p) >= 4 and int(p[0]) in need[l]: d[int(p[0])] = (p[2], p[3])
        other[l] = d
    print('German sentences', len(de), '| linked', {l: len(other[l]) for l in other}, flush=True)

    cand = collections.defaultdict(list)       # entry id -> heap of (score, sid, start, end, form)
    for sid, (text, user) in de.items():
        if len(text) > 90 or len(text) < 8 or re.search(r'[\d"„“”»«:;()\[\]/]', text): continue
        toks = [(m.group(), m.start(), m.end()) for m in TOK.finditer(text)]
        n = len(toks)
        if n < 3 or n > 13: continue
        ntr = sum(1 for l in ('eng', 'fra', 'por') if any(x in other[l] for x in links[l].get(sid, ())))
        base = {3: 100, 2: 40, 1: 10, 0: 0}[ntr] - abs(n - 7) * 2 - (4 if not user or user == r'\N' else 0)
        lows = [t[0].lower() for t in toks]
        for k, (w, a, b) in enumerate(toks):
            first = k == 0 or text[:a].rstrip()[-1:] in '.!?'
            hits = set()
            if w in exact: hits |= exact[w]
            if (w.islower() or first) and w.lower() in lower: hits |= lower[w.lower()]
            amb = len({entries[i]['lemma'] for i in hits})
            for i in hits:
                sc = base + (15 if amb == 1 else 0) - (6 if first else 0)
                # "Ich stehe früh auf" is aufstehen, not stehen
                if entries[i]['pos'] == 'verb' and lows[-1] in PARTICLES and k < n - 1 and not entries[i]['lemma'].startswith(lows[-1]): sc -= 80
                heapq.heappush(cand[i], (sc, sid, a, b, w.lower()))
                if len(cand[i]) > 40: heapq.heappop(cand[i])
            if (w.islower() or first) and w.lower() in pairs:
                for part, i in pairs[w.lower()]:
                    if part in lows[k + 1:]:
                        heapq.heappush(cand[i], (base + 20, sid, a, b, w.lower()))
                        if len(cand[i]) > 40: heapq.heappop(cand[i])

    used = collections.Counter(); n_ex = 0; four = 0; with_all = 0
    for i in sorted(cand, key=lambda i: entries[i]['frequency_rank'] or 10 ** 6):
        e = entries[i]; chosen = []; forms_used = set(); starts = set()
        pool = sorted(cand[i], reverse=True)
        while pool and len(chosen) < PER_ENTRY:
            best = max(pool, key=lambda c: c[0] - 12 * used[c[1]] - (8 if c[4] in forms_used else 0) - (25 if ' '.join(de[c[1]][0].split()[:3]) in starts else 0))
            pool.remove(best)
            sc, sid, a, b, w = best
            if any(sid == c[1] for c in chosen): continue
            chosen.append(best); forms_used.add(w); used[sid] += 1; starts.add(' '.join(de[sid][0].split()[:3]))
        for sc, sid, a, b, w in chosen:
            text, user = de[sid]
            tr = {}; tid = {}; credit = {'de': None if user == r'\N' else user}
            for l, code in (('eng', 'en'), ('fra', 'fr'), ('por', 'pt')):
                ids = sorted(x for x in links[l].get(sid, ()) if x in other[l])
                if ids:
                    best = min(ids, key=lambda x: (abs(len(other[l][x][0]) - len(text)), x))
                    tr[code] = other[l][best][0]; tid[code] = 't:%d' % best
                    credit[code] = None if other[l][best][1] == r'\N' else other[l][best][1]
                else:
                    tr[code] = None
            e['examples'].append({'id': 't:%d' % sid, 'text': text, 'hl': [a, b], 'translations': tr,
                                  'translation_ids': tid, 'credits': credit, 'origin': 'tatoeba'})
            n_ex += 1
            if all(tr.values()): with_all += 1
        if e['examples']: e['origin']['examples'] = 'tatoeba'
        if len(e['examples']) == PER_ENTRY: four += 1
        for g in e['governs']:           # point a preposition pattern at an example that shows it
            if g['prep']:
                ex = next((x for x in e['examples'] if re.search(r'\b' + re.escape(g['prep']) + r'\b', x['text'], re.I)), None)
                if ex: g['example_id'] = ex['id']
    wjson(os.path.join(WORK, 'entries_tatoeba.json'), entries)
    nde = sum(1 for e in entries.values() if e['lang'] == 'de')
    stats = {'german_entries': nde, 'with_examples': sum(1 for e in entries.values() if e['lang'] == 'de' and e['examples']),
             'with_4_examples': four, 'examples': n_ex, 'examples_with_en_fr_pt': with_all}
    wjson(os.path.join(REPORTS, 'tatoeba_stats.json'), stats, indent=1)
    print(stats)


if __name__ == '__main__':
    main()
