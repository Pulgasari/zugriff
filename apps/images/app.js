// apps/images/app.js
//
// the unified images app. one PWA, several modes, switched by ?mode= (a query
// param, not a real subpath — the launcher's rewrite only serves the app shell
// for /images/, so deep sub-routes would 404). the OS "open with" and the
// launchQueue drop the launched files straight into the view mode.
//
// phase 1 ships two modes — view (ported from the old image-viewer) and edit
// (ported from image-editor); library, convert and batch land in later phases.

// ::: vendors
import { html, signal, computed, useEffect, useRef } from '@aufbau/kits/preact-htm';
import { useGesture } from '@aufbau/gestures/preact';

// ::: shared
import { boot, config }      from '/.shared/js/app.js?slug=images';
import { Icon, AppSettings } from '/.shared/js/components/index.js';
import { stored }            from '/.shared/js/lib/signals.js';
import * as pwa              from '/.shared/js/lib/pwa.js';

// ::: local
import * as edit from './edit.js';


// :::::: MODE ROUTING (Option B: ?mode=) :::::::::::::::::::::::::::::::::::::::

const MODES = [
  { id: 'view', label: 'View', icon: 'mdi:image-outline' },
  { id: 'edit', label: 'Edit', icon: 'mdi:image-edit-outline' },
];
const isMode = id => MODES.some(m => m.id === id);

const screen = signal(
  isMode(new URLSearchParams(location.search).get('mode'))
    ? new URLSearchParams(location.search).get('mode')
    : 'view'
);

function setScreen (id) {
  if (!isMode(id)) return;
  screen.value = id;
  const url = new URL(location.href);
  url.searchParams.set('mode', id);
  history.replaceState(null, '', url);
}


// :::::: SHARED IMAGE TRAY :::::::::::::::::::::::::::::::::::::::::::::::::::::::
// the set of open images, shared by every mode. view browses it; edit loads the
// current one into a canvas.

const shots   = signal([]);   // [{ name, size, type, file, url }]
const idx     = signal(0);    // index of the shown image
const current = computed(() => shots.value[idx.value] ?? null);
const many    = computed(() => shots.value.length > 1);

const IMAGE_RE    = /\.(png|jpe?g|jfif|gif|webp|avif|bmp|svg|ico|heic|heif|tiff?)$/i;
const isImageFile = f => f && (f.type?.startsWith('image/') || IMAGE_RE.test(f.name || ''));

const UNITS = ['B', 'KB', 'MB', 'GB'];
function fmtSize (bytes = 0) {
  if (!bytes) return '';
  const i = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${UNITS[i]}`;
}

function revokeAll () { for (const s of shots.value) URL.revokeObjectURL(s.url); }

/** replace the open set with these File objects (images only) */
function setFiles (files) {
  const imgs = [...files].filter(isImageFile);
  if (!imgs.length) {
    if (files.length) vError.value = 'those files aren’t images the browser can show';
    return;
  }
  revokeAll();
  vError.value = '';
  shots.value = imgs.map(f => ({ name: f.name || 'image', size: f.size, type: f.type, url: URL.createObjectURL(f), file: f }));
  idx.value = 0;
  resetView();
}


// :::::: VIEW MODE (ex image-viewer) :::::::::::::::::::::::::::::::::::::::::::

const zoom   = signal(1);              // 1 = fit to stage
const pan    = signal({ x: 0, y: 0 });
const bare   = signal(false);          // immersive: chrome hidden
const strip  = signal(true);           // show the thumbnail strip
const vError = signal('');

function resetView () { zoom.value = 1; pan.value = { x: 0, y: 0 }; }

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

// zoom around the stage centre, clamped; pan re-clamped to keep the image in view
function setZoom (z) {
  zoom.value = Math.min(8, Math.max(1, z));
  if (zoom.value === 1) pan.value = { x: 0, y: 0 };
  else clampPan();
}

let stageEl = null, imgEl = null;
function clampPan () {
  if (!stageEl || !imgEl) return;
  const sr = stageEl.getBoundingClientRect();
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

let fallbackInput = null;   // the hidden <input type=file> for no-picker browsers

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
      fallbackInput?.click();
    }
  } catch (err) {
    if (err?.name !== 'AbortError') vError.value = err?.message || String(err);
  }
}

function downloadCurrent () {
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

// files opened via the OS "open with" arrive here on launch
function wireLaunchQueue () {
  if (!('launchQueue' in window) || !window.launchQueue?.setConsumer) return;
  window.launchQueue.setConsumer(async params => {
    if (!params?.files?.length) return;
    try {
      const files = await Promise.all(params.files.map(h => h.getFile()));
      setFiles(files);
      setScreen('view');
    } catch (err) {
      vError.value = 'could not open the launched file — ' + (err?.message || err);
    }
  });
}

function IconBtn ({ icon, label, onClick, disabled, active, size = 20 }) {
  return html`
    <button class=${'iv-btn' + (active ? ' active' : '')} title=${label} aria-label=${label}
            disabled=${disabled} onClick=${onClick}>
      <${Icon} name=${icon} size=${size} />
    </button>`;
}

function ViewTopBar () {
  const s = current.value;
  return html`
    <header class="iv-top">
      <div class="iv-title">
        <${Icon} name="image" size=${18} />
        <span class="iv-name" title=${s?.name}>${s?.name || 'Image Viewer'}</span>
        ${many.value && html`<span class="iv-count">${idx.value + 1} / ${shots.value.length}</span>`}
        ${s && html`<span class="iv-meta">${[s.type?.split('/')[1]?.toUpperCase(), fmtSize(s.size)].filter(Boolean).join(' · ')}</span>`}
      </div>
      <div class="iv-actions">
        <${IconBtn} icon="mdi:folder-open-outline"   label="Open images" onClick=${openPicker} />
        <${IconBtn} icon="mdi:image-edit-outline"    label="Edit this image" onClick=${editCurrent} disabled=${!s} />
        <${IconBtn} icon="zoom-out"                  label="Zoom out"    onClick=${() => setZoom(zoom.value / 1.4)} disabled=${!s || zoom.value <= 1} />
        <${IconBtn} icon="zoom-in"                   label="Zoom in"     onClick=${() => setZoom(zoom.value * 1.4)} disabled=${!s} />
        <${IconBtn} icon="mdi:fit-to-screen-outline" label="Fit"         onClick=${resetView} disabled=${!s || (zoom.value === 1 && pan.value.x === 0 && pan.value.y === 0)} />
        <${IconBtn} icon="download"                  label="Download"    onClick=${downloadCurrent} disabled=${!s} />
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

function OpenWithTip () {
  const canHandle = 'launchQueue' in window;
  if (!canHandle) return null;
  if (pwa.installed.value) {
    return html`<p class="iv-tip"><${Icon} name="mdi:check-circle-outline" size=${15} />
      Installed — pick <b>Images</b> from your device’s <b>Open with</b> menu to send images straight here.</p>`;
  }
  return html`
    <div class="iv-tip install">
      <${Icon} name="mdi:cellphone-arrow-down" size=${15} />
      <div>
        <span>Install the app to open images from your gallery or files with it.</span>
        ${pwa.canInstall.value
          ? html`<button class="iv-cta small" onClick=${() => pwa.promptInstall()}>
              <${Icon} name="download" size=${14} /> Install app</button>`
          : html`<span class="iv-tip-hint">Use your browser’s <b>Install</b> / <b>Add to Home screen</b> menu.</span>`}
      </div>
    </div>`;
}

function Welcome () {
  return html`
    <div class="iv-welcome">
      <${Icon} name="images" size=${64} />
      <h1>View an image</h1>
      <p>Open images from your device, or just drop them here. Nothing is
         uploaded — they stay on your machine.</p>
      <button class="iv-cta" onClick=${openPicker}>
        <${Icon} name="mdi:folder-open-outline" size=${18} /> Open images</button>
      ${vError.value && html`<p class="iv-error"><${Icon} name="mdi:alert-outline" size=${16} /> ${vError.value}</p>`}
      <${OpenWithTip} />
    </div>`;
}

function ViewMode () {
  const stageRef   = useRef(null);
  const imageRef   = useRef(null);
  const inputRef   = useRef(null);
  const panStart   = useRef({ x: 0, y: 0 });
  const pinchStart = useRef(1);

  useEffect(() => {
    fallbackInput = inputRef.current;
    stageEl = stageRef.current;

    const onKey = e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      switch (e.key) {
        case 'ArrowRight': case ' ': if (many.value) { e.preventDefault(); go(1); } break;
        case 'ArrowLeft':  if (many.value) go(-1); break;
        case '+': case '=': setZoom(zoom.value * 1.4); break;
        case '-': setZoom(zoom.value / 1.4); break;
        case '0': resetView(); break;
        case 'f': toggleFullscreen(); break;
        case 'e': if (current.value) editCurrent(); break;
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
    };
  }, []);

  useEffect(() => { stageEl = stageRef.current; imgEl = imageRef.current; });

  const gestureRef = useGesture({
    onDoubleClick : () => { if (current.value) setZoom(zoom.value > 1 ? 1 : 2.5); },
    onPanStart    : () => { panStart.current = { ...pan.value }; },
    onPan         : p => {
      if (zoom.value <= 1) return;
      pan.value = { x: panStart.current.x + p.deltaX, y: panStart.current.y + p.deltaY };
      clampPan();
    },
    onPinchStart  : () => { pinchStart.current = zoom.value; },
    onPinch       : p => { if (current.value) setZoom(pinchStart.current * p.scale); },
    onWheel       : w => { if (current.value) setZoom(zoom.value * (w.deltaY < 0 ? 1.15 : 1 / 1.15)); },
  });

  const setStage = useRef(null);
  if (!setStage.current) setStage.current = node => { stageRef.current = node; stageEl = node; gestureRef(node); };

  const onDrop = e => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) setFiles(e.dataTransfer.files);
  };

  const s        = current.value;
  const dragging = zoom.value > 1;

  return html`
    <div class=${'iv-app' + (bare.value ? ' bare' : '')}
         onDragOver=${e => e.preventDefault()} onDrop=${onDrop}>
      ${!bare.value && html`<${ViewTopBar} />`}

      <div class=${'iv-stage' + (dragging ? ' grab' : '')} ref=${setStage.current}
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


// :::::: EDIT MODE (ex image-editor) ::::::::::::::::::::::::::::::::::::::::::::

const original = signal(null);     // the canvas as first loaded, for Reset
const work     = signal(null);     // the current canvas (geometry baked in)
const filters  = signal({ ...edit.IDENTITY });
const cropMode = signal('idle');   // 'idle' | 'crop'
const cropRect = signal(null);     // { x, y, w, h } in image pixels
const cropAR   = signal(null);     // locked aspect ratio (w/h) while cropping, or null
const cropPreset = signal('free');
const undo     = signal([]);       // canvases, oldest first
const redo     = signal([]);
const edName   = signal('image');
const edError  = signal('');
const busy     = signal(false);
const edDrag   = signal(false);    // a file is being dragged over the stage

const resizeW  = signal(0);
const resizeH  = signal(0);
const lockAR   = signal(true);

const exportFmt = stored('image/png', 'images:edit:format');
const quality   = stored(92, 'images:edit:quality');
const panelTab  = stored('adjust', 'images:edit:tab'); // 'adjust' | 'resize' | 'export'

const HISTORY  = 30;
const MIN_CROP = 8; // px

const dims  = computed(() => work.value ? { w: work.value.width, h: work.value.height } : null);
const dirty = computed(() => undo.value.length > 0 || !edit.isIdentity(filters.value));

let edLoadedFrom = null; // the File last decoded into the editor

const FORMATS = [
  { type: 'image/png',  label: 'PNG',  ext: 'png',  lossy: false },
  { type: 'image/jpeg', label: 'JPEG', ext: 'jpg',  lossy: true  },
  { type: 'image/webp', label: 'WebP', ext: 'webp', lossy: true  },
];
const fmtOf = type => FORMATS.find(f => f.type === type) ?? FORMATS[0];

const CROP_PRESETS = [
  { id: 'free',     label: 'Free',     ar: null },
  { id: 'original', label: 'Original', ar: 'img' },
  { id: '1:1',      label: '1:1',      ar: 1 },
  { id: '4:3',      label: '4:3',      ar: 4 / 3 },
  { id: '3:4',      label: '3:4',      ar: 3 / 4 },
  { id: '3:2',      label: '3:2',      ar: 3 / 2 },
  { id: '2:3',      label: '2:3',      ar: 2 / 3 },
  { id: '16:9',     label: '16:9',     ar: 16 / 9 },
  { id: '9:16',     label: '9:16',     ar: 9 / 16 },
  { id: 'screen',   label: 'Screen',   ar: 'screen' },
];

const TABS = [
  { id: 'adjust', label: 'Adjust', icon: 'mdi:tune-variant' },
  { id: 'resize', label: 'Resize', icon: 'mdi:resize' },
  { id: 'export', label: 'Export', icon: 'mdi:export-variant' },
];

function screenAR () {
  const w = window.screen?.width || window.innerWidth || 16;
  const h = window.screen?.height || window.innerHeight || 9;
  return w / h;
}

function centeredRect (ar, W, H) {
  let w = W, h = W / ar;
  if (h > H) { h = H; w = H * ar; }
  return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w: Math.round(w), h: Math.round(h) };
}

function pushHistory (canvas) {
  undo.value = [...undo.value, canvas].slice(-HISTORY);
  redo.value = [];
}

function commit (next) {
  if (!work.value) return;
  pushHistory(work.value);
  work.value = next;
  syncResize();
}

async function loadFile (file) {
  if (!file || !isImageFile(file)) { edError.value = 'that is not an image'; return; }
  busy.value = true;
  edError.value = '';
  edLoadedFrom = file;   // set up front so the mode-switch effect doesn't re-load
  try {
    const canvas = await edit.loadImage(file);
    original.value = canvas;
    work.value     = canvas;
    filters.value  = { ...edit.IDENTITY };
    undo.value = [];
    redo.value = [];
    cropMode.value = 'idle';
    cropRect.value = null;
    edName.value = (file.name || 'image').replace(/\.[^.]+$/, '');
    resizeW.value = canvas.width;
    resizeH.value = canvas.height;
  } catch (err) {
    edError.value = err?.message || String(err);
    edLoadedFrom = null;   // let a retry re-load the same file
  } finally {
    busy.value = false;
  }
}

/** open the tray's current image in the editor, switching modes */
async function editCurrent () {
  const s = current.value;
  if (!s) { setScreen('edit'); return; }
  setScreen('edit');
  if (edLoadedFrom !== s.file) await loadFile(s.file);
}

const rotate = dir => commit(edit.rotate90(work.value, dir));
const flip   = axis => commit(edit.flip(work.value, axis));

function undoOp () {
  if (!undo.value.length) return;
  const prev = undo.value[undo.value.length - 1];
  redo.value = [...redo.value, work.value];
  undo.value = undo.value.slice(0, -1);
  work.value = prev;
  syncResize();
}
function redoOp () {
  if (!redo.value.length) return;
  const next = redo.value[redo.value.length - 1];
  undo.value = [...undo.value, work.value];
  redo.value = redo.value.slice(0, -1);
  work.value = next;
  syncResize();
}

function resetEdit () {
  if (!original.value) return;
  if (work.value !== original.value) pushHistory(work.value);
  work.value = original.value;
  filters.value = { ...edit.IDENTITY };
  cropMode.value = 'idle';
  cropRect.value = null;
  syncResize();
}

function syncResize () {
  if (work.value) { resizeW.value = work.value.width; resizeH.value = work.value.height; }
}

function enterCrop () {
  const w = work.value; if (!w) return;
  const inset = 0.1;
  cropRect.value = {
    x: Math.round(w.width  * inset),
    y: Math.round(w.height * inset),
    w: Math.round(w.width  * (1 - inset * 2)),
    h: Math.round(w.height * (1 - inset * 2)),
  };
  cropAR.value = null;
  cropPreset.value = 'free';
  cropMode.value = 'crop';
}
function cancelCrop () { cropMode.value = 'idle'; cropRect.value = null; }
function applyCropOp () {
  const r = cropRect.value;
  if (r) commit(edit.crop(work.value, r.x, r.y, r.w, r.h));
  cropMode.value = 'idle';
  cropRect.value = null;
  syncResize();
}

function applyPreset (preset) {
  const w = work.value; if (!w) return;
  cropPreset.value = preset.id;
  let ar = preset.ar;
  if (ar === 'img')    ar = w.width / w.height;
  if (ar === 'screen') ar = screenAR();
  cropAR.value = ar; // null for 'free'
  if (ar) cropRect.value = centeredRect(ar, w.width, w.height);
}

function nextCrop (d, p, W, H, ar) {
  const r = d.rect;
  const startL = r.x, startT = r.y, startR = r.x + r.w, startB = r.y + r.h;

  if (d.type === 'move') {
    const dx = p.x - d.origin.x, dy = p.y - d.origin.y;
    const l = Math.min(Math.max(0, r.x + dx), W - r.w);
    const t = Math.min(Math.max(0, r.y + dy), H - r.h);
    return { x: Math.round(l), y: Math.round(t), w: r.w, h: r.h };
  }

  const west = d.type.includes('w'), east = d.type.includes('e');
  const north = d.type.includes('n'), south = d.type.includes('s');

  if (!ar) {
    let l = startL, t = startT, rgt = startR, bot = startB;
    if (west)  l   = Math.min(Math.max(0, p.x), rgt - MIN_CROP);
    if (east)  rgt = Math.max(Math.min(W, p.x), l + MIN_CROP);
    if (north) t   = Math.min(Math.max(0, p.y), bot - MIN_CROP);
    if (south) bot = Math.max(Math.min(H, p.y), t + MIN_CROP);
    return { x: Math.round(l), y: Math.round(t), w: Math.round(rgt - l), h: Math.round(bot - t) };
  }

  const minW = Math.max(MIN_CROP, MIN_CROP * ar);
  let ax, ay, w, h;

  if ((east || west) && (north || south)) {
    ax = east ? startL : startR;
    ay = south ? startT : startB;
    w = Math.max(Math.abs(p.x - ax), Math.abs(p.y - ay) * ar);
    const maxW = east ? (W - ax) : ax;
    const maxH = south ? (H - ay) : ay;
    w = Math.min(w, maxW, maxH * ar);
  } else if (east || west) {
    ax = east ? startL : startR;
    const cy = (startT + startB) / 2;
    w = Math.abs(p.x - ax);
    const maxW = east ? (W - ax) : ax;
    w = Math.max(minW, Math.min(w, maxW, 2 * Math.min(cy, H - cy) * ar));
    h = w / ar;
    const l = east ? ax : ax - w;
    return round4(l, cy - h / 2, w, h);
  } else {
    ay = south ? startT : startB;
    const cx = (startL + startR) / 2;
    h = Math.abs(p.y - ay);
    const maxH = south ? (H - ay) : ay;
    h = Math.max(minW / ar, Math.min(h, maxH, 2 * Math.min(cx, W - cx) / ar));
    w = h * ar;
    const t = south ? ay : ay - h;
    return round4(cx - w / 2, t, w, h);
  }

  w = Math.max(w, minW);
  h = w / ar;
  const l = east ? ax : ax - w;
  const t = south ? ay : ay - h;
  return round4(l, t, w, h);
}

const round4 = (x, y, w, h) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });

function onResizeInput (which, value) {
  const w = work.value; if (!w) return;
  value = Math.max(1, Math.round(value || 0));
  if (lockAR.value) {
    const ar = w.width / w.height;
    if (which === 'w') { resizeW.value = value; resizeH.value = Math.max(1, Math.round(value / ar)); }
    else               { resizeH.value = value; resizeW.value = Math.max(1, Math.round(value * ar)); }
  } else {
    if (which === 'w') resizeW.value = value; else resizeH.value = value;
  }
}
function applyResize () {
  const w = work.value; if (!w) return;
  if (resizeW.value === w.width && resizeH.value === w.height) return;
  commit(edit.resize(w, resizeW.value, resizeH.value));
}

async function exportImage () {
  const w = work.value; if (!w) return;
  busy.value = true;
  try {
    const flat = edit.applyFilter(w, filters.value);
    const fmt  = fmtOf(exportFmt.value);
    const blob = await edit.toBlob(flat, fmt.type, quality.value / 100);
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `${edName.value}.${fmt.ext}` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    edError.value = err?.message || String(err);
  } finally {
    busy.value = false;
  }
}

function ToolButton ({ icon, label, onClick, disabled, active }) {
  return html`
    <button class=${'tbtn' + (active ? ' active' : '')} onClick=${onClick}
            disabled=${disabled} title=${label} aria-label=${label}>
      <${Icon} name=${icon} size="18" />
    </button>`;
}

const Sep = () => html`<span class="tsep"></span>`;

function EditToolbar ({ onOpen }) {
  const has = !!work.value;
  const cropping = cropMode.value === 'crop';
  return html`
    <div class="toolbar">
      <${ToolButton} icon="mdi:folder-image" label="Open image" onClick=${onOpen} />
      <${Sep} />
      <${ToolButton} icon="mdi:undo" label="Undo" onClick=${undoOp} disabled=${!undo.value.length} />
      <${ToolButton} icon="mdi:redo" label="Redo" onClick=${redoOp} disabled=${!redo.value.length} />
      <${Sep} />
      <${ToolButton} icon="mdi:rotate-left"  label="Rotate left"  onClick=${() => rotate('ccw')} disabled=${!has || cropping} />
      <${ToolButton} icon="mdi:rotate-right" label="Rotate right" onClick=${() => rotate('cw')}  disabled=${!has || cropping} />
      <${ToolButton} icon="mdi:flip-horizontal" label="Flip horizontal" onClick=${() => flip('h')} disabled=${!has || cropping} />
      <${ToolButton} icon="mdi:flip-vertical"   label="Flip vertical"   onClick=${() => flip('v')} disabled=${!has || cropping} />
      <${Sep} />
      <${ToolButton} icon="mdi:crop" label="Crop" active=${cropping} onClick=${() => cropping ? cancelCrop() : enterCrop()} disabled=${!has} />

      <div class="spacer"></div>

      <${ToolButton} icon="mdi:image-outline" label="Back to viewer" onClick=${() => setScreen('view')} />
      <${ToolButton} icon="mdi:restore" label="Reset to original" onClick=${resetEdit} disabled=${!dirty.value} />
    </div>`;
}

function CropBar () {
  const r = cropRect.value;
  return html`
    <div class="cropbar">
      <span class="cb-label">Aspect</span>
      <div class="cb-presets">
        ${CROP_PRESETS.map(p => html`
          <button class=${'chip' + (cropPreset.value === p.id ? ' active' : '')} key=${p.id}
                  title=${p.id === 'screen' ? `${window.screen?.width || '?'}×${window.screen?.height || '?'}` : p.label}
                  onClick=${() => applyPreset(p)}>${p.label}</button>`)}
      </div>
      <div class="spacer"></div>
      ${r && html`<span class="crop-size">${r.w} × ${r.h}</span>`}
      <button class="btn ghost"   onClick=${cancelCrop}>Cancel</button>
      <button class="btn primary" onClick=${applyCropOp}><${Icon} name="mdi:check" size="16" /> Apply crop</button>
    </div>`;
}

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function CropOverlay () {
  const r = cropRect.value;
  const w = work.value;
  const drag = useRef(null);
  const boxRef = useRef(null);

  const toImage = (clientX, clientY) => {
    const overlay = boxRef.current?.parentElement;
    const b = overlay.getBoundingClientRect();
    return {
      x: (clientX - b.left) * (w.width  / b.width),
      y: (clientY - b.top)  * (w.height / b.height),
    };
  };

  useEffect(() => {
    const move = e => {
      const d = drag.current; if (!d) return;
      const p = toImage(e.clientX, e.clientY);
      cropRect.value = nextCrop(d, p, w.width, w.height, cropAR.value);
    };
    const up = () => { drag.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [w]);

  const start = type => e => {
    e.preventDefault(); e.stopPropagation();
    drag.current = { type, origin: toImage(e.clientX, e.clientY), rect: cropRect.value };
  };

  const pct = { left: `${r.x / w.width * 100}%`, top: `${r.y / w.height * 100}%`,
                width: `${r.w / w.width * 100}%`, height: `${r.h / w.height * 100}%` };

  return html`
    <div class="crop-layer">
      <div ref=${boxRef} class="crop-box"
           style=${`left:${pct.left};top:${pct.top};width:${pct.width};height:${pct.height}`}
           onPointerDown=${start('move')}>
        <div class="crop-grid"></div>
        ${HANDLES.map(h => html`<span class=${'h h-' + h} key=${h} onPointerDown=${start(h)}></span>`)}
      </div>
    </div>`;
}

function EditStage ({ onPick }) {
  const w = work.value;
  const ref = useRef(null);

  useEffect(() => {
    if (!w || !ref.current) return;
    const c = ref.current;
    c.width = w.width; c.height = w.height;
    c.getContext('2d').drawImage(w, 0, 0);
  }, [w]);

  const onDrop = e => {
    e.preventDefault(); edDrag.value = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  };
  const stop = e => { e.preventDefault(); edDrag.value = true; };

  return html`
    <div class=${'stage' + (edDrag.value ? ' dropping' : '')}
         onDragOver=${stop}
         onDragLeave=${e => { if (e.target === e.currentTarget) edDrag.value = false; }}
         onDrop=${onDrop}>
      ${w ? html`
        <div class="canvas-wrap">
          <canvas ref=${ref} class="view" style=${`filter:${edit.filterString(filters.value)}`}></canvas>
          ${cropMode.value === 'crop' && html`<${CropOverlay} />`}
        </div>`
        : html`
        <button class="empty" onClick=${onPick}>
          <${Icon} name="mdi:image-plus-outline" size=${64} />
          <p>Open an image</p>
          <p class="sub">click to browse, or drop a file anywhere here</p>
        </button>`}
      <div class="drop-hint"><${Icon} name="mdi:tray-arrow-down" size=${40} /> <span>Drop to open</span></div>
    </div>`;
}

function EdSlider ({ label, value, min, max, onInput, suffix = '%', reset }) {
  return html`
    <label class="slider">
      <span class="s-head">
        <span>${label}</span>
        <button class="s-val" onClick=${reset} title="Reset">${value}${suffix}</button>
      </span>
      <input type="range" min=${min} max=${max} value=${value}
             onInput=${e => onInput(+e.target.value)} />
    </label>`;
}

function Adjustments () {
  const f = filters.value;
  const set = (k, v) => filters.value = { ...filters.value, [k]: v };
  return html`
    <section class="panel-sec">
      <${EdSlider} label="Brightness" value=${f.brightness} min="0" max="200" onInput=${v => set('brightness', v)} reset=${() => set('brightness', 100)} />
      <${EdSlider} label="Contrast"   value=${f.contrast}   min="0" max="200" onInput=${v => set('contrast', v)}   reset=${() => set('contrast', 100)} />
      <${EdSlider} label="Saturation" value=${f.saturate}   min="0" max="200" onInput=${v => set('saturate', v)}   reset=${() => set('saturate', 100)} />
      <${EdSlider} label="Grayscale"  value=${f.grayscale}  min="0" max="100" onInput=${v => set('grayscale', v)}  reset=${() => set('grayscale', 0)} />
      ${!edit.isIdentity(f) && html`
        <button class="btn ghost wide" onClick=${() => filters.value = { ...edit.IDENTITY }}>
          <${Icon} name="mdi:backup-restore" size="16" /> Reset adjustments
        </button>`}
    </section>`;
}

function ResizePanel () {
  return html`
    <section class="panel-sec">
      <div class="dim-row">
        <label class="field"><span>W</span>
          <input type="number" min="1" value=${resizeW.value} onInput=${e => onResizeInput('w', +e.target.value)} />
        </label>
        <button class=${'lock' + (lockAR.value ? ' on' : '')} title="Lock aspect ratio"
                onClick=${() => lockAR.value = !lockAR.value}>
          <${Icon} name=${lockAR.value ? 'mdi:link-variant' : 'mdi:link-variant-off'} size="16" />
        </button>
        <label class="field"><span>H</span>
          <input type="number" min="1" value=${resizeH.value} onInput=${e => onResizeInput('h', +e.target.value)} />
        </label>
      </div>
      <button class="btn wide" onClick=${applyResize}
              disabled=${!work.value || (resizeW.value === dims.value?.w && resizeH.value === dims.value?.h)}>
        Apply resize
      </button>
    </section>`;
}

function ExportPanel () {
  const fmt = fmtOf(exportFmt.value);
  return html`
    <section class="panel-sec">
      <div class="seg wide">
        ${FORMATS.map(f => html`
          <button class=${'seg-btn' + (exportFmt.value === f.type ? ' active' : '')} key=${f.type}
                  onClick=${() => exportFmt.value = f.type}>${f.label}</button>`)}
      </div>
      ${fmt.lossy && html`
        <${EdSlider} label="Quality" value=${quality.value} min="10" max="100" suffix="" onInput=${v => quality.value = v} reset=${() => quality.value = 92} />`}
      <label class="field wide"><span>Name</span>
        <input type="text" value=${edName.value} onInput=${e => edName.value = e.target.value} />
        <em>.${fmt.ext}</em>
      </label>
      <button class="btn primary wide" onClick=${exportImage} disabled=${!work.value || busy.value}>
        <${Icon} name="mdi:download" size="16" /> Download
      </button>
    </section>`;
}

function EditPanel () {
  if (!work.value) return html`<aside class="panel empty-panel"><p>No image loaded.</p></aside>`;
  const tab = panelTab.value;
  return html`
    <aside class="panel">
      <nav class="tabs">
        ${TABS.map(t => html`
          <button class=${'tab' + (tab === t.id ? ' active' : '')} key=${t.id}
                  onClick=${() => panelTab.value = t.id}>
            <${Icon} name=${t.icon} size="16" /> <span>${t.label}</span>
          </button>`)}
      </nav>
      <div class="tab-body">
        ${tab === 'adjust' && html`<${Adjustments} />`}
        ${tab === 'resize' && html`<${ResizePanel} />`}
        ${tab === 'export' && html`<${ExportPanel} />`}
      </div>
    </aside>`;
}

function EditStatusBar () {
  const d = dims.value;
  return html`
    <footer class="statusbar">
      <${Icon} name="mdi:image-outline" size="14" />
      <span>${d ? `${d.w} × ${d.h} px` : 'no image'}</span>
      ${edError.value && html`<span class="err"><${Icon} name="mdi:alert-outline" size="14" /> ${edError.value}</span>`}
      <span class="spacer"></span>
      ${busy.value && html`<span class="working"><${Icon} name="svg-spinners:bars-scale-middle" size="14" /> working…</span>`}
      ${dirty.value && !busy.value && html`<span class="edited">edited</span>`}
    </footer>`;
}

function EditMode () {
  const fileInput = useRef(null);
  const pick = () => fileInput.current?.click();

  useEffect(() => {
    // pull in the tray's current image if the editor is empty
    if (!work.value && current.value && edLoadedFrom !== current.value.file) loadFile(current.value.file);

    const onKey = e => {
      if (e.key === 'Escape' && cropMode.value === 'crop') { cancelCrop(); return; }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undoOp(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redoOp(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return html`
    <div class="ed">
      <${EditToolbar} onOpen=${pick} />
      ${cropMode.value === 'crop' && html`<${CropBar} />`}
      <div class="body">
        <${EditStage} onPick=${pick} />
        <${EditPanel} />
      </div>
      <${EditStatusBar} />
      <input ref=${fileInput} type="file" accept="image/*" hidden
             onChange=${e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }} />
    </div>`;
}


// :::::: SHELL ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

function ModeBar () {
  return html`
    <header class="im-modebar">
      <div class="im-brand"><${Icon} name="mdi:image-multiple-outline" size=${18} /> <span>images</span></div>
      <nav class="im-modes">
        ${MODES.map(m => html`
          <button class=${'im-mode' + (screen.value === m.id ? ' active' : '')} key=${m.id}
                  onClick=${() => m.id === 'edit' ? editCurrent() : setScreen(m.id)}
                  title=${m.label}>
            <${Icon} name=${m.icon} size=${18} /> <span>${m.label}</span>
          </button>`)}
      </nav>
      <div class="im-modebar-actions"><${AppSettings} /></div>
    </header>`;
}

function App () {
  useEffect(() => { wireLaunchQueue(); return () => revokeAll(); }, []);
  return html`
    <div class="im-app">
      <${ModeBar} />
      <div class="im-body">
        ${screen.value === 'edit' ? html`<${EditMode} />` : html`<${ViewMode} />`}
      </div>
    </div>`;
}

// :::::: BOOT :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

boot({ config, App });
