"""Static word pages for search engines: app/<lang>/<word>/index.html, one page per headword,
plus a list per language (app/<lang>/index.html), app/words/index.html, sitemap.xml and robots.txt.

Input: build/pages/words.json, written by build/pages/export.js, which runs the real app in a headless
browser and records the words the app itself shows in every other language (same choice as the cards).
Run:  node build/pages/export.js 1000   then   python3 -I build/word_pages.py
"""
import json, os, html, shutil, urllib.parse, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app')
SRC = os.path.join(HERE, 'pages', 'words.json')
SITE = 'https://glossarium-app.ch'
LANGS = ['en', 'de', 'fr', 'pt', 'cs', 'it', 'es', 'nl', 'sv', 'la']
NAME = {'en': 'English', 'de': 'German', 'fr': 'French', 'pt': 'Portuguese', 'cs': 'Czech', 'it': 'Italian',
        'es': 'Spanish', 'nl': 'Dutch', 'sv': 'Swedish', 'la': 'Latin'}
NATIVE = {'en': 'English', 'de': 'Deutsch', 'fr': 'Français', 'pt': 'Português', 'cs': 'Čeština', 'it': 'Italiano',
          'es': 'Español', 'nl': 'Nederlands', 'sv': 'Svenska', 'la': 'Latina'}
POS = {'noun': 'noun', 'verb': 'verb', 'adjective': 'adjective', 'adverb': 'adverb', 'pronoun': 'pronoun',
       'preposition': 'preposition', 'conjunction': 'conjunction', 'article': 'article', 'determiner': 'determiner',
       'numeral': 'number', 'interjection': 'interjection', 'particle': 'particle'}
GENDER = {'m': 'masculine', 'f': 'feminine', 'n': 'neuter', 'mf': 'masculine or feminine', 'c': 'common'}
e = html.escape


def slug(lemma):
    return lemma.replace('/', '_').replace(' ', '_').replace('?', '').replace('#', '')


def href(lang, lemma):
    return '/' + lang + '/' + urllib.parse.quote(slug(lemma)) + '/'


def level(x):
    lv = x.get('level')
    if isinstance(lv, dict):
        return lv.get('l'), lv.get('est')
    return lv, False


HEAD = '''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Glossarium">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{site}/icons/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/icons/icon-32.png">
<link rel="stylesheet" href="/fonts.css">
<link rel="stylesheet" href="/words.css">
</head>
<body>
<div class="page">
<header><a class="brand" href="/" aria-label="Glossarium"><span class="wordmark"></span></a>
<p class="motto">One word, ten languages</p>
<nav><a href="/">Open the dictionary</a> · <a href="/words/">All word lists</a>{crumb}</nav></header>
<main>
'''
FOOT = '''</main>
<footer><p>Translations, pronunciation, gender and plurals come from <a href="https://www.wiktionary.org">Wiktionary</a>
(licence <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>), checked and arranged for Glossarium.
Language levels are estimates. Found a mistake? Open the word in the dictionary and use "Report a mistake".</p></footer>
</div>
</body>
</html>
'''


def page(lang, title, desc, path, body, crumb=''):
    return HEAD.format(lang=lang, title=e(title), desc=e(desc), url=SITE + path, site=SITE, crumb=crumb) + body + FOOT


def main():
    data = json.load(open(SRC))
    have = {(l, x['lemma']) for l in LANGS for x in data.get(l, [])}
    # remove pages from an earlier run
    for l in LANGS:
        shutil.rmtree(os.path.join(APP, l), ignore_errors=True)
    shutil.rmtree(os.path.join(APP, 'words'), ignore_errors=True)
    urls = [SITE + '/']
    counts = {}
    for l in LANGS:
        groups = {}
        for x in data.get(l, []):
            groups.setdefault(x['lemma'], []).append(x)
        counts[l] = len(groups)
        for lemma, xs in groups.items():
            path = href(l, lemma)
            first = xs[0]
            # description: the first meaning in up to six languages
            s0 = first['senses'][0]
            bits = [f"{w[0]['shown']} ({NAME[o]})" for o, w in s0['tr'].items()][:6]
            lv, _ = level(first)
            title = f"{first['shown']}: {NAME[l]} {POS.get(first['pos'], first['pos'])} in 10 languages | Glossarium"
            desc = f"{first['shown']} ({NAME[l]}{', ' + lv if lv else ''}): " + ', '.join(bits) + '. Gender, plural, pronunciation and examples in Glossarium, a free dictionary in ten languages.'
            body = []
            for x in xs:
                lv, est = level(x)
                facts = [POS.get(x['pos'], x['pos'])]
                if x.get('gender'): facts.append(GENDER.get(x['gender'], x['gender']))
                if x.get('plural'): facts.append('plural: ' + x['plural'])
                ipa = f'<span class="ipa">/{e(x["ipa"])}/</span> ' if x.get('ipa') else ''
                lvl = f'<span class="lvl">{e(lv)}{" (estimated)" if est else ""}</span>' if lv else ''
                route = '/#/' + l + '/' + urllib.parse.quote(x['lemma']) + ('~' + x['pos'] if x.get('pos') else '')
                body.append(f'<article>\n<p class="kicker">{e(NAME[l])} · {e(NATIVE[l])}</p>\n<h1 lang="{l}">{e(x["shown"])}</h1>\n'
                            f'<p class="facts">{ipa}{e(" · ".join(facts))} {lvl}</p>\n')
                senses = [s for k, s in enumerate(x['senses']) if k == 0 or s.get('gloss')]      # a later meaning without an explanation would be unclear
                for k, s in enumerate(senses):
                    gloss = f'<h2>{k + 1}. {e(s["gloss"])}</h2>\n' if s.get('gloss') and len(senses) > 1 else (f'<h2>{e(s["gloss"])}</h2>\n' if s.get('gloss') else '')
                    rows = []
                    for o in LANGS:
                        if o == l or o not in s['tr']: continue
                        ws = []
                        for w in s['tr'][o]:
                            t = e(w['shown'])
                            ws.append(f'<a href="{href(o, w["lemma"])}" lang="{o}">{t}</a>' if (o, w['lemma']) in have else f'<span lang="{o}">{t}</span>')
                        rows.append(f'<tr><th>{e(NAME[o])}</th><td>{", ".join(ws)}</td></tr>')
                    body.append(f'<section>{gloss}<table>{"".join(rows)}</table></section>\n')
                body.append(f'<p class="open"><a class="btn" href="{e(route)}">Open “{e(x["lemma"])}” in Glossarium</a>'
                            f'<span> with all forms, examples and audio</span></p>\n</article>\n')
            out = os.path.join(APP, l, slug(lemma))
            os.makedirs(out, exist_ok=True)
            crumb = f' · <a href="/{l}/">{e(NAME[l])} words</a>'
            open(os.path.join(out, 'index.html'), 'w').write(page(l, title, desc, path, ''.join(body), crumb))
            urls.append(SITE + path)
        # list of the words of this language
        items = ''.join(f'<li><a href="{href(l, lem)}" lang="{l}">{e(xs[0]["shown"])}</a></li>' for lem, xs in sorted(groups.items(), key=lambda kv: kv[0].lower()))
        body = f'<h1>{e(NAME[l])} words</h1>\n<p class="lead">The {counts[l]:,} most common {e(NAME[l])} words, each with its translation into nine other languages.</p>\n<ul class="cols">{items}</ul>\n'
        os.makedirs(os.path.join(APP, l), exist_ok=True)
        open(os.path.join(APP, l, 'index.html'), 'w').write(page(l, f'{NAME[l]} words in 10 languages | Glossarium',
            f'The most common {NAME[l]} words with their translations into English, German, French, Portuguese, Czech, Italian, Spanish, Dutch, Swedish and Latin.', f'/{l}/', body))
        urls.append(f'{SITE}/{l}/')
    items = ''.join(f'<li><a href="/{l}/">{e(NAME[l])}</a> <span class="n">{e(NATIVE[l])} · {counts[l]:,} words</span></li>' for l in LANGS)
    os.makedirs(os.path.join(APP, 'words'), exist_ok=True)
    open(os.path.join(APP, 'words', 'index.html'), 'w').write(page('en', 'Word lists in 10 languages | Glossarium',
        'Browse the most common words of English, German, French, Portuguese, Czech, Italian, Spanish, Dutch, Swedish and Latin, each translated into the nine others.',
        '/words/', f'<h1>Word lists</h1>\n<p class="lead">Choose a language.</p>\n<ul class="langs">{items}</ul>\n'))
    urls.append(SITE + '/words/')
    today = datetime.date.today().isoformat()
    with open(os.path.join(APP, 'sitemap.xml'), 'w') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u in urls:
            f.write(f'<url><loc>{e(u)}</loc><lastmod>{today}</lastmod></url>\n')
        f.write('</urlset>\n')
    open(os.path.join(APP, 'robots.txt'), 'w').write(f'User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n')
    print('pages:', len(urls), counts)


if __name__ == '__main__':
    main()
