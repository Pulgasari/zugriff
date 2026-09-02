// shared/js/filesystem/scan.js
//
// the two reusable pieces of a "scan a granted folder into records" pass, pulled
// out of the audio-manager and ebooks libraries where they were nearly identical:
//
//   syncSource  diff the files on disk against the rows we already hold for one
//               source — keep unchanged rows (by a size+mtime signature), write
//               new/changed ones, drop rows whose file vanished.
//   MetaQueue   a bounded background queue for the slow per-file metadata
//               extraction (tag reading, cover render, pdf/epub parse) that runs
//               off to the side after the fast listing pass.
//
// neither knows anything about a specific app's record shape; the caller passes
// `makeRecord` / a worker that does. notes doesn't need either (it just stores a
// tree), so FolderLibrary takes a plain `scan` callback and these stay opt-in.

import { signal } from '@aufbau/kits/preact-htm';
import { createPool } from './../vendors/pool.js';

/** the size+mtime signature we use to tell whether a file changed since last scan */
export const signatureOf = file => `${file.size}:${file.lastModified}`;

/**
 * reconcile `rows` (every record across all sources) with the `files` found in
 * one source's folder, and persist the difference to `store`.
 *
 *   db          the @bunker/db instance
 *   store       object-store name the records live in (e.g. 'tracks', 'books')
 *   sourceId    the source being scanned
 *   files       flat file nodes from fsaccess.flatten(scanTree(...))
 *   rows        the current full array of records (from the app's signal)
 *   keyOf       (sourceId, path) => key
 *   makeRecord  (fileNode, { key, sourceId, sig, prev }) => a fresh record,
 *               called only for a new or changed file
 *
 * returns the next full array of records (this source rebuilt, others untouched),
 * ready to assign straight to the app's signal.
 */
export async function syncSource ({ db, store, sourceId, files, rows, keyOf, makeRecord }) {
  const seen    = new Set();
  const known   = new Map(rows.map(r => [r.key, r]));
  const next    = rows.filter(r => r.sourceId !== sourceId);   // rebuild this source's rows
  const toWrite = [];

  for (const f of files) {
    const key  = keyOf(sourceId, f.path);
    seen.add(key);
    const file = await f.handle.getFile();          // cheap: metadata only
    const sig  = signatureOf(file);
    const prev = known.get(key);

    const rec = (prev && prev.sig === sig)
      ? prev                                        // unchanged — keep it as-is
      : makeRecord(f, { key, sourceId, sig, prev });
    next.push(rec);
    if (rec !== prev) toWrite.push(rec);
  }

  // rows for files that vanished from this source
  const gone = rows.filter(r => r.sourceId === sourceId && !seen.has(r.key)).map(r => r.key);
  if (gone.length)    await db.task(store, 'readwrite', s => { for (const k of gone) s.delete(k); });
  if (toWrite.length) await db.task(store, 'readwrite', s => { for (const r of toWrite) s.put(r, r.key); });

  return next;
}

/**
 * a bounded background queue keyed by each item's `.key`, so a rescan can't
 * double-enqueue an item that is already queued or in flight. `pending` is a
 * signal of how many are still outstanding, for a "reading tags…" indicator.
 *
 *   const meta = new MetaQueue(3);
 *   meta.enqueue(newRows, row => extractOne(row));
 */
export class MetaQueue {
  constructor (concurrency = 3) {
    this.gate    = createPool(concurrency);
    this.queued  = new Set();
    this.pending = signal(0);
  }

  enqueue (items, worker) {
    for (const it of items) {
      if (this.queued.has(it.key)) continue;
      this.queued.add(it.key);
      this.gate(() => worker(it)).finally(() => {
        this.queued.delete(it.key);
        this.pending.value = this.queued.size;
      });
    }
    this.pending.value = this.queued.size;
  }
}
