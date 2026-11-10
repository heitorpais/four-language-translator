# Build scripts

Run from the repo root, in this order. All scripts are started with `python3 -I`.

| Step | Script | What it does |
|---|---|---|
| 1 | (download) | Source files go to `build/raw` (not shipped). The list is in `build/SOURCES.txt`. |
| 2 | `prep_german.py` | Caches the German records of the German and English Wiktionary. |
| 3 | `select_lemmas.py 1000` | Picks the most frequent German lemmas (FrequencyWords, OpenSubtitles 2018). `lemma_blocklist.txt` holds hand-removed wrong lemmas and names. |
| 4 | `prep_targets.py` | Pulls the needed English, French and Portuguese records out of the source files. |
| 5 | `import_wiktionary.py` | Builds the entries (spec section 4) and the translation links. |
| 6 | `import_tatoeba.py` | Adds up to 4 example sentences per German entry. |
| 7 | `library/export_library.js`, `import_library.py` | Merges the entries saved in the first version of the app; writes `reports/library_conflicts.md`. |
| 8 | `enrich_with_claude.py` | Adds the AI-written fields from `build/claude/*.tsv` where still empty. |
| 8a | `generate_forms.py` | Builds all word forms by rule, tests them against Wiktionary, stores the exceptions in `irregular_forms` (Phase 2). |
| 9 | `build_tiers.py` | Writes `app/data`. |
| 10 | `validate.py` | Checks `app/data`; exit status 1 on failure. |


`sh build/run_all.sh` runs steps 5 to 10. `report_phase1.py` prints the numbers for the report.

Tests (Phase 3):
- `python3 -I build/test/dump_forms.py && node build/test/test_forms.js`: the JavaScript rules in `app/forms.js` give exactly the same forms as `generate_forms.py`.
- `node build/test/test_app.js`: opens the app in Chrome, turns the network off and opens every German entry; checks the settings.
