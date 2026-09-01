// shared/js/lib/pwa.js

// install-to-home-screen plumbing, shared by the apps that grant on-disk
// folders. it exists for one practical reason: the File System Access API only
// *persists* a granted folder across sessions once the app is an installed PWA
// (Chrome/Edge "Allow on every visit"). in a plain browser tab the permission
// is dropped when the tab's session ends and has to be re-granted every visit —
// by design. so "install the app" is the real cure for having to reconnect.
//
//   import { canInstall, installed, promptInstall } from '.../lib/pwa.js';
//
// `canInstall`      — the browser fired beforeinstallprompt and we can show a button.
// `installed`       — running as an installed/standalone app already.
// `promptInstall()` — show the native install prompt (needs a user gesture).

import { signal } from '@aufbau/kits/preact-htm';

const standalone = () =>
  (typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)')?.matches ||
    window.navigator?.standalone === true));

export const canInstall = signal(false);
export const installed  = signal(standalone());

let deferred = null;

if (typeof window !== 'undefined') {
  // chrome/edge/android fire this when the app meets the install criteria and
  // isn't installed yet; we stash it so a button can trigger it on demand
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    canInstall.value = !installed.value;
  });

  window.addEventListener('appinstalled', () => {
    installed.value  = true;
    canInstall.value = false;
    deferred = null;
  });

  window.matchMedia?.('(display-mode: standalone)')
    ?.addEventListener?.('change', e => {
      if (e.matches) { installed.value = true; canInstall.value = false; }
    });
}

/** show the native install prompt. resolves true if the user accepted. */
export async function promptInstall () {
  if (!deferred) return false;
  const evt = deferred;
  deferred = null;
  canInstall.value = false;
  try {
    evt.prompt();
    const { outcome } = await evt.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  }
}
