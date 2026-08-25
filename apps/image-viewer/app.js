// apps/image-viewer/app.js
//
// a plain image viewer. its point is the *entry* path: an installed copy
// registers as a file handler (see the manifest's file_handlers, generated from
// the registry entry), so on Android — and desktop — you can "open with →
// Viewer" straight from a gallery or a file manager. those files arrive through
// the File Handling API's launchQueue as FileSystemFileHandles; the same viewer
// also takes files from a picker (showOpenFilePicker / <input>) and from drag
// and drop.
//
// nothing is uploaded or stored — the images live only as object URLs for the
// lifetime of the tab.
//
// like every app under /apps it draws its own chrome — there is no tools Shell.

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: vendors
import { html, signal, computed, useEffect, useRef } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot, config } from './../../shared/js/app.js?slug=image-viewer';
import { Icon } from './../../shared/js/components/index.js';
import * as pwa from './../../shared/js/lib/pwa.js';

// :::::: STATE :::::::::::::::::::::::::::::::::::::::::::::

const shots   = signal([]);       // [{ name, size, type, url }]
const idx     = signal(0);        // index of the shown image
const zoom    = signal(1);        // 1 = fit to stage
const pan     = signal({ x: 0, y: 0 });
const bare    = signal(false);    // immersive: chrome hidden
const strip   = signal(true);     // show the thumbnail strip
const error   = signal('');

const current = computed(() => shots.value[idx.value] ?? null);
const many    = computed(() => shots.value.length > 1);

const IMAGE_RE = /\.(png|jpe?g|jfif|gif|webp|avif|bmp|svg|ico|heic|heif|tiff?)$/i;
const isImageFile = f => f && (f.type?.startsWith('image/') || IMAGE_RE.test(f.name || ''));

// :::::: HELPERS :::::::::::::::::::::::::::::::::::::::::::

const UNITS = ['B', 'KB', 'MB', 'GB'];
function fmtSize (bytes = 0) {
  if (!bytes) return '';
  const i = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${UNITS[i]}`;
}

function revokeAll () {
  for (const s of shots.value) URL.revokeObjectURL(s.url);
}

function resetView () { zoom.value = 1; pan.value = { x: 0, y: 0 }; }

/** replace the shown set with these File objects (images only) */
function setFiles (files) {
  const imgs = [...files].filter(isImageFile);
  if (!imgs.length) {
    if (files.length) error.value = 'those files aren’t images the browser can show';
    return;
  }
  revokeAll();
  error.value = '';
  shots.value = imgs.map(f => ({ name: f.name || 'image', size: f.size, type: f.type, url: URL.createObjectURL(f) }));
  idx.value = 0;
  resetView();
}

function go (delta) {
  if (!shots.value.length) return;
  const n = shots.value.length;
  idx.value = (idx.value + delta + n) % n;
  resetView();
}
const showAt = i => { idx.value = i; resetView(); };

function removeCurrent () {
  const s = shots.value[idx.value];
  if (!s) return;
  URL.revokeObjectURL(s.url);
  const next = shots.value.filter((_, i) => i !== idx.value);
  shots.value = next;
  if (idx.value >= next.length) idx.value = Math.max(0, next.length - 1);
  resetView();
}

// zoom around the stage centre, clamped; pan is re-clamped to keep the image
// from sliding entirely out of view
function setZoom (z) {
  zoom.value = Math.min(8, Math.max(1, z));
  if (zoom.value === 1) pan.value = { x: 0, y: 0 };
  else clampPan();
}

let stageEl = null, imgEl = null;
function clampPan () {
  if (!stageEl || !imgEl) return;
  const sr = stageEl.getBoundingClientRect();
  // the image's fitted (unscaled) size = its rendered box divided by the zoom
  const base = imgEl.getBoundingClientRect();
  const baseW = base.width / zoom.value, baseH = base.height / zoom.value;
  const maxX = Math.max(0, (baseW * zoom.value - sr.width) / 2);
  const maxY = Math.max(0, (baseH * zoom.value - sr.height) / 2);
  const p = pan.value;
  pan.value = {
    x: Math.min(maxX, Math.max(-maxX, p.x)),
    y: Math.min(maxY, Math.max(-maxY, p.y)),
  };
}

async function openPicker () {
  try {
    if (window.showOpenFilePicker) {
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [{ description: 'Images', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.svg', '.ico', '.heic', '.heif', '.tif', '.tiff'] } }],
        excludeAcceptAllOption: false,
      });
      const files = await Promise.all(handles.map(h => h.getFile()));
      setFiles(files);
    } else {
      fallbackInput?.click();   // browsers without the picker use the <input>
    }
  } catch (err) {
    if (err?.name !== 'AbortError') error.value = err?.message || String(err);
  }
}

function download () {
  const s = current.value;
  if (!s) return;
  const a = Object.assign(document.createElement('a'), { href: s.url, download: s.name });
  document.body.appendChild(a); a.click(); a.remove();
}

function toggleFullscreen () {
  const el = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen?.();
  else el.requestFullscreen?.().catch(() => {});
}

let fallbackInput = null;   // the hidden <input type=file> for no-picker browsers

// :::::: FILE HANDLING API :::::::::::::::::::::::::::::::::
// files opened via the OS "open with" arrive here on launch

function wireLaunchQueue () {
  if (!('launchQueue' in window) || !window.launchQueue?.setConsumer) return;
  window.launchQueue.setConsumer(async params => {
    if (!params?.files?.length) return;
    try {
      const files = await Promise.all(params.files.map(h => h.getFile()));
      setFiles(files);
    } catch (err) {
      error.value = 'could not open the launched file — ' + (err?.message || err);
    }
  });
}

// :::::: COMPONENTS ::::::::::::::::::::::::::::::::::::::::

function IconBtn ({ icon, label, onClick, disabled, active, size = 20 }) {
  return html`
    <button class=${'iv-btn' + (active ? ' active' : '')} title=${label} aria-label=${label}
            disabled=${disabled} onClick=${onClick}>
      <${Icon} name=${icon} size=${size} />
    </button>`;
}

function TopBar () {
  const s = current.value;
  return html`
    <header class="iv-top">
      <div class="iv-title">
        <${Icon} name="mdi:image-outline" size=${18} />
        <span class="iv-name" title=${s?.name}>${s?.name || 'Image Viewer'}</span>
        ${many.value && html`<span class="iv-count">${idx.value + 1} / ${shots.value.length}</span>`}
        ${s && html`<span class="iv-meta">${[s.type?.split('/')[1]?.toUpperCase(), fmtSize(s.size)].filter(Boolean).join(' · ')}</span>`}
      </div>
      <div class="iv-actions">
        <${IconBtn} icon="mdi:folder-open-outline" label="Open images"   onClick=${openPicker} />
        <${IconBtn} icon="mdi:magnify-minus-outline" label="Zoom out"    onClick=${() => setZoom(zoom.value / 1.4)} disabled=${!s || zoom.value <= 1} />
        <${IconBtn} icon="mdi:magnify-plus-outline"  label="Zoom in"     onClick=${() => setZoom(zoom.value * 1.4)} disabled=${!s} />
        <${IconBtn} icon="mdi:fit-to-screen-outline" label="Fit"         onClick=${resetView} disabled=${!s || (zoom.value === 1 && pan.value.x === 0 && pan.value.y === 0)} />
        <${IconBtn} icon="mdi:download"              label="Download"    onClick=${download} disabled=${!s} />
        ${many.value && html`<${IconBtn} icon=${strip.value ? 'mdi:view-carousel-outline' : 'mdi:view-carousel'} label="Toggle thumbnails" active=${strip.value} onClick=${() => strip.value = !strip.value} />`}
        <${IconBtn} icon="mdi:fullscreen"            label="Fullscreen"  onClick=${toggleFullscreen} />
        <${IconBtn} icon="mdi:eye-off-outline"       label="Hide chrome (tap image to restore)" onClick=${() => bare.value = true} disabled=${!s} />
        ${s && html`<${IconBtn} icon="mdi:close" label="Close image" onClick=${removeCurrent} />`}
      </div>
    </header>`;
}

function ThumbStrip () {
  if (!many.value || !strip.value) return null;
  return html`
    <footer class="iv-strip">
      ${shots.value.map((s, i) => html`
        <button class=${'iv-thumb' + (i === idx.value ? ' active' : '')} key=${s.url}
                title=${s.name} onClick=${() => showAt(i)}>
          <img src=${s.url} alt=${s.name} loading="lazy" />
        </button>`)}
    </footer>`;
}

function Welcome () {
  return html`
    <div class="iv-welcome">
      <${Icon} name="mdi:image-multiple-outline" size=${64} />
      <h1>View an image</h1>
      <p>Open images from your device, or just drop them here. Nothing is
         uploaded — they stay on your machine.</p>
      <button class="iv-cta" onClick=${openPicker}>
        <${Icon} name="mdi:folder-open-outline" size=${18} /> Open images</button>
      ${error.value && html`<p class="iv-error"><${Icon} name="mdi:alert-outline" size=${16} /> ${error.value}</p>`}
      <${OpenWithTip} />
      <div class="iv-links">
        <a href="./../"><${Icon} name="mdi:view-grid-outline" size=${14} /> apps</a>
        <a href="./../../"><${Icon} name="mdi:home-outline" size=${14} /> launcher</a>
      </div>
    </div>`;
}

// once installed, the app shows up in the OS "open with" list — nudge it
function OpenWithTip () {
  const canHandle = 'launchQueue' in window;
  if (!canHandle) return null;
  if (pwa.installed.value) {
    return html`<p class="iv-tip"><${Icon} name="mdi:check-circle-outline" size=${15} />
      Installed — pick <b>Viewer</b> from your device’s <b>Open with</b> menu to send images straight here.</p>`;
  }
  return html`
    <div class="iv-tip install">
      <${Icon} name="mdi:cellphone-arrow-down" size=${15} />
      <div>
        <span>Install the app to open images from your gallery or files with it.</span>
        ${pwa.canInstall.value
          ? html`<button class="iv-cta small" onClick=${() => pwa.promptInstall()}>
              <${Icon} name="mdi:download" size=${14} /> Install app</button>`
          : html`<span class="iv-tip-hint">Use your browser’s <b>Install</b> / <b>Add to Home screen</b> menu.</span>`}
      </div>
    </div>`;
}

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const inputRef = useRef(null);
  const drag     = useRef(null);           // { startX, startY, panX, panY }
  const pointers = useRef(new Map());
  const pinch    = useRef(null);           // { dist, zoom }

  useEffect(() => {
    fallbackInput = inputRef.current;
    stageEl = stageRef.current;
    wireLaunchQueue();

    const onKey = e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      switch (e.key) {
        case 'ArrowRight': case ' ': if (many.value) { e.preventDefault(); go(1); } break;
        case 'ArrowLeft':  if (many.value) go(-1); break;
        case '+': case '=': setZoom(zoom.value * 1.4); break;
        case '-': setZoom(zoom.value / 1.4); break;
        case '0': resetView(); break;
        case 'f': toggleFullscreen(); break;
        case 'Escape': if (bare.value) bare.value = false; else resetView(); break;
      }
    };
    window.addEventListener('keydown', onKey);

    const onGlobalDrop = e => e.preventDefault();
    window.addEventListener('dragover', onGlobalDrop);
    window.addEventListener('drop', onGlobalDrop);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('dragover', onGlobalDrop);
      window.removeEventListener('drop', onGlobalDrop);
      revokeAll();
    };
  }, []);

  // keep the module refs to live nodes for the pan clamp
  useEffect(() => { stageEl = stageRef.current; imgEl = imageRef.current; });

  // ── pointer gestures: drag-pan (zoomed), pinch-zoom (two fingers) ──────────
  const onPointerDown = e => {
    if (!current.value) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: zoom.value };
    } else if (zoom.value > 1) {
      drag.current = { startX: e.clientX, startY: e.clientY, panX: pan.value.x, panY: pan.value.y };
    }
  };
  const onPointerMove = e => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      setZoom(pinch.current.zoom * (dist / pinch.current.dist));
      return;
    }
    if (drag.current && zoom.value > 1) {
      pan.value = { x: drag.current.panX + (e.clientX - drag.current.startX),
                    y: drag.current.panY + (e.clientY - drag.current.startY) };
      clampPan();
    }
  };
  const onPointerUp = e => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  };

  const onWheel = e => {
    if (!current.value) return;
    e.preventDefault();
    setZoom(zoom.value * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  };

  const onDoubleClick = () => { if (current.value) setZoom(zoom.value > 1 ? 1 : 2.5); };

  const onDrop = e => {
    e.preventDefault();
    drag.current = null;
    if (e.dataTransfer?.files?.length) setFiles(e.dataTransfer.files);
  };

  const s        = current.value;
  const dragging = zoom.value > 1;

  return html`
    <div class=${'iv-app' + (bare.value ? ' bare' : '')}
         onDragOver=${e => e.preventDefault()} onDrop=${onDrop}>
      ${!bare.value && html`<${TopBar} />`}

      <div class=${'iv-stage' + (dragging ? ' grab' : '')} ref=${stageRef}
           onWheel=${onWheel}
           onDblClick=${onDoubleClick}
           onPointerDown=${onPointerDown}
           onPointerMove=${onPointerMove}
           onPointerUp=${onPointerUp}
           onPointerCancel=${onPointerUp}
           onClick=${() => { if (bare.value) bare.value = false; }}>
        ${s
          ? html`<img class="iv-image" ref=${imageRef} src=${s.url} alt=${s.name} draggable="false"
                      style=${`transform: translate(${pan.value.x}px, ${pan.value.y}px) scale(${zoom.value})`} />`
          : html`<${Welcome} />`}

        ${many.value && !bare.value && html`
          <button class="iv-nav prev" aria-label="Previous" onClick=${e => { e.stopPropagation(); go(-1); }}>
            <${Icon} name="mdi:chevron-left" size=${34} /></button>
          <button class="iv-nav next" aria-label="Next" onClick=${e => { e.stopPropagation(); go(1); }}>
            <${Icon} name="mdi:chevron-right" size=${34} /></button>`}
      </div>

      ${!bare.value && html`<${ThumbStrip} />`}

      <input ref=${inputRef} type="file" accept="image/*" multiple hidden
             onChange=${e => { setFiles(e.target.files); e.target.value = ''; }} />
    </div>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

boot({ config, App });
