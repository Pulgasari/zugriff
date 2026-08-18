// apps/image-editor/app.js
//
// a canvas image editor — open a picture and crop, rotate, flip, resize and
// adjust it, then export. everything runs on the device; the image never
// leaves the browser. it draws its own chrome (toolbar · stage · side panel ·
// status bar); there is no tools Shell here.

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: vendors
import { html, signal, computed, useEffect, useRef } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot }   from './../../shared/js/app.js';
import { Icon }   from './../../shared/js/components/index.js';
import { stored } from './../../shared/js/lib/signals.js';

// ::: local
import * as config from './app.config.js';
import * as edit   from './edit.js';

// :::::: STATE :::::::::::::::::::::::::::::::::::::::::::::

const original = signal(null);   // the canvas as first loaded, for Reset
const work     = signal(null);   // the current canvas (geometry baked in)
const filters  = signal({ ...edit.IDENTITY });
const mode     = signal('view'); // 'view' | 'crop'
const cropRect = signal(null);   // { x, y, w, h } in image pixels
const undo     = signal([]);     // canvases, oldest first
const redo     = signal([]);
const fileName = signal('image');
const error    = signal('');
const busy     = signal(false);
const dragging = signal(false);  // a file is being dragged over the stage

const resizeW  = signal(0);
const resizeH  = signal(0);
const lockAR   = signal(true);

const exportFmt = stored('image/png', 'image-editor:format');
const quality   = stored(92, 'image-editor:quality');

const HISTORY = 30;
const MIN_CROP = 8; // px

const dims     = computed(() => work.value ? { w: work.value.width, h: work.value.height } : null);
const dirty    = computed(() => undo.value.length > 0 || !edit.isIdentity(filters.value));

// :::::: HELPERS :::::::::::::::::::::::::::::::::::::::::::

const FORMATS = [
  { type: 'image/png',  label: 'PNG',  ext: 'png',  lossy: false },
  { type: 'image/jpeg', label: 'JPEG', ext: 'jpg',  lossy: true  },
  { type: 'image/webp', label: 'WebP', ext: 'webp', lossy: true  },
];
const fmtOf = type => FORMATS.find(f => f.type === type) ?? FORMATS[0];

function pushHistory (canvas) {
  undo.value = [...undo.value, canvas].slice(-HISTORY);
  redo.value = [];
}

/** run a geometry op: current canvas onto the undo stack, its result becomes work */
function commit (next) {
  if (!work.value) return;
  pushHistory(work.value);
  work.value = next;
  syncResize();
}

// :::::: ACTIONS :::::::::::::::::::::::::::::::::::::::::::

async function loadFile (file) {
  if (!file || !file.type.startsWith('image/')) { error.value = 'that is not an image'; return; }
  busy.value = true;
  error.value = '';
  try {
    const canvas = await edit.loadImage(file);
    original.value = canvas;
    work.value     = canvas;
    filters.value  = { ...edit.IDENTITY };
    undo.value = [];
    redo.value = [];
    mode.value = 'view';
    cropRect.value = null;
    fileName.value = (file.name || 'image').replace(/\.[^.]+$/, '');
    resizeW.value = canvas.width;
    resizeH.value = canvas.height;
  } catch (err) {
    error.value = err?.message || String(err);
  } finally {
    busy.value = false;
  }
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

function reset () {
  if (!original.value) return;
  if (work.value !== original.value) pushHistory(work.value);
  work.value = original.value;
  filters.value = { ...edit.IDENTITY };
  mode.value = 'view';
  cropRect.value = null;
  syncResize();
}

function syncResize () {
  if (work.value) { resizeW.value = work.value.width; resizeH.value = work.value.height; }
}

// ── crop ─────────────────────────────────────────────────────────────────────

function enterCrop () {
  const w = work.value; if (!w) return;
  const inset = 0.1;
  cropRect.value = {
    x: Math.round(w.width  * inset),
    y: Math.round(w.height * inset),
    w: Math.round(w.width  * (1 - inset * 2)),
    h: Math.round(w.height * (1 - inset * 2)),
  };
  mode.value = 'crop';
}
function cancelCrop () { mode.value = 'view'; cropRect.value = null; }
function applyCrop () {
  const r = cropRect.value;
  if (r) commit(edit.crop(work.value, r.x, r.y, r.w, r.h));
  mode.value = 'view';
  cropRect.value = null;
  syncResize();
}

// ── resize ───────────────────────────────────────────────────────────────────

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

// ── export ───────────────────────────────────────────────────────────────────

async function exportImage () {
  const w = work.value; if (!w) return;
  busy.value = true;
  try {
    const flat = edit.applyFilter(w, filters.value);
    const fmt  = fmtOf(exportFmt.value);
    const blob = await edit.toBlob(flat, fmt.type, quality.value / 100);
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `${fileName.value}.${fmt.ext}` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    error.value = err?.message || String(err);
  } finally {
    busy.value = false;
  }
}

// :::::: COMPONENTS ::::::::::::::::::::::::::::::::::::::::

function ToolButton ({ icon, label, onClick, disabled, active }) {
  return html`
    <button class=${'tbtn' + (active ? ' active' : '')} onClick=${onClick}
            disabled=${disabled} title=${label} aria-label=${label}>
      <${Icon} name=${icon} size="18" />
    </button>`;
}

const Sep = () => html`<span class="tsep"></span>`;

function Toolbar ({ onOpen }) {
  const has = !!work.value;
  const cropping = mode.value === 'crop';
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

      ${cropping && cropRect.value && html`
        <span class="crop-size">${cropRect.value.w} × ${cropRect.value.h}</span>
        <button class="btn ghost"  onClick=${cancelCrop}>Cancel</button>
        <button class="btn primary" onClick=${applyCrop}><${Icon} name="mdi:check" size="16" /> Apply crop</button>`}

      ${!cropping && html`
        <${ToolButton} icon="mdi:restore" label="Reset to original" onClick=${reset} disabled=${!dirty.value} />`}
    </div>`;
}

function Stage ({ onPick }) {
  const w = work.value;
  const ref = useRef(null);

  useEffect(() => {
    if (!w || !ref.current) return;
    const c = ref.current;
    c.width = w.width; c.height = w.height;
    c.getContext('2d').drawImage(w, 0, 0);
  }, [w]);

  const onDrop = e => {
    e.preventDefault(); dragging.value = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  };
  const stop = e => { e.preventDefault(); dragging.value = true; };

  return html`
    <div class=${'stage' + (dragging.value ? ' dropping' : '')}
         onDragOver=${stop}
         onDragLeave=${e => { if (e.target === e.currentTarget) dragging.value = false; }}
         onDrop=${onDrop}>
      ${w ? html`
        <div class="canvas-wrap">
          <canvas ref=${ref} class="view" style=${`filter:${edit.filterString(filters.value)}`}></canvas>
          ${mode.value === 'crop' && html`<${CropOverlay} />`}
        </div>`
        : html`
        <button class="empty" onClick=${onPick}>
          <${Icon} name="mdi:image-plus-outline" size="64" />
          <p>Open an image</p>
          <p class="sub">click to browse, or drop a file anywhere here</p>
        </button>`}
      <div class="drop-hint"><${Icon} name="mdi:tray-arrow-down" size="40" /> <span>Drop to open</span></div>
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
      const W = w.width, H = w.height;
      let { x, y, w: rw, h: rh } = d.rect;
      let l = x, t = y, rgt = x + rw, bot = y + rh;

      if (d.type === 'move') {
        const dx = p.x - d.origin.x, dy = p.y - d.origin.y;
        l = Math.min(Math.max(0, x + dx), W - rw);
        t = Math.min(Math.max(0, y + dy), H - rh);
        cropRect.value = { x: Math.round(l), y: Math.round(t), w: rw, h: rh };
        return;
      }
      if (d.type.includes('w')) l   = Math.min(Math.max(0, p.x), rgt - MIN_CROP);
      if (d.type.includes('e')) rgt = Math.max(Math.min(W, p.x), l + MIN_CROP);
      if (d.type.includes('n')) t   = Math.min(Math.max(0, p.y), bot - MIN_CROP);
      if (d.type.includes('s')) bot = Math.max(Math.min(H, p.y), t + MIN_CROP);
      cropRect.value = { x: Math.round(l), y: Math.round(t), w: Math.round(rgt - l), h: Math.round(bot - t) };
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

function Slider ({ label, value, min, max, onInput, suffix = '%', reset }) {
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
      <h3><${Icon} name="mdi:tune-variant" size="16" /> Adjust</h3>
      <${Slider} label="Brightness" value=${f.brightness} min="0" max="200" onInput=${v => set('brightness', v)} reset=${() => set('brightness', 100)} />
      <${Slider} label="Contrast"   value=${f.contrast}   min="0" max="200" onInput=${v => set('contrast', v)}   reset=${() => set('contrast', 100)} />
      <${Slider} label="Saturation" value=${f.saturate}   min="0" max="200" onInput=${v => set('saturate', v)}   reset=${() => set('saturate', 100)} />
      <${Slider} label="Grayscale"  value=${f.grayscale}  min="0" max="100" onInput=${v => set('grayscale', v)}  reset=${() => set('grayscale', 0)} />
      ${!edit.isIdentity(f) && html`
        <button class="btn ghost wide" onClick=${() => filters.value = { ...edit.IDENTITY }}>
          <${Icon} name="mdi:backup-restore" size="16" /> Reset adjustments
        </button>`}
    </section>`;
}

function ResizePanel () {
  return html`
    <section class="panel-sec">
      <h3><${Icon} name="mdi:resize" size="16" /> Resize</h3>
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
      <h3><${Icon} name="mdi:export-variant" size="16" /> Export</h3>
      <div class="seg wide">
        ${FORMATS.map(f => html`
          <button class=${'seg-btn' + (exportFmt.value === f.type ? ' active' : '')} key=${f.type}
                  onClick=${() => exportFmt.value = f.type}>${f.label}</button>`)}
      </div>
      ${fmt.lossy && html`
        <${Slider} label="Quality" value=${quality.value} min="10" max="100" suffix="" onInput=${v => quality.value = v} reset=${() => quality.value = 92} />`}
      <label class="field wide"><span>Name</span>
        <input type="text" value=${fileName.value} onInput=${e => fileName.value = e.target.value} />
        <em>.${fmt.ext}</em>
      </label>
      <button class="btn primary wide" onClick=${exportImage} disabled=${!work.value || busy.value}>
        <${Icon} name="mdi:download" size="16" /> Download
      </button>
    </section>`;
}

function Panel () {
  if (!work.value) return html`<aside class="panel empty-panel"><p>No image loaded.</p></aside>`;
  return html`
    <aside class="panel">
      <${Adjustments} />
      <${ResizePanel} />
      <${ExportPanel} />
    </aside>`;
}

function StatusBar () {
  const d = dims.value;
  return html`
    <footer class="statusbar">
      <${Icon} name="mdi:image-outline" size="14" />
      <span>${d ? `${d.w} × ${d.h} px` : 'no image'}</span>
      ${error.value && html`<span class="err"><${Icon} name="mdi:alert-outline" size="14" /> ${error.value}</span>`}
      <span class="spacer"></span>
      ${busy.value && html`<span class="working"><${Icon} name="svg-spinners:bars-scale-middle" size="14" /> working…</span>`}
      ${dirty.value && !busy.value && html`<span class="edited">edited</span>`}
    </footer>`;
}

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  const fileInput = useRef(null);
  const pick = () => fileInput.current?.click();

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape' && mode.value === 'crop') { cancelCrop(); return; }
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
      <${Toolbar} onOpen=${pick} />
      <div class="body">
        <${Stage} onPick=${pick} />
        <${Panel} />
      </div>
      <${StatusBar} />
      <input ref=${fileInput} type="file" accept="image/*" hidden
             onChange=${e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }} />
    </div>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

// the app draws its own chrome, so it skips the tools Shell
boot({ config, App, shell: false });
