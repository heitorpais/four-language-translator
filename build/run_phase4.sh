#!/bin/sh
# Phase 4 build, after index_sources.py (7 sources) and inventory.py (4 languages). Run from the repo root.
set -e
python3 -I build/build_entries.py de & python3 -I build/build_entries.py pt & wait
python3 -I build/build_entries.py fr & python3 -I build/build_entries.py en & wait
python3 -I build/link_entries.py
python3 -I build/collect_core.py
python3 -I build/examples.py
node build/library/export_library.js
python3 -I build/import_library.py
python3 -I build/enrich_with_claude.py
python3 -I build/generate_forms.py
python3 -I build/pos_share.py
python3 -I build/regions.py
python3 -I build/swiss.py
python3 -I build/fix_verbs.py
python3 -I build/czech.py
python3 -I build/build_tiers.py
python3 -I build/validate.py
