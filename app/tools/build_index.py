#!/usr/bin/env python3
"""Make the Android app's page: dist/jade-vault.html with Tailwind compiled in and marked, DOMPurify and
KaTeX (with its fonts) inlined, so the phone needs no CDN for the basics. Writes android/proj/assets/index.html."""
import re, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NM = os.environ.get('JV_NODE_MODULES', os.path.join(ROOT, 'node_modules')) + '/'
s = open(os.path.join(ROOT, 'dist', 'jade-vault.html')).read()
css = open(os.path.join(ROOT, 'dist', 'tw.css')).read()
marked = open(NM + 'marked/lib/marked.umd.js').read().replace('//# sourceMappingURL=', '//# sourceMappingURL_removed=')
purify = open(NM + 'dompurify/dist/purify.min.js').read().replace('//# sourceMappingURL=', '//# sourceMappingURL_removed=')
for js in (marked, purify): assert '</script' not in js.lower()
a = s.index('<script src="https://cdn.tailwindcss.com/3.4.17"></script>'); b = s.index('</script>', s.index('<script>', a)) + len('</script>')
s = s[:a] + '<style id="tw-compiled">\n' + css + '\n</style>' + s[b:]
T1 = '<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>'
T2 = '<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js"></script>'
assert s.count(T1) == 1 and s.count(T2) == 1
s = s.replace(T1, '<script>' + marked + '</script>').replace(T2, '<script>' + purify + '</script>')
for a_, b_ in [('<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"', '<script async src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"'),
               ('<script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.js"', '<script defer src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.js"'),
               ('<script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.js"', '<script defer src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.js"')]:
    assert s.count(a_) == 1; s = s.replace(a_, b_)
m = re.search(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^"]*">', s); s = s.replace(m.group(0), m.group(0)[:-1] + ' media="print" onload="this.media=\'all\'">')

import base64, os, re as _re
K = NM + 'katex/dist/'
kjs = open(K + 'katex.min.js').read().replace('//# sourceMappingURL=', '//# sourceMappingURL_removed=')
assert '</script' not in kjs.lower()
kcss = open(K + 'katex.min.css').read()
def _font(m):
    f = m.group(1); b = base64.b64encode(open(K + 'fonts/' + f, 'rb').read()).decode()
    return f'src:url(data:font/woff2;base64,{b}) format("woff2")'
kcss = _re.sub(r'src:url\(fonts/([^)]+\.woff2)\) format\("woff2"\)[^;}]*', _font, kcss)
assert 'url(fonts/' not in kcss, 'unreplaced font'
TK1 = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" id="katex-css">'
TK2 = '<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" id="katex-js"></script>'
assert s.count(TK2) == 1
s = s.replace(TK2, '<script id="katex-js">' + kjs + '</script>')

# the terminal (xterm.js) is in the page too, so it works offline (2.22)
V = os.path.join(ROOT, 'app', 'vendor')
for tag, f in [('<script defer src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.js"></script>', 'xterm/xterm.js'),
               ('<script defer src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.js"></script>', 'xterm/addon-fit.js')]:
    js = open(os.path.join(V, f)).read().replace('//# sourceMappingURL=', '//# sourceMappingURL_removed=')
    assert s.count(tag) == 1 and '</script' not in js.lower(), f
    s = s.replace(tag, '<script>' + js + '</script>')
# ONNX Runtime ships as the app's own files (too big to inline): assets/ort/
import shutil
os.makedirs(os.path.join(ROOT, 'android', 'proj', 'assets', 'ort'), exist_ok=True)
for f in os.listdir(os.path.join(V, 'ort')):
    shutil.copyfile(os.path.join(V, 'ort', f), os.path.join(ROOT, 'android', 'proj', 'assets', 'ort', f))
# LiteRT the same way: assets/litert/ (its WebAssembly runtime and the bundle the litert tool loads)
os.makedirs(os.path.join(ROOT, 'android', 'proj', 'assets', 'litert'), exist_ok=True)
for f in os.listdir(os.path.join(V, 'litert')):
    shutil.copyfile(os.path.join(V, 'litert', f), os.path.join(ROOT, 'android', 'proj', 'assets', 'litert', f))

s = '<!doctype html>\n<html lang="en">\n' + s + '\n</html>\n'
os.makedirs(os.path.join(ROOT, 'android', 'proj', 'assets'), exist_ok=True)
open(os.path.join(ROOT, 'android', 'proj', 'assets', 'index.html'), 'w').write(s); print('index.html', len(s))
