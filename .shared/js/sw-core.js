// shared/js/sw-core.js
//
// the shared service worker body. every app ships a one-line sw.js that pulls
// this in — this is what sw.js.php used to generate per request.
//
//   import './../../shared/js/sw-core.js';
//
// it is a MODULE service worker, because import maps do not apply inside a
// worker: @bunker is imported by its full url here, not by bare specifier.
// everything bunker pulls in is relative to that url, so one entry is enough.

import { createCache } from 'https://code.pulgasari.dev/bunker/cache/index.js';

// ::::::

// the app slug is the last path segment of the registration scope, so nothing
// has to be templated into this file
const SCOPE   = self.registration.scope;
const SLUG    = SCOPE.replace(/\/+$/, '').split('/').pop() || 'zugriff';
const VERSION = 'v2';

const CACHE_APP     = `zugriff-${SLUG}-${VERSION}`;
const CACHE_VENDOR  = `zugriff-vendor-${VERSION}`;
const IMMUTABLE_TTL = 365 * 24 * 60 * 60 * 1000;
const VERSIONED     = /(?:esm\.sh|unpkg\.com|cdn\.jsdelivr\.net)\/.*@\d+\.\d+\.\d+/;

const NESTED = ['./tools/', './apps/'].map(path => new URL(path, SCOPE).href);
const OWN    = ['./', './app.js', './app.css', './manifest.json'];
const SHARED = ['./../css/index.css', './importmap.js', './app.js'];

const onError = ({ operation, key, error }) => console.warn(`[sw] vendor ${operation} failed for ${key}`, error);    
const app     = createCache ({ onError, name: CACHE_APP    }); // stale while revalidate
const vendor  = createCache ({ onError, name: CACHE_VENDOR }); // loaded once

const isNested     = url => NESTED.some(root => url.startsWith(root) && !SCOPE.startsWith(root));
const isSameOrigin = url => url.startsWith(self.location.origin + '/');
const isVendor     = url => VERSIONED.test(url);

// ── install ────────────────────────────────────────────────────────────────

const precacheUrls = () => [
     ...OWN.map(path => new URL(path, SCOPE).href),
  ...SHARED.map(path => new URL(path, import.meta.url).href),
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_APP);
    // one missing file must not fail the whole install
    await Promise.all(precacheUrls().map(url =>
      cache.add(new Request(url, { cache: 'reload' }))
           .catch(error => console.warn('[sw] precache skipped', url, error))
    ));
  })());
  self.skipWaiting();
});

// ── activate ───────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(key => key.startsWith('zugriff-') && key !== CACHE_APP && key !== CACHE_VENDOR)
          // another app's cache is none of our business — only drop our own
          // older versions, and the vendor cache when its version moved on
          .filter(key => key.startsWith(`zugriff-${SLUG}-`) || key.startsWith('zugriff-vendor-'))
          .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

// ── fetch ──────────────────────────────────────────────────────────────────


self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = request.url;

  
  if (!url.startsWith('http')) return; // extension and devtools schemes are not ours to answer
  if (isNested(url))           return;

  const versioned = isVendor(url);

  // anything else on a foreign origin is left to the browser. revalidating it
  // would mean adding If-None-Match / If-Modified-Since, and that turns a
  // simple request into a preflighted one — api.iconify.design does not allow
  // those headers, so the icons would start failing on the second load
  if (!versioned && !isSameOrigin(url)) return;

  const store = versioned ? vendor : app;

  // keepAlive hands the background revalidation to the event, so the worker is
  // not killed mid-refresh — without it a revalidation started on the last
  // request of a session is simply lost
  event.respondWith(
    store.staleWhileRevalidate(request, {
      ttl       : versioned ? IMMUTABLE_TTL : 0,
      keepAlive : pending => event.waitUntil(pending),
    }).catch(async error => {
      // offline and never cached: let the failure be the real network failure
      console.warn('[sw] miss', url, error);
      return fetch(request);
    })
  );
});
