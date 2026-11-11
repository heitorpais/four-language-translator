"""Add the fields that may be written by an AI (origin "claude"), and only where they are still empty:
CEFR level, Swiss German form, typical learner mistake, usage note.

The texts are in build/claude/*.tsv.  They were written by Claude during the build; nothing is
requested at runtime and no API key is used.   Run:  python3 -I build/enrich_with_claude.py"""
import sys, os, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

CEFR = ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')


def rows(name):
    for line in open(os.path.join(ROOT, 'build', 'claude', name), encoding='utf-8'):
        line = line.rstrip('\n')
        if line and not line.startswith('#'):
            yield line.split('|')


def main():
    entries = rjson(os.path.join(WORK, 'core.json'))
    by_lemma = collections.defaultdict(list)
    for e in entries.values():
        if e['lang'] == 'de': by_lemma[e['lemma']].append(e)
    n = collections.Counter(); unknown = []
    for r in rows('enrichment_de.tsv'):
        lemma, level, gsw = (r + ['', ''])[:3]
        if lemma not in by_lemma: unknown.append(lemma); continue
        assert level in CEFR, r
        for e in by_lemma[lemma]:
            if not e['level']:
                e['level'] = level; e['origin']['level'] = 'claude'; n['level'] += 1
            if gsw.strip() and not e['swiss_german']:
                e['swiss_german'] = {'form': gsw.strip(), 'origin': 'claude', 'approximate': True}
                e['origin']['swiss_german'] = 'claude'; n['swiss_german'] += 1
    for r in rows('notes_de.tsv'):
        i, mistake, note = (r + ['', ''])[:3]
        if not mistake.strip() and not note.strip(): continue
        if i not in entries: unknown.append(i); continue
        e = entries[i]
        if mistake.strip() and not e['more']['learner_mistake']:
            e['more']['learner_mistake'] = mistake.strip(); e['origin']['more.learner_mistake'] = 'claude'; n['learner_mistake'] += 1
        if note.strip() and not e['usage_note']:
            e['usage_note'] = note.strip(); e['origin']['usage_note'] = 'claude'; n['usage_note'] += 1
    wjson(os.path.join(WORK, 'core.json'), entries)
    nde = sum(len(v) for v in by_lemma.values())
    print('German entries', nde, 'filled now', dict(n)); print('not in data', unknown)
    print('still without level', [e['id'] for v in by_lemma.values() for e in v if not e['level']])


if __name__ == '__main__':
    main()
