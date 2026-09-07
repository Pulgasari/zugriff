// apps/files/app.js
// the files app on the shared handle. the runtime binds zugriff (+ zugriff.app, html) to
// window before this runs, so nothing here imports the runtime. a live, read-only view onto
// one granted folder through the shared FileExplorer; the granted folder lives in the db
// module. the app draws its own chrome and owns the #app root.

// ::: shared components
import Button       from '/.shared/js/components/Button.js';
import FileExplorer from '/.shared/js/components/FileExplorer.js';
import Icon         from '/.shared/js/components/Icon.js';
import InstallTip   from '/.shared/js/components/InstallTip.js';

// ::: vendors
import { computed }  from '@aufbau/signals';
import { useEffect } from 'preact/hooks';

// ::: app modules
import * as db from './modules/db.js';

// ::: the app handle
const app = zugriff.app;
app.db = db;

const { fs } = zugriff;

// :::::: BACKEND
// the granted folder described for FileExplorer. read-only for now (picked as mode:'read')
// — browse, preview, download; write is a later step. the id keys off the grant time so
// switching folders remounts the explorer at its new root.
const backend = computed(() => {
  const f = db.folder.value;
  if (!f || db.perm.value !== 'granted') return null;
  return { id: 'disk:' + f.addedAt, label: f.name, writable: false, supported: fs.supported, getRoot: () => f.handle };
});

// :::::: ACTIONS

async function chooseFolder () {
  if (!fs.supported()) return;
  try         { await db.grant(); }
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
      <${Icon} name="folder-open" />
      <h1>Browse a folder</h1>
      <p>Pick a folder from your device — it becomes the root of the explorer.
         Nothing is uploaded and nothing is copied; everything stays on your
         machine.</p>
      <button class="fe-btn primary" onClick=${chooseFolder}>
        <${Icon} name="folder-add" /> Open a folder</button>
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
        <${Button} class="primary" icon="mdi:folder-key-outline" label='Reconnect' onClick=${tryReconnect} />
        <${Button} class="ghost" icon='mdi:folder-search-outline' label='Choose folder'
          title="Re-select the folder — always works" onClick=${chooseFolder} />
      </div>
    </div>`;
}

function Sidebar () {
  const f = db.folder.value;
  return html`
    <aside class="sidebar">
      <div class="brand">
        <${Icon} name="folder" /> <span>Files</span>
      </div>

      <div class="fe-current">
        <span class="fe-current-label">open folder</span>
        <div class="fe-current-name" title=${f.name}>
          <${Icon} name="folder-open" /> <span>${f.name}</span>
        </div>
        <div class="fe-current-actions">
          <button class="fe-btn small" onClick=${chooseFolder}>
            <${Icon} name="mdi:folder-swap-outline" /> Change</button>
          <button class="fe-btn small ghost" onClick=${closeFolder}>
            <${Icon} name="close" /> Close</button>
        </div>
      </div>

      <div class="fe-side-foot">
        <${InstallTip} />
      </div>
    </aside>`;
}

// :::::: APP

const isNotSupported = () => !fs.supported();
const isLoading      = () => !db.ready.value;
const isWelcome      = () => !db.folder.value;
const isNotGranted   = () => db.perm.value !== 'granted';

function App () {
  useEffect(() => { db.load().catch(err => console.warn('[files] load failed', err)); }, []);

  return html`
    <>${
        isNotSupported() ? html`<${Unsupported} />`
      : isLoading()      ? html`<${Icon} name='loading' />`
      : isWelcome()      ? html`<${Welcome} />`
      : isNotGranted()   ? html`<${Reconnect} />`
      : html`
        <${Sidebar} />
        <main id="app-main"><${FileExplorer} backend=${backend.value} /></main>`
    }</>`;
}

// :::::: BOOT

app.init({ App });
