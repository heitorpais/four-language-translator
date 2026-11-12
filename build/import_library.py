"""Merge the entries saved in the old app (build/library/library.json) into the new data.

Rule (owner's decision 4): for gender, plural, IPA and verb forms Wiktionary replaces what was saved.
Saved fields are kept only where Wiktionary has nothing, and are marked origin "claude".
Every place where the saved data and Wiktionary disagree is written to
build/reports/library_conflicts.md.

Run:  node build/library/export_library.js && python3 -I build/import_library.py"""
import sys, os, re, json, gzip, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import import_wiktionary as iw

PC = {'noun': 'noun', 'verb': 'verb', 'adjective': 'adj', 'numeral': 'num', 'adverb': 'adv'}
CASES = {'Akkusativ': 'Akk', 'Dativ': 'Dat', 'Genitiv': 'Gen'}
REGION = {'gb': 'GB', 'ch': 'CH', 'at': 'AT', 'ca': 'CA', 'be': 'BE', 'pt': 'PT'}


def lemma_of(lang, w):
    w = w.strip()
    if lang == 'en': w = re.sub(r'^to\s+', '', w)
    if lang == 'de': w = re.sub(r'^sich\s+', '', w)
    if lang == 'fr': w = re.sub(r"^(se\s+|s')", '', w)
    if lang == 'pt': w = re.sub(r'-se$', '', w)
    return w


def ipa_key(s):
    return re.sub(r'[.\sˈˌ()‿͡]', '', clean_ipa(s) or '')


def strip_art(s):
    return re.sub(r"^(der|die|das|les|le|la|l'|os|as|o|a)\s*(?=\S)", '', s.strip()) if s else s


def hl(text):
    m = re.search(r'\*(.+?)\*', text)
    plain = text.replace('*', '')
    return plain, ([m.start(), m.start() + len(m.group(1))] if m else None)


def main():
    import build_entries as be
    entries = rjson(os.path.join(WORK, 'core.json'))
    rest = {}                     # extended and long-tail ids, so a library word outside the core can be promoted
    for L in LANGS:
        for line in gzip.open(os.path.join(WORK, 'entries_%s.jsonl.gz' % L), 'rt', encoding='utf-8'):
            i = line[8:line.index('"', 8)]
            rest[i] = True
    extra_tables = {}
    lib = rjson(os.path.join(ROOT, 'build', 'library', 'library.json'))
    conflicts = []; rule_diffs = []; created = []; claude_only = []; kept = collections.Counter()
    seen_conf = set()

    def conflict(i, field, saved, wikt, src):
        k = (i, field, str(saved))
        if k in seen_conf: return
        seen_conf.add(k); conflicts.append((i, field, saved, wikt, src))

    def find(lang, lemma, pos):
        i = eid(lang, lemma, pos)
        if i in entries: return entries[i]
        c = [e for e in entries.values() if e['lang'] == lang and e['lemma'] == lemma]
        if c: return c[0]
        made = be.build_one(lang, lemma, pos)
        if made:
            e, t = made
            entries[e['id']] = e; extra_tables[e['id']] = t
            created.append(e['id'] + (' (moved up from the %s tier)' % 'extended or long-tail' if e['id'] in rest else ' (from Wiktionary)'))
            return e
        e = iw.new_entry(lang, lemma, pos); e['tier'] = 'core'
        if pos == 'noun': e['noun'] = {'gender': None, 'plural': None, 'plural_alt': [], 'plural_rule': None, 'plural_regular': None, 'genitive': None, 'irregular_forms': {}}
        if pos == 'verb': e['verb'] = {'regular': None, 'class': None, 'aux': None, 'aux_regional': {}, 'principal_parts': None, 'present_3sg': None, 'irregular_forms': {}}
        if pos == 'adjective': e['adjective'] = {'agreement': None, 'comparison': None, 'comparison_regular': None, 'irregular_forms': {}}
        entries[e['id']] = e; claude_only.append(e['id'])
        return e

    for n, R in enumerate(lib):
        src = R['_source']; pos = R['pos']
        ids = {}
        for lang in [l for l in LANGS if l in R]:
            L = R[lang]; lemma = lemma_of(lang, L['word'])
            e = find(lang, lemma, pos); ids[lang] = e['id']; o = e['origin']; i = e['id']
            wikt = i not in claude_only
            # ---- compare with Wiktionary (Wiktionary wins)
            if L.get('ipa'):
                if e['ipa']['default'] and ipa_key(L['ipa']) != ipa_key(e['ipa']['default']):
                    conflict(i, 'IPA', clean_ipa(L['ipa']), e['ipa']['default'], src)
                elif not e['ipa']['default']:
                    conflict(i, 'IPA', clean_ipa(L['ipa']), '(none in Wiktionary; left empty, rule 2)', src)
            if e['noun']:
                if L.get('gender') and e['noun']['gender'] and L['gender'] != e['noun']['gender']:
                    conflict(i, 'gender', L['gender'], e['noun']['gender'], src)
                sp = strip_art(L.get('plural')) if L.get('plural') not in (None, '—') else None
                wp = [e['noun']['plural']] + e['noun'].get('plural_alt', [])
                if sp and e['noun']['plural'] and sp not in wp: conflict(i, 'plural', sp, ', '.join(x for x in wp if x), src)
                elif sp and not e['noun']['plural'] and wikt: conflict(i, 'plural', sp, '(none in Wiktionary)', src)
                if L.get('pluralRegular') is not None and e['noun']['plural_regular'] is not None and L['pluralRegular'] != e['noun']['plural_regular']:
                    rule_diffs.append((i, 'plural regular?', L['pluralRegular'], e['noun']['plural_regular']))
            if e['verb'] and L.get('forms'):
                parts = [p.strip() for p in L['forms'].split('·')]
                pp = e['verb']['principal_parts'] or []
                last = re.sub(r"\(e\)$", '', parts[-1].split()[-1]) if parts else None
                if lang == 'de' and len(parts) == 3 and len(pp) == 3:
                    saved_pp = re.sub(r'^(hat|ist)\s+(sich\s+)?', '', parts[2]); saved_past = re.sub(r'\s+sich$', '', parts[1])
                    if pp[1] and saved_past != pp[1]: conflict(i, 'past tense', saved_past, pp[1], src)
                    if pp[2] and saved_pp != pp[2]: conflict(i, 'past participle', saved_pp, pp[2], src)
                elif lang == 'en' and len(parts) == 3 and len(pp) == 3:
                    if pp[1] and parts[1] != pp[1]: conflict(i, 'past tense', parts[1], pp[1], src)
                    if pp[2] and last != pp[2]: conflict(i, 'past participle', last, pp[2], src)
                elif lang == 'fr' and len(pp) == 3 and pp[2] and ' ' not in lemma:
                    if last != pp[2]: conflict(i, 'past participle', last, pp[2], src)
                elif lang == 'pt' and len(pp) == 4 and len(parts) == 3 and ' ' not in lemma:
                    sv = [re.sub(r'^me\s+', '', p) for p in parts]
                    for a, b, name in ((sv[0], pp[1], 'present (eu)'), (sv[1], pp[2], 'preterite (eu)'), (sv[2], pp[3], 'past participle')):
                        if b and a != b: conflict(i, name, a, b, src)
                if L.get('auxiliary') and e['verb']['aux'] and L['auxiliary'] not in e['verb']['aux'].split('/'):
                    conflict(i, 'auxiliary', L['auxiliary'], e['verb']['aux'], src)
                elif L.get('auxiliary') and e['verb']['aux'] and '/' in e['verb']['aux']:
                    conflict(i, 'auxiliary', L['auxiliary'], e['verb']['aux'].replace('/', ' or '), src)
                if L.get('verbRegular') is not None and e['verb']['regular'] is not None and L['verbRegular'] != e['verb']['regular']:
                    rule_diffs.append((i, 'verb regular?', L['verbRegular'], e['verb']['regular']))
            if e['adjective'] and L.get('comparison') and e['adjective']['comparison']:
                sc = [p.strip() for p in L['comparison'].split('·')]
                if sc != e['adjective']['comparison']: conflict(i, 'comparison', ' · '.join(sc), ' · '.join(e['adjective']['comparison']), src)

            # ---- keep what Wiktionary does not have, as origin "claude"
            def keep(field, cond=True):
                if cond: o[field] = 'claude'; kept[field] += 1
            if L.get('level') or R.get('level'):
                if not e['level']: e['level'] = L.get('level') or R.get('level'); keep('level')
            if lang == 'de' and L.get('gsw') and not e['swiss_german']:
                e['swiss_german'] = {'form': L['gsw'], 'origin': 'claude', 'approximate': True}; keep('swiss_german')
            if L.get('note') and not e['usage_note']:
                e['usage_note'] = L['note']; keep('usage_note')
            if L.get('etymology') and not e['more']['etymology']:
                e['more']['etymology'] = L['etymology']; keep('more.etymology')
            if L.get('collocations') and not e['more']['collocations']:
                e['more']['collocations'] = [c['phrase'] + ' — ' + c['meaning'] for c in L['collocations']]; keep('more.collocations')
            if L.get('antonyms') and not e['more']['antonyms']:
                e['more']['antonyms'] = L['antonyms']; keep('more.antonyms')
            if L.get('synonyms') and not e['synonyms'] and not e['synonyms_text']:
                e['synonyms_text'] = L['synonyms']; keep('synonyms')
            have = {(g['prep'], g['case']) for g in e['governs']}
            for g in L.get('government', []):
                m = re.search(r'(?:\b([a-zäöüß]+(?: / [a-zäöüß]+)*) )?\+ (Akkusativ|Dativ|Genitiv)', g['pattern']) if lang == 'de' else None
                prep = m.group(1) if m and m.group(1) and m.group(1) != lemma and not g['pattern'].startswith(m.group(1)) else None
                case = CASES[m.group(2)] if m else None
                if any(x.get('pattern') == g['pattern'] for x in e['governs']): continue
                if lang == 'de' and (prep, case) in have: continue
                e['governs'].append({'prep': prep, 'case': case, 'example_id': None, 'pattern': g['pattern'], 'meaning': g['meaning'], 'origin': 'claude'})
                keep('governs.library', 'governs' in o); keep('governs', 'governs' not in o)
            regs = L.get('regional') or {v['region']: v for v in L.get('variants', []) if v}
            for r, v in regs.items():
                R2 = REGION.get(r, r.upper())
                note = v.get('diff') or v.get('note')
                if v.get('auxiliary') and e['verb'] and R2 not in e['verb']['aux_regional']:
                    e['verb']['aux_regional'][R2] = v['auxiliary']; keep('verb.aux_regional')
                if any(x['region'] == R2 for x in e['regional_variants']): continue
                form = lemma_of(lang, v['word']) if v.get('word') else None
                if not form and not note: continue
                rv = {'region': R2, 'form': form, 'note': note}
                for k in ('article', 'plural'):
                    if v.get(k): rv[k] = strip_art(v[k]) if k == 'plural' else v[k]
                e['regional_variants'].append(rv); keep('regional_variants')
        # ---- the saved example sentences (same sentence in all four languages)
        for lang in [l for l in LANGS if l in R]:
            e = entries[ids[lang]]
            exs = R[lang].get('examples', [])
            for k, x in enumerate(exs):
                text, h = hl(x)
                if any(y['text'] == text for y in e['examples']) or sum(1 for y in e['examples'] if y['origin'] == 'claude') >= 2: continue
                tr = {}
                for l2 in [x for x in LANGS if x in R]:
                    if l2 != lang and k < len(R[l2].get('examples', [])): tr[l2] = R[l2]['examples'][k].replace('*', '')
                e['examples'].append({'id': 'lib:%d:%d' % (n, k), 'text': text, 'hl': h, 'translations': tr,
                                      'translation_ids': {}, 'credits': {}, 'origin': 'claude'})
                e['origin']['examples.library'] = 'claude'; kept['examples'] += 1
        # ---- the saved translation link
        de = entries[ids['de']]
        want = {l: ids[l] for l in ('en', 'fr', 'pt')}
        if not any(all(want[l] in s['translations'][l] for l in want) for s in de['senses']):
            de['senses'].append({'id': 's%d' % (len(de['senses']) + 1), 'gloss_en': R.get('sense'), 'gloss': None, 'register': None,
                                 'translations': {l: [want[l]] for l in want}, 'route': {l: 'library' for l in want}, 'origin': 'claude'})
            kept['sense link'] += 1; de['origin'].setdefault('senses', 'claude')
        for lang in ('en', 'fr', 'pt'):
            le = entries[ids[lang]]
            if not any(ids['de'] in s['translations'].get('de', []) for s in le['senses']):
                tr = {'de': [ids['de']]}
                for l2 in ('en', 'fr', 'pt'):
                    if l2 != lang: tr[l2] = [ids[l2]]
                le['senses'].append({'id': 's%d' % (len(le['senses']) + 1), 'gloss_en': R.get('sense'), 'gloss': None, 'register': None,
                                     'translations': tr, 'route': {l2: 'library' for l2 in tr}, 'origin': 'claude'})
                le['origin'].setdefault('senses', 'claude')
    wjson(os.path.join(WORK, 'core.json'), entries)
    with gzip.open(os.path.join(WORK, 'tables_library.jsonl.gz'), 'wt', encoding='utf-8') as f:
        for i, t in extra_tables.items(): f.write(json.dumps([i, t], ensure_ascii=False) + '\n')

    with open(os.path.join(REPORTS, 'library_conflicts.md'), 'w', encoding='utf-8') as f:
        f.write('# Saved library vs. Wiktionary\n\n%d saved records (24 from entries.js, 2 from the shared library, 13 inside index.html).\n\n' % len(lib))
        f.write('## Conflicts in IPA, gender, plural and verb forms (Wiktionary value is used)\n\n| Entry | Field | Saved | Wiktionary | Saved in |\n|---|---|---|---|---|\n')
        for c in sorted(conflicts): f.write('| %s | %s | %s | %s | %s |\n' % c)
        f.write('\n## Regular/irregular label differs from the rule-based label\n\n| Entry | Field | Saved | New rule |\n|---|---|---|---|\n')
        for c in sorted(set(rule_diffs)): f.write('| %s | %s | %s | %s |\n' % c)
        f.write('\n## Saved words that are not Wiktionary entries (kept with origin "claude", IPA left empty)\n\n' + ''.join('- %s\n' % x for x in claude_only))
        f.write('\n## Entries added because the library has them\n\n' + ''.join('- %s\n' % x for x in created))
        f.write('\n## Saved fields kept as origin "claude"\n\n' + ''.join('- %s: %d\n' % kv for kv in sorted(kept.items())))
    by = collections.Counter(c[1] for c in conflicts)
    print('conflicts', len(conflicts), dict(by)); print('rule diffs', len(set(rule_diffs)))
    print('claude-only entries', claude_only); print('created', created); print('kept', dict(kept))


if __name__ == '__main__':
    main()
