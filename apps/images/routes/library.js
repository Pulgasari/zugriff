// apps/images/routes/library.js
// library route: browse granted folders as galleries, open an image into view.

import { signal, computed }            from '@aufbau/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { InstallTip }            from '/.shared/js/components/index.js';
import { setFiles }                    from '../modules/state.js';

const app = zugriff.app;

const libMsg    = signal('');
const libSearch = signal('');
const libFolder = signal('');   // '' = all folders, else a sourceId

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

const visiblePics = computed(() => {
  const q = libSearch.value.trim().toLowerCase();
  let list = app.lib.pics.value;
  if (libFolder.value) list = list.filter(p => p.sourceId === libFolder.value);
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q));
  return [...list].sort(byName);
});

async function addFolderAction () {
  libMsg.value = '';
  if (!app.lib.fs.supported()) { libMsg.value = 'This browser can’t open folders — try a Chromium-based one.'; return; }
  try { await app.lib.addFolder(); }
  catch (err) { libMsg.value = err?.message || String(err); }
}

/** open an image record into the view mode */
async function openInView (pic) {
  try {
    const file = await app.lib.openFile(pic);
    setFiles([file]);
    app.setRoute('view');
  } catch (err) {
    libMsg.value = err?.message || String(err);
  }
}

// a lazy thumbnail: the file is read (and an object url made) only once the cell
// scrolls near the viewport, so a folder of thousands doesn't decode all at once
function Thumb ({ pic }) {
  const ref = useRef(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    let alive = true, obj = null;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      (async () => {
        try {
          const file = await app.lib.openFile(pic);
          if (!alive) return;
          obj = URL.createObjectURL(file);
          setUrl(obj);
        } catch { /* leave the placeholder */ }
      })();
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => { alive = false; io.disconnect(); if (obj) URL.revokeObjectURL(obj); };
  }, [pic.key]);

  return html`
    <button ref=${ref} class="im-thumb" title=${pic.path} onClick=${() => openInView(pic)}>
      ${url
        ? html`<img src=${url} alt=${pic.name} loading="lazy" />`
        : html`<div class="im-thumb-ph"><svg-icon icon="mdi:image-outline"></svg-icon></div>`}
      <span class="im-thumb-name">${pic.name}</span>
    </button>`;
}

function ReconnectBar () {
  const stale = app.lib.sources.value.filter(s => app.lib.perms.value[s.id] && app.lib.perms.value[s.id] !== 'granted');
  if (!stale.length) return null;
  return html`
    <div class="im-reconnect">
      <svg-icon icon="mdi:folder-alert-outline"></svg-icon>
      <span>${stale.length} folder${stale.length === 1 ? '' : 's'} need reconnecting to read on this device.</span>
      ${stale.map(s => html`
        <div class="im-reconnect-item" key=${s.id}>
          <span class="im-reconnect-name">${s.name}</span>
          <button class="btn small primary" onClick=${() => app.lib.reconnect(s.id).then(res => {
            if (!res.granted) libMsg.value = `Reconnect failed — ${res.error ? (res.error.name || 'error') : 'browser said “' + res.state + '”'}. Try “Choose folder”.`;
          })}>
            <svg-icon icon="mdi:folder-key-outline"></svg-icon> Reconnect</button>
          <button class="btn small ghost" title="Re-select the folder — always works"
                  onClick=${() => app.lib.repick(s.id).then(ok => { if (!ok) libMsg.value = `Could not open ${s.name}`; })}>
            <svg-icon icon="mdi:folder-search-outline"></svg-icon> Choose folder</button>
        </div>`)}
    </div>`;
}

function FolderChips () {
  const list = app.lib.sources.value;
  if (list.length < 2) return null;
  return html`
    <div class="im-folderbar">
      <button class=${'chip' + (libFolder.value === '' ? ' active' : '')} onClick=${() => libFolder.value = ''}>All</button>
      ${list.map(s => html`
        <button key=${s.id} class=${'chip' + (libFolder.value === s.id ? ' active' : '')}
                onClick=${() => libFolder.value = s.id}>${s.name}</button>`)}
    </div>`;
}

function LibraryMode () {
  useEffect(() => { app.lib.ensureLoaded(); }, []);

  if (!app.lib.ready.value) {
    return html`<div class="im-lib"><div class="im-booting"><svg-icon icon="svg-spinners:bars-scale-middle"></svg-icon></div></div>`;
  }

  const pics       = visiblePics.value;
  const hasFolders = app.lib.sources.value.length > 0;
  const scanning   = Object.values(app.lib.scanning.value).some(Boolean);

  return html`
    <div class="im-lib">
      <header class="im-lib-head">
        ${scanning && html`<span class="im-scan-note"><svg-icon icon="svg-spinners:bars-scale-middle"></svg-icon> scanning…</span>`}
        <div class="im-lib-search">
          <svg-icon icon="mdi:magnify"></svg-icon>
          <input type="search" placeholder="Search images…" value=${libSearch.value}
                 onInput=${e => libSearch.value = e.target.value} />
          ${libSearch.value && html`<button class="iv-btn" aria-label="Clear" onClick=${() => libSearch.value = ''}>
            <svg-icon icon="mdi:close"></svg-icon></button>`}
        </div>
        ${hasFolders && html`<button class="iv-btn" title="Rescan folders" onClick=${() => app.lib.rescanAll()}><svg-icon icon="mdi:refresh"></svg-icon></button>`}
        <button class="btn primary" onClick=${addFolderAction}>
          <svg-icon icon="mdi:folder-plus-outline"></svg-icon> Add folder</button>
      </header>

      ${libMsg.value && html`<div class="im-lib-msg"><svg-icon icon="mdi:alert-outline"></svg-icon> ${libMsg.value}
        <button class="iv-btn" aria-label="Dismiss" onClick=${() => libMsg.value = ''}><svg-icon icon="mdi:close"></svg-icon></button></div>`}

      <${ReconnectBar} />
      <${InstallTip} show=${app.lib.sources.value.length > 0}
                     message="Install the app to keep your image folders connected between visits — no reconnecting." />
      <${FolderChips} />

      ${!hasFolders
        ? html`
          <div class="im-lib-empty">
            <svg-icon icon="mdi:folder-multiple-image"></svg-icon>
            <p class="im-empty-title">Browse an image folder</p>
            <p class="im-empty-hint">Grant a folder off your device and browse it as a gallery — open any image into the viewer or editor. Nothing is uploaded; only the folder permission is remembered.</p>
            <button class="btn primary" onClick=${addFolderAction}>
              <svg-icon icon="mdi:folder-plus-outline"></svg-icon> Add a folder</button>
          </div>`
        : pics.length
          ? html`<div class="im-scroll"><aufbau-index class="im-grid" viewmode="grid" item-size="140px" gap="0.6rem">
              ${pics.map(p => html`<${Thumb} key=${p.key} pic=${p} />`)}
            </aufbau-index></div>`
          : html`
            <div class="im-lib-empty">
              <svg-icon icon=${libSearch.value ? 'mdi:image-search-outline' : 'mdi:image-off-outline'}></svg-icon>
              <p class="im-empty-title">${libSearch.value ? 'Nothing matches your search' : 'No images here yet'}</p>
              ${!libSearch.value && html`<p class="im-empty-hint">Scanning may still be running, or this folder has no images.</p>`}
            </div>`}
    </div>`;
}
export { LibraryMode };
export default LibraryMode;
