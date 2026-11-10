# Sources and licences

The word data shipped in `app/data` is built from the sources below. Each field of each entry
carries its origin (`wiktionary`, `tatoeba`, `generated` or `claude`) in the entry's `origin` map.

## Wiktionary: CC BY-SA 4.0

Dictionary data (headwords, pronunciation, gender, plurals, verb forms, translations, definitions,
etymologies, idioms, word families) comes from Wiktionary, in the machine-readable extracts published
by kaikki.org (Wiktextract):

- English Wiktionary: entries for German, English, French and Portuguese words
- German Wiktionary (de.wiktionary.org)
- French Wiktionary (fr.wiktionary.org)
- Portuguese Wiktionary (pt.wiktionary.org)

Text is available under the Creative Commons Attribution-ShareAlike 4.0 licence
(https://creativecommons.org/licenses/by-sa/4.0/). Authors: the Wiktionary contributors; the
edit history of each word's page lists them (https://en.wiktionary.org, https://de.wiktionary.org,
https://fr.wiktionary.org, https://pt.wiktionary.org). The data was selected, merged and reformatted
for this app, and the result is shared under the same licence.

Wiktextract: Tatu Ylonen, "Wiktextract: Wiktionary as Machine-Readable Structured Data",
LREC 2022. https://kaikki.org/dictionary/rawdata.html

## Tatoeba: CC BY 2.0 FR

Example sentences and their translations come from Tatoeba (https://tatoeba.org), export of
7 November 2026, under the Creative Commons Attribution 2.0 France licence
(https://creativecommons.org/licenses/by/2.0/fr/). Every example keeps its Tatoeba sentence number
(`"id": "t:12345"` is https://tatoeba.org/sentences/show/12345) and the user names of the authors
(`credits`).

## FrequencyWords: CC BY-SA 4.0 (content), MIT (code)

Word frequencies come from FrequencyWords by Hermit Dave
(https://github.com/hermitdave/FrequencyWords), lists `content/2018/{de,en,fr,pt_br}/*_50k.txt`,
which are counted from the OpenSubtitles 2018 corpus (https://opus.nlpl.eu/OpenSubtitles2018.php).

## Fonts: SIL Open Font License 1.1

The app ships its own fonts (folder `app/fonts`), taken from the Fontsource packages on npm:

- IBM Plex Sans and IBM Plex Mono, Copyright 2019 IBM Corp. (`app/fonts/OFL-IBM-Plex.txt`)
- Newsreader, Copyright 2020 The Newsreader Project Authors (`app/fonts/OFL-Newsreader.txt`)

## Fields written by an AI

Fields with origin `claude` (CEFR level, Swiss German form, typical learner mistake, usage notes,
and the entries carried over from the first version of the app) were written by Claude (Anthropic).
They are not checked against a printed dictionary. Swiss German has no fixed spelling; those forms
are marked `"approximate": true`.

## Fields built by rules

Fields with origin `generated` (for example "regular / irregular", the short plural rule) are computed
by the scripts in `/build` from the Wiktionary forms.
