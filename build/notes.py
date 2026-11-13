"""Learner notes for the languages other than German (German: enrich_with_claude.py with notes_de.tsv).
build/claude/notes_<lang>.tsv, one line per entry:  entry id|typical learner mistake|usage note  (written by Claude,
origin "claude"). A text is only added where the field is still empty.
Reads and writes build/work/core.json.  Run:  python3 -I build/notes.py"""
import sys, os, glob, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *


def main():
    path = os.path.join(WORK, 'core.json')
    core = rjson(path)
    n = collections.Counter(); unknown = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'build', 'claude', 'notes_*.tsv'))):
        if f.endswith('notes_de.tsv'): continue
        for line in open(f, encoding='utf-8'):
            line = line.rstrip('\n')
            if not line or line.startswith('#'): continue
            i, mistake, note = (line.split('|') + ['', ''])[:3]
            e = core.get(i)
            if not e: unknown.append(i); continue
            e.setdefault('origin', {}) if isinstance(e.get('origin'), dict) else e.__setitem__('origin', {})
            e.setdefault('more', {}) if isinstance(e.get('more'), dict) else e.__setitem__('more', {})
            if mistake.strip() and not e['more'].get('learner_mistake'):
                e['more']['learner_mistake'] = mistake.strip(); e['origin']['more.learner_mistake'] = 'claude'; n[e['lang'] + ' mistake'] += 1
            if note.strip() and not e.get('usage_note'):
                e['usage_note'] = note.strip(); e['origin']['usage_note'] = 'claude'; n[e['lang'] + ' note'] += 1
    print('notes added', dict(n)); print('entries not found', unknown)
    wjson(path, core)


if __name__ == '__main__':
    main()
