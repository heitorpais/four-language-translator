"""Swiss words (Helvetisms): a hand-checked list written by Claude (Anthropic).
For each word it
  - puts the Swiss meaning first and fills in missing English, French and Portuguese (Brazil) translations,
  - stores a learner level `level_ch` (Wiktionary's frequency list comes from German-German subtitles,
    so a everyday Swiss word like Velo would otherwise count as C2),
  - marks the word as used in Switzerland.
build_tiers.py then lists exactly these words as the Swiss words (practice list, Swiss badge).
Runs after regions.py and before build_tiers.py; running it twice changes nothing.
Run:  python3 -I build/swiss.py"""
import sys, os, json, gzip
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

# lemma | pos | level | Germany | English | French | Portuguese (Brazil) | Austria if it differs from Germany (= : Austria uses the Swiss word too)
WORDS = """
Velo|noun|A1|Fahrrad|bike,bicycle|vélo|bicicleta|Fahrrad
Billett|noun|A1|Fahrkarte|ticket|billet|bilhete,passagem|Fahrschein
Natel|noun|A1|Handy|cell phone,mobile phone|portable,natel|celular
grüezi|interjection|A1|guten Tag|hello|bonjour|olá,oi|grüss Gott
merci|interjection|A1|danke|thank you,thanks|merci|obrigado|=
sali|interjection|A1|hallo|hi,hello|salut|oi
hoi|interjection|A1|hallo|hi,hello|salut|oi
tschau|interjection|A1|tschüss|bye|salut,ciao|tchau
Franken|noun|A1|-|franc|franc|franco|-
Glace|noun|A1|Eis|ice cream|glace|sorvete|Eis
Trottoir|noun|A2|Gehsteig|sidewalk,pavement|trottoir|calçada|Gehsteig
Tram|noun|A2|Strassenbahn|tram,streetcar|tram,tramway|bonde|Strassenbahn
Spital|noun|A2|Krankenhaus|hospital|hôpital|hospital|=
Coiffeur|noun|A2|Friseur|hairdresser|coiffeur|cabeleireiro
parkieren|verb|A2|parken|park|garer,stationner|estacionar
grillieren|verb|A2|grillen|grill,barbecue|griller|grelhar
posten|verb|A2|einkaufen|shop|acheter|comprar
Rüebli|noun|A2|Karotte|carrot|carotte|cenoura|Karotte
Poulet|noun|A2|Hähnchen|chicken|poulet|frango|Hendl
Rahm|noun|A2|Sahne|cream|crème|creme,nata|das Obers
Gipfeli|noun|A2|Croissant|croissant|croissant|croissant
Konfitüre|noun|A2|Marmelade|jam|confiture|geleia|Marmelade
Peperoni|noun|A2|Paprika|bell pepper,pepper|poivron|pimentão|Paprika
Morgenessen|noun|A2|Frühstück|breakfast|petit-déjeuner|café da manhã
Zmorge|noun|A2|Frühstück|breakfast|petit-déjeuner|café da manhã
Zmittag|noun|A2|Mittagessen|lunch|déjeuner,dîner|almoço
Znacht|noun|A2|Abendessen|dinner,supper|dîner,souper|jantar
Nachtessen|noun|A2|Abendessen|dinner,supper|dîner,souper|jantar
Znüni|noun|A2|das zweite Frühstück|snack|collation|lanche|die Jause
Zvieri|noun|A2|der Nachmittagssnack|snack|goûter|lanche|die Jause
Rappen|noun|A2|-|cent|centime|centavo|-
Kanton|noun|A2|-|canton|canton|cantão|-
Bancomat|noun|A2|Geldautomat|ATM,cash machine|distributeur|caixa eletrônico
Sackmesser|noun|A2|Taschenmesser|pocketknife,penknife|canif|canivete
Rösti|noun|A2|-|rösti,potato pancake,potato|rösti|batata|-
Lehrling|noun|A2|der Auszubildende|apprentice,trainee|apprenti|aprendiz|=
Metzger|noun|A2|Fleischer|butcher|boucher|açougueiro|der Fleischhauer
Bub|noun|A2|Junge|boy|garçon|menino,garoto|=
Portemonnaie|noun|A2|Geldbörse|wallet,purse|porte-monnaie|carteira
Perron|noun|B1|Bahnsteig|platform|quai|plataforma
Kondukteur|noun|B1|Schaffner|conductor|contrôleur|cobrador|Schaffner
Camion|noun|B1|Lastwagen|truck,lorry|camion|caminhão
Car|noun|B1|Reisebus|coach,bus|car|ônibus
Pneu|noun|B1|Reifen|tire,tyre|pneu|pneu|=
Töff|noun|B1|Motorrad|motorbike,motorcycle|moto|moto
Trottinett|noun|B1|Tretroller|scooter|trottinette|patinete
Abwart|noun|B1|Hausmeister|janitor,caretaker|concierge|zelador|Hausmeister
Estrich|noun|B1|Dachboden|attic|grenier|sótão|Dachboden
Lavabo|noun|B1|Waschbecken|sink,washbasin|lavabo|pia
Pult|noun|B1|Schreibtisch|desk|bureau|escrivaninha
zügeln|verb|B1|umziehen|move|déménager|mudar
Gotte|noun|B1|Patin|godmother|marraine|madrinha|Taufpatin
Götti|noun|B1|Pate|godfather|parrain|padrinho|Taufpate
Grosi|noun|B1|Oma|grandma,granny|mamie|vovó
Hahnenwasser|noun|B1|Leitungswasser|tap water|eau|água
Jupe|noun|B1|Rock|skirt|jupe|saia|Rock
Serviertochter|noun|B1|Kellnerin|waitress|serveuse|garçonete
Plausch|noun|B1|Spaß|fun|plaisir|diversão|Spaß
Beiz|noun|B1|Kneipe|pub,bar|bistrot|bar,boteco
Nastuch|noun|B1|Taschentuch|handkerchief,tissue|mouchoir|lenço
Kehricht|noun|B1|Müll|garbage,trash,rubbish|ordure,ordures|lixo|Mist
Baumnuss|noun|B1|Walnuss|walnut|noix|noz
Sackgeld|noun|B1|Taschengeld|pocket money,allowance|argent de poche|mesada
Hosensack|noun|B1|Hosentasche|pocket|poche|bolso
Pöstler|noun|B1|Briefträger|mailman,postman|facteur|carteiro
Fasnacht|noun|B1|Karneval|carnival|carnaval|carnaval|Fasching
innert|preposition|B1|innerhalb|within|dans,en|dentro de
Bundesrat|noun|B1|-|Federal Council,federal government|conseil,gouvernement|conselho,governo|-
Leibchen|noun|B1|T-Shirt|shirt,jersey|maillot|camiseta
Kassier|noun|B1|Kassierer|cashier,treasurer|caissier|caixa,tesoureiro|=
Schreiner|noun|B1|Tischler|carpenter,joiner|menuisier|marceneiro
Metzgerei|noun|B1|Fleischerei|butcher's,butcher shop|boucherie|açougue|die Fleischhauerei
Altersheim|noun|B1|Altenheim|retirement home,old people's home|maison de retraite|asilo|=
herzig|adjective|B1|niedlich|cute,sweet|mignon|fofo,bonitinho
gell|particle|B1|nicht wahr|right|hein|né|=
Zündholz|noun|B1|Streichholz|match|allumette|fósforo|=
Rande|noun|B2|die Rote Bete|beetroot,beet|betterave|beterraba|die Rote Rübe
Pendenz|noun|B2|offene Aufgabe|pending matter,task|affaire|pendência
Unterbruch|noun|B2|Unterbrechung|interruption,break|interruption|interrupção
allfällig|adjective|B2|eventuell|possible,any|éventuel|eventual
Zapfenzieher|noun|B2|Korkenzieher|corkscrew|tire-bouchon|saca-rolhas
Harass|noun|B2|Getränkekasten|crate|caisse|engradado|Getränkekiste
Couvert|noun|B2|Briefumschlag|envelope|enveloppe|envelope
Absenz|noun|B2|Abwesenheit|absence|absence|ausência
Konkurs|noun|B2|Insolvenz|bankruptcy|faillite|falência|=
Advokat|noun|B2|Rechtsanwalt|lawyer,attorney|avocat|advogado|=
Detailhandel|noun|B2|Einzelhandel|retail|commerce de détail|varejo
Traktandum|noun|C1|Tagesordnungspunkt|agenda item,item|point|item
"""

# words Switzerland uses next to the common word (Spass, Lastwagen, T-Shirt …): no Swiss form replaces the common word
NO_REVERSE = {'Plausch', 'Absenz', 'Advokat', 'Leibchen', 'Camion', 'Töff', 'Pult'}
GENDER = {'Spital': 'n'}          # das Spital in Switzerland and Austria
POS_OK = {'noun', 'verb', 'adjective', 'adverb', 'interjection', 'preposition', 'particle'}


def main():
    core = rjson(os.path.join(WORK, 'core.json'))
    ids = {L: set() for L in LANGS}
    for i in core: ids[i.split(':')[0]].add(i)
    rest = {}
    for L in LANGS:
        for line in gzip.open(os.path.join(WORK, 'entries_%s.jsonl.gz' % L), 'rt', encoding='utf-8'):
            e = json.loads(line); ids[L].add(e['id'])
            if L == 'de': rest[e['id']] = e
    by_lemma = {}
    for i in ids['en'] | ids['fr'] | ids['pt']:
        L, lem, pos = i.split(':', 2) if i.count(':') >= 2 else (None, None, None)
        if L: by_lemma.setdefault((L, lem.lower()), []).append(i)

    def target(L, word, pos):
        """the id of a translation: same part of speech first, else noun, else any"""
        c = by_lemma.get((L, word.lower()), [])
        for p in (pos, 'noun', 'verb', 'interjection', 'adjective', 'adverb', 'preposition'):
            for i in c:
                if i.endswith(':' + p) and i.split(':')[1] == word: return i
            for i in c:
                if i.endswith(':' + p): return i
        return c[0] if c else None

    done, missing_entry, missing_tr = [], [], []
    for line in WORDS.strip().splitlines():
        lemma, pos, level, std, en, fr, pt, *rest_ = line.split('|'); at = rest_[0] if rest_ else std
        assert pos in POS_OK and level in ('A1', 'A2', 'B1', 'B2', 'C1'), line
        i = 'de:%s:%s' % (lemma, pos)
        e = core.get(i) or rest.get(i)
        if not e: missing_entry.append(i); continue
        tier = 'core' if i in core else e['tier']
        want = {}
        for L, words in (('en', en), ('fr', fr), ('pt', pt)):
            got = [t for t in (target(L, w.strip(), pos) for w in words.split(',')) if t]
            if not got: missing_tr.append('%s %s: %s' % (i, L, words))
            want[L] = list(dict.fromkeys(got))
        senses = e['senses']
        old = next((s for s in senses if s['id'] == 'sch'), None)
        if old: senses.remove(old)
        # an existing sense that already means the Swiss meaning (it has the first English word) moves up and is completed
        same = next((s for s in senses if want['en'] and want['en'][0] in s['translations'].get('en', [])), None)
        if same and not old:
            senses.remove(same)
            for L, t in want.items():
                have = same['translations'].get(L) or []
                if not have and t:
                    same['translations'][L] = t; same['route'][L] = 'library'
            senses.insert(0, same)
        else:
            s = {'id': 'sch'}
            if tier in ('core', 'ext'): s['gloss_en'] = ', '.join(w.strip() for w in en.split(','))
            if tier == 'core': s['gloss'] = std; s['register'] = None
            s['translations'] = {L: t for L, t in want.items()}
            s['route'] = {L: ('library' if t else 'none') for L, t in want.items()}
            s['origin'] = 'claude'
            senses.insert(0, s)
        e['used_in'] = sorted(set(e.get('used_in') or []) | {'CH'})
        e['level_ch'] = level
        if lemma in GENDER and e.get('noun'): e['noun']['gender'] = GENDER[lemma]
        def with_art(w):      # the article from the dictionary, when the word is a noun there
            if ' ' in w: return w
            for v in (w, w.replace('ss', 'ß')):          # the dictionary spells Germany's way (Straßenbahn)
                n = core.get('de:%s:noun' % v) or rest.get('de:%s:noun' % v)
                if n: w = v; break
            g = (n or {}).get('noun') or {}
            return {'m': 'der ', 'f': 'die ', 'n': 'das '}.get(g.get('gender'), '') + w if n else w
        e.pop('standard', None)
        if std != '-':                                   # '-': only in Switzerland (Kanton, Rappen …), nothing to compare
            e['standard'] = {'DE': with_art(std)}
            if at != '=': e['standard']['AT'] = with_art(at)
        done.append(i)
    # the other way round: a common word of Germany shows the Swiss word when Switzerland is chosen (Sahne -> der Rahm)
    added = 0
    for i in done:
        e = core.get(i) or rest.get(i)
        std = (e.get('standard') or {}).get('DE', '')
        if e['pos'] != 'noun' or not e.get('noun') or ' ' not in std or e['lemma'] in NO_REVERSE: continue
        lem = std.split(' ', 1)[1]
        t = core.get('de:%s:noun' % lem)
        if not t: continue
        rv = t.setdefault('regional_variants', [])
        if any(x.get('region') == 'CH' and x.get('form') for x in rv): continue
        g = {'m': 'der', 'f': 'die', 'n': 'das'}.get(e['noun'].get('gender'))
        if not g: continue
        x = {'region': 'CH', 'form': e['lemma'], 'note': 'Switzerland says "%s".' % e['lemma'], 'article': g, 'plural': e['noun'].get('plural')}
        ip = (e.get('ipa') or {}).get('regional', {}).get('CH') or (e.get('ipa') or {}).get('default')
        if ip: x['ipa'] = ip
        rv.append(x)
        added += 1
    print('Swiss forms added to common words:', added)
    wjson(os.path.join(WORK, 'core.json'), core)
    p = os.path.join(WORK, 'entries_de.jsonl.gz'); tmp = p + '.tmp'
    with gzip.open(tmp, 'wt', encoding='utf-8') as out:
        for line in gzip.open(p, 'rt', encoding='utf-8'):
            e = json.loads(line)
            if e['id'] in rest and e['id'] not in core: e = rest[e['id']]
            out.write(json.dumps(e, ensure_ascii=False) + '\n')
    os.replace(tmp, p)
    print('Swiss words applied:', len(done))
    print('not in the data (skipped):', missing_entry)
    print('translations not found:', missing_tr)


if __name__ == '__main__':
    main()
