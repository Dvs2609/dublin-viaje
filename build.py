#!/usr/bin/env python3
"""Build dist/: the installable offline PWA (index.html + sw.js) and a fragment for the claude.ai artifact."""
import hashlib, json, pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).parent
SRC, DIST = ROOT / 'src', ROOT / 'dist'
DIST.mkdir(exist_ok=True)

shell = (SRC / 'app.html').read_text()
data = (SRC / 'data.js').read_text()
app = (SRC / 'app.js').read_text()

def fragment(pwa):
    js = app.replace('/*__PWA__*/false', 'true' if pwa else 'false')
    return shell.replace('/*__DATA__*/', data).replace('/*__APP__*/', js)

(DIST / 'artifact.html').write_text(fragment(False))

head = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#17664E">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Dublín">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-180.png">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
"""
index = head + fragment(True) + "\n</body>\n</html>\n"
(DIST / 'index.html').write_text(index)

manifest = {
    "name": "Dublín de bolsillo", "short_name": "Dublín", "lang": "es",
    "start_url": "./", "scope": "./", "display": "standalone",
    "background_color": "#EDF1F2", "theme_color": "#17664E",
    "icons": [
        {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}
(DIST / 'manifest.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

# Icon: a Georgian door (green door, fanlight) on deep green.
svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#17664E"/><path d="M156 430V230a100 100 0 0 1 200 0v200z" fill="#EDF1F2"/><path d="M176 430V250h160v180z" fill="#B5372B"/><path d="M176 236a80 80 0 0 1 160 0z" fill="#A9CBDD"/><circle cx="310" cy="345" r="9" fill="#E2B045"/></svg>"""
(DIST / 'icon.svg').write_text(svg)
def png(size, name):
    S = 4 * size
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = S / 512
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=110 * k, fill='#17664E')
    d.pieslice([156 * k, 130 * k, 356 * k, 330 * k], 180, 360, fill='#EDF1F2'); d.rectangle([156 * k, 230 * k, 356 * k, 430 * k], fill='#EDF1F2')
    d.rectangle([176 * k, 250 * k, 336 * k, 430 * k], fill='#B5372B')
    d.pieslice([176 * k, 156 * k, 336 * k, 316 * k], 180, 360, fill='#A9CBDD')
    d.ellipse([301 * k, 336 * k, 319 * k, 354 * k], fill='#E2B045')
    im.resize((size, size), Image.LANCZOS).save(DIST / name)
for s in (180, 192, 512):
    png(s, f'icon-{s}.png')

assets = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png']
version = hashlib.sha1(index.encode()).hexdigest()[:10]
sw = f"""// Offline cache: everything is precached; Google Fonts are cached on first use.
const CACHE = 'dublin-{version}';
const ASSETS = {json.dumps(assets)};
self.addEventListener('install', e => {{
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
}});
self.addEventListener('activate', e => {{
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
}});
self.addEventListener('fetch', e => {{
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = /fonts\\.(googleapis|gstatic)\\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !font) return;
  if (req.mode === 'navigate') {{
    e.respondWith(caches.match('index.html').then(r => r || fetch(req)));
    return;
  }}
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {{
    if (res.ok || res.type === 'opaque') {{ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }}
    return res;
  }})));
}});
"""
(DIST / 'sw.js').write_text(sw)
print('built', version, len(index) // 1024, 'KB')
