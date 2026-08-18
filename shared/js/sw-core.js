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

/* global self, caches */

// ── identity ───────────────────────────────────────────────────────────────

// the app slug is the last path segment of the registration scope, so nothing
// has to be templated into this file
const SCOPE   = self.registration.scope;
const SLUG    = SCOPE.replace(/\/+$/, '').split('/').pop() || 'zugriff';
const VERSION = 'v2';

const APP_CACHE    = `zugriff-${SLUG}-${VERSION}`;
const VENDOR_CACHE = `zugriff-vendor-${VERSION}`;

// ── caches ─────────────────────────────────────────────────────────────────

// the app's own files: small, and they change whenever the repo is pushed, so
// every load revalidates — conditionally, so an unchanged file costs a 304
const app = createCache({
  name    : APP_CACHE,
  onError : ({ operation, key, error }) => console.warn(`[sw] ${operation} failed for ${key}`, error),
});

// third party modules pinned to a version in the url. those bytes can never
// change, so once they are here they are never fetched again — and the cache is
// shared by every app instead of each one keeping its own copy of preact
const vendor = createCache({
  name    : VENDOR_CACHE,
  onError : ({ operation, key, error }) => console.warn(`[sw] vendor ${operation} failed for ${key}`, error),
});

const IMMUTABLE_TTL = 365 * 24 * 60 * 60 * 1000;

// esm.sh/preact@10.20.1, unpkg.com/@ffmpeg/core@0.12.6/…, jsdelivr /npm/x@1.2.3/
const VERSIONED = /(?:esm\.sh|unpkg\.com|cdn\.jsdelivr\.net)\/.*@\d+\.\d+\.\d+/;

const isVendor    = url => VERSIONED.test(url);
const isSameOrigin = url => url.startsWith(self.location.origin + '/');

// ── install ────────────────────────────────────────────────────────────────

// the app's own files hang off the scope, the shared ones off this module —
// the launcher sits at /zugriff/ and the apps two levels deeper, so resolving
// both against the same base would break one of them
// entry points only — everything they import is picked up by the fetch
// handler on the first load anyway
const OWN = ['./', './app.js', './app.css', './manifest.json'];

const SHARED = ['./../css/index.css', './importmap.js', './app.js'];

const precacheUrls = () => [
  ...OWN.map(path    => new URL(path, SCOPE).href),
  ...SHARED.map(path => new URL(path, import.meta.url).href),
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
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
      keys.filter(key => key.startsWith('zugriff-') && key !== APP_CACHE && key !== VENDOR_CACHE)
          // another app's cache is none of our business — only drop our own
          // older versions, and the vendor cache when its version moved on
          .filter(key => key.startsWith(`zugriff-${SLUG}-`) || key.startsWith('zugriff-vendor-'))
          .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

// ── fetch ──────────────────────────────────────────────────────────────────

// the launcher's scope is /zugriff/, which sits above every app — it must not
// answer (or cache) their files, those belong to the app's own worker
const NESTED = new URL('./tools/', SCOPE).href;
const isNested = url => url.startsWith(NESTED) && !SCOPE.startsWith(NESTED);

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = request.url;

  // extension and devtools schemes are not ours to answer
  if (!url.startsWith('http')) return;

  if (isNested(url)) return;

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
