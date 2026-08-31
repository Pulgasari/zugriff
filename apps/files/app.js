// apps/files/app.js

// :::::: IMPORTS

// ::: vendors
import { html, computed, useEffect } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot, config }  from '/.shared/js/app.js?slug=files';
import { Icon, FileExplorer, AppSettings } from '/.shared/js/components/index.js';
import * as fs   from '/.shared/js/filesystem/fsaccess.js';
import * as pwa  from '/.shared/js/lib/pwa.js';

// ::: local
import * as db   from './db.js';

// :::::: BACKEND

// the granted folder, described for the FileExplorer component. read-only for
// now (the folder is picked with mode:'read') — you browse, preview and
// download; granting write is a later step. the id keys off the grant time so
// switching to a different folder remounts the explorer at its new root.
const backend = computed(() => {
  const f = db.folder.value;
  if (!f || db.perm.value !== 'granted') return null;
  return {
    id       : 'disk:' + f.addedAt,
    label    : f.name,
    writable : false,
    supported: fs.supported,
    getRoot  : () => f.handle,
  };
});

// :::::: ACTIONS

async function chooseFolder () {
  if (!fs.supported()) return;
  try { await db.grant(); }
  catch (err) { console.warn('[files] grant failed', err); }
}

async function tryReconnect () {
  const res = await db.reconnect();
  if (!res.granted) await chooseFolder();   // fall back to the reliable re-pick
}

async function closeFolder () {
  if (!confirm('Close this folder? Your files are untouched — this only forgets it.')) return;
  await db.forget();
}

// :::::: SCREENS

// no File System Access at all in this browser
function Unsupported () {
  return html`
    <div class="fe-hero">
      <${Icon} name="mdi:folder-alert-outline" />
      <h1>Can't open folders here</h1>
      <p>This browser doesn't support the File System Access API, so the explorer
         has no folder to open. Try a recent Chromium-based browser (Chrome, Edge,
         Brave, Arc…).</p>
    </div>`;
}

// nothing granted yet — the first-run welcome
function Welcome () {
  return html`
    <div class="fe-hero">
      <${Icon} name="mdi:folder-open-outline" />
      <h1>Browse a folder</h1>
      <p>Pick a folder from your device — it becomes the root of the explorer.
         Nothing is uploaded and nothing is copied; everything stays on your
         machine.</p>
      <button class="fe-btn primary" onClick=${chooseFolder}>
        <${Icon} name="mdi:folder-plus-outline" /> Open a folder</button>
    </div>`;
}

// a folder is remembered but the browser wants permission again
function Reconnect () {
  const denied = db.perm.value === 'denied';
  return html`
    <div class="fe-hero">
      <${Icon} name="mdi:folder-key-outline" />
      <h1>Reconnect “${db.folder.value.name}”</h1>
      <p>${denied
          ? 'Permission for this folder was blocked. Re-pick it to browse again.'
          : 'This folder needs permission again for this visit.'}</p>
      <div class="fe-hero-actions">
        <button class="fe-btn primary" onClick=${tryReconnect}>
          <${Icon} name="mdi:folder-key-outline" /> Reconnect</button>
        <button class="fe-btn ghost" title="Re-select the folder — always works"
                onClick=${chooseFolder}>
          <${Icon} name="mdi:folder-search-outline" /> Choose folder</button>
      </div>
    </div>`;
}

// the folder-perms-persist-if-installed nudge, same idea as notes/ebooks
function InstallTip () {
  if (pwa.installed.value) return null;
  return html`
    <div class="fe-tip">
      <${Icon} name="mdi:information-outline" />
      <div class="fe-tip-body">
        <span>Install the app so your folder stays connected between visits.</span>
        ${pwa.canInstall.value
          ? html`<button class="fe-btn small primary" onClick=${() => pwa.promptInstall()}>
              <${Icon} name="mdi:download" /> Install app</button>`
          : html`<span class="fe-tip-hint">Use your browser's <b>Install</b> / <b>Add to Home screen</b> menu.</span>`}
      </div>
    </div>`;
}

function Sidebar () {
  const f = db.folder.value;
  return html`
    <aside class="fe-side">
      <div class="fe-brand">
        <${Icon} name="mdi:folder-outline" /> <span>Files</span>
      </div>

      <div class="fe-current">
        <span class="fe-current-label">open folder</span>
        <div class="fe-current-name" title=${f.name}>
          <${Icon} name="mdi:folder-open-outline" /> <span>${f.name}</span>
        </div>
        <div class="fe-current-actions">
          <button class="fe-btn small" onClick=${chooseFolder}>
            <${Icon} name="mdi:folder-swap-outline" /> Change</button>
          <button class="fe-btn small ghost" onClick=${closeFolder}>
            <${Icon} name="mdi:close" /> Close</button>
        </div>
      </div>

      <div class="fe-side-foot">
        <${InstallTip} />
      </div>
    </aside>`;
}

// :::::: APP

function App () {
  useEffect(() => { db.load().catch(err => console.warn('[files] load failed', err)); }, []);

  if (!fs.supported())  return html`<div class="fe-app centered"><${Unsupported} /></div>`;
  if (!db.ready.value)  return html`<div class="fe-app centered"><div class="fe-booting"><${Icon} name="svg-spinners:bars-scale-middle" /></div></div>`;
  if (!db.folder.value) return html`<div class="fe-app centered"><${Welcome} /></div>`;
  if (db.perm.value !== 'granted') return html`<div class="fe-app centered"><${Reconnect} /></div>`;

  return html`
    <div class="fe-app">
      <${Sidebar} />
      <main class="fe-main">
        <${FileExplorer} backend=${backend.value} />
      </main>
    </div>`;
}

// :::::: BOOT

boot({ config, App });
