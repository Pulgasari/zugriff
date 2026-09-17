// fs.js

export * from './filesystem/handles.js';
export * from './filesystem/platform.js';

/*
const isString = sth => typeof sth === 'string';

const getPlatform = () => !!globalThis.Capacitor?.isNativePlatform?.() ? 'cap' : 'web';
const PLATFORM    = getPlatform();

function isSupported () {
  if (PLATFORM === 'cap') return true;
  if (PLATFORM === 'web') return (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function');
}

async function pick ({ id, mode = 'read', startIn } = {}) {
  if (PLATFORM === 'cap') return capFS.pick();
  if (PLATFORM === 'web') return webFS.pick({ id, mode, startIn });
}
*/
