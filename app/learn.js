/* Learner helpers that are not in Wiktionary. Written by Claude (Anthropic); origin "claude".
   FALSE_FRIENDS: [lang A, word A, lang B, word B, what each one means]
   GENDER_RULES:  endings that usually give a gender; the app checks each rule against its own data and shows a
                  rule only where it holds for at least 80 % of the nouns with that ending.
   GRAMMAR:       short grammar pages in English, linked from terms on the cards.
   Level estimate: where no level is stored, the level is estimated from the word's frequency rank and shown like any other level. */
(function () {
'use strict';
const FALSE_FRIENDS = [
  ['de', 'Gift', 'en', 'gift', 'German Gift = poison. English gift = Geschenk.'],
  ['de', 'bekommen', 'en', 'become', 'German bekommen = to get, receive. English become = werden.'],
  ['de', 'Handy', 'en', 'handy', 'German Handy = mobile phone. English handy = practical (praktisch).'],
  ['de', 'Chef', 'en', 'chef', 'German Chef = boss. English chef = Koch.'],
  ['de', 'aktuell', 'en', 'actual', 'German aktuell = current, up to date. English actual = tatsächlich.'],
  ['de', 'eventuell', 'en', 'eventually', 'German eventuell = possibly. English eventually = schliesslich.'],
  ['de', 'sensibel', 'en', 'sensible', 'German sensibel = sensitive. English sensible = vernünftig.'],
  ['de', 'Rente', 'en', 'rent', 'German Rente = pension. English rent = Miete.'],
  ['de', 'also', 'en', 'also', 'German also = so, therefore. English also = auch.'],
  ['de', 'Kind', 'en', 'kind', 'German Kind = child. English kind = freundlich, or Art.'],
  ['de', 'Brief', 'en', 'brief', 'German Brief = letter. English brief = kurz.'],
  ['de', 'Mist', 'en', 'mist', 'German Mist = dung, rubbish. English mist = Nebel, Dunst.'],
  ['de', 'Rat', 'en', 'rat', 'German Rat = advice, council. English rat = Ratte.'],
  ['de', 'Art', 'en', 'art', 'German Art = kind, type, manner. English art = Kunst.'],
  ['de', 'fast', 'en', 'fast', 'German fast = almost. English fast = schnell.'],
  ['de', 'Bad', 'en', 'bad', 'German Bad = bath, bathroom. English bad = schlecht.'],
  ['de', 'Billion', 'en', 'billion', 'German Billion = a million million (10¹²). English billion = Milliarde (10⁹).'],
  ['de', 'Fabrik', 'en', 'fabric', 'German Fabrik = factory. English fabric = Stoff.'],
  ['de', 'Hose', 'en', 'hose', 'German Hose = trousers. English hose = Schlauch.'],
  ['de', 'spenden', 'en', 'spend', 'German spenden = to donate. English spend = ausgeben, verbringen.'],
  ['de', 'Taste', 'en', 'taste', 'German Taste = key, button. English taste = Geschmack.'],
  ['de', 'Wand', 'en', 'wand', 'German Wand = wall. English wand = Zauberstab.'],
  ['de', 'bald', 'en', 'bald', 'German bald = soon. English bald = kahl, glatzköpfig.'],
  ['de', 'Lust', 'en', 'lust', 'German Lust = wish, desire to do something ("Lust haben"). English lust = sexual desire (Begierde).'],
  ['de', 'Promotion', 'en', 'promotion', 'German Promotion = doctorate. English promotion = Beförderung.'],
  ['de', 'Pommes', 'fr', 'pommes', 'German Pommes = French fries. French pommes = apples (German Äpfel).'],
  ['de', 'Kollege', 'fr', 'collège', 'German Kollege = colleague (French collègue). French collège = lower secondary school.'],
  ['de', 'Mais', 'pt', 'mais', 'German Mais = maize, corn (Portuguese milho). Portuguese mais = more (German mehr).'],
  ['de', 'Pasta', 'pt', 'pasta', 'German Pasta = pasta (Portuguese massa). Portuguese pasta = folder or paste (German Ordner, Paste).'],
  ['de', 'Rente', 'pt', 'rente', 'German Rente = pension. Portuguese rente = close to, very short (hair).'],
  ['fr', 'actuellement', 'en', 'actually', 'French actuellement = currently. English actually = en fait.'],
  ['fr', 'librairie', 'en', 'library', 'French librairie = bookshop. English library = bibliothèque.'],
  ['fr', 'sensible', 'en', 'sensible', 'French sensible = sensitive. English sensible = raisonnable.'],
  ['fr', 'attendre', 'en', 'attend', 'French attendre = to wait. English attend = assister à.'],
  ['fr', 'blesser', 'en', 'bless', 'French blesser = to injure. English bless = bénir.'],
  ['fr', 'coin', 'en', 'coin', 'French coin = corner. English coin = pièce de monnaie.'],
  ['fr', 'préservatif', 'en', 'preservative', 'French préservatif = condom. English preservative = conservateur.'],
  ['fr', 'monnaie', 'en', 'money', 'French monnaie = change, currency. English money = argent.'],
  ['fr', 'location', 'en', 'location', 'French location = rental. English location = emplacement.'],
  ['fr', 'journée', 'en', 'journey', 'French journée = day. English journey = voyage.'],
  ['fr', 'rester', 'en', 'rest', 'French rester = to stay. English rest = se reposer.'],
  ['fr', 'éventuellement', 'en', 'eventually', 'French éventuellement = possibly. English eventually = finalement.'],
  ['fr', 'envie', 'en', 'envy', 'French envie = desire, wish ("avoir envie de"). English envy = jalousie.'],
  ['fr', 'car', 'en', 'car', 'French car = because, or coach (bus). English car = voiture.'],
  ['fr', 'chair', 'en', 'chair', 'French chair = flesh. English chair = chaise.'],
  ['fr', 'pain', 'en', 'pain', 'French pain = bread. English pain = douleur.'],
  ['fr', 'lecture', 'en', 'lecture', 'French lecture = reading. English lecture = conférence, cours.'],
  ['fr', 'raisin', 'en', 'raisin', 'French raisin = grape. English raisin = raisin sec.'],
  ['fr', 'collège', 'en', 'college', 'French collège = lower secondary school. English college = université, haute école.'],
  ['fr', 'exquis', 'pt', 'esquisito', 'French exquis = exquisite, delicious. Portuguese esquisito = strange, odd.'],
  ['fr', 'rato', 'pt', 'rato', ''],
  ['pt', 'puxar', 'en', 'push', 'Portuguese puxar = to pull. English push = empurrar.'],
  ['pt', 'pretender', 'en', 'pretend', 'Portuguese pretender = to intend. English pretend = fingir.'],
  ['pt', 'livraria', 'en', 'library', 'Portuguese livraria = bookshop. English library = biblioteca.'],
  ['pt', 'parente', 'en', 'parent', 'Portuguese parente = relative. English parent = pai or mãe.'],
  ['pt', 'assistir', 'en', 'assist', 'Portuguese assistir = to watch (a film, a game). English assist = ajudar.'],
  ['pt', 'atualmente', 'en', 'actually', 'Portuguese atualmente = currently. English actually = na verdade.'],
  ['pt', 'costume', 'en', 'costume', 'Portuguese costume = habit, custom. English costume = fantasia, traje.'],
  ['pt', 'esquisito', 'en', 'exquisite', 'Portuguese esquisito = strange, odd. English exquisite = requintado.'],
  ['pt', 'eventualmente', 'en', 'eventually', 'Portuguese eventualmente = occasionally, possibly. English eventually = finalmente.'],
  ['pt', 'fábrica', 'en', 'fabric', 'Portuguese fábrica = factory. English fabric = tecido.'],
  ['pt', 'sensível', 'en', 'sensible', 'Portuguese sensível = sensitive. English sensible = sensato.'],
  ['pt', 'data', 'en', 'data', 'Portuguese data = date. English data = dados.'],
  ['pt', 'balcão', 'en', 'balcony', 'Portuguese balcão = counter. English balcony = varanda, sacada.'],
  ['pt', 'propaganda', 'en', 'propaganda', 'Portuguese propaganda = advertising (in Brazil). English propaganda = political propaganda only.'],
  ['pt', 'resumir', 'en', 'resume', 'Portuguese resumir = to summarize. English resume = retomar.'],
  ['pt', 'gripe', 'en', 'gripe', 'Portuguese gripe = flu. English gripe = complaint (reclamação).'],
  ['pt', 'injúria', 'en', 'injury', 'Portuguese injúria = insult. English injury = ferimento, lesão.'],
  ['pt', 'polvo', 'fr', 'poulpe', ''],
  // German and Portuguese
  ['de', 'Mappe', 'pt', 'mapa', 'German Mappe = folder. Portuguese mapa = map (Karte).'],
  ['de', 'Dose', 'pt', 'dose', 'German Dose = can, tin. Portuguese dose = dose (Dosis).'],
  ['de', 'Gymnasium', 'pt', 'ginásio', 'German Gymnasium = academic high school. Portuguese ginásio = gym (Turnhalle, Fitnessstudio).'],
  ['de', 'Kollege', 'pt', 'colégio', 'German Kollege = colleague. Portuguese colégio = school (Schule).'],
  ['de', 'Novelle', 'pt', 'novela', 'German Novelle = novella, short novel. Portuguese novela = soap opera (Seifenoper).'],
  ['de', 'Notiz', 'pt', 'notícia', 'German Notiz = note. Portuguese notícia = news (Nachricht).'],
  ['de', 'Karton', 'pt', 'cartão', 'German Karton = cardboard box. Portuguese cartão = card (Karte).'],
  ['de', 'Billion', 'pt', 'bilhão', 'German Billion = a million million (10¹²). Portuguese bilhão = a thousand million (Milliarde).'],
  ['de', 'Dom', 'pt', 'dom', 'German Dom = cathedral. Portuguese dom = gift, talent (Gabe).'],
  ['de', 'Marmelade', 'pt', 'marmelada', 'German Marmelade = jam. Portuguese marmelada = quince paste (Quittenbrot).'],
  ['de', 'Termin', 'pt', 'término', 'German Termin = appointment. Portuguese término = end (Ende).'],
  ['de', 'Pulver', 'pt', 'pólvora', 'German Pulver = powder. Portuguese pólvora = gunpowder (Schiesspulver).'],
  ['de', 'Mode', 'pt', 'modo', 'German Mode = fashion. Portuguese modo = way, manner (Art, Weise).'],
  ['de', 'Zigarre', 'pt', 'cigarro', 'German Zigarre = cigar. Portuguese cigarro = cigarette (Zigarette).'],
  ['de', 'Rock', 'pt', 'rock', 'German Rock = skirt (also rock music). Portuguese rock = only rock music; skirt is saia.'],
  // German and French
  ['de', 'blamieren', 'fr', 'blâmer', 'German blamieren = to embarrass. French blâmer = to blame (tadeln).'],
  ['de', 'Konkurs', 'fr', 'concours', 'German Konkurs = bankruptcy. French concours = competition, contest (Wettbewerb).'],
  ['de', 'Promotion', 'fr', 'promotion', 'German Promotion = doctorate. French promotion = promotion, special offer (Beförderung, Sonderangebot).'],
  ['de', 'Lokal', 'fr', 'local', 'German Lokal = pub, restaurant. French local = premises, room (Räumlichkeit).'],
  ['de', 'Gymnasium', 'fr', 'gymnase', 'German Gymnasium = academic high school. French gymnase = gym (Turnhalle).'],
  ['de', 'Bluse', 'fr', 'blouse', 'German Bluse = blouse. French blouse = also a smock or lab coat (Kittel).'],
  ['de', 'Dose', 'fr', 'dose', 'German Dose = can, tin. French dose = dose (Dosis).'],
  ['de', 'Kommode', 'fr', 'commode', 'German Kommode = chest of drawers. French commode = also an adjective: convenient, easy (bequem).'],
  // French and Portuguese
  ['fr', 'attendre', 'pt', 'atender', 'French attendre = to wait (esperar). Portuguese atender = to answer, to serve (répondre, servir).'],
  ['fr', 'pourtant', 'pt', 'portanto', 'French pourtant = however (porém). Portuguese portanto = therefore (donc).'],
  ['fr', 'logo', 'pt', 'logo', 'French logo = logo only. Portuguese logo = also soon, right away (bientôt).'],
  ['fr', 'grade', 'pt', 'grade', 'French grade = rank (posto). Portuguese grade = railing, grid; also class schedule (grille).'],
  ['fr', 'costume', 'pt', 'costume', 'French costume = suit (terno). Portuguese costume = habit, custom (habitude).'],
  ['fr', 'rouge', 'pt', 'roxo', 'French rouge = red (vermelho). Portuguese roxo = purple (violet).'],
  ['fr', 'tasse', 'pt', 'taça', 'French tasse = cup (xícara). Portuguese taça = wine glass, trophy (verre à pied, coupe).'],
  ['fr', 'garçon', 'pt', 'garçom', 'French garçon = boy (menino). Portuguese garçom = waiter (serveur).'],
  ['fr', 'talon', 'pt', 'talão', 'French talon = heel (calcanhar). Portuguese talão = stub, counterfoil (souche).'],
  ['fr', 'prendre', 'pt', 'prender', 'French prendre = to take (pegar). Portuguese prender = to arrest, to fasten (arrêter, attacher).'],
  ['fr', 'procurer', 'pt', 'procurar', 'French procurer = to obtain (conseguir). Portuguese procurar = to look for (chercher).'],
  ['fr', 'propre', 'pt', 'próprio', 'French propre = also clean (limpo). Portuguese próprio = own, proper only (propre à).'],
].filter(x => x[4]);

/* gender rules: [lang, ending, gender] */
const GENDER_RULES = [
  ['de', 'ung', 'f'], ['de', 'heit', 'f'], ['de', 'keit', 'f'], ['de', 'schaft', 'f'], ['de', 'tät', 'f'], ['de', 'ion', 'f'], ['de', 'ik', 'f'],
  ['de', 'ei', 'f'], ['de', 'enz', 'f'], ['de', 'anz', 'f'], ['de', 'ur', 'f'],
  ['de', 'chen', 'n'], ['de', 'lein', 'n'], ['de', 'ment', 'n'], ['de', 'um', 'n'], ['de', 'tum', 'n'], ['de', 'nis', 'n'],
  ['de', 'ling', 'm'], ['de', 'ismus', 'm'], ['de', 'ist', 'm'], ['de', 'or', 'm'], ['de', 'ig', 'm'], ['de', 'ich', 'm'], ['de', 'ant', 'm'], ['de', 'eur', 'm'],
  ['fr', 'tion', 'f'], ['fr', 'sion', 'f'], ['fr', 'té', 'f'], ['fr', 'ure', 'f'], ['fr', 'ette', 'f'], ['fr', 'ance', 'f'], ['fr', 'ence', 'f'], ['fr', 'ade', 'f'], ['fr', 'ie', 'f'], ['fr', 'esse', 'f'],
  ['fr', 'ment', 'm'], ['fr', 'age', 'm'], ['fr', 'isme', 'm'], ['fr', 'eau', 'm'], ['fr', 'oir', 'm'], ['fr', 'et', 'm'], ['fr', 'ier', 'm'], ['fr', 'eur', 'm'],
  ['pt', 'ção', 'f'], ['pt', 'são', 'f'], ['pt', 'dade', 'f'], ['pt', 'agem', 'f'], ['pt', 'ude', 'f'], ['pt', 'ência', 'f'], ['pt', 'ância', 'f'], ['pt', 'eza', 'f'],
  ['pt', 'mento', 'm'], ['pt', 'ismo', 'm'], ['pt', 'or', 'm'], ['pt', 'ema', 'm'], ['pt', 'ário', 'm'], ['pt', 'eiro', 'm'], ['pt', 'ão', 'm'],
  ['cs', 'ost', 'f'], ['cs', 'ice', 'f'], ['cs', 'ka', 'f'], ['cs', 'a', 'f'], ['cs', 'ení', 'n'], ['cs', 'ství', 'n'], ['cs', 'o', 'n'], ['cs', 'tel', 'm'], ['cs', 'ník', 'm'],
];

/* CEFR estimate from the frequency rank (most frequent words first) */
const BANDS = [[600, 'A1'], [1500, 'A2'], [3000, 'B1'], [5500, 'B2'], [9000, 'C1'], [Infinity, 'C2']];
function estimateLevel(rank) { if (!rank) return null; for (const [n, l] of BANDS) if (rank <= n) return l; return null; }


/* short grammar pages, opened from terms on the cards (ⓘ) */
const GRAMMAR = {
  gender_nl: { title: 'Dutch: de or het', body: [
    'Dutch has two articles: de (for masculine and feminine words, the common gender) and het (for neuter words). About two thirds of nouns take de.',
    'All plurals take de: het huis, de huizen.',
    'Always het: diminutives in -je (het meisje, het huisje), infinitives used as nouns (het eten), and most words starting with ge- or be- (het gesprek, het begin).',
    'The indefinite article is een for both: een man, een huis.'] },
  gender_sv: { title: 'Swedish: en or ett', body: [
    'Swedish nouns are en-words (common gender, about 75 %) or ett-words (neuter): en bil, ett hus.',
    '"The" is an ending: bilen (the car), huset (the house); plural bilarna, husen.',
    'Adjectives agree: en stor bil, ett stort hus, stora bilar.'] },
  cases_la: { title: 'Latin cases', body: [
    'Latin shows the role of a noun by its ending, not by word order: nominative (subject), genitive (of), dative (to/for), accusative (object), ablative (by/with/from), vocative (calling).',
    'The dictionary form gives the nominative and the genitive (rosa, rosae), which shows the declension: -ae first, -ī second, -is third, -ūs fourth, -eī fifth.',
    'There are no articles: rosa is "a rose" or "the rose".'] },
  gender_cs: { title: 'Czech gender', body: [
    'Every Czech noun is masculine, feminine or neuter. There is no article: the ending usually shows the gender.',
    'Masculine: most nouns ending in a consonant (dům, stůl, muž). Masculine nouns are animate (people and animals: muž, pes) or inanimate (things: dům); the two decline differently.',
    'Feminine: most nouns ending in -a (žena, kniha), many in -e/-ě (růže, země) and some in a consonant (kost, píseň).',
    'Neuter: most nouns ending in -o (město, okno), -í (náměstí) and -e (moře, kuře).',
    'Adjectives and past forms of verbs agree with the gender: dobrý muž, dobrá žena, dobré město; on byl, ona byla, ono bylo.'] },
  aspect_cs: { title: 'Czech verb aspect', body: [
    'Most Czech verbs come in pairs: an imperfective verb for an action in progress or repeated (dělat, psát, číst) and a perfective verb for one completed action (udělat, napsat, přečíst).',
    'Imperfective verbs have a present (dělám = I am doing / I do) and a future with budu (budu dělat = I will be doing).',
    'Perfective verbs have no present: their present forms mean the future (udělám = I will do it, I will get it done).',
    'Both have a past: dělal jsem (I was doing / used to do), udělal jsem (I did it, I got it done).',
    'Verbs of motion have a third form for regular or round trips: jít (go now, on foot), chodit (go regularly).'] },
  cases: { title: 'German cases: Nominativ, Akkusativ, Dativ, Genitiv', text: [
    'German shows the role of a noun in the sentence by its case, mostly visible on the article.',
    'Nominativ: the subject. Der Hund schläft.',
    'Akkusativ: the direct object, and after durch, für, gegen, ohne, um. Ich sehe den Hund.',
    'Dativ: the indirect object, and after aus, bei, mit, nach, seit, von, zu. Ich gebe dem Hund Wasser.',
    'Genitiv: possession, and after wegen, trotz, während (in speech often replaced by the Dativ). Das Haus des Vaters.',
    'Two-way prepositions (an, auf, hinter, in, neben, über, unter, vor, zwischen) take the Akkusativ for movement towards a place (wohin?) and the Dativ for a location (wo?): Ich gehe in die Stadt. Ich bin in der Stadt.',
    'Only masculine nouns change their article in the Akkusativ: der → den, ein → einen.'] },
  gender_de: { title: 'German gender: der, die, das', text: [
    'Every German noun is masculine (der), feminine (die) or neuter (das). Learn each noun with its article.',
    'The plural article is always die.',
    'Endings help: -ung, -heit, -keit, -schaft, -tät, -ion are feminine; -chen and -lein are neuter; -ling and -ismus are masculine. The cards show such a tip when the app’s own data confirms it.',
    'In compound nouns the last part decides: das Haus + die Tür = die Haustür.',
    'In this app: ■ masculine (blue), ● feminine (red), ▲ neuter (green).'] },
  gender_romance: { title: 'Gender in French and Portuguese', text: [
    'French and Portuguese nouns are masculine or feminine; there is no neuter.',
    'French: le / un (masculine), la / une (feminine), l’ before a vowel, les / des in the plural.',
    'Portuguese: o / um (masculine), a / uma (feminine), os / as in the plural.',
    'Adjectives agree with the noun: un petit chat, une petite maison; um carro novo, uma casa nova.',
    'The gender often differs between languages: der Mond, la lune, a lua; das Mädchen, la fille, a menina.'] },
  plural_de: { title: 'German plurals', text: [
    'German has several plural endings, so learn each noun with its plural: der Tisch – die Tische, das Haus – die Häuser, die Frau – die Frauen, das Auto – die Autos, der Lehrer – die Lehrer.',
    'Some plurals add an umlaut (a → ä, o → ö, u → ü): der Vater – die Väter.',
    'Rough rules: most feminine nouns add -(e)n; nouns in -chen and -lein, and most in -er, do not change; words from English and French often add -s.',
    'In the Dativ plural an -n is added where possible: mit den Kindern.'] },
  perfect_de: { title: 'German Perfekt: haben or sein', text: [
    'The Perfekt is the usual past tense in speech: Ich habe gegessen. Wir sind gefahren.',
    'Most verbs use haben. Verbs of movement from one place to another (gehen, fahren, fliegen) and of change of state (werden, sterben, aufwachen) use sein, as do sein and bleiben.',
    'In Switzerland, Austria and southern Germany stehen, sitzen and liegen also use sein: Ich bin gestanden. The card shows this with the flag.',
    'The participle usually has ge-: gemacht, gegangen. Verbs in -ieren and verbs with be-, ver-, er-, ent-, zer- have no ge-: studiert, verstanden.'] },
  praeteritum: { title: 'German Präteritum (simple past)', text: [
    'The Präteritum is used mainly in writing and with sein, haben, the modal verbs and es gibt: Ich war müde. Es gab keine Zeit.',
    'Regular verbs add -te: machen – machte. Irregular verbs change the stem vowel: gehen – ging, singen – sang.',
    'In Switzerland the Präteritum is rare in speech; the Perfekt is used instead.'] },
  konjunktiv: { title: 'German Konjunktiv I and II', text: [
    'Konjunktiv II expresses wishes, polite requests and unreal situations: Ich hätte gern einen Kaffee. Wenn ich Zeit hätte, käme ich. Often formed with würde + infinitive: Ich würde kommen.',
    'Konjunktiv I is used for reported speech, mostly in newspapers: Er sagt, er sei krank.'] },
  adj_endings: { title: 'German adjective endings', text: [
    'An adjective before a noun gets an ending that depends on the article.',
    'Weak endings (after der, die, das): der große Hund, die große Stadt.',
    'Mixed endings (after ein, kein, mein): ein großer Hund, ein großes Haus.',
    'Strong endings (no article): großer Hund, kaltes Wasser. The ending then shows the case and gender itself.',
    'After sein, werden, bleiben the adjective has no ending: Der Hund ist groß.'] },
  separable: { title: 'German separable verbs', text: [
    'Many verbs have a prefix that moves to the end of the sentence: anfangen – Der Film fängt um acht an.',
    'The participle puts ge- between prefix and verb: angefangen. With zu: anzufangen.',
    'Separable prefixes are stressed (an-, auf-, aus-, ein-, mit-, vor-, zu-…); be-, ver-, er-, ent- never separate.'] },
  irregular_de: { title: 'Regular and irregular German verbs', text: [
    'Regular (weak) verbs keep their stem: machen – machte – gemacht.',
    'Irregular (strong) verbs change the stem vowel and end the participle in -en: singen – sang – gesungen, gehen – ging – gegangen.',
    'Explore › Irregular verbs lists them; Words like this on a card shows verbs with the same vowel change.'] },
  irregular_en: { title: 'Irregular English verbs', text: [
    'Regular verbs add -ed for the past and the participle: walk – walked – walked.',
    'About 200 common verbs are irregular: go – went – gone, sing – sang – sung, buy – bought – bought. They have to be learned; groups with the same pattern help.'] },
  irregular_fr: { title: 'Regular and irregular French verbs', text: [
    'Most French verbs end in -er and follow the regular pattern of parler (except aller).',
    'Verbs in -ir like finir (nous finissons) form the second group.',
    'All others are irregular (être, avoir, aller, faire, prendre, venir…) and are worth learning by heart.'] },
  irregular_pt: { title: 'Regular and irregular Portuguese verbs', text: [
    'Regular verbs end in -ar (falar), -er (comer) or -ir (partir) and follow the pattern of their group.',
    'The most common verbs are irregular: ser, estar, ter, ir, fazer, poder, dizer, dar, ver, vir.'] },
  fr_passe: { title: 'French passé composé: avoir or être', text: [
    'The passé composé is the usual past tense in speech: J’ai mangé. Je suis allé(e).',
    'Most verbs use avoir. Être is used by reflexive verbs (je me suis levé) and by about 15 verbs of movement and change: aller, venir, arriver, partir, entrer, sortir, monter, descendre, naître, mourir, rester, tomber, retourner, devenir, revenir.',
    'With être the participle agrees with the subject: elle est partie, ils sont partis.'] },
  fr_subj: { title: 'French subjonctif', text: [
    'The subjonctif follows expressions of wish, need, feeling and doubt, usually after que: Il faut que tu viennes. Je veux qu’il parte.',
    'It is formed from the ils-form of the present: ils finissent → que je finisse.'] },
  pt_infpers: { title: 'Portuguese personal infinitive', text: [
    'Portuguese can give the infinitive a personal ending: para eu fazer, para nós fazermos, para eles fazerem.',
    'It is used after prepositions when the subject must be clear: É melhor nós sairmos cedo.'] },
  pt_futsubj: { title: 'Portuguese future subjunctive', text: [
    'After quando, se, enquanto, assim que about the future, Portuguese uses the future subjunctive: Quando eu chegar, eu ligo. Se você puder, venha.',
    'It is formed from the 3rd person plural of the pretérito perfeito: fizeram → quando eu fizer.'] },
  register: { title: 'Register labels', text: [
    'colloquial: everyday speech, not for formal writing. slang: very informal, often for a group or a period. vulgar or offensive: avoid unless you know the situation well. formal or literary: written or elevated style. dated or archaic: no longer in common use.',
    'The labels come from Wiktionary and are shown next to the meaning they belong to.'] },
};

/* how often a word is used, from its frequency rank */
function freqLabel(rank) { if (!rank) return null; return rank <= 1000 ? 'very common' : rank <= 5000 ? 'common' : rank <= 20000 ? 'less common' : 'rare'; }

window.FLTLearn = { FALSE_FRIENDS, GENDER_RULES, estimateLevel, BANDS, GRAMMAR, freqLabel };
})();
