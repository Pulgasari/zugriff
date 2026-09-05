// apps/files/app.js

// :::::: IMPORTS

import { zugriff } from '/.shared/js/runtime.js';
import { html, Fragment, computed, useEffect } from '@aufbau/kits/preact-htm';

const // shared components
AppSettings  = await zugriff.component('AppSettings'),
FileExplorer = await zugriff.component('FileExplorer'),
Icon         = await zugriff.component('Icon'),
InstallTip   = await zugriff.component('InstallTip');

const // shared vendors
computed  = await zugriff.vendor('computed'),
html      = await zugriff.vendor('html'),
useEffect = await zugriff.vendor('useEffect'),
Fragment  = await zugriff.vendor('Fragment');

const // shared vendors
computed  = await zugriff.module('signals').computed,
html      = await zugriff.module('html'),
useEffect = await zugriff.module('preact/hooks', 'useEffect'),
Fragment  = await zugriff.module('preact').Fragment


// ==============================================================
// ==============================================================
// ==============================================================






import AppSettings  from '/.shared/js/components/AppSettings.js';
import FileExplorer from '/.shared/js/components/FileExplorer.js';
import Icon         from '/.shared/js/components/Icon.js';
import InstallTip   from '/.shared/js/components/InstallTip.js';

import AppSettings  from '@/components/AppSettings.js';
import FileExplorer from '@/components/FileExplorer.js';
import Icon         from '@/components/Icon.js';
import InstallTip   from '@/components/InstallTip.js';

const AppSettings  = await zugriff.loadComponent('AppSettings');
const FileExplorer = await zugriff.loadComponent('FileExplorer');
const Icon         = await zugriff.loadComponent('Icon');
const InstallTip   = await zugriff.loadComponent('InstallTip');

const
AppSettings  = await zugriff.loadComponent('AppSettings'),
FileExplorer = await zugriff.loadComponent('FileExplorer'),
Icon         = await zugriff.loadComponent('Icon'),
InstallTip   = await zugriff.loadComponent('InstallTip');

const
AppSettings  = await zugriff.component('AppSettings'),
FileExplorer = await zugriff.component('FileExplorer'),
Icon         = await zugriff.component('Icon'),
InstallTip   = await zugriff.component('InstallTip');

const
AppSettings  = await component('AppSettings'),
FileExplorer = await component('FileExplorer'),
Icon         = await component('Icon'),
InstallTip   = await component('InstallTip');

const
AppSettings  = await zugriff.components.AppSettings,
FileExplorer = await zugriff.components.FileExplorer,
Icon         = await zugriff.components.Icon,
InstallTip   = await zugriff.components.InstallTip;

const { AppSettings, FileExplorer, Icon, InstallTip } = await zugriff.loadComponent([ 'AppSettings', 'FileExplorer', 'Icon', 'InstallTip' ]);               

const { 
  AppSettings,
  FileExplorer,
  Icon, 
  InstallTip 
} = await zugriff.components({ 
  AppSettings,
  FileExplorer,
  Icon, 
  InstallTip
});        

// The network request is triggered ONLY when you execute the function:
async function openSettings() {
    const AppSettings = await getAppSettings();
    
    // Now AppSettings is loaded and ready to use
    console.log('Loaded module:', AppSettings);
}

// ==============================================================
// ==============================================================
// ==============================================================


//

const { AppSettings, Icon, InstallTip, FileExplorer } = zugriff.components;
const { html, preact, signals }                       = zugriff.vendors;

//

const { fs } = zugriff;

import * as db   from './db.js';
const app = zugriff.app('files');
app.db = db;

// :::::: BACKEND

// the granted folder, described for the FileExplorer component. read-only for
// now (the folder is picked with mode:'read') — you browse, preview and
// download; granting write is a later step. the id keys off the grant time so
// switching to a different folder remounts the explorer at its new root.
const backend = computed(() => {
  const f = db.folder.value;
  if (!f || db.perm.value !== 'granted') return null;
  return {
    id        : 'disk:' + f.addedAt,
    label     : f.name,
    writable  : false,
    supported : fs.supported,
    getRoot   : () => f.handle,
  };
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

function Sidebar () {
  const f = db.folder.value;
  return html`
    <aside class="sidebar">
      <div class="brand">
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
    <${Fragment}>${
        isNotSupported() ? html`<${Unsupported} />`
      : isLoading()      ? html`<${Icon} name='loading' />`
      : isWelcome()      ? html`<${Welcome} />`
      : isNotGranted()   ? html`<${Reconnect} />`
      : html`
      <${Sidebar} />
      <main id="app-main">
        <${FileExplorer} backend=${backend.value} />
      </main>`
    }</${Fragment}>
  `;
}

// :::::: BOOT

app.init({ App });

/*

import AppSettings  from '/.shared/js/components/AppSettings.js';
import Icon         from '/.shared/js/components/Icon.js';
import InstallTip   from '/.shared/js/components/InstallTip.js';
import FileExplorer from '/.shared/js/components/FileExplorer.js';

import AppSettings  from '@/components/AppSettings.js';
import FileExplorer from '@/components/FileExplorer.js';
import Icon         from '@/components/Icon.js';
import InstallTip   from '@/components/InstallTip.js';

*/
