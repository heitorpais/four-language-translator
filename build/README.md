# Build scripts

Run from the repo root. All Python scripts are started with `python3 -I`. The downloaded source files go to
`build/raw` and the intermediate files to `build/work`; neither is in the repository (they are large and
rebuilt by the scripts). The download list is in `build/SOURCES.txt`.

## Phase 4 build (all languages, all tiers)

| Step | Script | What it does |
|---|---|---|
| 1 | `index_sources.py` | Reads the seven Wiktionary extracts once (English edition: English, German, French, Portuguese words; German, French, Portuguese editions) into SQLite indexes in `build/raw/db`. |
| 2 | `inventory.py <lang>` | The cleaned word list of one language: drops proper names, abbreviations (except those in `common_abbreviations.txt`), entries that are only a form or misspelling of another word. Ranks the words with FrequencyWords (OpenSubtitles 2018) and sets the tier: core (8,000 most frequent), extended (found in the frequency list), long tail (the rest). `lemma_blocklist.txt` holds hand-removed wrong lemmas. |
| 3 | `build_entries.py <lang>` | Builds the entries of one language: grammar, IPA, senses and translations (routes: own edition, other editions, through English). |
| 4 | `link_entries.py` | Adds the reverse links (gehen → ir gives ir → gehen), merges them into matching senses, orders each translation list, drops phrases nobody links to. |
| 5 | `collect_core.py` | Collects the core entries into one file for the next steps. |
| 6 | `examples.py` | Up to 4 Tatoeba sentences per core entry, in all four languages. |
| 7 | `library/export_library.js`, `import_library.py` | Merges the entries saved in the first version of the app; writes `reports/library_conflicts.md`. |
| 8 | `enrich_with_claude.py` | Adds the AI-written fields from `build/claude/*.tsv` where still empty. |
| 9 | `generate_forms.py` | Builds all word forms by rule, tests them against Wiktionary, stores the exceptions in `irregular_forms`. |
| 10 | `build_tiers.py` | Writes `app/data`: core card files, core details files, letter files of the other tiers, manifest. |
| 11 | `validate.py` | Checks `app/data`; exit status 1 on failure. |

`sh build/run_phase4.sh` runs steps 3 to 11.

## Tests

- `python3 -I build/test/dump_forms.py && node build/test/test_forms.js`: the JavaScript rules in `app/forms.js` give exactly the same forms as `generate_forms.py`.
- `node build/test/test_app4.js [Mbit/s]`: opens the app in Chrome on a throttled connection, measures the first visit, looks up words of every tier and inflected forms, checks the translation order, then turns the network off.
- `node build/test/test_app.js`: the Phase 3 test (settings, offline).

## Pilot scripts (Phases 1 to 3)

`prep_german.py`, `select_lemmas.py`, `prep_targets.py`, `import_wiktionary.py`, `import_tatoeba.py` and
`build_tiers` of the pilot built the first 1,000 German words. Phase 4 reuses their grammar and IPA rules.
