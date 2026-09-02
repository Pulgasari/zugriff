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
import { html, Fragment, signal, computed, useEffect, useRef, useState } from '@aufbau/kits/preact-htm';
import { useGesture } from '@aufbau/gestures/preact';

// ::: shared
import { zugriff } from '/.shared/js/runtime.js';
const app = zugriff.app('images');
import { Icon, IconButton, InstallTip, AppSettings } from '/.shared/js/components/index.js';
import { stored }            from '/.shared/js/app/signals.js';
import * as pwa              from '/.shared/js/app/pwa.js';

// ::: local
import * as edit    from './edit.js';
import * as fx      from './filters.js';
import * as library from './library.js';


// :::::: MODE ROUTING (Option B: ?mode=) :::::::::::::::::::::::::::::::::::::::

const MODES = [
  { id: 'library', label: 'Library', icon: 'mdi:folder-multiple-image' },
  { id: 'view',    label: 'View',    icon: 'mdi:image-outline' },
  { id: 'edit',    label: 'Edit',    icon: 'mdi:image-edit-outline' },
  { id: 'convert', label: 'Convert', icon: 'mdi:image-sync-outline' },
  { id: 'batch',   label: 'Batch',   icon: 'mdi:image-multiple-outline' },
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
const vEffect = signal('none');   // a live, view-only css effect (non-destructive)

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


function ViewTopBar () {
  const s = current.value;
  return html`
    <header class="iv-top">
      <div class="iv-title">
        <${Icon} name="image" />
        <span class="iv-name" title=${s?.name}>${s?.name || 'Image Viewer'}</span>
        ${many.value && html`<span class="iv-count">${idx.value + 1} / ${shots.value.length}</span>`}
        ${s && html`<span class="iv-meta">${[s.type?.split('/')[1]?.toUpperCase(), fmtSize(s.size)].filter(Boolean).join(' · ')}</span>`}
      </div>
      <div class="iv-actions">
        <${IconButton} className="iv-btn" icon="mdi:folder-open-outline"   label="Open images" onClick=${openPicker} />
        <${IconButton} className="iv-btn" icon="mdi:image-edit-outline"    label="Edit this image" onClick=${editCurrent} disabled=${!s} />
        <${IconButton} className="iv-btn" icon="zoom-out"                  label="Zoom out"    onClick=${() => setZoom(zoom.value / 1.4)} disabled=${!s || zoom.value <= 1} />
        <${IconButton} className="iv-btn" icon="zoom-in"                   label="Zoom in"     onClick=${() => setZoom(zoom.value * 1.4)} disabled=${!s} />
        <${IconButton} className="iv-btn" icon="mdi:fit-to-screen-outline" label="Fit"         onClick=${resetView} disabled=${!s || (zoom.value === 1 && pan.value.x === 0 && pan.value.y === 0)} />
        <${IconButton} className="iv-btn" icon="download"                  label="Download"    onClick=${downloadCurrent} disabled=${!s} />
        ${s && html`
          <select class="iv-fx-select" title="Live effect (view only, not saved)" aria-label="Effect"
                  value=${vEffect.value} onChange=${e => vEffect.value = e.target.value}>
            ${fx.EFFECTS.filter(x => x.cssBacked).map(x => html`
              <option value=${x.id}>${x.id === 'none' ? 'No effect' : x.name}</option>`)}
          </select>`}
        ${many.value && html`<${IconButton} className="iv-btn" icon=${strip.value ? 'mdi:view-carousel-outline' : 'mdi:view-carousel'} label="Toggle thumbnails" active=${strip.value} onClick=${() => strip.value = !strip.value} />`}
        <${IconButton} className="iv-btn" icon="mdi:fullscreen"            label="Fullscreen"  onClick=${toggleFullscreen} />
        <${IconButton} className="iv-btn" icon="mdi:eye-off-outline"       label="Hide chrome (tap image to restore)" onClick=${() => bare.value = true} disabled=${!s} />
        ${s && html`<${IconButton} className="iv-btn" icon="mdi:close" label="Close image" onClick=${removeCurrent} />`}
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
  if (pwa.isInstalled.value) {
    return html`<p class="iv-tip"><${Icon} name="mdi:check-circle-outline" />
      Installed — pick <b>Images</b> from your device’s <b>Open with</b> menu to send images straight here.</p>`;
  }
  return html`
    <div class="iv-tip install">
      <${Icon} name="mdi:cellphone-arrow-down" />
      <div>
        <span>Install the app to open images from your gallery or files with it.</span>
        ${pwa.canInstall.value
          ? html`<button class="iv-cta small" onClick=${() => pwa.promptInstall()}>
              <${Icon} name="download" /> Install app</button>`
          : html`<span class="iv-tip-hint">Use your browser’s <b>Install</b> / <b>Add to Home screen</b> menu.</span>`}
      </div>
    </div>`;
}

function Welcome () {
  return html`
    <div class="iv-welcome">
      <${Icon} name="images" />
      <h1>View an image</h1>
      <p>Open images from your device, or just drop them here. Nothing is
         uploaded — they stay on your machine.</p>
      <button class="iv-cta" onClick=${openPicker}>
        <${Icon} name="mdi:folder-open-outline" /> Open images</button>
      ${vError.value && html`<p class="iv-error"><${Icon} name="mdi:alert-outline" /> ${vError.value}</p>`}
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
                      style=${`transform: translate(${pan.value.x}px, ${pan.value.y}px) scale(${zoom.value})`
                        + (fx.cssValue(vEffect.value) ? `; filter: ${fx.cssValue(vEffect.value)}` : '')} />`
          : html`<${Welcome} />`}

        ${many.value && !bare.value && html`
          <button class="iv-nav prev" aria-label="Previous" onClick=${e => { e.stopPropagation(); go(-1); }}>
            <${Icon} name="mdi:chevron-left" /></button>
          <button class="iv-nav next" aria-label="Next" onClick=${e => { e.stopPropagation(); go(1); }}>
            <${Icon} name="mdi:chevron-right" /></button>`}
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
const panelTab  = stored('adjust', 'images:edit:tab'); // 'adjust' | 'effects' | 'resize' | 'export'

const effect    = stored('none', 'images:edit:effect'); // an @aufbau/filters id, or 'none'
const effectAmt = signal(1);                             // the effect's `amount`, when it has one

function selectEffect (id) {
  effect.value = id;
  const e = fx.effectById(id);
  effectAmt.value = e?.amount ? e.amount.default : 1;
}

const HISTORY  = 30;
const MIN_CROP = 8; // px

const dims  = computed(() => work.value ? { w: work.value.width, h: work.value.height } : null);
const dirty = computed(() => undo.value.length > 0 || !edit.isIdentity(filters.value) || effect.value !== 'none');

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
  { id: 'adjust',  label: 'Adjust',  icon: 'mdi:tune-variant' },
  { id: 'effects', label: 'Effects', icon: 'mdi:auto-fix' },
  { id: 'resize',  label: 'Resize',  icon: 'mdi:resize' },
  { id: 'export',  label: 'Export',  icon: 'mdi:export-variant' },
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
    effect.value   = 'none';
    effectAmt.value = 1;
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
  effect.value = 'none';
  effectAmt.value = 1;
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
    fx.bake(flat, effect.value, { amount: effectAmt.value });
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
      <${Icon} name=${icon} />
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
      <button class="btn primary" onClick=${applyCropOp}><${Icon} name="mdi:check" /> Apply crop</button>
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
  const wrapRef = useRef(null);
  const eff = effect.value;      // subscribe so the preview effect re-runs on change
  const amt = effectAmt.value;

  useEffect(() => {
    if (!w || !ref.current) return;
    const c = ref.current;
    c.width = w.width; c.height = w.height;
    c.getContext('2d').drawImage(w, 0, 0);
  }, [w]);

  // the aufbau effect is a live, non-destructive layer on the canvas wrapper; the
  // brightness/contrast adjustments stay a css filter on the canvas itself, so the
  // two compose. both are baked into the pixels on export (exportImage).
  useEffect(() => { fx.preview(wrapRef.current, eff, { amount: amt }); }, [eff, amt, w]);

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
        <div class="canvas-wrap" ref=${wrapRef}>
          <canvas ref=${ref} class="view" style=${`filter:${edit.filterString(filters.value)}`}></canvas>
          ${cropMode.value === 'crop' && html`<${CropOverlay} />`}
        </div>`
        : html`
        <button class="empty" onClick=${onPick}>
          <${Icon} name="mdi:image-plus-outline" />
          <p>Open an image</p>
          <p class="sub">click to browse, or drop a file anywhere here</p>
        </button>`}
      <div class="drop-hint"><${Icon} name="mdi:tray-arrow-down" /> <span>Drop to open</span></div>
    </div>`;
}

function EdSlider ({ label, value, min, max, onInput, suffix = '%', reset, step = 1 }) {
  return html`
    <label class="slider">
      <span class="s-head">
        <span>${label}</span>
        <button class="s-val" onClick=${reset} title="Reset">${value}${suffix}</button>
      </span>
      <input type="range" min=${min} max=${max} step=${step} value=${value}
             onInput=${e => onInput(+e.target.value)} />
    </label>`;
}

function EffectsPanel () {
  const cur = effect.value;
  const e   = fx.effectById(cur);
  return html`
    <section class="panel-sec">
      <div class="im-fx-grid">
        ${fx.EFFECTS.map(x => html`
          <button class=${'im-fx' + (cur === x.id ? ' active' : '')} key=${x.id}
                  title=${!x.previewable && x.id !== 'none' ? 'Applied on export (no live preview)' : x.name}
                  onClick=${() => selectEffect(x.id)}>
            ${x.name}${!x.previewable && x.id !== 'none' ? ' *' : ''}
          </button>`)}
      </div>
      ${cur !== 'none' && e?.amount && html`
        <${EdSlider} label="Amount" suffix="" value=${effectAmt.value}
          min=${e.amount.min} max=${e.amount.max} step=${e.amount.step ?? 0.05}
          onInput=${v => effectAmt.value = v} reset=${() => effectAmt.value = e.amount.default} />`}
      ${cur !== 'none' && e && !e.previewable && html`
        <p class="im-fx-note">* No live preview for this effect — it’s applied when you export.</p>`}
    </section>`;
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
          <${Icon} name="mdi:backup-restore" /> Reset adjustments
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
          <${Icon} name=${lockAR.value ? 'mdi:link-variant' : 'mdi:link-variant-off'} />
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
        <${Icon} name="mdi:download" /> Download
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
            <${Icon} name=${t.icon} /> <span>${t.label}</span>
          </button>`)}
      </nav>
      <div class="tab-body">
        ${tab === 'adjust'  && html`<${Adjustments} />`}
        ${tab === 'effects' && html`<${EffectsPanel} />`}
        ${tab === 'resize'  && html`<${ResizePanel} />`}
        ${tab === 'export'  && html`<${ExportPanel} />`}
      </div>
    </aside>`;
}

function EditStatusBar () {
  const d = dims.value;
  return html`
    <footer class="statusbar">
      <${Icon} name="mdi:image-outline" />
      <span>${d ? `${d.w} × ${d.h} px` : 'no image'}</span>
      ${edError.value && html`<span class="err"><${Icon} name="mdi:alert-outline" /> ${edError.value}</span>`}
      <span class="spacer"></span>
      ${busy.value && html`<span class="working"><${Icon} name="svg-spinners:bars-scale-middle" /> working…</span>`}
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


// :::::: LIBRARY MODE (folder galleries via File System Access) :::::::::::::::

const libMsg    = signal('');
const libSearch = signal('');
const libFolder = signal('');   // '' = all folders, else a sourceId

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

const visiblePics = computed(() => {
  const q = libSearch.value.trim().toLowerCase();
  let list = library.pics.value;
  if (libFolder.value) list = list.filter(p => p.sourceId === libFolder.value);
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q));
  return [...list].sort(byName);
});

async function addFolderAction () {
  libMsg.value = '';
  if (!library.fs.supported()) { libMsg.value = 'This browser can’t open folders — try a Chromium-based one.'; return; }
  try { await library.addFolder(); }
  catch (err) { libMsg.value = err?.message || String(err); }
}

/** open an image record into the view mode */
async function openInView (pic) {
  try {
    const file = await library.openFile(pic);
    setFiles([file]);
    setScreen('view');
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
          const file = await library.openFile(pic);
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
        : html`<div class="im-thumb-ph"><${Icon} name="mdi:image-outline" /></div>`}
      <span class="im-thumb-name">${pic.name}</span>
    </button>`;
}

function ReconnectBar () {
  const stale = library.sources.value.filter(s => library.perms.value[s.id] && library.perms.value[s.id] !== 'granted');
  if (!stale.length) return null;
  return html`
    <div class="im-reconnect">
      <${Icon} name="mdi:folder-alert-outline" />
      <span>${stale.length} folder${stale.length === 1 ? '' : 's'} need reconnecting to read on this device.</span>
      ${stale.map(s => html`
        <div class="im-reconnect-item" key=${s.id}>
          <span class="im-reconnect-name">${s.name}</span>
          <button class="btn small primary" onClick=${() => library.reconnect(s.id).then(res => {
            if (!res.granted) libMsg.value = `Reconnect failed — ${res.error ? (res.error.name || 'error') : 'browser said “' + res.state + '”'}. Try “Choose folder”.`;
          })}>
            <${Icon} name="mdi:folder-key-outline" /> Reconnect</button>
          <button class="btn small ghost" title="Re-select the folder — always works"
                  onClick=${() => library.repick(s.id).then(ok => { if (!ok) libMsg.value = `Could not open ${s.name}`; })}>
            <${Icon} name="mdi:folder-search-outline" /> Choose folder</button>
        </div>`)}
    </div>`;
}

function FolderChips () {
  const list = library.sources.value;
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
  useEffect(() => { library.ensureLoaded(); }, []);

  if (!library.ready.value) {
    return html`<div class="im-lib"><div class="im-booting"><${Icon} name="svg-spinners:bars-scale-middle" /></div></div>`;
  }

  const pics       = visiblePics.value;
  const hasFolders = library.sources.value.length > 0;
  const scanning   = Object.values(library.scanning.value).some(Boolean);

  return html`
    <div class="im-lib">
      <header class="im-lib-head">
        ${scanning && html`<span class="im-scan-note"><${Icon} name="svg-spinners:bars-scale-middle" /> scanning…</span>`}
        <div class="im-lib-search">
          <${Icon} name="mdi:magnify" />
          <input type="search" placeholder="Search images…" value=${libSearch.value}
                 onInput=${e => libSearch.value = e.target.value} />
          ${libSearch.value && html`<button class="iv-btn" aria-label="Clear" onClick=${() => libSearch.value = ''}>
            <${Icon} name="mdi:close" /></button>`}
        </div>
        ${hasFolders && html`<button class="iv-btn" title="Rescan folders" onClick=${() => library.rescanAll()}><${Icon} name="mdi:refresh" /></button>`}
        <button class="btn primary" onClick=${addFolderAction}>
          <${Icon} name="mdi:folder-plus-outline" /> Add folder</button>
      </header>

      ${libMsg.value && html`<div class="im-lib-msg"><${Icon} name="mdi:alert-outline" /> ${libMsg.value}
        <button class="iv-btn" aria-label="Dismiss" onClick=${() => libMsg.value = ''}><${Icon} name="mdi:close" /></button></div>`}

      <${ReconnectBar} />
      <${InstallTip} show=${library.sources.value.length > 0}
                     message="Install the app to keep your image folders connected between visits — no reconnecting." />
      <${FolderChips} />

      ${!hasFolders
        ? html`
          <div class="im-lib-empty">
            <${Icon} name="mdi:folder-multiple-image" />
            <p class="im-empty-title">Browse an image folder</p>
            <p class="im-empty-hint">Grant a folder off your device and browse it as a gallery — open any image into the viewer or editor. Nothing is uploaded; only the folder permission is remembered.</p>
            <button class="btn primary" onClick=${addFolderAction}>
              <${Icon} name="mdi:folder-plus-outline" /> Add a folder</button>
          </div>`
        : pics.length
          ? html`<div class="im-scroll"><aufbau-index class="im-grid" viewmode="grid" item-size="140px" gap="0.6rem">
              ${pics.map(p => html`<${Thumb} key=${p.key} pic=${p} />`)}
            </aufbau-index></div>`
          : html`
            <div class="im-lib-empty">
              <${Icon} name=${libSearch.value ? 'mdi:image-search-outline' : 'mdi:image-off-outline'} />
              <p class="im-empty-title">${libSearch.value ? 'Nothing matches your search' : 'No images here yet'}</p>
              ${!libSearch.value && html`<p class="im-empty-hint">Scanning may still be running, or this folder has no images.</p>`}
            </div>`}
    </div>`;
}


// :::::: TOOL MODES SHARED (convert + batch) ::::::::::::::::::::::::::::::::::

const uid = () => (crypto.randomUUID?.() ?? (Date.now().toString(36) + Math.random().toString(36).slice(2)));

/** File list -> pending entries with a preview url (images only) */
function dropEntries (fileList) {
  return [...fileList]
    .filter(isImageFile)
    .map(f => ({ id: uid(), file: f, status: 'pending', previewUrl: URL.createObjectURL(f) }));
}

function ImgDrop ({ onFiles, label }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const onDrop = e => { e.preventDefault(); setOver(false); if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files); };
  return html`
    <div class=${'im-drop' + (over ? ' over' : '')}
         onDragOver=${e => { e.preventDefault(); setOver(true); }}
         onDragLeave=${e => { if (e.target === e.currentTarget) setOver(false); }}
         onDrop=${onDrop}
         onClick=${() => inputRef.current?.click()}>
      <${Icon} name="mdi:image-plus" />
      <p>${label || 'Drop images here, or click to choose'}</p>
      <input ref=${inputRef} type="file" accept="image/*" multiple hidden
             onChange=${e => { onFiles(e.target.files); e.target.value = ''; }} />
    </div>`;
}

function ToolFileItem ({ entry, onRemove }) {
  const icon = {
    pending    : 'mdi:image-outline',
    converting : 'mdi:loading',
    processing : 'mdi:loading',
    done       : 'mdi:check-circle-outline',
    error      : 'mdi:alert-circle-outline',
  }[entry.status];
  const busyRow = entry.status === 'converting' || entry.status === 'processing';
  const label = {
    pending    : '',
    converting : 'converting…',
    processing : 'processing…',
    done       : entry.outName,
    error      : entry.error,
  }[entry.status];
  return html`
    <div class=${'im-fileitem ' + entry.status}>
      <div class="im-fi-thumb"><img src=${entry.previewUrl} alt=${entry.file.name} /></div>
      <${Icon} name=${icon} class=${busyRow ? 'spin' : ''} />
      <span class="im-fi-name">${entry.file.name}</span>
      ${label && html`<span class="im-fi-label">${label}</span>`}
      ${entry.status === 'done' && html`
        <a class="tbtn" href=${entry.blobUrl} download=${entry.outName} title="Download"><${Icon} name="mdi:download" /></a>`}
      ${!busyRow && html`
        <button class="tbtn" title="Remove" onClick=${() => onRemove(entry.id)}><${Icon} name="mdi:close" /></button>`}
    </div>`;
}


// :::::: CONVERT MODE (ex image-converter) ::::::::::::::::::::::::::::::::::::

const cvFiles   = signal([]);
const cvFormat  = stored('webp', 'images:convert:format');
const cvQuality = stored(90, 'images:convert:quality');
const CV_FORMATS = ['jpg', 'png', 'webp'];

const cvUpdate    = (id, patch) => cvFiles.value = cvFiles.value.map(f => f.id === id ? { ...f, ...patch } : f);
const cvAddFiles  = list => cvFiles.value = [...cvFiles.value, ...dropEntries(list)];
const cvRemove    = id => { const e = cvFiles.value.find(f => f.id === id); if (e?.blobUrl) URL.revokeObjectURL(e.blobUrl); URL.revokeObjectURL(e?.previewUrl); cvFiles.value = cvFiles.value.filter(f => f.id !== id); };
const cvConvertAll = () => Promise.all(cvFiles.value.filter(f => f.status === 'pending').map(cvConvertOne));

async function cvConvertOne (entry) {
  cvUpdate(entry.id, { status: 'converting' });
  try {
    const bitmap = await createImageBitmap(entry.file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (cvFormat.value === 'jpg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const mime = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' }[cvFormat.value];
    const blob = await new Promise(res => canvas.toBlob(res, mime, cvQuality.value / 100));
    if (!blob) throw new Error('Conversion failed');
    const blobUrl = URL.createObjectURL(blob);
    const outName = entry.file.name.replace(/\.[^.]+$/, '') + '.' + cvFormat.value;
    cvUpdate(entry.id, { status: 'done', blobUrl, outName });
  } catch (error) {
    cvUpdate(entry.id, { status: 'error', error: error.message });
  }
}

function cvDownloadAll () {
  cvFiles.value.filter(f => f.status === 'done').forEach(f =>
    Object.assign(document.createElement('a'), { href: f.blobUrl, download: f.outName }).click());
}

function ConvertMode () {
  const list       = cvFiles.value;
  const pendingCnt = list.filter(f => f.status === 'pending').length;
  const hasDone    = list.some(f => f.status === 'done');
  const lossy      = cvFormat.value !== 'png';

  return html`
    <div class="im-tool">
      <${ImgDrop} onFiles=${cvAddFiles} />

      ${list.length > 0 && html`
        <div class="im-tool-options">
          <div class="seg">
            ${CV_FORMATS.map(f => html`
              <button class=${'seg-btn' + (cvFormat.value === f ? ' active' : '')} key=${f}
                      onClick=${() => cvFormat.value = f}>${f.toUpperCase()}</button>`)}
          </div>
          ${lossy && html`
            <label class="im-quality">Quality
              <input type="range" min="10" max="100" value=${cvQuality.value}
                     onInput=${e => cvQuality.value = +e.target.value} />
              <span>${cvQuality.value}%</span>
            </label>`}
        </div>

        <div class="im-filelist">
          ${list.map(e => html`<${ToolFileItem} key=${e.id} entry=${e} onRemove=${cvRemove} />`)}
        </div>

        <div class="im-tool-actions">
          ${pendingCnt > 0 && html`<button class="btn primary" onClick=${cvConvertAll}>
            <${Icon} name="mdi:cog-outline" /> Convert ${pendingCnt} file${pendingCnt > 1 ? 's' : ''}</button>`}
          ${hasDone && html`<button class="btn" onClick=${cvDownloadAll}>
            <${Icon} name="mdi:download-multiple" /> Download all</button>`}
        </div>`}
    </div>`;
}


// :::::: BATCH MODE (ex image-batch-processor) ::::::::::::::::::::::::::::::::

const bpFiles = signal([]);
const bpTasks = stored([], 'images:batch:tasks');
// start past the highest persisted id so a newly added task never collides with
// a restored one (the ids key move/remove/update)
let _bpId = bpTasks.value.reduce((m, t) => Math.max(m, typeof t.id === 'number' ? t.id : -1), -1) + 1;

const BP_TASK_TYPES = {
  blur       : { label: 'Blur',       icon: 'mdi:blur',               defaults: { radius: 4 } },
  brightness : { label: 'Brightness', icon: 'mdi:brightness-6',       defaults: { value: 0 } },
  contrast   : { label: 'Contrast',   icon: 'mdi:contrast-circle',    defaults: { value: 0 } },
  convert    : { label: 'Convert',    icon: 'mdi:image-sync-outline', defaults: { fmt: 'webp' } },
  crop       : { label: 'Crop',       icon: 'mdi:crop',               defaults: { x: 0, y: 0, w: 800, h: 600 } },
  filter     : { label: 'Filter',     icon: 'mdi:auto-fix',           defaults: { id: 'sepia', amount: 1 } },
  flip       : { label: 'Flip',       icon: 'mdi:flip-horizontal',    defaults: { axis: 'h' } },
  grayscale  : { label: 'Grayscale',  icon: 'mdi:contrast',           defaults: {} },
  quality    : { label: 'Quality',    icon: 'mdi:image-filter-hdr',   defaults: { value: 85 } },
  resize     : { label: 'Resize',     icon: 'mdi:resize',             defaults: { w: 800, h: '', lock: true } },
  rotate     : { label: 'Rotate',     icon: 'mdi:rotate-right',       defaults: { deg: 90 } },
  watermark  : { label: 'Watermark',  icon: 'mdi:watermark',          defaults: { text: '© 2025', size: 24, pos: 'br', opacity: 0.5 } },
};

const bpAddTask    = type => bpTasks.value = [...bpTasks.value, { id: _bpId++, type, params: { ...BP_TASK_TYPES[type].defaults } }];
const bpRemoveTask = id => bpTasks.value = bpTasks.value.filter(t => t.id !== id);
const bpMoveTask   = (id, dir) => {
  const arr = [...bpTasks.value];
  const i = arr.findIndex(t => t.id === id);
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  bpTasks.value = arr;
};
const bpUpdateTask = (id, patch) => bpTasks.value = bpTasks.value.map(t => t.id === id ? { ...t, params: { ...t.params, ...patch } } : t);

async function bpProcessOne (file) {
  let bitmap = await createImageBitmap(file);
  let canvas = document.createElement('canvas');
  let ctx    = canvas.getContext('2d');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  let fmt = file.type || 'image/webp';

  for (const task of bpTasks.value) {
    const p = task.params;
    const w = canvas.width, h = canvas.height;

    if (task.type === 'rotate') {
      const deg = ((p.deg % 360) + 360) % 360;
      const swap = deg === 90 || deg === 270;
      const tmp = document.createElement('canvas');
      tmp.width = swap ? h : w; tmp.height = swap ? w : h;
      const tc = tmp.getContext('2d');
      tc.translate(tmp.width / 2, tmp.height / 2);
      tc.rotate((deg * Math.PI) / 180);
      tc.drawImage(canvas, -w / 2, -h / 2);
      canvas = tmp; ctx = tc;
    }
    else if (task.type === 'flip') {
      const tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      const tc = tmp.getContext('2d');
      if (p.axis === 'h') { tc.scale(-1, 1); tc.drawImage(canvas, -w, 0); }
      else                { tc.scale(1, -1); tc.drawImage(canvas, 0, -h); }
      canvas = tmp; ctx = tc;
    }
    else if (task.type === 'resize') {
      const nw = p.w ? +p.w : Math.round(w * (+p.h / h));
      const nh = p.h ? +p.h : Math.round(h * (+p.w / w));
      const tmp = document.createElement('canvas');
      tmp.width = nw; tmp.height = nh;
      const tc = tmp.getContext('2d');
      tc.drawImage(canvas, 0, 0, nw, nh);
      canvas = tmp; ctx = tc;
    }
    else if (task.type === 'crop') {
      const tmp = document.createElement('canvas');
      tmp.width = +p.w; tmp.height = +p.h;
      const tc = tmp.getContext('2d');
      tc.drawImage(canvas, -p.x, -p.y);
      canvas = tmp; ctx = tc;
    }
    else if (task.type === 'convert') {
      fmt = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' }[p.fmt] ?? fmt;
    }
    else if (task.type === 'brightness' || task.type === 'contrast') {
      const id = ctx.getImageData(0, 0, w, h);
      const d = id.data;
      const v = +p.value;
      for (let i = 0; i < d.length; i += 4) {
        if (task.type === 'brightness') {
          d[i]   = Math.min(255, Math.max(0, d[i]   + v));
          d[i+1] = Math.min(255, Math.max(0, d[i+1] + v));
          d[i+2] = Math.min(255, Math.max(0, d[i+2] + v));
        } else {
          const f = (259 * (v + 255)) / (255 * (259 - v));
          d[i]   = Math.min(255, Math.max(0, f * (d[i]   - 128) + 128));
          d[i+1] = Math.min(255, Math.max(0, f * (d[i+1] - 128) + 128));
          d[i+2] = Math.min(255, Math.max(0, f * (d[i+2] - 128) + 128));
        }
      }
      ctx.putImageData(id, 0, 0);
    }
    else if (task.type === 'grayscale') {
      const id = ctx.getImageData(0, 0, w, h);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        d[i] = d[i+1] = d[i+2] = g;
      }
      ctx.putImageData(id, 0, 0);
    }
    else if (task.type === 'filter') {
      fx.bake(canvas, p.id, { amount: +p.amount });
      ctx = canvas.getContext('2d');   // fx.bake redraws through a scratch canvas
    }
    else if (task.type === 'blur') {
      const tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      const tc = tmp.getContext('2d');
      tc.filter = `blur(${p.radius}px)`;
      tc.drawImage(canvas, 0, 0);
      tc.filter = 'none';
      canvas = tmp; ctx = tc;
    }
    else if (task.type === 'watermark') {
      const size = +p.size;
      ctx.globalAlpha = +p.opacity;
      ctx.font = `bold ${size}px system-ui`;
      const tw = ctx.measureText(p.text).width;
      const pad = 16;
      const x = p.pos.includes('r') ? w - tw - pad : pad;
      const y = p.pos.includes('b') ? h - pad : size + pad;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText(p.text, x + 1, y + 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(p.text, x, y);
      ctx.globalAlpha = 1;
    }
    // 'quality' is applied at export
  }

  const q = bpTasks.value.find(t => t.type === 'quality')?.params.value ?? 92;
  const blob = await new Promise(res => canvas.toBlob(res, fmt, q / 100));
  const ext = fmt.split('/')[1].replace('jpeg', 'jpg');
  const outName = file.name.replace(/\.[^.]+$/, '') + '_processed.' + ext;
  return { blob, outName };
}

const bpUpdate   = (id, patch) => bpFiles.value = bpFiles.value.map(f => f.id === id ? { ...f, ...patch } : f);
const bpAddFiles = list => bpFiles.value = [...bpFiles.value, ...dropEntries(list)];
const bpRemove   = id => { const e = bpFiles.value.find(f => f.id === id); if (e?.blobUrl) URL.revokeObjectURL(e.blobUrl); URL.revokeObjectURL(e?.previewUrl); bpFiles.value = bpFiles.value.filter(f => f.id !== id); };

async function bpRunAll () {
  for (const f of bpFiles.value.filter(f => f.status === 'pending')) {
    bpUpdate(f.id, { status: 'processing' });
    try {
      const { blob, outName } = await bpProcessOne(f.file);
      bpUpdate(f.id, { status: 'done', blobUrl: URL.createObjectURL(blob), outName });
    } catch (e) {
      bpUpdate(f.id, { status: 'error', error: e.message });
    }
  }
}
function bpDownloadAll () {
  bpFiles.value.filter(f => f.status === 'done').forEach(f =>
    Object.assign(document.createElement('a'), { href: f.blobUrl, download: f.outName }).click());
}

function TaskPane ({ task, index, total, children }) {
  const { id, type } = task;
  const { icon, label } = BP_TASK_TYPES[type];
  return html`
    <div class="im-task">
      <header>
        <span class="im-task-title"><${Icon} name=${icon} /> ${label}</span>
        <span class="im-task-actions">
          <button class="tbtn" onClick=${() => bpMoveTask(id, -1)} disabled=${index === 0}><${Icon} name="mdi:chevron-up" /></button>
          <button class="tbtn" onClick=${() => bpMoveTask(id, 1)} disabled=${index === total - 1}><${Icon} name="mdi:chevron-down" /></button>
          <button class="tbtn" onClick=${() => bpRemoveTask(id)}><${Icon} name="mdi:close" /></button>
        </span>
      </header>
      <main>${children}</main>
    </div>`;
}

function RangeTaskPane ({ task, index, total, min, max, step = 1, unit = '' }) {
  const { id, params: p } = task;
  return html`
    <${TaskPane} ...${{ task, index, total }}>
      <input type="range" min=${min} max=${max} step=${step} value=${p.value}
             onInput=${e => bpUpdateTask(id, { value: +e.target.value })} style="flex:1;accent-color:var(--accent)" />
      <span class="im-task-val">${p.value}${unit}</span>
    </${TaskPane}>`;
}

const BlurTaskPane = props => { const { id, params: p } = props.task; return html`
  <${TaskPane} ...${props}>
    <input type="range" min=1 max=20 value=${p.radius} onInput=${e => bpUpdateTask(id, { radius: +e.target.value })} style="flex:1;accent-color:var(--accent)" />
    <span class="im-task-val">${p.radius}px</span>
  </${TaskPane}>`; };

const BrightnessTaskPane = props => html`<${RangeTaskPane} ...${props} min=${-100} max=${100} />`;
const ContrastTaskPane   = props => html`<${RangeTaskPane} ...${props} min=${-100} max=${100} />`;
const QualityTaskPane    = props => html`<${RangeTaskPane} ...${props} min=${1} max=${100} unit="%" />`;

const ConvertTaskPane = props => { const { id, params: p } = props.task; return html`
  <${TaskPane} ...${props}>
    ${['webp', 'png', 'jpg'].map(f => html`<button class=${'chip' + (p.fmt === f ? ' active' : '')} onClick=${() => bpUpdateTask(id, { fmt: f })}>${f}</button>`)}
  </${TaskPane}>`; };

const FlipTaskPane = props => { const { id, params: p } = props.task; return html`
  <${TaskPane} ...${props}>
    <button class=${'chip' + (p.axis === 'h' ? ' active' : '')} onClick=${() => bpUpdateTask(id, { axis: 'h' })}><${Icon} name="mdi:flip-horizontal" /> Horizontal</button>
    <button class=${'chip' + (p.axis === 'v' ? ' active' : '')} onClick=${() => bpUpdateTask(id, { axis: 'v' })}><${Icon} name="mdi:flip-vertical" /> Vertical</button>
  </${TaskPane}>`; };

const GrayscaleTaskPane = props => html`<${TaskPane} ...${props}><span class="im-task-hint">No options</span></${TaskPane}>`;

const RotateTaskPane = props => { const { id, params: p } = props.task; return html`
  <${TaskPane} ...${props}>
    ${[90, 180, 270].map(d => html`<button class=${'chip' + (p.deg === d ? ' active' : '')} onClick=${() => bpUpdateTask(id, { deg: d })}>${d}°</button>`)}
    <input type="number" class="im-task-input sm" value=${p.deg} min=0 max=359 onInput=${e => bpUpdateTask(id, { deg: +e.target.value })} />
  </${TaskPane}>`; };

const ResizeTaskPane = props => { const { id, params: p } = props.task; return html`
  <${TaskPane} ...${props}>
    <span class="im-task-label">W</span>
    <input type="number" class="im-task-input" placeholder="px" value=${p.w} onInput=${e => bpUpdateTask(id, { w: e.target.value })} />
    <span class="im-task-label">H</span>
    <input type="number" class="im-task-input" placeholder="px" value=${p.h} onInput=${e => bpUpdateTask(id, { h: e.target.value })} />
    <span class="im-task-hint">(leave one empty to keep ratio)</span>
  </${TaskPane}>`; };

const CropTaskPane = props => { const { id, params: p } = props.task;
  const field = (label, key) => html`<span class="im-task-label">${label}</span>
    <input type="number" class="im-task-input sm" value=${p[key]} onInput=${e => bpUpdateTask(id, { [key]: +e.target.value })} />`;
  return html`<${TaskPane} ...${props}>${field('X', 'x')} ${field('Y', 'y')} ${field('W', 'w')} ${field('H', 'h')}</${TaskPane}>`; };

const WatermarkTaskPane = props => { const { id, params: p } = props.task;
  const POS = [['tl', 'top-left'], ['tr', 'top-right'], ['bl', 'bottom-left'], ['br', 'bottom-right']];
  return html`
    <${TaskPane} ...${props}>
      <input class="im-task-input grow" type="text" value=${p.text} placeholder="Text" onInput=${e => bpUpdateTask(id, { text: e.target.value })} />
      <span class="im-task-label">Size</span>
      <input type="number" class="im-task-input sm" value=${p.size} min=8 max=200 onInput=${e => bpUpdateTask(id, { size: +e.target.value })} />
      <span class="im-task-label">Opacity</span>
      <input type="range" min=0 max=1 step=0.05 value=${p.opacity} onInput=${e => bpUpdateTask(id, { opacity: +e.target.value })} style="width:80px;accent-color:var(--accent)" />
      ${POS.map(([v, l]) => html`<button class=${'chip' + (p.pos === v ? ' active' : '')} onClick=${() => bpUpdateTask(id, { pos: v })} title=${l}>${v.toUpperCase()}</button>`)}
    </${TaskPane}>`; };

const FilterTaskPane = props => { const { id, params: p } = props.task;
  const e = fx.effectById(p.id);
  return html`
    <${TaskPane} ...${props}>
      <select class="im-task-input grow" value=${p.id} onChange=${ev => bpUpdateTask(id, { id: ev.target.value })}>
        ${fx.EFFECTS.filter(x => x.id !== 'none').map(x => html`<option value=${x.id}>${x.name}</option>`)}
      </select>
      ${e?.amount && html`
        <span class="im-task-label">Amt</span>
        <input type="range" min=${e.amount.min} max=${e.amount.max} step=${e.amount.step ?? 0.05} value=${p.amount}
               onInput=${ev => bpUpdateTask(id, { amount: +ev.target.value })} style="width:90px;accent-color:var(--accent)" />
        <span class="im-task-val">${p.amount}</span>`}
    </${TaskPane}>`; };

const BP_TASK_PANE = {
  blur: BlurTaskPane, brightness: BrightnessTaskPane, contrast: ContrastTaskPane, convert: ConvertTaskPane,
  crop: CropTaskPane, filter: FilterTaskPane, flip: FlipTaskPane, grayscale: GrayscaleTaskPane,
  quality: QualityTaskPane, resize: ResizeTaskPane, rotate: RotateTaskPane, watermark: WatermarkTaskPane,
};

function TaskAdder () {
  return html`
    <div class="im-task-adder">
      <span class="im-adder-label">Add task</span>
      <div class="im-adder-chips">
        ${Object.entries(BP_TASK_TYPES).map(([type, def]) => html`
          <button class="chip" onClick=${() => bpAddTask(type)}><${Icon} name=${def.icon} /> ${def.label}</button>`)}
      </div>
    </div>`;
}

function BatchMode () {
  const list       = bpFiles.value;
  const taskList   = bpTasks.value;
  const pendingCnt = list.filter(f => f.status === 'pending').length;
  const hasDone    = list.some(f => f.status === 'done');
  const busy       = list.some(f => f.status === 'processing');

  return html`
    <div class="im-tool">
      <${ImgDrop} onFiles=${bpAddFiles} />

      ${list.length > 0 && html`
        <div class="im-filelist">
          ${list.map(e => html`<${ToolFileItem} key=${e.id} entry=${e} onRemove=${bpRemove} />`)}
        </div>`}

      <${TaskAdder} />

      ${taskList.length > 0 && html`
        <div class="im-tasks">
          ${taskList.map((task, index) => {
            const Pane = BP_TASK_PANE[task.type];
            return Pane && html`<${Pane} task=${task} index=${index} total=${taskList.length} key=${task.id} />`;
          })}
        </div>`}

      ${(list.length > 0 && taskList.length > 0) && html`
        <div class="im-tool-actions">
          <button class="btn primary" onClick=${bpRunAll} disabled=${busy || pendingCnt === 0}>
            <${Icon} name=${busy ? 'mdi:loading' : 'mdi:play'} class=${busy ? 'spin' : ''} />
            ${busy ? 'Processing…' : 'Run on ' + pendingCnt + ' image' + (pendingCnt > 1 ? 's' : '')}</button>
          ${hasDone && html`<button class="btn" onClick=${bpDownloadAll}>
            <${Icon} name="mdi:download-multiple" /> Download all</button>`}
        </div>`}
    </div>`;
}


// :::::: SHELL ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

function ModeBar () {
  return html`
    <header class="im-modebar">
      <div class="im-brand"><${Icon} name="mdi:image-multiple-outline" /> <span>images</span></div>
      <nav class="im-modes">
        ${MODES.map(m => html`
          <button class=${'im-mode' + (screen.value === m.id ? ' active' : '')} key=${m.id}
                  onClick=${() => m.id === 'edit' ? editCurrent() : setScreen(m.id)}
                  title=${m.label}>
            <${Icon} name=${m.icon} /> <span>${m.label}</span>
          </button>`)}
      </nav>
      <div class="im-modebar-actions"><${AppSettings} /></div>
    </header>`;
}

function App () {
  useEffect(() => { wireLaunchQueue(); return () => revokeAll(); }, []);
  return html`
    <${Fragment}>
      <${ModeBar} />
      <div id="app-main">
        ${screen.value === 'library' ? html`<${LibraryMode} />`
          : screen.value === 'edit'    ? html`<${EditMode} />`
          : screen.value === 'convert' ? html`<${ConvertMode} />`
          : screen.value === 'batch'   ? html`<${BatchMode} />`
          :                              html`<${ViewMode} />`}
      </div>
    </${Fragment}>`;
}

// :::::: BOOT :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

app.init({ App });
