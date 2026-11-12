# Corrections of reported mistakes

People report mistakes with "Report a mistake in this entry" (under "More about this word"). Each report is a GitHub
issue in this repository. A scheduled task checks them every morning and fixes the clear ones by adding
**corrections** to `app/data/manifest.json`, in the list `"corrections"`. The app applies them to an entry as soon as
the entry is loaded, also offline (the manifest is saved on the device). A rebuild of the data (`build/build_tiers.py`)
keeps the list.

Nothing else in `app/data/` is edited by hand: the data files are checked by size and SHA-256 in the manifest.

## Format

Each correction is one object. `entry` (the entry id, e.g. `en:can:verb`) and `issue` (the issue number) are required;
`date` (YYYY-MM-DD) and `note` (what was wrong, in one line) should be given. Then one or more of:

| key | effect | example |
|---|---|---|
| `set` | sets fields; dotted paths, numbers are list positions | `{"noun.gender": "f", "senses.0.gloss_en": "to be able to"}` |
| `hide` | the entry is not shown anywhere (`true`) | `true` |
| `remove_translation` | removes a translation from every sense, or from `sense` | `{"lang": "pt", "target": "pt:telemóvel:noun"}` |
| `add_translation` | adds a translation to sense `sense`, first unless `"first": false` | `{"lang": "pt", "target": "pt:celular:noun"}` |
| `sense` | the sense (position, from 0) for the two keys above | `0` |
| `hide_example` | hides one example sentence | `{"id": "t:12345"}` |
| `example_translation` | replaces one translation of an example sentence, or removes it without `text` | `{"id": "t:12345", "lang": "pt", "text": "Eu posso nadar."}` |

A translation target must be an existing entry id (`lang:lemma:pos`), found with the app or in `app/data/`.

```json
{"entry": "en:can:verb", "issue": 12, "date": "2026-11-13", "note": "past form is could",
 "set": {"verb.principal_parts": ["can", "could", null]}}
```

## Checks before uploading

```
python3 -I build/validate.py          # must end with RESULT: PASS
node build/test/test_corrections.js   # the corrections are applied in the browser
```

Then bump `SHELL` in `app/sw.js` (flt-shell-vN → vN+1) only if app files changed; a change to the manifest alone needs no
bump.
