#!/bin/bash
# Downloads all Phase-1 source files into build/raw (not shipped with the app).
cd "$(dirname "$0")/raw" || exit 1
get(){ curl -sS -L --retry 5 -C - -o "$2" "$1" && echo "ok $2 $(stat -c %s "$2")" || echo "FAIL $2"; }
for l in de en fr pt; do
  get https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/$l/${l}_full.txt freq_${l}_full.txt
done
get https://kaikki.org/ptwiktionary/raw-wiktextract-data.jsonl.gz ptwiktionary.jsonl.gz
get https://kaikki.org/dewiktionary/raw-wiktextract-data.jsonl.gz dewiktionary.jsonl.gz
for l in deu eng fra por; do
  get https://downloads.tatoeba.org/exports/per_language/$l/${l}_sentences.tsv.bz2 tatoeba_${l}_sentences.tsv.bz2
done
get https://downloads.tatoeba.org/exports/links.tar.bz2 tatoeba_links.tar.bz2
get https://kaikki.org/frwiktionary/raw-wiktextract-data.jsonl.gz frwiktionary.jsonl.gz
get https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz enwiktionary.jsonl.gz
# Czech (added later)
get https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/cs/cs_full.txt frequency/cs_full.txt
get https://kaikki.org/dictionary/Czech/kaikki.org-dictionary-Czech.jsonl.gz enwiktionary/Czech.jsonl.gz
get https://kaikki.org/cswiktionary/raw-wiktextract-data.jsonl.gz editions/cs-extract.jsonl.gz
get https://downloads.tatoeba.org/exports/per_language/ces/ces_sentences_detailed.tsv.bz2 tatoeba/ces_sentences_detailed.tsv.bz2
for x in ces-eng ces-deu ces-fra ces-por; do get https://downloads.tatoeba.org/exports/per_language/ces/${x}_links.tsv.bz2 tatoeba/${x}_links.tsv.bz2; done
# Italian, Spanish, Dutch, Swedish, Latin (added later). Latin has no subtitle list: build/frequency_la.py counts Tatoeba Latin sentences.
for l in it es nl sv; do get https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/$l/${l}_full.txt frequency/${l}_full.txt; done
for n in Italian Spanish Dutch Swedish Latin; do get https://kaikki.org/dictionary/$n/kaikki.org-dictionary-$n.jsonl.gz enwiktionary/$n.jsonl.gz; done
for l in it es nl; do get https://kaikki.org/${l}wiktionary/raw-wiktextract-data.jsonl.gz editions/${l}-extract.jsonl.gz; done
T="ces deu eng fra por ita spa nld swe lat"
for a in ita spa nld swe lat; do
  get https://downloads.tatoeba.org/exports/per_language/$a/${a}_sentences_detailed.tsv.bz2 tatoeba/${a}_sentences_detailed.tsv.bz2
  for b in $T; do [ $a != $b ] && get https://downloads.tatoeba.org/exports/per_language/$a/${a}-${b}_links.tsv.bz2 tatoeba/${a}-${b}_links.tsv.bz2; done
  for b in ces deu eng fra por; do get https://downloads.tatoeba.org/exports/per_language/$b/${b}-${a}_links.tsv.bz2 tatoeba/${b}-${a}_links.tsv.bz2; done
done
echo ALLDONE
