"""Phase 4: collect the core entries of all four languages into build/work/core.json, the file the
example, library, AI-field and word-form steps work on.  Extended and long-tail entries stay in
build/work/entries_<lang>.jsonl.gz."""
import sys, os, json, gzip
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

core = {}
for L in LANGS:
    for line in gzip.open(os.path.join(WORK, 'entries_%s.jsonl.gz' % L), 'rt', encoding='utf-8'):
        if '"tier": "core"' in line:
            e = json.loads(line)
            if e['tier'] == 'core': core[e['id']] = e
wjson(os.path.join(WORK, 'core.json'), core)
print('core entries', len(core), {L: sum(1 for e in core.values() if e['lang'] == L) for L in LANGS})
