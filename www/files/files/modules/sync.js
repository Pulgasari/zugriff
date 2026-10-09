// files :: modules/sync.js
// sending files to another device on the local network, LocalSend v2: any
// LocalSend app receives them, or the filesync desktop daemon. the network part
// is native (the FileSync plugin, .github/capacitor/plugins/filesync/): udp
// multicast, http(s) to a lan address and a self-signed certificate are nothing
// a web page may do. so this only works in the android app; `available` says so.
//
//   devices    the receivers discovery found, newest first
//   targets    the receivers sent to before, kept across visits
//   outbox     the files waiting to be sent: [{ mime, name, size, uri }]
//   send(target, files)   one task in the 'send' lane, progress in bytes
//
// a file of the library becomes an outbox entry through its content:// uri,
// which the android folder shim (filesystem/platform.js) keeps on every handle.
// the receiver may want a pin: send() asks for it and tries once more.

import { signal } from '@aufbau/signals';

const app = zugriff.app;
const fs  = zugriff.fs;

const plugin = () => globalThis.Capacitor?.Plugins?.FileSync ?? null;

export const available = () => Boolean(plugin());

// :::::: STATE :::::::::::::::::::::::::::::::::::::::::::::::::

export const PROTOCOLS = ['https', 'http'];
const PORT    = 53317;
const STORAGE = 'zugriff:files:sync';

const stored = (() => { try { return JSON.parse(localStorage.getItem(STORAGE)) ?? {}; } catch { return {}; } })();

export const devices   = signal([]);
export const targets   = signal(Array.isArray(stored.targets) ? stored.targets : []);
export const outbox    = signal([]);
export const identity  = signal(null);
export const autoSync  = signal(null);   // the native service's state, null until read

// the native side keeps the auto sync folder as a uri only, its name is kept here
let folderName = stored.folderName ?? '';

const persist = () => { try { localStorage.setItem(STORAGE, JSON.stringify({ folderName, targets: targets.value })); } catch {} };

// :::::: TARGETS :::::::::::::::::::::::::::::::::::::::::::::::

/**
 * what the user typed into a target: an address with or without a port, or the
 * filesync:// uri the desktop shows (it carries protocol and fingerprint). null
 * when there is nothing to send to
 */
export function parseTarget (raw, protocol = 'https') {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  if (text.includes('://')) {
    try {
      const url = new URL(text.replace(/^filesync:\/\//, 'http://'));
      const own = url.searchParams.get('protocol');
      return {
        fingerprint : url.searchParams.get('fingerprint') ?? '',
        host        : url.hostname,
        port        : Number(url.port) || PORT,
        protocol    : PROTOCOLS.includes(own) ? own : protocol,
      };
    }
    catch { return null; }
  }

  const [host, port] = text.split(':');
  return { fingerprint: '', host, port: Number(port) || PORT, protocol };
}

const label = target => target.alias ?? `${target.host}:${target.port}`;

function remember (target) {
  const rest = targets.value.filter(other => !(other.host === target.host && other.port === target.port));
  targets.value = [{ alias: target.alias, fingerprint: target.fingerprint, host: target.host, port: target.port, protocol: target.protocol }, ...rest].slice(0, 8);
  persist();
}

export function forget (target) {
  targets.value = targets.value.filter(other => !(other.host === target.host && other.port === target.port));
  persist();
}

// :::::: DISCOVERY :::::::::::::::::::::::::::::::::::::::::::::

let listening = false;

export async function start () {
  const native = plugin();
  if (!native) return;

  if (!listening) {
    listening = true;
    native.addListener('device', device => {
      if (!device?.ip) return;
      const key  = device.fingerprint || device.ip;
      devices.value = [device, ...devices.value.filter(other => (other.fingerprint || other.ip) !== key)];
    });
    identity.value = await native.getIdentity().catch(() => null);
  }

  await native.startDiscovery().catch(err => console.warn('[files] discovery failed', err));
  await refreshAutoSync();
}

export const stop = () => plugin()?.stopDiscovery().catch(() => {});

// :::::: OUTBOX ::::::::::::::::::::::::::::::::::::::::::::::::

const add = files => {
  const known = new Set(outbox.value.map(file => file.uri));
  outbox.value = [...outbox.value, ...files.filter(file => file.uri && !known.has(file.uri))];
};

export async function pickFiles () {
  const { files = [] } = await plugin().pickFiles();
  add(files);
}

// an entry of the granted folder, by the content uri its android handle carries
export async function addEntry (root, path, entry) {
  const handle = await (await fs.dirAt(root, path)).getFileHandle(entry.name);
  if (!handle._uri) throw new Error('only files of the folder on this device can be sent');
  add([{ mime: entry.type || 'application/octet-stream', name: entry.name, size: entry.size ?? -1, uri: handle._uri }]);
}

export const remove = uri => { outbox.value = outbox.value.filter(file => file.uri !== uri); };
export const clear  = () => { outbox.value = []; };

// :::::: SEND ::::::::::::::::::::::::::::::::::::::::::::::::::

const isPinError = err => err?.code === 'PIN_REQUIRED' || /\bpin\b/i.test(err?.message ?? '');

export function send (target, files = outbox.value, pin = '') {
  const native = plugin();
  if (!native || !target || !files.length) return Promise.resolve(null);

  const count = files.length;
  const what  = count === 1 ? files[0].name : `${count} files`;

  return app.tasks.run({ icon: 'lucide:send', label: `Send ${what} to ${label(target)}`, lane: 'send' }, async ({ progress }) => {
    const listener = await native.addListener('progress', event => progress(event.sent, event.total));
    try {
      const attempt = secret => native.send({ files, fingerprint: target.fingerprint ?? '', host: target.host, pin: secret, port: target.port, protocol: target.protocol });
      try   { await attempt(pin); }
      catch (err) {
        if (!isPinError(err)) throw err;
        const asked = prompt(`${label(target)} wants a pin`);
        if (!asked) throw new Error('no pin given');
        await attempt(asked);
      }
      remember(target);
      outbox.value = outbox.value.filter(file => !files.includes(file));
    }
    finally { listener.remove(); }
  });
}

// :::::: AUTO SYNC :::::::::::::::::::::::::::::::::::::::::::::
// a folder of the device, sent on its own whenever new files show up and the
// phone is on wi-fi (optionally one network only). the native service keeps
// running without the app; this only configures and reads it.

export async function refreshAutoSync () {
  const state = await plugin()?.getAutoSyncState().catch(() => null) ?? null;
  autoSync.value = state && { ...state, name: state.tree ? folderName : '' };
}

export async function pickSyncFolder () {
  const { name, uri } = await plugin().pickFolder();
  if (!uri) return;
  folderName     = name ?? '';
  autoSync.value = { ...autoSync.value, name: folderName, tree: uri };
  persist();
}

export async function startAutoSync (target, { pin = '', ssid = '' } = {}) {
  const tree = autoSync.value?.tree;
  if (!tree) throw new Error('pick a folder first');
  await plugin().startAutoSync({ fingerprint: target.fingerprint ?? '', host: target.host, pin, port: target.port, protocol: target.protocol, ssid, tree });
  await refreshAutoSync();
}

export async function stopAutoSync () {
  await plugin().stopAutoSync();
  await refreshAutoSync();
}

export const syncNow = () => plugin()?.syncNow();
