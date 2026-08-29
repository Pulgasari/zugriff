// shared/js/filesystem/platform.js
//
// the one place that knows which platform we are on, so the rest of the
// filesystem layer does not have to. two things genuinely differ between a
// browser and the Capacitor wrapper:
//
//   1. picking a folder   — showDirectoryPicker() vs the native SAF picker
//   2. persisting a root  — a browser handle is structured-cloneable and round-
//                           trips through IndexedDB as-is; a native CapDirHandle
//                           is not, so we store a plain { uri } descriptor and
//                           rebuild the handle on load.
//
// everything else (walking, reading, writing) is the shared handle interface,
// which the Capacitor shim (cap-fs.js) also implements — so no other module
// branches on platform.
//
// hydrate/dehydrate are deliberately platform-agnostic: they key off the *value*
// (is this a CapDirHandle / a { __capfs } descriptor?), not off isNative(). that
// keeps them correct no matter what, and makes the web path a pure identity — so
// existing browser records and behaviour are completely untouched.

import { isCapacitor, CapDirHandle, pickDirectory as capPick, hydrate as capHydrate, dehydrate as capDehydrate } from './cap-fs.js';

/** running inside the native Capacitor wrapper (vs a plain browser)? */
export const isNative = isCapacitor;

/** can this platform grant a folder at all? */
export function supported () {
  return isNative()
    ? true
    : (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function');
}

/**
 * open the folder picker → a live directory handle, or null if cancelled.
 * on the web this is showDirectoryPicker (and must run inside a user gesture);
 * on native it is the SAF picker, which persists the grant so it survives
 * restarts. the returned object satisfies the same handle interface either way.
 */
export async function pick ({ id, mode = 'read', startIn } = {}) {
  if (isNative()) return capPick();
  if (!supported()) throw new Error('This browser cannot open a folder — try a Chromium-based one.');
  try {
    return await window.showDirectoryPicker({ id, mode, startIn });
  } catch (err) {
    if (err?.name === 'AbortError') return null;   // the user dismissed the picker
    throw err;
  }
}

const isCapRef = v => v && typeof v === 'object' && v.__capfs === true;

/** a stored root descriptor -> a live handle (web: identity) */
export const hydrate = ref => (isCapRef(ref) ? capHydrate(ref) : ref);

/** a live handle -> the structured-cloneable thing we persist (web: identity) */
export const dehydrate = handle => (handle instanceof CapDirHandle ? capDehydrate(handle) : handle);
