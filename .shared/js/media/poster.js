// .shared/js/media/poster.js
// poster frames for local video files. hand it a clip id + signature + a lazy
// getFile(), and it returns a small webp object-url of one decoded frame, from an
// on-device store (IndexedDB via @bunker/db), generating it the first time by
// decoding the video in an offscreen <video> and drawing a frame to a canvas.
// nothing server-side; the file is only opened on a cache miss.
//
//   const posters = createPosterCache({ name: 'zugriff-videos-posters' });
//   const url = await posters.request(clip.key, clip.sig, () => lib.openFile(clip));
//
// generation can fail (a codec the browser can't decode — hevc, some mkv): request
// resolves to null and the caller falls back to a placeholder icon. keyed by
// id@sig, so a changed file regenerates and the stale entry ages out of the store.

import { createDb } from '@bunker/db';

// a tiny concurrency gate — decoding video is heavy, so a full grid doesn't spin
// up dozens of <video> decodes at once
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

const canDecode = typeof document !== 'undefined' && typeof URL?.createObjectURL === 'function';

/**
 * decode one frame of a video File into a downscaled webp blob.
 * resolves to a Blob, or rejects when the browser can't decode/seek the file.
 *
 * @param {File|Blob} file
 * @param {object}    [opts]
 * @param {number}    [opts.width=320]    poster width in px; height keeps aspect
 * @param {number}    [opts.seek=1]       target time in seconds (clamped into the clip)
 * @param {number}    [opts.quality=0.72] webp quality
 * @param {number}    [opts.timeout=15000] give up after this many ms
 */
export function extractPosterFrame (file, { width = 320, seek = 1, quality = 0.72, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!canDecode) { reject(new Error('unsupported')); return; }

    const url   = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    let done = false;
    const cleanup = () => { video.removeAttribute('src'); try { video.load(); } catch {} URL.revokeObjectURL(url); };
    const fail = err => { if (done) return; done = true; cleanup(); reject(err instanceof Error ? err : new Error(String(err))); };
    const timer = setTimeout(() => fail(new Error('timeout')), timeout);

    const draw = () => {
      if (done) return;
      try {
        const vw = video.videoWidth || width;
        const vh = video.videoHeight || width;
        const scale = Math.min(1, width / vw);
        const w = Math.max(1, Math.round(vw * scale));
        const h = Math.max(1, Math.round(vh * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob(blob => {
          clearTimeout(timer);
          if (done) return;
          done = true; cleanup();
          blob ? resolve(blob) : reject(new Error('encode'));
        }, 'image/webp', quality);
      } catch (err) { clearTimeout(timer); fail(err); }
    };

    video.addEventListener('error', () => { clearTimeout(timer); fail(video.error || new Error('decode')); }, { once: true });

    video.addEventListener('loadedmetadata', () => {
      const d = video.duration;
      // a positive seek target forces a real 'seeked' and a decoded frame (t=0 can
      // be black or never fire); clamp comfortably inside a short clip
      const t = Number.isFinite(d) && d > 0 ? Math.min(seek, Math.max(0.1, d * 0.1)) : seek;
      video.addEventListener('seeked', draw, { once: true });
      try { video.currentTime = t; } catch (err) { clearTimeout(timer); fail(err); }
    }, { once: true });

    video.src = url;
    try { video.load(); } catch {}
  });
}

/**
 * create a persisted poster cache.
 *
 * @param {object} [opts]
 * @param {string} [opts.name='zugriff-posters'] IndexedDB database name
 * @param {number} [opts.width=320]              poster width in px
 * @param {number} [opts.seek=1]                 seek target in seconds
 * @param {number} [opts.quality=0.72]           webp quality
 * @param {number} [opts.concurrency=2]          parallel decodes
 * @param {number} [opts.maxBytes]               soft cap; oldest entries drop past it
 */
export function createPosterCache ({
  name        = 'zugriff-posters',
  width       = 320,
  seek        = 1,
  quality     = 0.72,
  concurrency = 2,
  maxBytes    = 128 * 1024 * 1024,
} = {}) {
  const db       = createDb(name);
  const mem      = new Map;   // key -> object-url (this session)
  const inflight = new Map;   // key -> Promise<string|null>
  const gate     = limiter(concurrency);

  let setup = null;
  const ensure = () => (setup ??= db.setup({ posters: {}, meta: {} }));

  const keyOf = (id, sig) => `${id}@${sig ?? ''}@${width}`;

  async function store (key, blob) {
    await db.set('posters', key, { blob, bytes: blob.size, at: Date.now() });
    const meta = (await db.get('meta', 'total')) || { bytes: 0 };
    meta.bytes = (meta.bytes || 0) + blob.size;
    if (meta.bytes > maxBytes) await evictDown(meta);
    else await db.set('meta', 'total', meta);
  }

  async function evictDown (meta) {
    const entries = await db.entries('posters');              // [[key, rec], …]
    entries.sort((a, b) => (a[1].at || 0) - (b[1].at || 0));  // oldest first
    let bytes = meta.bytes;
    const target = maxBytes * 0.9;
    for (const [k, rec] of entries) {
      if (bytes <= target) break;
      await db.delete('posters', k);
      const u = mem.get(k);
      if (u) { URL.revokeObjectURL(u); mem.delete(k); }
      bytes -= rec.bytes || 0;
    }
    await db.set('meta', 'total', { bytes: Math.max(0, bytes) });
  }

  async function loadFromDb (key) {
    const rec = await db.get('posters', key);
    if (!rec?.blob) return null;
    const u = URL.createObjectURL(rec.blob);
    mem.set(key, u);
    return u;
  }

  return {
    /** the cached object-url if already in memory, else null (sync) */
    peek (id, sig) { return mem.get(keyOf(id, sig)) || null; },

    /**
     * the poster object-url for a clip, generating and storing it on a miss.
     * `getFile` is only awaited on a miss (so a cache hit never opens the file).
     * resolves to null when the clip can't be decoded — the caller falls back to
     * a placeholder.
     */
    async request (id, sig, getFile) {
      const key = keyOf(id, sig);
      if (mem.has(key)) return mem.get(key);
      if (inflight.has(key)) return inflight.get(key);

      const job = (async () => {
        try {
          await ensure();
          const cached = await loadFromDb(key);
          if (cached) return cached;

          const file = await getFile();
          if (!file) return null;

          const blob = await gate(() => extractPosterFrame(file, { width, seek, quality }));
          await store(key, blob);
          const u = URL.createObjectURL(blob);
          mem.set(key, u);
          return u;
        } catch {
          return null;   // undecodable / gone — caller shows the placeholder
        } finally {
          inflight.delete(key);
        }
      })();

      inflight.set(key, job);
      return job;
    },

    /** drop cached posters for these [id, sig] pairs */
    async evict (pairs = []) {
      await ensure();
      let freed = 0;
      for (const [id, sig] of pairs) {
        const key = keyOf(id, sig);
        const rec = await db.get('posters', key);
        if (rec) freed += rec.bytes || 0;
        await db.delete('posters', key);
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
      await db.clear('posters', 'meta');
    },
  };
}

export default createPosterCache;
