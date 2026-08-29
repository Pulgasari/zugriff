// tools/pixel-art-creator/app.js

// ::: vendors
import { effect, html, signal, useRef, useState } from '@aufbau/kits/preact-htm';
import UPNG from 'upng-js';

// ::: shared
import { boot, config } from '/.shared/js/app.js?slug=pixel-art-creator';
import { Icon, Picker } from '/.shared/js/components/index.js';
import { stored } from '/.shared/js/lib/signals.js';

// ::: local

// ------ CONSTANTS ----------------------------------------------

const appID   = 'pac';
//const PRESETS = [ 8, 16, 32, 64, 128 ];
const AUTO_SZ = { 8: 48, 16: 24, 32: 12, 64: 8, 128: 4 };
const SCALES  = [ 0.125, 0.25, 0.50, 1.00, 1.50, 2.00 ];
const PALETTE = ['#e63946','#457b9d','#2a9d8f','#e9c46a','#f4a261','#264653','#ffffff','#000000'];
const MIRROR_MODES = [
  { id: 'none',     icon: 'mdi:minus',             label: 'No Mirror'  },
  { id: 'x',        icon: 'mdi:flip-horizontal',   label: 'Mirror X'   },
  { id: 'y',        icon: 'mdi:flip-vertical',     label: 'Mirror Y'   },
  { id: 'xy',       icon: 'mdi:vector-combine',    label: 'Mirror X+Y' },
  { id: 'diagonal', icon: 'mdi:swap-horizontal',   label: 'Diagonal'   },
];

const PRESETS = [
  { w:  8, h:  8, label:   '8×8'   },
  { w: 16, h: 16, label:  '16×16'  },
  { w: 32, h: 32, label:  '32×32'  },
  { w: 64, h: 64, label:  '64×64'  },
  { w:128, h:128, label: '128×128' },
  { w: 16, h:  8, label:  '16×8'   },
  { w: 32, h: 16, label:  '32×16'  },
  { w: 64, h: 32, label:  '64×32'  },
  { w:128, h: 64, label:  '128×64' },
];

const TOOLS = [
  { value: 'draw',    icon: 'mdi:pencil',            title: 'Draw'    },
  { value: 'fill',    icon: 'mdi:format-color-fill', title: 'Fill'    },
  { value: 'erase',   icon: 'mdi:eraser',            title: 'Erase'   },
  { value: 'pipette', icon: 'mdi:eyedropper',        title: 'Pipette' },
];

const makeGrid = (w, h) => Array.from({ length: h }, () => Array(w).fill(null));

//const makeGrid = n => Array.from({ length: n }, () => Array(n).fill(null));

// ------ SIGNALS ----------------------------------------------

let palette  = stored( PALETTE, appID + ':palette' );
let active   = stored('#000000', appID + ':active');
let tool     = signal('draw');
let preset   = stored({ w: 16, h: 16 }, appID + ':preset');
if (typeof preset.value === 'number') preset.value = { w: preset.value, h: preset.value };
let grid     = stored(makeGrid(preset.value.w, preset.value.h), appID + ':grid');
let scale    = stored( 1   , appID + ':scale'    );
let showBg   = stored( true, appID + ':showBg'   );
let showGap  = stored( true, appID + ':showGap'  );
let showGrid = stored( true, appID + ':showGrid' );
let mirror   = stored( 'none', appID + ':mirror' );

let exportWidth = stored( 512, appID + ':export-width' );

// ------ EFFECTS ----------------------------------------------

let root = document.documentElement;
effect(() => root.style.setProperty('--pxl-active' , active.value.toString()));
effect(() => root.style.setProperty('--pxl-scale'  , scale.value.toString()));
effect(() => { root.dataset.showBg   = showBg.value   ? 'true' : 'false' });
effect(() => { root.dataset.showGap  = showGap.value || showGrid.value ? 'true' : 'false' });
effect(() => { root.dataset.showGrid = showGrid.value ? 'true' : 'false' });

//effect(() => css.setProp('--pxl-scale' , scale));

// ------ ACTIONS ----------------------------------------------

let toggleShowBg   = () => showBg.value = !showBg.value;
let toggleShowGap  = () => showGap.value = !showGap.value;
let toggleShowGrid = () => showGrid.value = !showGrid.value;

function getMirrorCells (r, c) {
  let { w, h } = preset.value;
  let mr = h-1-r;
  let mc = w-1-c;
  
  switch (mirror.value) {
    case 'x'        : return [[r,c],[r,mc]];
    case 'y'        : return [[r,c],[mr,c]];
    case 'xy'       : return [[r,c],[r,mc],[mr,c],[mr,mc]];
    case 'diagonal' : return [[r,c],[c,r]];
    default         : return [[r,c]];
  }
}

// ------ HISTORY ----------------------------------------------

let hist    = [grid.value];
let historyIndex = 0;

let pushHistory = () => {
  hist = hist.slice(0, historyIndex + 1);
  hist.push(grid.value.map(r => [...r]));
  historyIndex = hist.length - 1;
};
let undo = () => { if (historyIndex > 0)               { historyIndex--; grid.value = hist[historyIndex].map(r => [...r]); } };
let redo = () => { if (historyIndex < hist.length - 1) { historyIndex++; grid.value = hist[historyIndex].map(r => [...r]); } };

document.addEventListener('keydown', event => {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
  if (event.key === 'y') { event.preventDefault(); redo(); }
});

// ------ CANVAS / GRID ----------------------------------------------

function changePreset (p) {
  let old = grid.value;
  preset.value = p;
  grid.value   = Array.from({ length: p.h }, (_, r) =>
                 Array.from({ length: p.w }, (_, c) => old[r]?.[c] ?? null));
  hist = [grid.value]; historyIndex = 0;
}

// Painting
function setCell (row, column, color) {
  //
  let newGrid = grid.value.map(row => [...row]);
  newGrid[row][column] = color;
  // mirroring
  let cells = getMirrorCells(row, column);
  cells.forEach(([rr, cc]) => newGrid[rr][cc] = color);
  //
  grid.value = newGrid;
}
function floodFill(r, c, target, replacement) {
  if (target === replacement) return;
  let { w, h } = preset.value;
  let g = grid.value.map(row => [...row]);
  let stack = [[r, c]];
  while (stack.length) {
    let [cr, cc] = stack.pop();
    if (cr < 0 || cr >= h || cc < 0 || cc >= w) continue;
    if (g[cr][cc] !== target) continue;
    g[cr][cc] = replacement;
    stack.push([cr+1,cc],[cr-1,cc],[cr,cc+1],[cr,cc-1]);
  }
  grid.value = g;
}
function handleCell (r, c) {
  if (tool.value === 'pipette') {
    let color = grid.value[r][c];
    if (color) active.value = color;
    tool.value = 'draw';
    return;
  }
  if (tool.value === 'erase') return setCell(r, c, null);
  if (tool.value === 'fill')  { floodFill(r, c, grid.value[r][c], active.value); pushHistory(); return; }
  // draw: toggle wenn gleiche farbe, sonst setzen
  let oldColor = grid.value[r][c];
  let newColor = oldColor === null || oldColor !== active.value ? active.value : null;
  setCell(r, c, newColor);
}

// Dragging
let painting = false;
let onCellDown  = (r, c, event) => { painting = true; handleCell(r, c); };
let onCellEnter = (r, c, event) => { if (painting && tool.value !== 'fill') handleCell(r, c); };
let stopPaint   = () => { if (painting) { pushHistory(); painting = false; } };

// Palette
let addColor    = color => { if (!palette.value.includes(color)) palette.value = [...palette.value, color]; active.value = color; };
let removeColor = color => palette.value = palette.value.filter(x => x !== color);

// Operations
let clearGrid    = () => { grid.value = makeGrid(preset.value); pushHistory(); };
let fillAll      = () => { let n = preset.value; grid.value = Array.from({ length: n }, () => Array(n).fill(active.value)); pushHistory(); };
let invertColors = () => {
  grid.value = grid.value.map(row => row.map(hex =>
    hex ? '#' + (0xffffff ^ parseInt(hex.slice(1), 16)).toString(16).padStart(6, '0') : null
  ));
  pushHistory();
};
function replaceColor (oldColor, newColor) {
  grid.value = grid.value.map(row => row.map(c => c === oldColor ? newColor : c));
  if (!palette.value.includes(newColor)) palette.value = [...palette.value, newColor];
  pushHistory();
}

// ------ EXPORT + IMPORT ----------------------------------------------

// JSON
function exportJSON() {
  let data = JSON.stringify({ 
    version : 1, 
    preset  : preset.value, 
    palette : palette.value, 
    grid    : grid.value 
  });
  let blob = new Blob([data], { type: 'application/json' });
  Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'pixel-art.json' }).click();
}
function importJSON (file) {
  file.text().then(raw => {
    let d = JSON.parse(raw);
    if (!d.grid || !d.preset) return alert('Invalid file');
    preset.value  = d.preset;
    palette.value = d.palette ?? palette.value;
    grid.value    = d.grid;
    hist = [grid.value]; historyIndex = 0;
  });
}

// SVG
function buildSVG() {
  let { w, h } = preset.value;
  let rects = grid.value.flatMap((row, r) =>
    row.map((color, c) => color ? `<rect x="${c}" y="${r}" width="1" height="1" fill="${color}"/>` : '')
  ).filter(Boolean).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">\n  ${rects}\n</svg>`;
}
function downloadSVG () {
  let blob = new Blob([buildSVG()], { type: 'image/svg+xml' });
  Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'pixel-art.svg' }).click();
}

// PNG
function downloadPNG() {
  let { w, h } = preset.value;
  let sz  = Math.max(4, Math.round(exportWidth.value / Math.max(w, h)));
  let cvs = Object.assign(document.createElement('canvas'), { width: w*sz, height: h*sz });
  let ctx = cvs.getContext('2d');
  grid.value.forEach((row, r) => row.forEach((color, c) => {
    if (!color) return;
    ctx.fillStyle = color;
    ctx.fillRect(c*sz, r*sz, sz, sz);
  }));
  cvs.toBlob(blob =>
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'pixel-art.png' }).click()
  );
}
function downloadUPNG() {
  let { w, h } = preset.value;
  let sz = Math.max(4, Math.round(exportWidth.value / Math.max(w, h)));
  let W = w*sz, H = h*sz;
  let rgba = new Uint8Array(W * H * 4);
  grid.value.forEach((row, r) => row.forEach((color, c) => {
    if (!color) return;
    let v = parseInt(color.slice(1), 16);
    let R = (v >> 16) & 0xff, G = (v >> 8) & 0xff, B = v & 0xff;
    for (let pr = 0; pr < sz; pr++) for (let pc = 0; pc < sz; pc++) {
      let i = ((r*sz+pr)*W + (c*sz+pc)) * 4;
      rgba[i]=R; rgba[i+1]=G; rgba[i+2]=B; rgba[i+3]=255;
    }
  }));
  let png  = UPNG.encode([rgba.buffer], W, H, 256);
  let blob = new Blob([png], { type: 'image/png' });
  Object.assign( document.createElement('a'), { href: URL.createObjectURL(blob), download: 'pixel-art-opt.png' }).click();
}

// ------ COMPONENTS ----------------------------------------------

function Grid() {
  return html`
    <div class="pixel-grid"
      style=${{ '--cols': preset.value.w, '--rows': preset.value.h }}
      onMouseLeave=${stopPaint}
      onMouseUp=${stopPaint}
      onContextMenu=${e => e.preventDefault()}>
      ${grid.value.flatMap((row, r) => row.map((color, c) => html`
        <div class="pixel-cell"
          style=${{ background: color ?? 'transparent' }}
          onMouseDown=${e => onCellDown(r, c, e)}
          onMouseEnter=${e => onCellEnter(r, c, e)} />
      `))}
    </div>`;
}

// cyclet / cycleswitch
// TODO: abstrahieren undals component auslagern
function MirrorToggle() {
  let [open, setOpen] = useState(false);
  let timer = useRef(null);
  let idx   = MIRROR_MODES.findIndex(m => m.id === mirror.value);
  let cur   = MIRROR_MODES[idx];

  let onDown = () => timer.current = setTimeout(() => setOpen(true), 400);
  let onUp   = () => clearTimeout(timer.current);

  return html`
    <div class="mirror-toggle">
      <button
        class=${'tool-btn' + (mirror.value !== 'none' ? ' active' : '')}
        title=${'Mirror: ' + cur.label + ' (hold to pick)'}
        onClick=${() => { mirror.value = MIRROR_MODES[(idx+1) % MIRROR_MODES.length].id; }}
        onMouseDown=${onDown} onMouseUp=${onUp} onMouseLeave=${onUp}>
        <${Icon} name=${cur.icon} />
      </button>
      ${open && html`
        <>
          <div class="mirror-backdrop" onClick=${() => setOpen(false)} />
          <div class="mirror-popup">
            ${MIRROR_MODES.map(m => html`
              <button class=${'mirror-opt' + (mirror.value === m.id ? ' active' : '')}
                onClick=${() => { mirror.value = m.id; setOpen(false); }}>
                <${Icon} name=${m.icon} /><span>${m.label}</span>
              </button>
            `)}
          </div>
        </>
      `}
    </div>
  `;
}

function Palette() {
  return html`
    <div class="palette">
      ${palette.value.map(c => html`
        <div class=${'pal-swatch' + (active.value === c ? ' active' : '')}
          style=${{ background: c }}
          onClick=${() => active.value = c}
          onContextMenu=${e => { e.preventDefault(); removeColor(c); }}
          title=${c} />
      `)}
      <label class="pal-add" title="Add color">
        <input type="color" style="opacity:0;position:absolute;width:0;height:0"
          onInput=${e => addColor(e.target.value)} />
        <${Icon} name="mdi:plus" />
      </label>
    </div>`;
}

function UsedColors() {
  let used = [...new Set(grid.value.flat().filter(Boolean))];
  return html`
    <div class="used-colors">
      <div class="used-swatch transparent" title="Transparent"
        onClick=${() => replaceColor(null, active.value)} />
      ${used.map(c => html`
        <label class="used-swatch" style=${{ background: c }} title=${c}>
          <input type="color" value=${c}
            style="opacity:0;position:absolute;width:0;height:0"
            onInput=${e => replaceColor(c, e.target.value)} />
        </label>
      `)}
    </div>
  `;
}

function NumberInput ({ signal: sig }) {
  return html`
    <input type='number' value=${sig.value} onInput=${() => sig.value = sig.target.value} />
  `;
}

function Toolbar () {
  return html`
    <div class="toolbar">
        
      <${Picker} options=${TOOLS} sig=${tool} />
      <${Picker} options=${SCALES} sig=${scale} />
      <div class="divider" />
      
      <${MirrorToggle} />
      <div class="divider" />
      
      <div class="tool-group">
        ${PRESETS.map(p => html`
          <button
            class=${'preset-btn' + (preset.value.w === p.w && preset.value.h === p.h ? ' active' : '')}
            onClick=${() => changePreset(p)}>
            ${p.label}
          </button>
        `)}
      </div>
      <div class="divider" />
      
      <div class="tool-group">
        <button class="tool-btn" title="Undo (Ctrl+Z)" onClick=${undo}><${Icon} name="mdi:undo" /></button>
        <button class="tool-btn" title="Redo (Ctrl+Y)" onClick=${redo}><${Icon} name="mdi:redo" /></button>
      </div>
      <div class="divider" />
      <div class="tool-group">
        <button class="tool-btn" title="Clear"         onClick=${clearGrid}><${Icon}    name="mdi:trash-can-outline" /></button>
        <button class="tool-btn" title="Fill all"      onClick=${fillAll}><${Icon}      name="mdi:palette" /></button>
        <button class="tool-btn" title="Invert colors" onClick=${invertColors}><${Icon} name="mdi:invert-colors" /></button>
      </div>
      <div class="divider" />
      
      <button class="btn primary"   onClick=${downloadSVG}><${Icon} name="mdi:download" /> SVG</button>
      <button class="btn secondary" onClick=${downloadPNG}><${Icon} name="mdi:image"    /> PNG</button>
      <button class="btn secondary" onClick=${downloadUPNG}><${Icon} name="mdi:image-compress" /> PNG opt</button>
      <button class="btn secondary" onClick=${exportJSON}><${Icon} name="mdi:code-json" /> JSON</button>
      
      <label class="btn secondary" title="Import JSON">
        <input type="file" accept=".json" style="display:none"
          onChange=${e => { importJSON(e.target.files[0]); e.target.value=''; }} />
        <${Icon} name="mdi:upload" /> Import
      </label>
      
      <div class="divider" />
      
      <div class="tool-group">
        <button class="tool-btn" title="Toggle BG"   onClick=${toggleShowBg}><${Icon} name="tabler:background" /></button>
        <button class="tool-btn" title="Toggle Gap"  onClick=${toggleShowGap}><${Icon} name="boxicons:between-vertical-end" /></button>
        <button class="tool-btn" title="Toggle Grid" onClick=${toggleShowGrid}><${Icon} name="cil:grid" /></button>
      </div>
      
      <div class='group'>
        <${NumberInput} signal=${exportWidth} />
      </div>
      
    </div>
  `;
}

function App() {
  return html`
    <div id="app-body">
      <${UsedColors} />
      <div class="canvas-wrap"><${Grid} /></div>
      <${Palette} />
      <${Toolbar} />
    </div>`;
}

boot({ config, App });
