// tools/svg-pixel-pattern-generator/app.js

// ::: vendors
import { effect, html, signal, useState } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot, config } from './../../.shared/js/app.js?slug=svg-pixel-pattern-generator';
import { Icon } from './../../.shared/js/components/index.js';
import { stored } from './../../.shared/js/lib/signals.js';

// ::: local

let appID = 'svgppg';

/*
image-rendering: auto;
image-rendering: smooth;
image-rendering: crisp-edges;
image-rendering: pixelated;
*/

// ── state ─────────────────────────────────────────────────────────────────────
let palette = stored(['#e63946','#457b9d','#2a9d8f','#e9c46a','#f4a261','#264653','#ffffff','#000000'], appID + ':palette');
let active  = stored('#000000', appID + ':active');
let tool    = stored('draw', appID + ':tool');
let cols    = stored( 9, appID + ':cols');
let rows    = stored( 9, appID + ':rows');
let gap     = stored( 0, appID + ':gap');
let cellSz  = stored(32, appID + ':cellsz');
let grid    = stored(makeGrid(cols.value, rows.value, '#ffffff'), appID + ':grid');
//let grid    = signal(makeGrid(cols.value, rows.value, '#ffffff'));

// wenn cols oder rows sich ändern → grid anpassen
effect(() => {
  let c = cols.value, r = rows.value;
  let g = grid.value;
  // nur resizen wenn dimensionen nicht passen
  if (g.length !== r || g[0]?.length !== c) {
    let nr = Array.from({ length: r }, (_, ri) =>
      Array.from({ length: c }, (_, ci) => g[ri]?.[ci] ?? '#ffffff')
    );
    grid.value = nr;
  }
});

function makeGrid (c, r, fill = '#ffffff') {
  return Array.from({ length: r }, () => Array(c).fill(fill));
}

function resizeGrid (newCols, newRows) {
  let old = grid.value;
  let nr  = Array.from({ length: newRows }, (_, r) =>
    Array.from({ length: newCols }, (_, c) =>
      (old[r]?.[c]) ?? '#ffffff'
    )
  );
  grid.value = nr;
}

// ── tools ─────────────────────────────────────────────────────────────────────
function setCell (r, c, color) {
  let g = grid.value.map(row => [...row]);
  g[r][c] = color;
  grid.value = g;
}

function floodFill (r, c, target, replacement) {
  if (target === replacement) return;
  let g = grid.value.map(row => [...row]);
  let stack = [[r, c]];
  while (stack.length) {
    let [cr, cc] = stack.pop();
    if (cr < 0 || cr >= rows.value || cc < 0 || cc >= cols.value) continue;
    if (g[cr][cc] !== target) continue;
    g[cr][cc] = replacement;
    stack.push([cr+1,cc],[cr-1,cc],[cr,cc+1],[cr,cc-1]);
  }
  grid.value = g;
}

function handleCell (r, c) {
  if (tool.value === 'erase') { setCell(r, c, '#ffffff'); return; }
  if (tool.value === 'fill')  { floodFill(r, c, grid.value[r][c], active.value); return; }
  setCell(r, c, active.value);
}

// ── drag painting ─────────────────────────────────────────────────────────────
let painting = false;
let onCellDown  = (r, c) => { painting = true; handleCell(r, c); };
let onCellEnter = (r, c) => { if (painting && tool.value !== 'fill') handleCell(r, c); };
let stopPaint   = ()     => { painting = false; };

// ── palette ───────────────────────────────────────────────────────────────────
let addColor    = c => { if (!palette.value.includes(c)) palette.value = [...palette.value, c]; active.value = c; };
let removeColor = c => palette.value = palette.value.filter(x => x !== c);

// ── actions ───────────────────────────────────────────────────────────────────
let clearGrid    = () => { grid.value = makeGrid(cols.value, rows.value, '#ffffff'); };
let fillAll      = () => { grid.value = makeGrid(cols.value, rows.value, active.value); };
let invertColors = () => {
  grid.value = grid.value.map(row => row.map(hex => {
    let n = parseInt(hex.slice(1), 16);
    return '#' + (0xffffff ^ n).toString(16).padStart(6, '0');
  }));
};

// ── export SVG ────────────────────────────────────────────────────────────────
function buildSVG() {
  let g   = grid.value;
  let sz  = 10;
  let gp  = gap.value;
  let W   = cols.value * (sz + gp);
  let H   = rows.value * (sz + gp);
  let rects = g.flatMap((row, r) =>
    row.map((color, c) =>
      `<rect x="${c*(sz+gp)}" y="${r*(sz+gp)}" width="${sz}" height="${sz}" fill="${color}"/>`
    )
  ).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">\n  ${rects}\n</svg>`;
}

function downloadSVG() {
  let svg  = buildSVG();
  let blob = new Blob([svg], { type: 'image/svg+xml' });
  Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: 'pattern.svg',
  }).click();
}

// ── SVG data URL (shared) ─────────────────────────────────────────────────────
function buildSVGDataURL() {
  let svg = buildSVG();
  // btoa braucht encodeURIComponent für non-ASCII Zeichen
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// ── CSS export (SVG als background-image) ─────────────────────────────────────
function buildCSS() {
  let url = buildSVGDataURL();
  let sz  = 10; // muss mit buildSVG übereinstimmen
  let gp  = gap.value;
  let W   = cols.value * (sz + gp) + 'px';
  let H   = rows.value * (sz + gp) + 'px';
  return `.pixel-art {\n  width: ${W};\n  height: ${H};\n  background-image: url("${url}");\n  background-repeat: no-repeat;\n  background-size: 100% 100%;\n  image-rendering: pixelated;\n}`;
}
function buildCSS2() {
  let url = buildSVGDataURL();
  let sz  = 10; // muss mit buildSVG übereinstimmen
  let gp  = gap.value;
  let W   = cols.value * (sz + gp) + 'px';
  let H   = rows.value * (sz + gp) + 'px';
  return `background-image: url("${url}");\n`
       + `background-repeat: repeat;\n `
       + `background-size: 3px 3px;\n`
       + `image-rendering: smooth;`;
}

function copyCSS () {
  navigator.clipboard.writeText(buildCSS());
}

function Preview() {
  //let url   = buildSVGDataURL();
  let style = buildCSS2();
  return html`<div class='preview' style=${style}></div>`;
  /*
  return html`
    <div class="preview" style=${{
      backgroundImage  : `url("${url}")`,
      backgroundRepeat : 'repeat',
      backgroundSize   : 'contain',
      imageRendering   : 'pixelated',
    }} />`;
  */
}

// ── Grid component ────────────────────────────────────────────────────────────
function Grid() {
  let g  = grid.value;
  let sz = cellSz.value;

  return html`
    <div class="pixel-grid"
      style=${{ '--sz': sz + 'px', '--cols': cols.value }}
      onMouseLeave=${stopPaint}
      onMouseUp=${stopPaint}>
      ${g.flatMap((row, r) =>
        row.map((color, c) => html`
          <div
            class="pixel-cell"
            style=${{ background: color }}
            onMouseDown=${() => onCellDown(r, c)}
            onMouseEnter=${() => onCellEnter(r, c)}
          />`)
      )}
    </div>`;
}

// ── Palette ───────────────────────────────────────────────────────────────────
function Palette() {
  let [picking, setPicking] = useState(false);
  let pickerRef;

  return html`
    <div class="palette">
      ${palette.value.map(c => html`
        <div
          class=${'pal-swatch' + (active.value === c ? ' active' : '')}
          style=${{ background: c }}
          onClick=${() => active.value = c}
          onContextMenu=${e => { e.preventDefault(); removeColor(c); }}
          title=${c}
        />
      `)}
      <label class="pal-add" title="Add color">
        <input type="color" style="opacity:0;position:absolute;width:0;height:0"
          onInput=${e => addColor(e.target.value)} />
        <${Icon} name="mdi:plus" />
      </label>
    </div>`;
}

// ── SizeInput ─────────────────────────────────────────────────────────────────
function SizeInput({ label, sig, min=1, max=64, onChange }) {
  return html`
    <div class="size-field">
      <span class="size-label">${label}</span>
      <button class="sz-btn" onClick=${() => { let v = Math.max(min, sig.value-1); sig.value=v; onChange?.(v); }}>
        <${Icon} name="mdi:minus" />
      </button>
      <input type="number" class="field sz-input" min=${min} max=${max} value=${sig.value}
        onInput=${e => { let v = Math.max(min, Math.min(max, +e.target.value)); sig.value=v; onChange?.(v); }} />
      <button class="sz-btn" onClick=${() => { let v = Math.min(max, sig.value+1); sig.value=v; onChange?.(v); }}>
        <${Icon} name="mdi:plus" />
      </button>
    </div>`;
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  let TOOLS = [
    { id: 'draw',  icon: 'mdi:pencil',            label: 'Draw'  },
    { id: 'fill',  icon: 'mdi:format-color-fill', label: 'Fill'  },
    { id: 'erase', icon: 'mdi:eraser',            label: 'Erase' },
  ];

  return html`
    <div id="app-body">
      
      <${Preview} />
      
      <div class="canvas-wrap"><${Grid} /></div>
      
      <${Palette} />
      
      <div class="toolbar">
        <div class="tool-group">
          ${TOOLS.map(t => html`
            <button class=${'tool-btn' + (tool.value === t.id ? ' active' : '')}
              title=${t.label} onClick=${() => tool.value = t.id}>
              <${Icon} name=${t.icon} />
            </button>`)}
        </div>
        <div class="divider" />
        <div class="tool-group">
          <button class="tool-btn" title="Clear" onClick=${clearGrid}>
            <${Icon} name="mdi:trash-can-outline" />
          </button>
          <button class="tool-btn" title="Fill all with active color" onClick=${fillAll}>
            <${Icon} name="mdi:palette" />
          </button>
          <button class="tool-btn" title="Invert colors" onClick=${invertColors}>
            <${Icon} name="mdi:invert-colors" />
          </button>
        </div>
        <div class="divider" />
        <${SizeInput} label="W" sig=${cols} />
        <${SizeInput} label="H" sig=${rows} />
        <div class="divider" />
        <div class="tool-group">
          <button class="tool-btn" title="Zoom out" onClick=${() => cellSz.value = Math.max(8, cellSz.value - 4)}>
            <${Icon} name="mdi:magnify-minus-outline" />
          </button>
          <button class="tool-btn" title="Zoom in" onClick=${() => cellSz.value = Math.min(64, cellSz.value + 4)}>
            <${Icon} name="mdi:magnify-plus-outline" />
          </button>
        </div>
        <div class="divider" />
        <button class="btn primary" onClick=${downloadSVG}>
          <${Icon} name="mdi:download" /> SVG
        </button>
        <button class="btn secondary" onClick=${copyCSS}>
          <${Icon} name="mdi:content-copy" /> CSS
        </button>
      </div>
      
    </div>
  `;
}

boot({ config, App });
