// .shared/js/service.js
// the body of /sw.js, one worker for every app of the site. a bundle stamps VERSION
// with its own (stage-capacitor-www.mjs), the live site counts it up by hand

import { createCache } from 'https://code.pulgasari.dev/bunker/cache/index.js';

const VERSION = 'v4';

const CACHE_APP     = `zugriff-app-${VERSION}`;
const CACHE_DEV     = `zugriff-dev-${VERSION}`;
const CACHE_ICON    = `zugriff-icon-${VERSION}`;
const CACHE_VENDOR  = `zugriff-vendor-${VERSION}`;
const IMMUTABLE_TTL = 365 * 24 * 60 * 60 * 1000;

// the esm cdns. a url pinned to a full semver there is immutable and cached for a year;
// a looser pin (music-metadata@11) is still cached but revalidated, since that pin can move to a newer patch.
const VENDOR_HOST = /^https:\/\/(?:esm\.sh|unpkg\.com|cdn\.jsdelivr\.net)\//;
const FULL_SEMVER = /@\d+\.\d+\.\d+/;
const DEV_HOST    = 'https://code.pulgasari.dev/'; // stale while revalidate
const ICON_HOST   = 'https://api.iconify.design/';
const ICON_TTL    = 30 * 24 * 60 * 60 * 1000;

const PRECACHE = ['/.shared/css/index.css', '/.shared/js/data/importmap.js', '/.shared/js/boot.js', '/.shared/js/runtime.js'];

const onError = ({ operation, key, error }) => console.warn(`[sw] cache ${operation} failed for ${key}`, error);
const app     = createCache ({ onError, name: CACHE_APP    }); // same-origin, stale while revalidate
const dev     = createCache ({ onError, name: CACHE_DEV    }); // code.pulgasari.dev, stale while revalidate
const icon    = createCache ({ onError, name: CACHE_ICON   }); // api.iconify.design svgs, cached hard
const vendor  = createCache ({ onError, name: CACHE_VENDOR }); // esm cdns, immutable when versioned

const isDev        = url => url.startsWith(DEV_HOST);
const isIcon       = url => url.startsWith(ICON_HOST) && url.endsWith('.svg');
const isImmutable  = url => isVendor(url) && FULL_SEMVER.test(url);
const isSameOrigin = url => url.startsWith(self.location.origin + '/');
const isVendor     = url => VENDOR_HOST.test(url);

// ── install ────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_APP);
    // one missing file must not fail the whole install
    await Promise.all(PRECACHE.map(url =>
      cache.add(new Request(url, { cache: 'reload' }))
           .catch(error => console.warn('[sw] precache skipped', url, error))
    ));
  })());
  self.skipWaiting();
});

// ── activate ───────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const current = [CACHE_APP, CACHE_DEV, CACHE_ICON, CACHE_VENDOR];
    const keys    = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('zugriff-') && !current.includes(key)).map(key => caches.delete(key)));
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

  // versioned CDN URLs: cached once (immutable)
  // icons: cached hard, a given `prefix:name` never changes
  // everything else: served cached-first and revalidated in the background
  let store, ttl, req = request;
  if      (isImmutable(url))  { store = vendor; ttl = IMMUTABLE_TTL; }
  else if (isVendor(url))     { store = vendor; ttl = 0; }
  else if (isDev(url))        { store = dev;    ttl = 0; }
  else if (isIcon(url))       { store = icon;   ttl = ICON_TTL;
                                // an <svg-icon> mask-image is fetched cors; a background-image
                                // one (flags) no-cors → opaque, which cannot be stored or masked.
                                // force cors so iconify answers with its access-control-allow-origin
                                // and both modes get one readable, cacheable, cors-clean body.
                                req = new Request(url, { mode: 'cors', credentials: 'omit' }); }
  else if (isSameOrigin(url)) { store = app;    ttl = 0; }
  else return;

  event.respondWith(
    store.staleWhileRevalidate(req, {
      ttl,
      keepAlive : pending => event.waitUntil(pending),
    }).catch(async error => {
      // offline and never cached: let the failure be the real network failure
      console.warn('[sw] miss', url, error);
      return fetch(request);
    })
  );
});
