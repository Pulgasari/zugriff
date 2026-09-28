// apps/files/app.js
// the files app on the shared handle. the runtime binds zugriff (+ zugriff.app, html) to
// window before this runs, so nothing here imports the runtime. a live, read-only view onto
// one granted folder through the shared FileExplorer; the granted folder lives in the db
// module. the app draws its own chrome and owns the #app root.

// ::: shared components
import Brand        from '/.shared/js/components/Brand.js';
import Button       from '/.shared/js/components/Button.js';
import FileExplorer from '/.shared/js/components/FileExplorer.js';
import Icon         from '/.shared/js/components/Icon.js';
import IconButton   from '/.shared/js/components/IconButton.js';
import InstallTip   from '/.shared/js/components/InstallTip.js';
import Sidebar      from '/.shared/js/components/Sidebar.js';

// ::: vendors
import { computed }  from '@aufbau/signals';
import { useEffect } from 'preact/hooks';

// ::: the app handle
const app = zugriff.app;
app.db = await app.module('db');

const { fs } = zugriff;

// the sidebar is a drawer on a phone
app.state.$extend({ isNavOpen: { type: 'scalar', value: false } });

const closeNav = () => app.state.isNavOpen = false;
const openNav  = () => app.state.isNavOpen = true;

// :::::: BACKEND
const backend = computed(() => {
  const f = app.db.folder.value;
  if (!f || app.db.perm.value !== 'granted') return null;
  return { id: 'disk:' + f.addedAt, label: f.name, writable: false, supported: fs.supported, getRoot: () => f.handle };
});

// :::::: ACTIONS

async function chooseFolder () {
  if (!fs.supported()) return;
  try         { await app.db.grant(); }
  catch (err) { console.warn('[files] grant failed', err); }
}

async function tryReconnect () {
  const res = await app.db.reconnect();
  if (!res.granted) await chooseFolder();   // fall back to the reliable re-pick
}

async function closeFolder () {
  if (!confirm('Close this folder? Your files are untouched — this only forgets it.')) return;
  await app.db.forget();
}

// :::::: SCREENS

// no File System Access at all in this browser
function Unsupported () {
  return html`
    <div class="fe-hero">
      <${Icon} name='alert' />
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
  const denied = app.db.perm.value === 'denied';
  return html`
    <div class="fe-hero">
      <${Icon} name='folder-key' />
      <h1>Reconnect “${app.db.folder.value.name}”</h1>
      <p>${denied
          ? 'Permission for this folder was blocked. Re-pick it to browse again.'
          : 'This folder needs permission again for this visit.'}</p>
      <div class="fe-hero-actions">
        <${Button} class="primary" icon='folder-key'    label='Reconnect'     onClick=${tryReconnect} />
        <${Button} class="ghost"   icon='folder-search' label='Choose folder' onClick=${chooseFolder} />
      </div>
    </div>`;
}

function FolderSidebar () {
  const folder = app.db.folder.value;
  return html`
    <${Sidebar} class='fe-side' isOpen=${app.state.$isNavOpen} onClose=${closeNav}>
      <${Brand} app=${app} />

      <div class="fe-current">
        <span class="fe-current-label">open folder</span>
        <div class="fe-current-name" title=${folder.name}>
          <${Icon} name="folder-open" /> <span>${folder.name}</span>
        </div>
        <div class="fe-current-actions">
          <${Button} class='small'       icon='mdi:folder-swap-outline' label='change' onClick=${() => { closeNav(); chooseFolder(); }} />
          <${Button} class='small ghost' icon='close'                   label='close'  onClick=${() => { closeNav(); closeFolder(); }} />
        </div>
      </div>

      <div class="fe-side-foot">
        <${InstallTip} />
      </div>
    </${Sidebar}>
  `;
}

// :::::: APP

const isNotSupported = () => !fs.supported();
const isLoading      = () => !app.db.ready.value;
const isWelcome      = () => !app.db.folder.value;
const isNotGranted   = () =>  app.db.perm.value !== 'granted';

function App () {
  useEffect(() => { app.db.load().catch(err => console.warn('[files] load failed', err)); }, []);

  return isNotSupported() ? html`<${Unsupported} />`
       : isLoading()      ? html`<${Icon} name='loading' />`
       : isWelcome()      ? html`<${Welcome} />`
       : isNotGranted()   ? html`<${Reconnect} />`
       : html`
         <${FolderSidebar} />
         <main id="app-main">
           <${IconButton} class='fe-menu' icon='menu' label='Folder' onClick=${openNav} />
           <${FileExplorer} backend=${backend.value} />
         </main>`;
}

// :::::: BOOT

app.init({ App });
