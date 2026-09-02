// apps/images/routes/batch.js
// batch route (ex image-batch-processor): a pipeline of tasks over many images.

import { html, signal } from '@aufbau/kits/preact-htm';
import { Icon } from '/.shared/js/components/index.js';
import { stored } from '/.shared/js/app/signals.js';
import * as fx from '../filters.js';
import { dropEntries, ImgDrop, ToolFileItem } from './tools.js';

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
export { BatchMode };
export default BatchMode;
