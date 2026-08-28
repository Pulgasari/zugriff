// shared/js/lib/thumbs.js
//
// a local, client-only thumbnail cache. hand it an image url and it returns a
// small webp copy from an on-device store (IndexedDB via @bunker/db), generating
// it the first time by fetching the original and downscaling it on a canvas.
// nothing server-side, and after the first generation the original host is never
// touched again — the images live on the device.
//
// the one unavoidable constraint: to *resize* a cross-origin image the browser
// has to read its pixels, which needs the bytes. a direct fetch is tried first;
// only when the host blocks it (no CORS headers) does it fall back to a proxy —
// the same proxy an app already uses for its data. display of the original never
// needs any of this, so a caller can always fall back to showing the source url.
//
// shared on purpose: any zugriff app can keep its artwork small the same way.
//
//   import { createThumbCache } from './../../shared/js/lib/thumbs.js';
//   const thumbs = createThumbCache({ proxy: () => corsProxy.value });
//   const url = await thumbs.request(imageUrl);   // -> blob object-url or null
//
// logging (@pulgasari/logger, scope 'thumbs'): a generated thumbnail and a
// proxy fallback log at info, a failure at warn — both visible by default. cache
// hits log at debug; run `setLogLevel('debug')` from @pulgasari/logger to see
// them. a host that blocks the direct fetch is remembered so the browser's
// unsuppressable CORS error is not logged again for it.

import { createDb } from '@bunker/db';
import { Logger }   from '@pulgasari/logger';

// a small stable string hash (cyrb53) — the same one the apps use for ids.
function hash (str = '') {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// `{url}` in a proxy template is replaced with the encoded source; a template
// without the placeholder gets it appended.
function viaProxy (proxy, url) {
  const tpl = (proxy || '').trim();
  if (!tpl) return null;
  const enc = encodeURIComponent(url);
  return tpl.includes('{url}') ? tpl.replaceAll('{url}', enc) : tpl + enc;
}

// a tiny concurrency gate, so a full page of artwork does not open fifty fetches
function limiter (max) {
  let active = 0;
  const queue = [];
  const pump = () => {
    if (active >= max || !queue.length) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve().then(fn).then(resolve, reject).finally(() => { active--; pump(); });
  };
  return fn => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); pump(); });
}

const canResize = typeof createImageBitmap === 'function' && typeof document !== 'undefined';

/**
 * create a thumbnail cache.
 *
 * @param {object}   [opts]
 * @param {string}   [opts.name='zugriff-images']  the IndexedDB database name (shared across apps by default)
 * @param {number}   [opts.width=400]              the stored thumbnail's width in px; height keeps the aspect ratio
 * @param {()=>string} [opts.proxy]                returns the CORS proxy template for the byte-fetch fallback
 * @param {number}   [opts.maxBytes]               soft cap on total cache size; oldest entries are dropped past it
 * @param {number}   [opts.quality=0.82]           webp quality
 * @param {number}   [opts.concurrency=3]          parallel generations
 * @param {string}   [opts.scope='thumbs']         logger scope
 * @param {(url:string,width:number)=>string|null} [opts.resizer]
 *        a server-side resizer endpoint builder. when it returns a url, the
 *        already-small image is fetched from there and stored as-is (no client
 *        decode/canvas, no CORS proxy) — the preferred path when a self-hosted
 *        resizer is available. return null/empty to fall back to client-side
 *        canvas resizing.
 */
export function createThumbCache ({
  name        = 'zugriff-images',
  width       = 250,
  proxy       = () => '',
  maxBytes    = 64 * 1024 * 1024,
  quality     = 0.80,
  concurrency = 3,
  scope       = 'thumbs',
  resizer     = null,
} = {}) {
  const db       = createDb(name);
  const mem      = new Map; // key -> object-url (this session)
  const inflight = new Map; // key -> Promise<string|null>
  const gate     = limiter(concurrency);
  const log      = new Logger({ prefix: scope });

  // hosts whose direct fetch we already saw blocked by CORS. remembering them
  // means we stop re-issuing a cross-origin fetch the browser will only reject
  // and log again — the repeated "blocked by CORS" console spam — and go
  // straight to the proxy for that host instead.
  const corsBlocked = new Set;

  let setup = null;
  const ensure = () => (setup ??= db.setup({ thumbs: {}, meta: {} }));

  const keyOf   = url => `${hash(url)}@${width}`;
  const hostOf  = url => { try { return new URL(url).host; } catch { return url; } };
  const label   = url => { try { return decodeURIComponent(new URL(url).pathname.split('/').pop()) || url; } catch { return url; } };
  const asKb    = bytes => `${Math.round(bytes / 1024)} KB`;

  // ── byte fetch: direct, then proxy ─────────────────────────────────────────
  // returns { blob, via } where via is 'direct' | 'proxy', or null on failure.
  async function fetchBytes (url) {
    const host = hostOf(url);

    // skip the direct attempt for hosts already known to block it, so the
    // browser does not log the same CORS rejection over and over
    if (!corsBlocked.has(host)) {
      try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (res.ok) return { blob: await res.blob(), via: 'direct' };
      } catch {
        corsBlocked.add(host);
        log.debug('cors', host, '→ proxy from now on');
      }
    }

    const proxied = viaProxy(proxy(), url);
    if (!proxied) return null;
    try {
      const res = await fetch(proxied, { credentials: 'omit' });
      if (res.ok) return { blob: await res.blob(), via: 'proxy' };
    } catch { /* give up, the caller falls back to the original */ }
    return null;
  }

  // ── generate a downscaled webp blob from the original ──────────────────────
  // returns { blob, via, w, h } on success, or { error } describing the failure.
  async function generate (url) {
    // preferred path: a self-hosted resizer already returns a small image, so
    // just fetch and keep it — no cross-origin bytes, no canvas.
    const endpoint = resizer?.(url, width) || null;
    if (endpoint) {
      try {
        const res = await fetch(endpoint, { credentials: 'omit' });
        if (res.ok) return { blob: await res.blob(), via: 'resizer' };
      } catch { /* fall through to the error below */ }
      return { error: 'resizer' };
    }

    if (!canResize) return { error: 'unsupported' };

    const got = await fetchBytes(url);
    if (!got) return { error: 'fetch' };

    let bitmap;
    try   { bitmap = await createImageBitmap(got.blob); } // decode once; bail if not an image
    catch { return { error: 'decode' }; }

    // downscale only — a small original is kept at its own size, never blown up
    const scale = Math.min(1, width / (bitmap.width || width));
    const w = Math.max(1, Math.round((bitmap.width  || 1) * scale));
    const h = Math.max(1, Math.round((bitmap.height || 1) * scale));

    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', quality));
    if (!blob) return { error: 'encode' };
    return { blob, via: got.via, w, h };
  }

  // ── storage bookkeeping (soft LRU by creation time) ───────────────────────
  async function store (key, url, blob) {
    await db.set('thumbs', key, { blob, url, bytes: blob.size, at: Date.now() });
    const meta = (await db.get('meta', 'total')) || { bytes: 0 };
    meta.bytes = (meta.bytes || 0) + blob.size;
    if (meta.bytes > maxBytes) await evictDown(meta);
    else await db.set('meta', 'total', meta);
  }

  async function evictDown (meta) {
    const entries = await db.entries('thumbs');            // [[key, rec], …]
    entries.sort((a, b) => (a[1].at || 0) - (b[1].at || 0)); // oldest first
    let bytes = meta.bytes;
    const target = maxBytes * 0.9;
    for (const [k, rec] of entries) {
      if (bytes <= target) break;
      await db.delete('thumbs', k);
      const u = mem.get(k);
      if (u) { URL.revokeObjectURL(u); mem.delete(k); }
      bytes -= rec.bytes || 0;
    }
    await db.set('meta', 'total', { bytes: Math.max(0, bytes) });
  }

  async function loadFromDb (key) {
    const rec = await db.get('thumbs', key);
    if (!rec?.blob) return null;
    const u = URL.createObjectURL(rec.blob);
    mem.set(key, u);
    return u;
  }

  return {
    /** the cached object-url if it is already in memory, else null (sync) */
    peek (url) { return url ? (mem.get(keyOf(url)) || null) : null; },

    /**
     * the thumbnail object-url for `url`, generating and storing it on a miss.
     * resolves to null when the image can't be fetched or decoded — the caller
     * should then fall back to the original url or a placeholder.
     */
    async request (url) {
      if (!url) return null;
      const key = keyOf(url);
      if (mem.has(key)) { log.debug('cache', 'mem', label(url)); return mem.get(key); }
      if (inflight.has(key)) return inflight.get(key);

      const job = (async () => {
        await ensure();
        const cached = await loadFromDb(key);
        if (cached) { log.debug('cache', 'db', label(url)); return cached; }
        try {
          const res = await gate(() => generate(url));
          if (!res || res.error) {
            log.warn('fail', res?.error || 'unknown', label(url));
            return null;
          }
          await store(key, url, res.blob);
          const u = URL.createObjectURL(res.blob);
          mem.set(key, u);
          const dims = res.w && res.h ? `${res.w}×${res.h}` : null;
          log.info(res.via === 'direct' ? 'made' : `made (via ${res.via})`,
                   ...[dims, asKb(res.blob.size), label(url)].filter(Boolean));
          return u;
        } catch (err) {
          log.warn('fail', 'store', label(url), err?.message || err);
          return null;
        } finally {
          inflight.delete(key);
        }
      })();

      inflight.set(key, job);
      return job;
    },

    /** kick off generation for a batch of urls, ignoring the results */
    prewarm (urls = []) {
      for (const url of urls) if (url) this.request(url).catch(() => {});
    },

    /** drop the cached thumbnails for these urls (e.g. on unsubscribe) */
    async evict (urls = []) {
      await ensure();
      let freed = 0;
      for (const url of urls) {
        if (!url) continue;
        const key = keyOf(url);
        const rec = await db.get('thumbs', key);
        if (rec) freed += rec.bytes || 0;
        await db.delete('thumbs', key);
        const u = mem.get(key);
        if (u) { URL.revokeObjectURL(u); mem.delete(key); }
      }
      if (freed) {
        const meta = (await db.get('meta', 'total')) || { bytes: 0 };
        await db.set('meta', 'total', { bytes: Math.max(0, (meta.bytes || 0) - freed) });
      }
    },

    /** wipe the whole cache */
    async clear () {
      await ensure();
      for (const u of mem.values()) URL.revokeObjectURL(u);
      mem.clear();
      await db.clear('thumbs', 'meta');
    },
  };
}

export default createThumbCache;
