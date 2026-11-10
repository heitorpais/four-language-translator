"""Writes the forms the Python generator gives for every shipped entry (for test_forms.js)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from common import *
import generate_forms as gf
out = {}
for l in LANGS:
    for e in rjson(os.path.join(DATA, 'core-%s.json' % l)):
        if e['pos'] in ('noun', 'verb', 'adjective'):
            out[e['id']] = gf.forms(e)
wjson(os.path.join(WORK, 'forms_py.json'), out)
print('entries', len(out), 'forms', sum(len(v) for v in out.values()))
