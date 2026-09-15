// fs.js

const getPlatform = () => {
  const bool = !!globalThis.Capacitor?.isNativePlatform?.();
  return bool ? 'cap' : 'web';
}

function isSupported () {
  const platform = getPlatform();

  switch (platform) {
    case 'cap' : return true;
    case 'web' : return (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function');      
  }
}

async function pick ({ id, mode = 'read', startIn } = {}) {
  const platform = getPlatform();

  if (platform === 'cap') return capFS.pick();
  if (platform === 'web') return webFS.pick({ id, mode, startIn });
}

// capacitor / android

// name a tree URI for display: decode its last path segment, which for a SAF tree
// URI is the document id (e.g. "primary:Music") — take the part after ':'.
function nameFromUri (uri) {
  try {
    const last = decodeURIComponent(uri.replace(/\/+$/, '').split('/').pop() || '');
    const tail = last.split(':').pop();
    return tail || last || 'folder';
  } catch { return 'folder'; }
 }

const cap = {};

cap.pick = async () => {
  try {
    const res = await FilePicker().pickDirectory(); // persists the grant on android
    const uri = res?.path ?? res?.uri;
    return !uri ? null : new CapDirHandle (uri, nameFromUri(uri));
  }
  catch (err) {
    if (/cancel/i.test(err?.message || '')) return null;     // normalise user-cancel to null
    throw err;
  }
}

// web / browser

const webFS = {};

webFS.pick = async function ({ id, mode = 'read', startIn } = {}) {
  if (!supported()) throw new Error('This browser cannot open a folder — try a Chromium-based one.');
  try           { return await window.showDirectoryPicker({ id, mode, startIn }); }
  catch (error) { if (error?.name === 'AbortError') return null; throw error; }
}

