// shared/js/service.js

import { createCache } from 'https://code.pulgasari.dev/bunker/cache/index.js';

// ::::::

const SCOPE   = self.registration.scope;
const SLUG    = SCOPE.replace(/\/+$/, '').split('/').pop() || 'zugriff';
const VERSION = 'v3';

const CACHE_APP     = `zugriff-${SLUG}-${VERSION}`;
const CACHE_DEV     = `zugriff-dev-${VERSION}`;
const CACHE_VENDOR  = `zugriff-vendor-${VERSION}`;
const IMMUTABLE_TTL = 365 * 24 * 60 * 60 * 1000;

// the esm cdns. a url pinned to a full semver there is immutable and cached for a year;
// a looser pin (music-metadata@11) is still cached but revalidated, since that pin can move to a newer patch.
const VENDOR_HOST = /^https:\/\/(?:esm\.sh|unpkg\.com|cdn\.jsdelivr\.net)\//;
const FULL_SEMVER = /@\d+\.\d+\.\d+/;

// code.pulgasari.dev ships the in-development libs (@aufbau, @bunker, …);
// they move often, so serve cached-first and revalidate on every request.
const DEV_HOST = 'https://code.pulgasari.dev/';

const NESTED = ['./tools/', './apps/'].map(path => new URL(path, SCOPE).href);
const OWN    = ['./', './app.js', './app.css', './manifest.json'];
const SHARED = ['./../css/index.css', './boot.js', './app.js'];

const onError = ({ operation, key, error }) => console.warn(`[sw] cache ${operation} failed for ${key}`, error);
const app     = createCache ({ onError, name: CACHE_APP    }); // same-origin, stale while revalidate
const dev     = createCache ({ onError, name: CACHE_DEV    }); // code.pulgasari.dev, stale while revalidate
const vendor  = createCache ({ onError, name: CACHE_VENDOR }); // esm cdns, immutable when versioned

const isDev        = url => url.startsWith(DEV_HOST);
const isImmutable  = url => isVendor(url) && FULL_SEMVER.test(url);
const isNested     = url => NESTED.some(root => url.startsWith(root) && !SCOPE.startsWith(root));
const isSameOrigin = url => url.startsWith(self.location.origin + '/');
const isVendor     = url => VENDOR_HOST.test(url);

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
      keys.filter(key => key.startsWith('zugriff-') && key !== CACHE_APP && key !== CACHE_VENDOR && key !== CACHE_DEV)
          // another app's cache is none of our business — only drop our own older
          // versions, and the shared vendor/dev caches when their version moved on
          .filter(key => key.startsWith(`zugriff-${SLUG}-`) || key.startsWith('zugriff-vendor-') || key.startsWith('zugriff-dev-'))
          .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

// ── fetch ──────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event; if (request.method !== 'GET') return;

  // never answer a top-level navigation from here. a document served from the
  // cache renders at the *requested* url, not the redirected one, so:
  //   • vercel's `trailingSlash: true` 308 (/apps → /apps/) never fires while
  //     the sw is in control — the page stays on the un-slashed url;
  //   • the index.html shell would then resolve any relative assets one segment
  //     too high (/code/app.js becomes /app.js); the shell injects absolute
  //     /<route>/… paths for exactly this reason, but keeping navigations on the
  //     network preserves the redirect + rewrites regardless.
  // letting navigations hit the network keeps the redirect + rewrites intact;
  // the sw still caches every subresource below, which is where the win is.
  if (request.mode === 'navigate') return;

  const { url } = request;
  if (!url.startsWith('http')) return; // extension and devtools schemes are not ours to answer
  if (isNested(url))           return;

  // versioned CDN URLs: cached once (immutable)
  // everything else: served cached-first and revalidated in the background
  let store, ttl;
  if      (isImmutable(url))  { store = vendor; ttl = IMMUTABLE_TTL; }
  else if (isVendor(url))     { store = vendor; ttl = 0; }
  else if (isDev(url))        { store = dev;    ttl = 0; }
  else if (isSameOrigin(url)) { store = app;    ttl = 0; }
  else return;

  event.respondWith(
    store.staleWhileRevalidate(request, {
      ttl,
      keepAlive    : pending => event.waitUntil(pending),
      withDirtyFix : true,
    }).catch(async error => {
      // offline and never cached: let the failure be the real network failure
      console.warn('[sw] miss', url, error);
      return fetch(request);
    })
  );
});
