#!/bin/sh
# Rebuilds the data from the cached source records. Run from the repo root:  sh build/run_all.sh
# (prep_german.py, select_lemmas.py and prep_targets.py must have been run once before; they read build/raw.)
set -e
python3 -I build/import_wiktionary.py
python3 -I build/import_tatoeba.py
node build/library/export_library.js
python3 -I build/import_library.py
python3 -I build/enrich_with_claude.py
python3 -I build/generate_forms.py
python3 -I build/build_tiers.py
python3 -I build/validate.py
