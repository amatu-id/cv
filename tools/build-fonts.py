#!/usr/bin/env python3
"""Download static TTF instances from Google Fonts and subset them to fonts/<Family>-<weight><i>.woff.
Latin + Latin Extended + common punctuation, kerning only (no ligatures, so PDF text stays searchable)."""
import os, re, subprocess, sys, urllib.request, urllib.parse
OUT = os.path.join(os.path.dirname(__file__), '..', 'fonts')
TMP = sys.argv[1] if len(sys.argv) > 1 else '/tmp/ttf'
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
FONTS = {
  'Arimo': ['400','400i','700','700i'],
  'Tinos': ['400','400i','700','700i'],
  'Carlito': ['400','400i','700','700i'],
  'Inter': ['400','400i','600','700'],
  'Lato': ['400','400i','700','900'],
  'Archivo': ['400','400i','600','800'],
  'IBM Plex Sans': ['400','400i','600','700'],
  'IBM Plex Mono': ['400','500'],
  'Source Serif 4': ['400','400i','600','700'],
  'EB Garamond': ['400','400i','600'],
  'Playfair Display': ['500','700'],
}
UA = 'Mozilla/5.0 (Windows NT 6.1; rv:10.0) Gecko/20100101 Firefox/10.0'
UNI = 'U+0020-007E,U+00A0-024F,U+1E00-1EFF,U+2010-2015,U+2018-201E,U+2020-2022,U+2026,U+2030,U+20AC,U+20B9,U+2122,U+2190-2193,U+2212,U+2460-2473'
for fam, styles in FONTS.items():
    for st in styles:
        ital = st.endswith('i'); w = st.rstrip('i')
        q = urllib.parse.quote(fam).replace('%20','+') + ':' + ('ital,wght@1,' if ital else 'wght@') + w
        req = urllib.request.Request('https://fonts.googleapis.com/css2?family=' + q, headers={'User-Agent': UA})
        css = urllib.request.urlopen(req).read().decode()
        url = re.search(r'url\((https://[^)]+)\)', css).group(1)
        name = fam.replace(' ', '') + '-' + st
        ttf = os.path.join(TMP, name + '.ttf')
        if not os.path.exists(ttf):
            urllib.request.urlretrieve(url, ttf)
        subprocess.check_call([sys.executable, '-m', 'fontTools.subset', ttf, '--unicodes=' + UNI, '--layout-features=kern',
            '--no-hinting', '--flavor=woff', '--with-zopfli' if False else '--desubroutinize',
            '--output-file=' + os.path.join(OUT, name + '.woff')])
        print(name, os.path.getsize(os.path.join(OUT, name + '.woff')) // 1024, 'KB', url.rsplit('.',1)[-1])

# fontkit cannot read empty glyphs at the very end of glyf (IBM Plex keeps space there): move them forward.
from fontTools.ttLib import TTFont
for name in sorted(os.listdir(OUT)):
    path = os.path.join(OUT, name)
    f = TTFont(path, lazy=False)
    order = f.getGlyphOrder()
    if f['glyf'][order[-1]].numberOfContours != 0:
        continue
    empties = [g for g in order[1:] if f['glyf'][g].numberOfContours == 0]
    new = [order[0]] + empties + [g for g in order[1:] if g not in empties]
    for tag in f.keys():
        if tag != 'GlyphOrder':
            f[tag]
    f.setGlyphOrder(new)
    f['glyf'].glyphOrder = new
    f.flavor = 'woff'
    f.save(path, reorderTables=False)
    print('reordered', name)
