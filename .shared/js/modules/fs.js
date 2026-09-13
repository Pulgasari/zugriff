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

  if (platform === 'cap') return cap.pick();
  if (platform === 'web') return await window.showDirectoryPicker({ id, mode, startIn });
}

const cap = {};
const web = {};


cap.pick = async () => {
  try {
    const res = await FilePicker().pickDirectory(); // persists the grant on android
    const uri = res?.path ?? res?.uri;
    if (!uri) return null;
    return new CapDirHandle(uri, nameFromUri(uri));
  } catch (err) {
    if (/cancel/i.test(err?.message || '')) return null;     // normalise user-cancel to null
    throw err;
  }
}

