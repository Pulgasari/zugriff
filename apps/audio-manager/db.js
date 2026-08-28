// apps/audio-manager/db.js
//
// storage for the music library. the granted-folder lifecycle (the `sources`
// store, permissions, scanning) is the shared FolderLibrary
// (shared/js/filesystem/folders.js); this module owns the `tracks` store it
// scans into: one record per audio file — path, tags, a cover Blob and a
// size+mtime signature so tags are only re-read when a file changes.
//
// scanning is two-phase: syncSource() lists the files and shows the library
// right away with filename titles, then a bounded MetaQueue reads real tags +
// cover off each new or changed file. nothing but the handles and the extracted
// tags is stored — audio is streamed from disk on play (see player.js).

import { signal, computed } from '@aufbau/kits/preact-htm';
import { zugriff }                         from '/.shared/js/runtime.js';
import { syncSource, MetaQueue }           from '/.shared/js/filesystem/scan.js';
import * as fs                             from '/.shared/js/filesystem/fsaccess.js';
import { accept, prettyName, extractMeta } from './library.js';

const keyOf = (sourceId, path) => sourceId + '\n' + path;

// ── signals ────────────────────────────────────────────────────────────────
// sources / perms / scanning / ready come from the library below.

export const tracks = signal([]);   // [{ key, sourceId, path, name, title, artist, album, … }]

const meta = new MetaQueue(3);
export const pending = meta.pending;   // tracks still queued for tag extraction

export const trackByKey = key => tracks.value.find(t => t.key === key) ?? null;

const cmp = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

// display helpers used across the ui
export const displayArtist = t => t.artist || 'Unknown Artist';
export const displayAlbum  = t => t.album  || 'Unknown Album';
export const displayTitle  = t => t.title  || prettyName(t.name);

// ── the library ──────────────────────────────────────────────────────────

const lib = new zugriff.fs.FolderLibrary({
  db       : 'zugriff-audio',
  pickerId : 'zugriff-audio',
  stores   : { sources: {}, tracks: {} },

  onLoad: async (db) => {
    tracks.value = Object.values(await db.getAll('tracks'));
  },

  scan: async (s, { db }) => {
    const files = fs.flatten(await fs.scanTree(s.handle, { accept }));
    const next  = await syncSource({
      db, store: 'tracks', sourceId: s.id, files, rows: tracks.value, keyOf,
      makeRecord: (f, { key, sourceId, sig, prev }) => ({
        key, sourceId, path: f.path, name: f.name,
        title: '', artist: '', album: '', albumArtist: '', trackNo: null, year: null,
        genre: '', duration: null, cover: prev?.cover ?? null,
        sig, metaDone: false, addedAt: prev?.addedAt ?? Date.now(),
      }),
    });
    tracks.value = next;
    meta.enqueue(next.filter(t => t.sourceId === s.id && !t.metaDone), extractOne);
  },

  cascade: async (id, db) => {
    const doomed = tracks.value.filter(t => t.sourceId === id).map(t => t.key);
    await db.task('tracks', 'readwrite', store => { for (const k of doomed) store.delete(k); });
    tracks.value = tracks.value.filter(t => t.sourceId !== id);
  },
});

export const { sources, perms, scanning, ready } = lib;
export const sourceById = lib.sourceById;

export const load         = lib.load;
export const addFolder    = lib.addFolder;
export const reconnect    = lib.reconnect;
export const repick       = lib.repick;
export const removeFolder = lib.removeFolder;
export const scan         = lib.scan;
export const rescanAll    = lib.rescanAll;

// ── background tag queue ─────────────────────────────────────────────────────

async function extractOne (t) {
  const cur = trackByKey(t.key);
  if (!cur || cur.metaDone || cur.sig !== t.sig) return;
  try {
    const file   = await fileAt(t);
    const info   = await extractMeta(file);
    const merged = { ...cur, ...info, cover: info.cover ?? cur.cover, metaDone: true };
    await lib.db.set('tracks', merged.key, merged);
    tracks.value = tracks.value.map(x => x.key === merged.key ? merged : x);
  } catch {
    const merged = { ...cur, metaDone: true };   // don't retry a file we can't read
    await lib.db.set('tracks', merged.key, merged);
    tracks.value = tracks.value.map(x => x.key === merged.key ? merged : x);
  }
}

// ── file access ──────────────────────────────────────────────────────────

/** the File object for a track, read from disk on demand (playback, re-tag) */
export async function fileAt (track) {
  const s = lib.sourceById(track.sourceId);
  if (!s) throw new Error('folder is gone');
  return lib.fileAt(s, track.path);
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
