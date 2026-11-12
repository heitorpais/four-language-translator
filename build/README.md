# Build scripts

Run from the repo root. All Python scripts are started with `python3 -I`. The downloaded source files go to
`build/raw` and the intermediate files to `build/work`; neither is in the repository (they are large and
rebuilt by the scripts). The download list is in `build/SOURCES.txt`.

## Phase 4 build (all languages, all tiers)

| Step | Script | What it does |
|---|---|---|
| 1 | `index_sources.py` | Reads the Wiktionary extracts once (English edition: English, German, French, Portuguese, Czech, Italian, Spanish, Dutch, Swedish, Latin words; German, French, Portuguese, Czech, Italian, Spanish, Dutch editions) into SQLite indexes in `build/raw/db`. |
| 2 | `inventory.py <lang>` | The cleaned word list of one language: drops proper names, abbreviations (except those in `common_abbreviations.txt`), entries that are only a form or misspelling of another word. Ranks the words with FrequencyWords (OpenSubtitles 2018) and sets the tier: core (8,000 most frequent), extended (found in the frequency list), long tail (the rest). `lemma_blocklist.txt` holds hand-removed wrong lemmas. |
| 3 | `build_entries.py <lang>` | Builds the entries of one language: grammar, IPA, senses and translations (routes: own edition, other editions, through English). |
| 4 | `link_entries.py` | Adds the reverse links (gehen → ir gives ir → gehen), merges them into matching senses, orders each translation list, drops phrases nobody links to. |
| 5 | `collect_core.py` | Collects the core entries into one file for the next steps. |
| 6 | `examples.py` | Up to 4 Tatoeba sentences per core entry, in all four languages. |
| 7 | `library/export_library.js`, `import_library.py` | Merges the entries saved in the first version of the app; writes `reports/library_conflicts.md`. |
| 8 | `enrich_with_claude.py` | Adds the AI-written fields from `build/claude/*.tsv` where still empty. |
| 9 | `generate_forms.py` | Builds all word forms by rule, tests them against Wiktionary, stores the exceptions in `irregular_forms`. |
| 9b | `regions.py` | Register labels of core senses (colloquial, formal …), and marks regional translations from Wiktionary's region labels and `build/claude/regional_words.tsv` (celular BR / telemóvel PT, laufen for "walk" in Switzerland); fills a missing region's word from synonyms. Report: `reports/regions_report.json`. |
| 9c | `swiss.py`, `fix_verbs.py`, `czech.py` | Hand-checked Swiss words (level, translations, the word used in Germany and Austria, regional genders such as das Tram), corrected irregular verb tables, Czech clean-up (English order, wrong-class meanings). |
| 10 | `build_tiers.py` | Writes `app/data`: core card files, core details files, letter files of the other tiers, manifest. |
| 11 | `validate.py` | Checks `app/data`; exit status 1 on failure. |

`sh build/run_phase4.sh` runs steps 3 to 11.

## Tests

- `python3 -I build/test/dump_forms.py && node build/test/test_forms.js`: the JavaScript rules in `app/forms.js` give exactly the same forms as `generate_forms.py`.
- `node build/test/test_app4.js [Mbit/s]`: opens the app in Chrome on a throttled connection, measures the first visit, looks up words of every tier and inflected forms, checks the translation order, then turns the network off.
- `node build/test/test_app.js`: the Phase 3 test (settings, offline).
- `node build/test/test_phase5.js`: the Phase 5 features (search, cards, views, practice, audio with a stand-in voice, personal data, settings, export), 135 checks.
- `node build/test/test_regions.js`: the same meaning gives the same word from any language, each region gets its own word first, and the pronunciation label follows the chosen region.

## Pilot scripts (Phases 1 to 3)

`prep_german.py`, `select_lemmas.py`, `prep_targets.py`, `import_wiktionary.py`, `import_tatoeba.py` and
`build_tiers` of the pilot built the first 1,000 German words. Phase 4 reuses their grammar and IPA rules.

## Data files in app/data

Everything except `manifest.json` and `regional.json` is stored gzip-compressed (`*.json.gz`): the ten languages come to about 1.3 GB
uncompressed, over the GitHub Pages limit of 1 GB; compressed they take about 200 MB. The app unpacks them in the browser
(`readJson` in app.js, DecompressionStream). In the manifest, `bytes` is the unpacked size and `stored_bytes` the size on disk.
Python scripts read them with `rjson` from common.py, which finds the `.gz` file by itself.

Latin has no film-subtitle frequency list: `frequency_la.py` counts the words of the Tatoeba Latin sentences instead.
