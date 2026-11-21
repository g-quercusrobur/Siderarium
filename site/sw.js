/* The app once lived at the root of this address and left a service worker there, which answered for every page of the
   site from its own old copies. This file retires it: a browser that still holds the old worker fetches this one in its
   place, and this one takes over, drops the old copies it kept (everything outside /app/), removes itself and reloads
   the pages it held, which then come from the network. The app's own worker lives under /app/ and is not touched.
   Nothing registers this file any more. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(ks => Promise.all(ks.map(k => caches.open(k).then(c => c.keys().then(rs => Promise.all(rs.filter(r => !new URL(r.url).pathname.startsWith('/app/')).map(r => c.delete(r))))))))
    .catch(() => {})
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(cs => Promise.all(cs.map(c => c.navigate(c.url).catch(() => {}))))
));
