// apps/ebooks/db.js
//
// storage for the library. three @bunker/db stores:
//
//   sources   granted folder handles (the only thing that isn't disposable)
//   books     one record per book file — path, extracted title/author, a cover
//             Blob and a size+mtime signature so we re-extract only when a file
//             actually changes
//   progress  per-book reading position (pdf page or epub cfi) + last-opened
//
// scanning is two-phase: a fast pass lists the files and shows the shelf right
// away with filename titles, then a throttled background queue opens each new
// or changed book to pull real metadata and a cover, updating the grid as each
// one lands.

import { signal, computed } from '@aufbau/kits/preact-htm';
import { createDb } from '@bunker/db';
import * as fs from './../../shared/js/lib/fsaccess.js';
import { accept, kindOf, prettyName, extractMeta } from './library.js';

const db = createDb('zugriff-ebooks');

const SEP = '/';   // key = sourceId + '/' + path; sourceIds are UUIDs, so this never collides
const keyOf = (sourceId, path) => sourceId + SEP + path;

// ── signals ────────────────────────────────────────────────────────────────

export const
sources  = signal([]),       // [{ id, name, handle, addedAt }]
books    = signal([]),       // [{ key, sourceId, path, name, kind, title, author, cover, sig, metaDone, pages, addedAt }]
progress = signal({}),       // key -> { location, page, pages, percent, updatedAt, lastOpenedAt }
perms    = signal({}),       // sourceId -> 'granted' | 'prompt' | 'denied'
scanning = signal({}),       // sourceId -> true while scanning
pending  = signal(0),        // books still queued for metadata extraction
ready    = signal(false);

export const sourceById = id => sources.value.find(s => s.id === id) ?? null;
export const bookByKey  = key => books.value.find(b => b.key === key) ?? null;
export const booksBySource = computed(() => {
  const map = {};
  for (const b of books.value) (map[b.sourceId] ??= []).push(b);
  return map;
});

// ── loading ────────────────────────────────────────────────────────────────

export async function load () {
  await db.setup({ sources: {}, books: {}, progress: {} });
  const [srcRows, bookRows, progRows] = await Promise.all([
    db.getAll('sources'), db.getAll('books'), db.getAll('progress'),
  ]);
  sources.value  = Object.values(srcRows).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
  books.value    = Object.values(bookRows);
  progress.value = progRows;

  // resolve permissions first (fast, never prompts), reveal the ui with the
  // cached shelf, then rescan granted folders in the background
  await Promise.all(sources.value.map(async s => {
    const state = await fs.queryPermission(s.handle, 'read');
    perms.value = { ...perms.value, [s.id]: state };
  }));
  ready.value = true;

  sources.value.forEach(s => { if (perms.value[s.id] === 'granted') scan(s.id).catch(() => {}); });
}

// ── folders ──────────────────────────────────────────────────────────────

export async function addFolder () {
  const handle = await fs.pickDirectory({ id: 'zugriff-ebooks', mode: 'read' });
  if (!handle) return null;
  for (const s of sources.value) {
    if (await s.handle.isSameEntry?.(handle)) throw new Error('That folder is already in your library.');
  }
  const rec = { id: crypto.randomUUID(), name: handle.name, handle, addedAt: Date.now() };
  await db.set('sources', rec.id, rec);
  sources.value = [...sources.value, rec];
  perms.value   = { ...perms.value, [rec.id]: 'granted' };
  await scan(rec.id);
  return rec;
}

export async function reconnect (id) {
  const s = sourceById(id);
  if (!s) return false;
  const ok = await fs.ensurePermission(s.handle, 'read');
  perms.value = { ...perms.value, [id]: ok ? 'granted' : 'denied' };
  if (ok) await scan(id);
  return ok;
}

export async function removeFolder (id) {
  const doomed = books.value.filter(b => b.sourceId === id).map(b => b.key);
  await db.delete('sources', id);
  await db.task('books',    'readwrite', store => { for (const k of doomed) store.delete(k); });
  await db.task('progress', 'readwrite', store => { for (const k of doomed) store.delete(k); });

  sources.value = sources.value.filter(s => s.id !== id);
  books.value   = books.value.filter(b => b.sourceId !== id);
  const p = { ...progress.value }; for (const k of doomed) delete p[k]; progress.value = p;
  const pm = { ...perms.value };   delete pm[id];  perms.value = pm;
}

// ── scanning ───────────────────────────────────────────────────────────────

export async function scan (id) {
  const s = sourceById(id);
  if (!s) return;
  scanning.value = { ...scanning.value, [id]: true };
  try {
    const tree  = await fs.scanTree(s.handle, { accept });
    const files = fs.flatten(tree);
    const seen  = new Set();
    const known = new Map(books.value.map(b => [b.key, b]));
    const next  = books.value.filter(b => b.sourceId !== id);   // rebuild this source's rows
    const toWrite = [];

    for (const f of files) {
      const key  = keyOf(id, f.path);
      seen.add(key);
      const file = await f.handle.getFile();          // cheap: metadata only
      const sig  = `${file.size}:${file.lastModified}`;
      const prev = known.get(key);

      const rec = (prev && prev.sig === sig)
        ? prev                                        // unchanged — keep cover + metadata
        : {
            key, sourceId: id, path: f.path, name: f.name, kind: kindOf(f.name),
            title: prettyName(f.name), author: '', cover: prev?.cover ?? null,
            sig, metaDone: false, pages: null, addedAt: prev?.addedAt ?? Date.now(),
          };
      next.push(rec);
      if (rec !== prev) toWrite.push(rec);
    }

    // delete rows for files that vanished from this source
    const gone = books.value.filter(b => b.sourceId === id && !seen.has(b.key)).map(b => b.key);
    if (gone.length) await db.task('books', 'readwrite', store => { for (const k of gone) store.delete(k); });
    if (toWrite.length) await db.task('books', 'readwrite', store => { for (const r of toWrite) store.put(r, r.key); });

    books.value = next;
    enqueueMeta(next.filter(b => b.sourceId === id && !b.metaDone));
  } finally {
    scanning.value = { ...scanning.value, [id]: false };
  }
}

export const rescanAll = () => Promise.all(
  sources.value.filter(s => perms.value[s.id] === 'granted').map(s => scan(s.id).catch(() => {})),
);

// ── background metadata queue ────────────────────────────────────────────────
// one book at a time keeps the ui responsive and avoids a burst of parallel
// unzips/pdf-parses churning memory on a big folder.

let queue = [];
let running = false;

function enqueueMeta (list) {
  const keys = new Set(queue.map(b => b.key));
  for (const b of list) if (!keys.has(b.key)) queue.push(b);
  pending.value = queue.length;
  if (!running) runQueue();
}

async function runQueue () {
  running = true;
  while (queue.length) {
    const b = queue.shift();
    pending.value = queue.length;
    const cur = bookByKey(b.key);
    if (!cur || cur.metaDone || cur.sig !== b.sig) continue;   // superseded by a rescan

    const source = sourceById(b.sourceId);
    if (!source) continue;

    try {
      const handle = await fileHandleFor(source.handle, b.path);
      const meta = await extractMeta(b.kind, handle);
      const merged = {
        ...cur,
        title  : meta.title  || cur.title,
        author : meta.author || cur.author,
        cover  : meta.cover  ?? cur.cover,
        pages  : meta.pages ?? cur.pages,
        metaDone: true,
      };
      await db.set('books', merged.key, merged);
      books.value = books.value.map(x => x.key === merged.key ? merged : x);
    } catch {
      const merged = { ...cur, metaDone: true };   // don't retry a broken file every load
      await db.set('books', merged.key, merged);
      books.value = books.value.map(x => x.key === merged.key ? merged : x);
    }
  }
  running = false;
  pending.value = 0;
}

// walk a stored path to its file handle, live from the granted folder
export async function fileHandleFor (rootHandle, path) {
  const segs = path.split('/');
  let dir = rootHandle;
  for (const seg of segs.slice(0, -1)) dir = await dir.getDirectoryHandle(seg);
  return dir.getFileHandle(segs.at(-1));
}

/** the live File for a book, opened fresh from disk */
export async function openFile (book) {
  const source = sourceById(book.sourceId);
  if (!source) throw new Error('This book’s folder is no longer open.');
  if (await fs.queryPermission(source.handle, 'read') !== 'granted') {
    const ok = await fs.ensurePermission(source.handle, 'read');
    if (!ok) throw new Error('Permission to read the folder was denied.');
  }
  const handle = await fileHandleFor(source.handle, book.path);
  return handle.getFile();
}

// ── progress ─────────────────────────────────────────────────────────────────

export const progressOf = key => progress.value[key] ?? null;

export async function saveProgress (key, patch) {
  const next = { ...progress.value[key], ...patch, updatedAt: Date.now() };
  progress.value = { ...progress.value, [key]: next };
  await db.set('progress', key, next);
  return next;
}

export const markOpened = key => saveProgress(key, { lastOpenedAt: Date.now() });

export async function clearProgress (key) {
  const p = { ...progress.value }; delete p[key]; progress.value = p;
  await db.delete('progress', key);
}
