// apps/audio-manager/db.js
//
// storage for the music library — two @bunker/db stores:
//
//   sources   granted folder handles (the only durable thing)
//   tracks    one record per audio file: path, tags, a cover Blob and a
//             size+mtime signature so tags are only re-read when a file changes
//
// scanning is two-phase: a fast pass lists the files and shows the library right
// away with filename titles, then a bounded pool reads real tags + cover off
// each new or changed file. nothing but the handles and the extracted tags is
// stored — audio is streamed from disk on play (see player.js).

import { signal, computed } from '@aufbau/kits/preact-htm';
import { createDb } from '@bunker/db';
import { createPool } from './../../shared/js/lib/pool.js';
import * as fs from './../../shared/js/lib/fsaccess.js';
import { accept, prettyName, extractMeta } from './library.js';

const db    = createDb('zugriff-audio');
const keyOf = (sourceId, path) => sourceId + '\n' + path;

// ── signals ────────────────────────────────────────────────────────────────

export const
sources  = signal([]),      // [{ id, name, handle, addedAt }]
tracks   = signal([]),      // [{ key, sourceId, path, name, title, artist, album, … }]
perms    = signal({}),      // sourceId -> 'granted' | 'prompt' | 'denied'
scanning = signal({}),      // sourceId -> true while scanning
pending  = signal(0),       // tracks still queued for tag extraction
ready    = signal(false);

export const sourceById = id => sources.value.find(s => s.id === id) ?? null;
export const trackByKey = key => tracks.value.find(t => t.key === key) ?? null;

const cmp = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

// display helpers used across the ui
export const displayArtist = t => t.artist || 'Unknown Artist';
export const displayAlbum  = t => t.album  || 'Unknown Album';
export const displayTitle  = t => t.title  || prettyName(t.name);

// ── loading ────────────────────────────────────────────────────────────────

export async function load () {
  await db.setup({ sources: {}, tracks: {} });
  const [srcRows, trackRows] = await Promise.all([db.getAll('sources'), db.getAll('tracks')]);
  sources.value = Object.values(srcRows).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
  tracks.value  = Object.values(trackRows);

  await Promise.all(sources.value.map(async s => {
    perms.value = { ...perms.value, [s.id]: await fs.queryPermission(s.handle, 'read') };
  }));
  ready.value = true;

  sources.value.forEach(s => { if (perms.value[s.id] === 'granted') scan(s.id).catch(() => {}); });
}

// ── folders ──────────────────────────────────────────────────────────────

export async function addFolder () {
  const handle = await fs.pickDirectory({ id: 'zugriff-audio', mode: 'read' });
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
  if (!s) return { granted: false };
  const res = await fs.requestRead(s.handle, 'read');
  perms.value = { ...perms.value, [id]: res.granted ? 'granted' : (res.state ?? 'denied') };
  if (res.granted) await scan(id);
  return res;
}

export async function repick (id) {
  const s = sourceById(id);
  if (!s) return false;
  const handle = await fs.pickDirectory({ id: 'zugriff-audio', mode: 'read' });
  if (!handle) return false;
  const rec = { ...s, name: handle.name, handle };
  await db.set('sources', id, rec);
  sources.value = sources.value.map(x => x.id === id ? rec : x);
  perms.value   = { ...perms.value, [id]: 'granted' };
  await scan(id);
  return true;
}

export async function removeFolder (id) {
  const doomed = tracks.value.filter(t => t.sourceId === id).map(t => t.key);
  await db.delete('sources', id);
  await db.task('tracks', 'readwrite', store => { for (const k of doomed) store.delete(k); });
  sources.value = sources.value.filter(s => s.id !== id);
  tracks.value  = tracks.value.filter(t => t.sourceId !== id);
  const pm = { ...perms.value }; delete pm[id]; perms.value = pm;
}

// ── scanning ───────────────────────────────────────────────────────────────

export async function scan (id) {
  const s = sourceById(id);
  if (!s) return;
  scanning.value = { ...scanning.value, [id]: true };
  try {
    const files   = fs.flatten(await fs.scanTree(s.handle, { accept }));
    const seen    = new Set();
    const known   = new Map(tracks.value.map(t => [t.key, t]));
    const next    = tracks.value.filter(t => t.sourceId !== id);
    const toWrite = [];

    for (const f of files) {
      const key = keyOf(id, f.path);
      seen.add(key);
      const file = await f.handle.getFile();
      const sig  = `${file.size}:${file.lastModified}`;
      const prev = known.get(key);

      const rec = (prev && prev.sig === sig) ? prev : {
        key, sourceId: id, path: f.path, name: f.name,
        title: '', artist: '', album: '', albumArtist: '', trackNo: null, year: null,
        genre: '', duration: null, cover: prev?.cover ?? null,
        sig, metaDone: false, addedAt: prev?.addedAt ?? Date.now(),
      };
      next.push(rec);
      if (rec !== prev) toWrite.push(rec);
    }

    const gone = tracks.value.filter(t => t.sourceId === id && !seen.has(t.key)).map(t => t.key);
    if (gone.length)    await db.task('tracks', 'readwrite', store => { for (const k of gone) store.delete(k); });
    if (toWrite.length) await db.task('tracks', 'readwrite', store => { for (const r of toWrite) store.put(r, r.key); });

    tracks.value = next;
    enqueueMeta(next.filter(t => t.sourceId === id && !t.metaDone));
  } finally {
    scanning.value = { ...scanning.value, [id]: false };
  }
}

export const rescanAll = () => Promise.all(
  sources.value.filter(s => perms.value[s.id] === 'granted').map(s => scan(s.id).catch(() => {})),
);

// ── background tag queue ─────────────────────────────────────────────────────

const gate   = createPool(3);
const queued = new Set();

function enqueueMeta (list) {
  for (const t of list) {
    if (queued.has(t.key)) continue;
    queued.add(t.key);
    gate(() => extractOne(t)).finally(() => { queued.delete(t.key); pending.value = queued.size; });
  }
  pending.value = queued.size;
}

async function extractOne (t) {
  const cur = trackByKey(t.key);
  if (!cur || cur.metaDone || cur.sig !== t.sig) return;
  try {
    const file   = await fileAt(t);
    const meta   = await extractMeta(file);
    const merged = { ...cur, ...meta, cover: meta.cover ?? cur.cover, metaDone: true };
    await db.set('tracks', merged.key, merged);
    tracks.value = tracks.value.map(x => x.key === merged.key ? merged : x);
  } catch {
    const merged = { ...cur, metaDone: true };   // don't retry a file we can't read
    await db.set('tracks', merged.key, merged);
    tracks.value = tracks.value.map(x => x.key === merged.key ? merged : x);
  }
}

// ── file access ──────────────────────────────────────────────────────────

async function handleAt (root, path) {
  const parts = path.split('/');
  let dir = root;
  for (const seg of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(seg);
  return dir.getFileHandle(parts.at(-1));
}

/** the File object for a track, read from disk on demand (playback, re-tag) */
export async function fileAt (track) {
  const s = sourceById(track.sourceId);
  if (!s) throw new Error('folder is gone');
  return (await handleAt(s.handle, track.path)).getFile();
}

// ── grouping ─────────────────────────────────────────────────────────────

const albumKey = t => `${displayAlbum(t)}\n${t.albumArtist || displayArtist(t)}`;

export const albums = computed(() => {
  const map = new Map();
  for (const t of tracks.value) {
    const key = albumKey(t);
    let a = map.get(key);
    if (!a) map.set(key, a = { key, album: displayAlbum(t), artist: t.albumArtist || displayArtist(t), year: t.year, cover: null, tracks: [] });
    a.tracks.push(t);
    if (!a.cover && t.cover) a.cover = t.cover;
    if (!a.year && t.year)   a.year  = t.year;
  }
  const list = [...map.values()];
  for (const a of list) a.tracks.sort((x, y) => (x.trackNo ?? 1e9) - (y.trackNo ?? 1e9) || cmp(displayTitle(x), displayTitle(y)));
  return list.sort((a, b) => cmp(a.artist, b.artist) || cmp(a.album, b.album));
});

export const artists = computed(() => {
  const map = new Map();
  for (const t of tracks.value) {
    const name = displayArtist(t);
    let a = map.get(name);
    if (!a) map.set(name, a = { name, cover: null, tracks: [], albums: new Set() });
    a.tracks.push(t);
    a.albums.add(displayAlbum(t));
    if (!a.cover && t.cover) a.cover = t.cover;
  }
  return [...map.values()].sort((a, b) => cmp(a.name, b.name));
});
