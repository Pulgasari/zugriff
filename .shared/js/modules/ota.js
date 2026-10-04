// .shared/js/modules/ota.js
// live updates of the web part, for the android build `capacitor` (variant 4,
// .github/scripts/android.js). the apk ships a bundle of its own; newer ones are
// published per app by .github/workflows/ota-publish.yml and pulled in here
// through @capgo/capacitor-updater in manual mode.
//
// every staged www/ carries an ota.json: { slug, version, manifest }. version is
// the build's minute (202610041212), manifest the url of the newest bundle's
// ota.json, { version, url }. a newer one is downloaded now and becomes the app
// on the next start. without the plugin (the web, the live and bundle builds)
// this does nothing.

import { getJson } from './http.js';

const updater = () => globalThis.Capacitor?.Plugins?.CapacitorUpdater ?? null;

// the bundle on screen tells its own version and where to look for newer ones
const own = () => fetch('/ota.json', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).catch(() => null);

async function check () {
  const plugin = updater();
  if (!plugin) return null;

  // the bundle started fine. without this the plugin rolls back after 10 seconds
  await plugin.notifyAppReady();

  const current = await own();
  if (!current?.manifest) return null;

  const latest = await getJson(current.manifest).catch(() => null);
  // versions are minutes, yyyymmddhhmm, so a string compare orders them
  if (!latest?.version || !latest.url || String(latest.version) <= String(current.version)) return null;

  const { bundles = [] } = await plugin.list();
  const bundle = bundles.find(entry => entry.version === latest.version && entry.status === 'success')
    ?? await plugin.download({ url: latest.url, version: latest.version });

  await plugin.next({ id: bundle.id });
  return latest.version;
}

// never throws: an update that fails leaves the app as it is
const ota = () => check().catch(error => { console.warn('[ota] update check failed:', error); return null; });

export { ota };
export default ota;
