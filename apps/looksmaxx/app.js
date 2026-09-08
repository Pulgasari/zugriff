// apps/looksmaxx/app.js
// the on-device hair recolour + hairstyle try-on, on the shared handle. the runtime binds
// zugriff (+ zugriff.app, html) to window before this runs, so nothing here imports the
// runtime. ephemeral editor state on app.state; the heavy working data (canvases, mask, face
// landmarks) is a plain object — it never renders directly. everything stays on the device.

// ::: vendors
import { useRef, useEffect } from 'preact/hooks';

// ::: shared
import { Icon } from '/.shared/js/components/index.js';

// ::: app modules
import { segmentHair, detectFace } from './modules/vision.js';
import { recolorHair, SWATCHES }   from './modules/recolor.js';
import { drawHairstyle }           from './modules/overlay.js';
import { HAIRSTYLES }              from './hairstyles/index.js';

// ::: the app handle
const app = zugriff.app;
const config = app.config;

// :::::: STATE ::::::::::::::::::::::::::::::::::::::::::::::
// ephemeral editor state on app.state (no `.value`, read inside render).

const MAX_DIM = 1400;   // cap the working resolution for a smooth recolour

app.state.status      = '';     // '' | 'loading' | 'segmenting' | 'detecting' | 'error…'
app.state.hasPhoto    = false;
app.state.color       = null;   // { r, g, b } | null
app.state.strength    = 0.85;
app.state.styleId     = null;   // hairstyle id | 'custom' | null
app.state.styleScale  = 1;
app.state.styleOffset = 0;      // fraction of head height, negative = up

// non-reactive working data (plain refs, not signals — they never render directly)
const work = {
  base   : null,   // offscreen canvas holding the photo at working resolution
  mask   : null,   // { mask, maskW, maskH } from the hair segmenter
  face   : null,   // face landmarks (lazy, only when a hairstyle is applied)
  styleImg : null, // the currently loaded hairstyle HTMLImageElement
};

// :::::: PIPELINE ::::::::::::::::::::::::::::::::::::::::::::

/** load a File / Blob into an HTMLImageElement */
function loadImage (src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

/** take a photo File, size it down, draw it to the base canvas, segment the hair */
async function usePhoto (file) {
  app.state.status = 'loading';
  try {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    URL.revokeObjectURL(url);

    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);

    const base = document.createElement('canvas');
    base.width = w; base.height = h;
    base.getContext('2d').drawImage(img, 0, 0, w, h);

    work.base = base;
    work.face = null;                     // re-detect lazily for this new photo
    app.state.hasPhoto = true;

    app.state.status = 'segmenting';
    const { mask, width, height } = await segmentHair(base);
    work.mask = { mask, maskW: width, maskH: height };

    app.state.status = '';
    compose();
  } catch (err) {
    console.error('[looksmaxx]', err);
    app.state.status = err.message || 'Something went wrong.';
  }
}

/** (re)draw the visible canvas: base photo → recolour → hairstyle overlay */
function compose () {
  const canvas = view.current, base = work.base;
  if (!canvas || !base) return;

  canvas.width = base.width; canvas.height = base.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(base, 0, 0);

  if (app.state.color && work.mask) {
    recolorHair(ctx, { width: canvas.width, height: canvas.height }, work.mask, app.state.color, app.state.strength);
  }
  if (app.state.styleId && work.styleImg && work.face) {
    drawHairstyle(ctx, work.face, work.styleImg, {
      width: canvas.width, height: canvas.height,
      scale: app.state.styleScale, offsetY: app.state.styleOffset,
    });
  }
}

/** pick a hairstyle (or 'custom' from a user image, or null to remove) */
async function useStyle (entry, customImg) {
  if (!entry && !customImg) { app.state.styleId = null; work.styleImg = null; compose(); return; }
  try {
    work.styleImg = customImg ?? await loadImage(entry.src);
    app.state.styleId = entry?.id ?? 'custom';
    app.state.styleScale = 1; app.state.styleOffset = 0;
    if (!work.face) {                          // detect the face once, on first overlay
      app.state.status = 'detecting';
      work.face = await detectFace(work.base);
      app.state.status = work.face ? '' : 'No face found — hairstyle needs a clear front-facing photo.';
    }
    compose();
  } catch (err) {
    console.error('[looksmaxx]', err);
    app.state.status = err.message || 'Could not apply that hairstyle.';
  }
}

function reset () {
  app.state.color = null; app.state.strength = 0.85;
  app.state.styleId = null; work.styleImg = null;
  app.state.styleScale = 1; app.state.styleOffset = 0;
  compose();
}

function download () {
  const canvas = view.current; if (!canvas || !app.state.hasPhoto) return;
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'looksmaxx.png';
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}

// :::::: UI ::::::::::::::::::::::::::::::::::::::::::::::::

const view = { current: null };   // canvas ref, shared across the module

function Dropzone () {
  const onFile = e => { const f = e.target.files?.[0]; if (f) usePhoto(f); e.target.value = ''; };
  const onDrop = e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith('image/')) usePhoto(f); };
  return html`
    <label class="drop" onDragOver=${e => e.preventDefault()} onDrop=${onDrop}>
      <${Icon} name="mdi:image-plus-outline" />
      <strong>Drop a photo</strong>
      <span>or tap to choose — a clear, front-facing portrait works best. Nothing leaves your device.</span>
      <input type="file" accept="image/*" hidden onChange=${onFile} />
    </label>`;
}

function ColorRow () {
  const onCustom = e => { const c = hexToRgb(e.target.value); if (c) { app.state.color = c; compose(); } };
  return html`
    <div class="group">
      <div class="group-head"><span>Hair colour</span>
        ${app.state.color && html`<button class="link" onClick=${() => { app.state.color = null; compose(); }}>none</button>`}
      </div>
      <div class="swatches">
        ${SWATCHES.map(s => html`
          <button class=${'swatch' + (isSame(app.state.color, s) ? ' on' : '')}
                  title=${s.name} style=${`background:rgb(${s.r},${s.g},${s.b})`}
                  onClick=${() => { app.state.color = { r: s.r, g: s.g, b: s.b }; compose(); }}></button>`)}
        <label class="swatch custom" title="Custom colour">
          <${Icon} name="mdi:eyedropper-variant" />
          <input type="color" onInput=${onCustom} />
        </label>
      </div>
      ${app.state.color && html`
        <label class="slider">
          <span>Intensity</span>
          <input type="range" min="0" max="1" step="0.01" value=${app.state.strength}
                 onInput=${e => { app.state.strength = +e.target.value; compose(); }} />
        </label>`}
    </div>`;
}

function StyleRow () {
  const onCustom = async e => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    const img = await loadImage(URL.createObjectURL(f));
    useStyle(null, img);
  };
  return html`
    <div class="group">
      <div class="group-head"><span>Hairstyle</span></div>
      <div class="styles">
        <button class=${'style none' + (!app.state.styleId ? ' on' : '')} onClick=${() => useStyle(null)}>
          <${Icon} name="mdi:cancel" /><span>None</span>
        </button>
        ${HAIRSTYLES.map(s => html`
          <button class=${'style' + (app.state.styleId === s.id ? ' on' : '')} onClick=${() => useStyle(s)}>
            <img src=${s.src} alt=${s.name} /><span>${s.name}</span>
          </button>`)}
        <label class=${'style upload' + (app.state.styleId === 'custom' ? ' on' : '')}>
          <${Icon} name="mdi:tray-arrow-up" /><span>Your PNG</span>
          <input type="file" accept="image/png,image/*" hidden onChange=${onCustom} />
        </label>
      </div>
      ${app.state.styleId && work.face && html`
        <label class="slider">
          <span>Size</span>
          <input type="range" min="0.6" max="1.8" step="0.01" value=${app.state.styleScale}
                 onInput=${e => { app.state.styleScale = +e.target.value; compose(); }} />
        </label>`}
      ${app.state.styleId && work.face && html`
        <label class="slider">
          <span>Height</span>
          <input type="range" min="-0.4" max="0.4" step="0.01" value=${app.state.styleOffset}
                 onInput=${e => { app.state.styleOffset = +e.target.value; compose(); }} />
        </label>`}
    </div>`;
}

function App () {
  const canvasRef = useRef(null);
  useEffect(() => { view.current = canvasRef.current; }, []);

  const onNew = e => { const f = e.target.files?.[0]; if (f) usePhoto(f); e.target.value = ''; };

  return html`
    <header class="topbar">
      <${Icon} name=${config.icon} />
      <strong>${config.name}</strong>
      <div class="spacer"></div>
      ${app.state.hasPhoto && html`
        <label class="ibtn" title="New photo">
          <${Icon} name="mdi:image-refresh-outline" />
          <input type="file" accept="image/*" hidden onChange=${onNew} />
        </label>
        <button class="ibtn" title="Reset edits" onClick=${reset}><${Icon} name="mdi:restore" /></button>
        <button class="ibtn" title="Download" onClick=${download}><${Icon} name="mdi:tray-arrow-down" /></button>`}
    </header>

    <main class="stage">
      ${!app.state.hasPhoto ? html`<${Dropzone} />` : html`
        <div class="canvas-wrap">
          <canvas ref=${canvasRef}></canvas>
          ${app.state.status && html`<div class="overlay-status"><span class="spin"></span>${label(app.state.status)}</div>`}
        </div>`}
    </main>

    ${app.state.hasPhoto && html`
      <footer class="controls">
        ${app.state.status && !isBusy(app.state.status) && html`<div class="msg">${app.state.status}</div>`}
        <${ColorRow} />
        <${StyleRow} />
      </footer>`}`;
}

// :::::: HELPERS :::::::::::::::::::::::::::::::::::::::::::::

const BUSY = { loading: 'Loading photo…', segmenting: 'Finding the hair…', detecting: 'Finding the face…' };
const isBusy = s => s in BUSY;
const label  = s => BUSY[s] ?? s;

const isSame = (c, s) => c && c.r === s.r && c.g === s.g && c.b === s.b;
function hexToRgb (hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::::

app.init({ App });
