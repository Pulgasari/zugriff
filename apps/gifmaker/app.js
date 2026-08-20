// apps/gifmaker/app.js
//
// a frame-sequence animator. load a stack of images, reorder / remove / add
// them, nudge each frame's position by a few pixels, then play it back and
// export it — as an animated GIF, or as a project zip (the images plus a
// manifest) that can be imported again. everything runs on the device.

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: vendors
import { html, signal, computed, useEffect, useRef } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot, config } from './../../shared/js/app.js?slug=gifmaker';
import { Icon, Slider } from './../../shared/js/components/index.js';
import { stored }       from './../../shared/js/lib/signals.js';

// ::: local
import { zipStore, unzip } from './zip.js';

// :::::: STATE :::::::::::::::::::::::::::::::::::::::::::::

// a frame: { id, name, canvas, w, h, dx, dy, delay }
const frames   = signal([]);
const cursor   = signal(0);       // index of the frame shown / selected
const playing  = signal(false);
const busy     = signal(false);
const error    = signal('');
const dragging = signal(false);   // a file is dragged over the app
const immersive = signal(false);  // chrome hidden, just the canvas

const sizeMode = signal('auto');  // 'auto' | 'custom'
const customW  = signal(480);
const customH  = signal(480);

const bg       = stored('#ffffff', 'gifmaker:bg');
const delayDef = stored(100, 'gifmaker:delay');   // ms, default for new frames
const step     = stored(5,   'gifmaker:step');    // nudge step in px
const projName = signal('animation');

let nextId = 1;
let dragFrom = null; // filmstrip reorder source index

// ── derived ──────────────────────────────────────────────────────────────────

const canvasSize = computed(() => {
  const list = frames.value;
  if (sizeMode.value === 'custom') return { w: Math.max(1, customW.value | 0), h: Math.max(1, customH.value | 0) };
  const w = Math.max(1, ...list.map(f => f.w));
  const h = Math.max(1, ...list.map(f => f.h));
  return { w, h };
});

const selected = computed(() => frames.value[cursor.value] ?? null);
const totalMs  = computed(() => frames.value.reduce((s, f) => s + (f.delay || 0), 0));

// :::::: HELPERS :::::::::::::::::::::::::::::::::::::::::::

function loadImage (blob) {
  return createImageBitmap(blob).then(bm => {
    const c = document.createElement('canvas');
    c.width = bm.width; c.height = bm.height;
    c.getContext('2d').drawImage(bm, 0, 0);
    bm.close?.();
    return c;
  }).catch(() => new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url); res(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('could not decode image')); };
    img.src = url;
  }));
}

const pad  = n => String(n + 1).padStart(3, '0');
const safe = s => (s || 'frame').replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '_');

function download (blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── frame ops ────────────────────────────────────────────────────────────────

async function addFiles (fileList) {
  const files = [...fileList].filter(f => f && f.type.startsWith('image/'));
  if (!files.length) return;
  busy.value = true; error.value = '';
  try {
    const added = [];
    for (const file of files) {
      const canvas = await loadImage(file);
      added.push({ id: nextId++, name: file.name, canvas, w: canvas.width, h: canvas.height, dx: 0, dy: 0, delay: delayDef.value });
    }
    frames.value = [...frames.value, ...added];
  } catch (err) {
    error.value = err?.message || String(err);
  } finally {
    busy.value = false;
  }
}

function patchFrame (index, patch) {
  frames.value = frames.value.map((f, i) => i === index ? { ...f, ...patch } : f);
}

function nudge (dx, dy) {
  const i = cursor.value; const f = frames.value[i]; if (!f) return;
  patchFrame(i, { dx: f.dx + dx, dy: f.dy + dy });
}

function removeAt (index) {
  const list = frames.value.filter((_, i) => i !== index);
  frames.value = list;
  cursor.value = Math.max(0, Math.min(cursor.value, list.length - 1));
  if (list.length < 2) playing.value = false;
}

function reorder (from, to) {
  if (from === to || from == null) return;
  const list = [...frames.value];
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  frames.value = list;
  cursor.value = to;
}

function duplicateAt (index) {
  const f = frames.value[index]; if (!f) return;
  const copy = { ...f, id: nextId++ };
  const list = [...frames.value];
  list.splice(index + 1, 0, copy);
  frames.value = list;
  cursor.value = index + 1;
}

function clearAll () {
  frames.value = []; cursor.value = 0; playing.value = false;
}

const step5 = () => Math.max(1, step.value | 0);
const prev = () => { const n = frames.value.length; if (n) cursor.value = (cursor.value - 1 + n) % n; };
const next = () => { const n = frames.value.length; if (n) cursor.value = (cursor.value + 1) % n; };

// ── compositing ──────────────────────────────────────────────────────────────

function paint (ctx, size, frame) {
  ctx.clearRect(0, 0, size.w, size.h);
  ctx.fillStyle = bg.value;
  ctx.fillRect(0, 0, size.w, size.h);
  if (frame) ctx.drawImage(frame.canvas, frame.dx, frame.dy);
}

// ── export: gif ────────────────────────────────────────────────────────────

async function exportGif () {
  const list = frames.value; if (!list.length) return;
  busy.value = true; error.value = '';
  try {
    // esm.sh sometimes exposes gifenc's api on the default export instead of as
    // named exports, so unwrap whichever shape we get
    const mod = await import('gifenc');
    const api = mod.GIFEncoder ? mod : (mod.default ?? mod);
    const { GIFEncoder, quantize, applyPalette } = api;
    if (typeof GIFEncoder !== 'function') throw new Error('gifenc failed to load');
    const size = canvasSize.value;
    const c = document.createElement('canvas'); c.width = size.w; c.height = size.h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const gif = GIFEncoder();

    for (const f of list) {
      paint(ctx, size, f);
      const { data } = ctx.getImageData(0, 0, size.w, size.h);
      const palette = quantize(data, 256);
      const index   = applyPalette(data, palette);
      gif.writeFrame(index, size.w, size.h, { palette, delay: Math.max(20, f.delay | 0) });
    }
    gif.finish();
    download(new Blob([gif.bytes()], { type: 'image/gif' }), `${projName.value || 'animation'}.gif`);
  } catch (err) {
    error.value = err?.message || String(err);
  } finally {
    busy.value = false;
  }
}

// ── export / import: project zip ─────────────────────────────────────────────

function toBlob (canvas, type = 'image/png') {
  return new Promise(res => canvas.toBlob(b => res(b), type));
}

async function exportZip () {
  const list = frames.value; if (!list.length) return;
  busy.value = true; error.value = '';
  try {
    const size = canvasSize.value;
    const manifest = {
      version : 1,
      app     : 'gifmaker',
      name    : projName.value,
      canvas  : { mode: sizeMode.value, w: size.w, h: size.h },
      background : bg.value,
      defaultDelay : delayDef.value,
      frames  : [],
    };
    const entries = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const file = `frames/${pad(i)}_${safe(f.name)}.png`;
      const blob = await toBlob(f.canvas, 'image/png');
      entries.push({ name: file, data: new Uint8Array(await blob.arrayBuffer()) });
      manifest.frames.push({ file, name: f.name, dx: f.dx, dy: f.dy, delay: f.delay, w: f.w, h: f.h });
    }
    entries.unshift({ name: 'project.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
    download(zipStore(entries), `${projName.value || 'animation'}.zip`);
  } catch (err) {
    error.value = err?.message || String(err);
  } finally {
    busy.value = false;
  }
}

async function importZip (file) {
  busy.value = true; error.value = '';
  try {
    const items = await unzip(await file.arrayBuffer());
    const byName = new Map(items.map(it => [it.name, it]));
    const manifestItem = byName.get('project.json');

    let built = [];
    if (manifestItem) {
      const manifest = JSON.parse(new TextDecoder().decode(manifestItem.data));
      for (const fr of manifest.frames ?? []) {
        const item = byName.get(fr.file); if (!item) continue;
        const canvas = await loadImage(new Blob([item.data]));
        built.push({ id: nextId++, name: fr.name ?? fr.file, canvas, w: canvas.width, h: canvas.height,
                     dx: fr.dx | 0, dy: fr.dy | 0, delay: fr.delay || manifest.defaultDelay || 100 });
      }
      if (manifest.name) projName.value = manifest.name;
      if (manifest.background) bg.value = manifest.background;
      if (manifest.defaultDelay) delayDef.value = manifest.defaultDelay;
      if (manifest.canvas?.mode === 'custom') { sizeMode.value = 'custom'; customW.value = manifest.canvas.w; customH.value = manifest.canvas.h; }
      else sizeMode.value = 'auto';
    } else {
      // no manifest — just a bag of images, ordered by filename
      const images = items.filter(it => /\.(png|jpe?g|gif|webp|bmp)$/i.test(it.name)).sort((a, b) => a.name.localeCompare(b.name));
      for (const it of images) {
        const canvas = await loadImage(new Blob([it.data]));
        built.push({ id: nextId++, name: it.name, canvas, w: canvas.width, h: canvas.height, dx: 0, dy: 0, delay: delayDef.value });
      }
    }

    if (!built.length) throw new Error('no frames found in that zip');
    frames.value = built; cursor.value = 0; playing.value = false;
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

function Toolbar ({ onAdd, onImport }) {
  const n = frames.value.length;
  return html`
    <div class="toolbar">
      <${ToolButton} icon="mdi:image-plus" label="Add images" onClick=${onAdd} />
      <${ToolButton} icon="mdi:folder-zip-outline" label="Import project (.zip)" onClick=${onImport} />
      <${ToolButton} icon="mdi:delete-sweep-outline" label="Clear all" onClick=${clearAll} disabled=${!n} />
      <${Sep} />
      <${ToolButton} icon="mdi:skip-previous" label="Previous frame" onClick=${prev} disabled=${n < 2} />
      <${ToolButton} icon=${playing.value ? 'mdi:pause' : 'mdi:play'} label=${playing.value ? 'Pause' : 'Play'}
                     active=${playing.value} onClick=${() => playing.value = !playing.value} disabled=${n < 2} />
      <${ToolButton} icon="mdi:skip-next" label="Next frame" onClick=${next} disabled=${n < 2} />

      <div class="spacer"></div>

      <button class="btn" onClick=${exportZip} disabled=${!n || busy.value}>
        <${Icon} name="mdi:folder-zip-outline" size="16" /> Project .zip
      </button>
      <button class="btn primary" onClick=${exportGif} disabled=${!n || busy.value}>
        <${Icon} name="mdi:file-gif-box" size="16" /> Export GIF
      </button>
    </div>`;
}

function Preview ({ onAdd }) {
  const size = canvasSize.value;
  const list = frames.value;
  const f    = list[cursor.value];
  const ref  = useRef(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    c.width = size.w; c.height = size.h;
    paint(c.getContext('2d'), size, f);
  }, [f, size.w, size.h, bg.value, f?.dx, f?.dy]);

  if (!list.length) return html`
    <div class="stage">
      <button class="empty" onClick=${onAdd}>
        <${Icon} name="mdi:image-multiple-outline" size="64" />
        <p>Add images to start</p>
        <p class="sub">click to browse, or drop files anywhere here</p>
      </button>
      <div class="drop-hint"><${Icon} name="mdi:tray-arrow-down" size="40" /> <span>Drop to add</span></div>
    </div>`;

  return html`
    <div class="stage" onPointerUp=${stageTap} title="Double-tap to hide/show the interface">
      <div class="canvas-wrap"><canvas ref=${ref} class="view"></canvas></div>
      <div class="drop-hint"><${Icon} name="mdi:tray-arrow-down" size="40" /> <span>Drop to add</span></div>
    </div>`;
}

// double-tap (or double-click) the canvas area to toggle the chrome. two taps
// within 300ms; taps on actual controls are ignored.
let lastTap = 0;
function stageTap (e) {
  if (e.target.closest('button, input, a')) return;
  const now = Date.now();
  if (now - lastTap < 300) { immersive.value = !immersive.value; lastTap = 0; }
  else lastTap = now;
}

function Thumb ({ frame, index }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const S = 72, scale = Math.min(S / frame.w, S / frame.h, 1);
    c.width  = Math.max(1, Math.round(frame.w * scale));
    c.height = Math.max(1, Math.round(frame.h * scale));
    c.getContext('2d').drawImage(frame.canvas, 0, 0, c.width, c.height);
  }, [frame.canvas]);

  const active = index === cursor.value;
  return html`
    <div class=${'thumb' + (active ? ' active' : '')}
         draggable=${true}
         onClick=${() => cursor.value = index}
         onDragStart=${() => { dragFrom = index; }}
         onDragOver=${e => e.preventDefault()}
         onDrop=${e => { e.preventDefault(); reorder(dragFrom, index); dragFrom = null; }}>
      <span class="idx">${index + 1}</span>
      <canvas ref=${ref}></canvas>
      <button class="thumb-x" title="Remove" onClick=${e => { e.stopPropagation(); removeAt(index); }}>
        <${Icon} name="mdi:close" size="12" />
      </button>
    </div>`;
}

function Filmstrip ({ onAdd }) {
  const list = frames.value;
  if (!list.length) return null;
  return html`
    <div class="filmstrip">
      ${list.map((f, i) => html`<${Thumb} frame=${f} index=${i} key=${f.id} />`)}
      <button class="thumb add" title="Add images" onClick=${onAdd}>
        <${Icon} name="mdi:plus" size="24" />
      </button>
    </div>`;
}

function NumField ({ label, value, onInput, min, max, step: st = 1 }) {
  return html`
    <label class="field"><span>${label}</span>
      <input type="number" value=${value} min=${min} max=${max} step=${st}
             onInput=${e => onInput(e.target.value === '' ? 0 : +e.target.value)} />
    </label>`;
}

function FramePanel () {
  const f = selected.value;
  const i = cursor.value;
  return html`
    <section class="panel-sec">
      <h3><${Icon} name="mdi:cursor-move" size="16" /> Frame</h3>
      ${!f ? html`<p class="muted">no frame selected</p>` : html`
        <p class="muted">#${i + 1} · ${f.w}×${f.h}px · ${f.name}</p>

        <div class="nudge">
          <span class="n-label">Position</span>
          <div class="pad">
            <button class="tbtn" title="Up"    onClick=${() => nudge(0, -step5())}><${Icon} name="mdi:arrow-up" size="16" /></button>
            <div class="pad-row">
              <button class="tbtn" title="Left"  onClick=${() => nudge(-step5(), 0)}><${Icon} name="mdi:arrow-left" size="16" /></button>
              <button class="tbtn" title="Reset position" onClick=${() => patchFrame(i, { dx: 0, dy: 0 })}><${Icon} name="mdi:target" size="16" /></button>
              <button class="tbtn" title="Right" onClick=${() => nudge(step5(), 0)}><${Icon} name="mdi:arrow-right" size="16" /></button>
            </div>
            <button class="tbtn" title="Down"  onClick=${() => nudge(0, step5())}><${Icon} name="mdi:arrow-down" size="16" /></button>
          </div>
        </div>

        <div class="dim-row">
          <${NumField} label="X" value=${f.dx} onInput=${v => patchFrame(i, { dx: v | 0 })} />
          <${NumField} label="Y" value=${f.dy} onInput=${v => patchFrame(i, { dy: v | 0 })} />
        </div>
        <${NumField} label="Step (px)" value=${step.value} min="1" onInput=${v => step.value = Math.max(1, v | 0)} />
        <${Slider} label="Delay" value=${f.delay} min="20" max="2000" step="10" unit="ms" showButtons editable
                   onChange=${v => patchFrame(i, { delay: Math.max(20, v | 0) })} />

        <div class="row-btns">
          <button class="btn ghost" onClick=${() => duplicateAt(i)}><${Icon} name="mdi:content-duplicate" size="15" /> Duplicate</button>
          <button class="btn danger" onClick=${() => removeAt(i)}><${Icon} name="mdi:trash-can-outline" size="15" /> Remove</button>
        </div>`}
    </section>`;
}

function AnimationPanel () {
  const size = canvasSize.value;
  return html`
    <section class="panel-sec">
      <h3><${Icon} name="mdi:animation-outline" size="16" /> Animation</h3>

      <${Slider} label="Default delay" value=${delayDef.value} min="20" max="2000" step="10" unit="ms" showButtons editable
                 onChange=${v => delayDef.value = Math.max(20, v | 0)} />
      <button class="btn ghost wide" disabled=${!frames.value.length}
              onClick=${() => frames.value = frames.value.map(f => ({ ...f, delay: delayDef.value }))}>
        Apply delay to all frames
      </button>

      <div class="seg wide">
        <button class=${'seg-btn' + (sizeMode.value === 'auto' ? ' active' : '')}   onClick=${() => sizeMode.value = 'auto'}>Auto size</button>
        <button class=${'seg-btn' + (sizeMode.value === 'custom' ? ' active' : '')} onClick=${() => sizeMode.value = 'custom'}>Custom</button>
      </div>
      ${sizeMode.value === 'custom' ? html`
        <div class="dim-row">
          <${NumField} label="W" value=${customW.value} min="1" onInput=${v => customW.value = Math.max(1, v | 0)} />
          <${NumField} label="H" value=${customH.value} min="1" onInput=${v => customH.value = Math.max(1, v | 0)} />
        </div>`
        : html`<p class="muted">canvas ${size.w}×${size.h}px (largest frame)</p>`}

      <label class="field"><span>Background</span>
        <input type="color" value=${bg.value} onInput=${e => bg.value = e.target.value} />
        <em>${bg.value}</em>
      </label>
    </section>`;
}

function ExportPanel ({ onImport }) {
  return html`
    <section class="panel-sec">
      <h3><${Icon} name="mdi:export-variant" size="16" /> Export</h3>
      <label class="field wide"><span>Name</span>
        <input type="text" value=${projName.value} onInput=${e => projName.value = e.target.value} />
      </label>
      <button class="btn primary wide" onClick=${exportGif} disabled=${!frames.value.length || busy.value}>
        <${Icon} name="mdi:file-gif-box" size="16" /> Export GIF
      </button>
      <button class="btn wide" onClick=${exportZip} disabled=${!frames.value.length || busy.value}>
        <${Icon} name="mdi:folder-zip-outline" size="16" /> Save project (.zip)
      </button>
      <button class="btn ghost wide" onClick=${onImport}>
        <${Icon} name="mdi:import" size="16" /> Import project (.zip)
      </button>
      <p class="muted">The zip holds the original images plus a <code>project.json</code> — reimport it to keep editing.</p>
    </section>`;
}

function Panel ({ onImport }) {
  return html`
    <aside class="panel">
      <${FramePanel} />
      <${AnimationPanel} />
      <${ExportPanel} onImport=${onImport} />
    </aside>`;
}

function StatusBar () {
  const n = frames.value.length;
  return html`
    <footer class="statusbar">
      <${Icon} name="mdi:animation-play-outline" size="14" />
      <span>${n ? `${n} frame${n === 1 ? '' : 's'} · ${(totalMs.value / 1000).toFixed(2)}s loop` : 'no frames'}</span>
      ${n > 0 && html`<span class="muted">· showing #${cursor.value + 1}</span>`}
      ${error.value && html`<span class="err"><${Icon} name="mdi:alert-outline" size="14" /> ${error.value}</span>`}
      <span class="spacer"></span>
      ${busy.value && html`<span class="working"><${Icon} name="svg-spinners:bars-scale-middle" size="14" /> working…</span>`}
    </footer>`;
}

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  const addInput    = useRef(null);
  const importInput = useRef(null);
  const openAdd    = () => addInput.current?.click();
  const openImport = () => importInput.current?.click();

  // playback loop
  useEffect(() => {
    if (!playing.value) return;
    let raf, last = performance.now(), acc = 0;
    const tick = now => {
      acc += now - last; last = now;
      const list = frames.value;
      if (list.length > 1) {
        const d = Math.max(20, list[cursor.value % list.length]?.delay | 0);
        if (acc >= d) { acc -= d; cursor.value = (cursor.value + 1) % list.length; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing.value]);

  // keyboard: arrows nudge the selected frame, space toggles play
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape' && immersive.value) { immersive.value = false; return; }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (typing) return;
      if (e.key === ' ' && frames.value.length > 1) { e.preventDefault(); playing.value = !playing.value; return; }
      if (!selected.value) return;
      const s = e.shiftKey ? 1 : step5();
      if (e.key === 'ArrowLeft')  { e.preventDefault(); nudge(-s, 0); }
      if (e.key === 'ArrowRight') { e.preventDefault(); nudge(s, 0); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); nudge(0, -s); }
      if (e.key === 'ArrowDown')  { e.preventDefault(); nudge(0, s); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onDrop = e => {
    e.preventDefault(); dragging.value = false;
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    const zip = [...files].find(f => f.name.endsWith('.zip') || f.type === 'application/zip');
    if (zip) importZip(zip); else addFiles(files);
  };

  return html`
    <div class=${'gm' + (immersive.value ? ' immersive' : '')}
         onDragOver=${e => { e.preventDefault(); dragging.value = true; }}
         onDragLeave=${e => { if (e.target === e.currentTarget) dragging.value = false; }}
         onDrop=${onDrop}>
      <${Toolbar} onAdd=${openAdd} onImport=${openImport} />
      <div class=${'work' + (dragging.value ? ' dropping' : '')}>
        <${Preview} onAdd=${openAdd} />
        <${Panel} onImport=${openImport} />
      </div>
      <${Filmstrip} onAdd=${openAdd} />
      <${StatusBar} />

      ${immersive.value && html`
        <button class="exit-immersive" title="Show interface (Esc)" onClick=${() => immersive.value = false}>
          <${Icon} name="mdi:fullscreen-exit" size="20" />
        </button>`}

      <input ref=${addInput} type="file" accept="image/*" multiple hidden
             onChange=${e => { addFiles(e.target.files); e.target.value = ''; }} />
      <input ref=${importInput} type="file" accept=".zip,application/zip" hidden
             onChange=${e => { const f = e.target.files?.[0]; if (f) importZip(f); e.target.value = ''; }} />
    </div>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

// the app draws its own chrome, so it skips the tools Shell
boot({ config, App });
