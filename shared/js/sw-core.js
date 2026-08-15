// shared/js/sw-core.js
//
// the shared service worker body. every app ships a three-liner sw.js that
// pulls this in, which is what the old sw.js.php generated per request:
//
//   importScripts('./../../shared/js/sw-core.js');
//
// it is a classic worker script on purpose — importScripts() works everywhere,
// module workers still do not.

/* global self, caches, fetch */

// the app slug is the last path segment of the registration scope, so the
// cache name stays unique per app without anything being templated in
const SCOPE   = self.registration.scope;
const SLUG    = SCOPE.replace(/\/+$/, '').split('/').pop() || 'zugriff';
const VERSION = 'v1';
const CACHE   = `${SLUG}-${VERSION}`;

// relative to the scope, so this works under /zugriff/apps/<slug>/ as well as
// under any other base path
const PRECACHE = [
  './',
  './index.html',
  './app.js',
  './app.css',
  './app.config.js',
  './manifest.json',
  './../../shared/css/index.css',
  './../../shared/js/importmap.js',
  './../../shared/js/app.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // one missing file must not fail the whole install
      Promise.all(PRECACHE.map(path =>
        cache.add(new Request(new URL(path, SCOPE), { cache: 'reload' }))
             .catch(error => console.warn('[sw] precache skipped', path, error))
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key.startsWith(`${SLUG}-`) && key !== CACHE)
                      .map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// stale-while-revalidate: answer from the cache at once, refresh in the
// background. only status 200 is stored, which also filters out the opaque
// responses of cross-origin requests.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(event.request).then(cached => {
        const fresh = fetch(event.request).then(response => {
          if (response && response.status === 200) cache.put(event.request, response.clone());
          return response;
        }).catch(error => {
          if (cached) return cached;
          throw error;
        });

        return cached || fresh;
      })
    )
  );
});
