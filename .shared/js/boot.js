// .shared/js/boot.js
// the classic <head> script of every page, after data/importmap.js

(() => {

const $root  = document.documentElement;
const script = document.currentScript;
const create = (tag, props) => Object.assign(document.createElement(tag), props);

// ::: dev. ?dev turns it on for the tab, ?dev=off or ?dev=0 off again
const DEV = 'zugriff:devtools';

function devMode () {
  try {
    const param = new URLSearchParams(location.search).get('dev');
    if (param === 'off' || param === '0') sessionStorage.removeItem(DEV);
    else if (param !== null)              sessionStorage.setItem(DEV, '1');
    return sessionStorage.getItem(DEV) === '1';
  }
  catch { return false; }   // storage blocked
}

// ::: gestalt. the stored palette, density and geometry of the app before the first paint
function applyGestalt () {
  const slug = $root.dataset.app;
  if (!slug) return;

  for (const token of ['density', 'geometry', 'palette']) {
    try {
      const value = JSON.parse(localStorage.getItem(`zugriff:${slug}:${token}`));
      if (typeof value !== 'string' || !value) continue;
      $root.style.setProperty(`--${token}`, value);
      $root.dataset[token] = value;
    }
    catch {}   // storage blocked, a broken value
  }
}

// ::: importmap. a bundle lays its local entries over the map (bundler.config.js)
function injectImportmap () {
  const imports = { ...globalThis.__IMPORTMAP__, ...globalThis.__BOOT_CONFIG__?.imports };
  script.after(create('script', { type: 'importmap', textContent: JSON.stringify({ imports }) }));
}

// :::::: RUN

const dev = devMode();

// the recorder has to run before anything else, and synchronously
if (dev) document.write('<script src="https://code.pulgasari.dev/aufbau/devtools/recorder.js"><\/script>');

applyGestalt();
injectImportmap();

window.__ZUGRIFF_READY__ = import('./runtime.js');
window.__ZUGRIFF_READY__.catch(error => console.error('[boot] runtime failed:', error));

window.addEventListener('load', () => {
  navigator.serviceWorker?.register('/sw.js', { type: 'module' })
    .catch(error => console.warn('[boot] service worker failed:', error));
});

if (dev) {
  document.head.append(create('script', { src: 'https://cdn.jsdelivr.net/npm/eruda@3', onload: () => window.eruda?.init() }));
  window.__ZUGRIFF_READY__.then(() => import('@aufbau/devtools/boot.js'))
    .catch(error => console.error('[boot] devtools failed:', error));
}

})();
