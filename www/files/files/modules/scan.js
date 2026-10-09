// files :: modules/scan.js
// the whole granted folder, walked in the background: what the dashboard shows
// (categories, recent files) and what its search goes through.
//
// a walk reads every file's size, type and modification time, which takes a
// while in a big folder. so the last index is kept in opfs and shown at once,
// a fresh walk replaces it when it is done. one walk at a time, a new one
// aborts the running one. dot folders and node_modules are skipped.
//
//   restore(folder)        the stored index of that folder, into `index`
//   scan(root, folder)     walks, then stores and publishes the new index
//   search(query, limit)   the indexed files whose name contains the query
//
// index:    { scannedAt, total, size, categories: { [id]: { count, size } }, recent: [entry], files: [entry] }
// entry:    { name, path: ['a', 'b'], size, lastModified, type }
// scanning: null, or { files } while a walk runs

import createOpfs from '@bunker/opfs';
import { signal } from '@aufbau/signals';

// :::::: CATEGORIES ::::::::::::::::::::::::::::::::::::::::::::

export const CATEGORIES = [
  { id: 'images',    label: 'Images',    icon: 'lucide:image'        },
  { id: 'audio',     label: 'Audio',     icon: 'lucide:music'        },
  { id: 'video',     label: 'Videos',    icon: 'lucide:film'         },
  { id: 'documents', label: 'Documents', icon: 'lucide:file-text'    },
  { id: 'archives',  label: 'Archives',  icon: 'lucide:file-archive' },
  { id: 'other',     label: 'Other',     icon: 'lucide:file'         },
];

const DOCUMENTS = /^(pdf|txt|md|rtf|odt|doc|docx|xls|xlsx|ods|ppt|pptx|odp|csv|epub|html?|json|xml)$/;
const ARCHIVES  = /^(zip|rar|7z|tar|gz|bz2|xz|zst)$/;

const extOf = name => { const dot = name.lastIndexOf('.'); return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''; };

/** the category id of a file, by its mime type and, where that is empty, its extension */
export function categoryOf ({ name, type = '' }) {
  const ext = extOf(name);
  if (type.startsWith('image/')) return 'images';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('text/') || DOCUMENTS.test(ext)) return 'documents';
  if (ARCHIVES.test(ext)) return 'archives';
  return 'other';
}

// :::::: STATE :::::::::::::::::::::::::::::::::::::::::::::::::

export const index    = signal(null);
export const scanning = signal(null);

const RECENT = 24;
const SKIP   = name => name.startsWith('.') || name === 'node_modules';

const store = createOpfs({ directory: 'zugriff/files' });
const keyOf = folder => `index-${folder.addedAt ?? folder.name}`;

let running = null;

// :::::: WALK ::::::::::::::::::::::::::::::::::::::::::::::::::

async function walk (handle, path, files, signal) {
  const dirs  = [];
  const reads = [];

  for await (const [name, child] of handle.entries()) {
    if (signal.aborted) throw new DOMException('scan aborted', 'AbortError');
    if (SKIP(name)) continue;
    if (child.kind === 'directory') dirs.push([name, child]);
    else reads.push(child.getFile().then(
      file => ({ name, path, size: file.size, lastModified: file.lastModified, type: file.type }),
      ()   => null,   // gone or unreadable in the meantime
    ));
  }

  // the files of one folder side by side, the folders one after the other
  for (const entry of await Promise.all(reads)) if (entry) files.push(entry);
  scanning.value = { files: files.length };

  for (const [name, child] of dirs) await walk(child, [...path, name], files, signal);
}

function summarize (files) {
  const categories = Object.fromEntries(CATEGORIES.map(({ id }) => [id, { count: 0, size: 0 }]));
  let size = 0;

  for (const file of files) {
    const category = categories[categoryOf(file)];
    category.count++;
    category.size += file.size;
    size          += file.size;
  }

  const recent = [...files].sort((a, b) => b.lastModified - a.lastModified).slice(0, RECENT);
  return { categories, files, recent, scannedAt: Date.now(), size, total: files.length };
}

// :::::: API :::::::::::::::::::::::::::::::::::::::::::::::::::

export async function restore (folder) {
  if (!folder) { index.value = null; return null; }
  const stored = await store.get(keyOf(folder)).catch(() => null);
  index.value = stored ?? null;
  return stored;
}

export async function scan (root, folder) {
  running?.abort();
  const controller = new AbortController();
  running = controller;

  const files = [];
  scanning.value = { files: 0 };

  try {
    await walk(root, [], files, controller.signal);
    const next = summarize(files);
    index.value = next;
    await store.set(keyOf(folder), next);
    return next;
  }
  catch (err) {
    if (err?.name !== 'AbortError') throw err;
    return null;
  }
  finally {
    if (running === controller) { running = null; scanning.value = null; }
  }
}

export function stop () {
  running?.abort();
}

export async function forget (folder) {
  stop();
  index.value = null;
  if (folder) await store.delete(keyOf(folder)).catch(() => {});
}

export function search (query, limit = 100) {
  const needle = query.trim().toLowerCase();
  const files  = index.value?.files ?? [];
  if (!needle) return [];

  const hits = [];
  for (const file of files) {
    if (file.name.toLowerCase().includes(needle)) hits.push(file);
    if (hits.length >= limit) break;
  }
  return hits;
}
