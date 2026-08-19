// shared/js/lib/fsaccess.js
//
// the File System Access side of things — the counterpart to fs.js / vfs.js.
// where those wrap the *private* OPFS the cli owns, this wraps a folder the
// user hands us from their real disk with showDirectoryPicker(). the handle it
// returns is structured-cloneable, so an app persists it in its own @bunker/db
// and re-authorises it on the next load; this module is only the picker, the
// permission dance and the recursive walk. no storage, no ui.
//
// a "path" here is a forward-slash string relative to the granted root, e.g.
// "journal/2026/entry.md". the root itself has path "".

export const supported = () =>
  typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

/** open the OS folder picker. resolves to a handle, or null if the user cancels. */
export async function pickDirectory ({ id, mode = 'read', startIn } = {}) {
  if (!supported()) throw new Error('This browser cannot open a folder — try a Chromium-based one.');
  try {
    return await window.showDirectoryPicker({ id, mode, startIn });
  } catch (err) {
    if (err?.name === 'AbortError') return null;   // the user dismissed the picker
    throw err;
  }
}

/** the current permission state without prompting: 'granted' | 'prompt' | 'denied' */
export async function queryPermission (handle, mode = 'read') {
  if (!handle?.queryPermission) return 'granted';   // no gate on this platform
  try { return await handle.queryPermission({ mode }); }
  catch { return 'denied'; }
}

/**
 * make sure we may read `handle`, prompting if needed. requestPermission must
 * run inside a user gesture, so call this from a click, never at load.
 */
export async function ensurePermission (handle, mode = 'read') {
  if (!handle?.queryPermission) return true;
  if (await handle.queryPermission({ mode }) === 'granted') return true;
  try { return (await handle.requestPermission({ mode })) === 'granted'; }
  catch { return false; }
}

// ── walking ──────────────────────────────────────────────────────────────

export const extOf = name => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

const byName = (a, b) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

/**
 * walk `dirHandle` recursively into a tree that mirrors the folder structure.
 * only files for which `accept(name)` is true are kept, and a directory that
 * ends up with no accepted file anywhere beneath it is pruned — so the tree is
 * exactly the shape of the content, never an empty scaffold. dot-files and
 * dot-folders are skipped.
 *
 * node shapes:
 *   dir  : { kind:'dir',  name, path, handle, children:[…] }
 *   file : { kind:'file', name, path, ext, handle }
 *
 * children are directories first, then files, each sorted naturally by name.
 */
export async function scanTree (dirHandle, { accept = () => true, signal } = {}) {
  const walk = async (handle, prefix) => {
    const dirs = [], files = [];

    for await (const [name, child] of handle.entries()) {
      if (signal?.aborted) throw new DOMException('scan aborted', 'AbortError');
      if (name.startsWith('.')) continue;
      const path = prefix ? `${prefix}/${name}` : name;

      if (child.kind === 'directory') {
        const node = await walk(child, path);
        if (node.children.length) dirs.push(node);
      } else if (accept(name)) {
        files.push({ kind: 'file', name, path, ext: extOf(name), handle: child });
      }
    }

    dirs.sort(byName); files.sort(byName);
    return { kind: 'dir', name: handle.name, path: prefix, handle, children: [...dirs, ...files] };
  };

  return walk(dirHandle, '');
}

/** every file node in a tree, depth-first, as a flat array */
export function flatten (node, out = []) {
  if (!node) return out;
  if (node.kind === 'file') out.push(node);
  else for (const child of node.children ?? []) flatten(child, out);
  return out;
}

/** count the file nodes beneath a tree */
export const countFiles = node => flatten(node).length;

/**
 * resolve a relative path (as written inside a file, e.g. "../img/cover.png")
 * against the directory that holds `fromPath`, returning the file handle or
 * null. used to load a note's sibling images from the same granted folder.
 */
export async function resolveRelative (rootHandle, fromPath, relative) {
  if (!relative || /^([a-z]+:)?\/\//i.test(relative) || relative.startsWith('data:')) return null;

  const base = fromPath.split('/').slice(0, -1);            // the file's own directory
  const segs = decodeURI(relative.split(/[?#]/)[0]).split('/');
  const parts = [...base];
  for (const seg of segs) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  if (!parts.length) return null;

  try {
    let dir = rootHandle;
    for (const seg of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(seg);
    return await dir.getFileHandle(parts.at(-1));
  } catch {
    return null;
  }
}
