"""Latin has no film-subtitle frequency list, so the word counts come from the Tatoeba Latin sentences.
Writes build/raw/frequency/la_full.txt in the FrequencyWords format ("word count" per line, most common first).
Run after download.sh:  python3 -I build/frequency_la.py"""
import bz2, collections, os, re

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'raw')
words = collections.Counter()
with bz2.open(os.path.join(RAW, 'tatoeba', 'lat_sentences_detailed.tsv.bz2'), 'rt', encoding='utf-8') as f:
    for line in f:
        parts = line.rstrip('\n').split('\t')
        if len(parts) < 3: continue
        for w in re.findall(r"[a-zA-ZÀ-ɏ]+", parts[2].lower()):
            words[w] += 1
with open(os.path.join(RAW, 'frequency', 'la_full.txt'), 'w', encoding='utf-8') as f:
    for w, n in words.most_common():
        f.write('%s %d\n' % (w, n))
print('Latin words counted:', len(words))
