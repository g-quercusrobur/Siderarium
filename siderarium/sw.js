/* siderarium — service worker. network first, cache fallback: the clock works offline after one visit. */
const VERSION = 'sd-2026-11-27g';
const SHELL = ['./', './index.html', './css/style.css', './js/vendor/astronomy.browser.min.js', './js/color.js', './js/correspondences.js', './js/i18n.js',
  './js/engine.js', './js/glyphs.js', './js/render.js', './js/glossary.js', './js/app.js', './manifest.webmanifest', './icons/siderarium-192.png', './icons/siderarium-512.png',
  './fonts/Geist-Regular.woff2', './fonts/Geist-Medium.woff2', './fonts/GeistMono-Regular.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (url.origin !== location.origin && !font) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })   // revalidate: a new deploy shows on the next open, not ten minutes later
      .catch(() => caches.match(req, { ignoreSearch: url.origin === location.origin }).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
