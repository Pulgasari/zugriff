// tools/image-batch-processor/app.js

// ::: vendors
import { html, signal } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot, config } from '/.shared/js/app.js?slug=image-batch-processor';
import { Dropzone, GhostButton, Icon } from '/.shared/js/components/index.js';
import { stored } from '/.shared/js/lib/signals.js';

// ── state ────────────────────────────────────────────────────────────
let files = signal([]);
let tasks = stored([], 'ibp:tasks');
let _id = 0;

// ── task definitions ─────────────────────────────────────────────────
let TASK_TYPES = {
  blur       : { label: 'Blur',       icon: 'mdi:blur',               defaults: { radius: 4 } },
  brightness : { label: 'Brightness', icon: 'mdi:brightness-6',       defaults: { value: 0 } },
  contrast   : { label: 'Contrast',   icon: 'mdi:contrast-circle',    defaults: { value: 0 } },
  convert    : { label: 'Convert',    icon: 'mdi:image-sync-outline', defaults: { fmt: 'webp' } },
  crop       : { label: 'Crop',       icon: 'mdi:crop',               defaults: { x: 0, y: 0, w: 800, h: 600 } },
  flip       : { label: 'Flip',       icon: 'mdi:flip-horizontal',    defaults: { axis: 'h' } },
  grayscale  : { label: 'Grayscale',  icon: 'mdi:contrast',           defaults: {} },
  quality    : { label: 'Quality',    icon: 'mdi:image-filter-hdr',   defaults: { value: 85 } },
  resize     : { label: 'Resize',     icon: 'mdi:resize',             defaults: { w: 800, h: '', lock: true } },
  rotate     : { label: 'Rotate',     icon: 'mdi:rotate-right',       defaults: { deg: 90 } },
  watermark  : { label: 'Watermark',  icon: 'mdi:watermark',          defaults: { text: '© 2025', size: 24, pos: 'br', opacity: 0.5 } },
};
/*
rename
to gif
zip
fill alpha
add overlay

abfolge speichern
abfolgr exportieren/importieren (als json?)

vorschaumodus
*/

// ── task helpers ──────────────────────────────────────────────────────────────
let addTask    = type  => tasks.value = [...tasks.value, { id: _id++, type, params: { ...TASK_TYPES[type].defaults } }];
let removeTask = id    => tasks.value = tasks.value.filter(t => t.id !== id);
let moveTask   = (id, dir) => {
  let arr = [...tasks.value];
  let i   = arr.findIndex(t => t.id === id);
  let j   = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  tasks.value = arr;
};
let updateTask = (id, patch) => tasks.value = tasks.value.map(t => t.id === id ? { ...t, params: { ...t.params, ...patch } } : t);

// ── canvas processing ─────────────────────────────────────────────────────────
async function processOne (file) {
  let bitmap = await createImageBitmap(file);
  let canvas = document.createElement('canvas');
  let ctx    = canvas.getContext('2d');
  canvas.width  = bitmap.width;
  canvas.height = bitmap.height;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  let fmt = file.type || 'image/webp';

  for (let task of tasks.value) {
    let p = task.params;
    let w = canvas.width, h = canvas.height;

    if (task.type === 'rotate') {
      let deg = ((p.deg % 360) + 360) % 360;
      let swap = deg === 90 || deg === 270;
      let tmp  = document.createElement('canvas');
      tmp.width  = swap ? h : w;
      tmp.height = swap ? w : h;
      let tc   = tmp.getContext('2d');
      tc.translate(tmp.width / 2, tmp.height / 2);
      tc.rotate((deg * Math.PI) / 180);
      tc.drawImage(canvas, -w / 2, -h / 2);
      canvas = tmp; ctx = tc;
    }
    
    else if (task.type === 'flip') {
      let tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      let tc  = tmp.getContext('2d');
      if (p.axis === 'h') { tc.scale(-1, 1); tc.drawImage(canvas,-w, 0); }
      else                { tc.scale( 1,-1); tc.drawImage(canvas, 0,-h); }
      canvas = tmp; ctx = tc;
    }
    
    else if (task.type === 'resize') {
      let nw = p.w ? +p.w : Math.round(w * (+p.h / h));
      let nh = p.h ? +p.h : Math.round(h * (+p.w / w));
      let tmp = document.createElement('canvas');
      tmp.width = nw; tmp.height = nh;
      let tc  = tmp.getContext('2d');
      tc.drawImage(canvas, 0, 0, nw, nh);
      canvas = tmp; ctx = tc;
    }
    
    else if (task.type === 'crop') {
      let tmp = document.createElement('canvas');
      tmp.width = +p.w; tmp.height = +p.h;
      let tc  = tmp.getContext('2d');
      tc.drawImage(canvas, -p.x, -p.y);
      canvas = tmp; ctx = tc;
    }

    else if (task.type === 'convert') {
      fmt = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' }[p.fmt] ?? fmt;
    }

    else if (task.type === 'brightness' || task.type === 'contrast') {
      let id = ctx.getImageData(0, 0, w, h);
      let d  = id.data;
      let v  = +p.value;
      for (let i = 0; i < d.length; i += 4) {
        if (task.type === 'brightness') {
          d[i]   = Math.min(255, Math.max(0, d[i]   + v));
          d[i+1] = Math.min(255, Math.max(0, d[i+1] + v));
          d[i+2] = Math.min(255, Math.max(0, d[i+2] + v));
        } else {
          let f = (259 * (v + 255)) / (255 * (259 - v));
          d[i]   = Math.min(255, Math.max(0, f * (d[i]   - 128) + 128));
          d[i+1] = Math.min(255, Math.max(0, f * (d[i+1] - 128) + 128));
          d[i+2] = Math.min(255, Math.max(0, f * (d[i+2] - 128) + 128));
        }
      }
      ctx.putImageData(id, 0, 0);
    }

    else if (task.type === 'grayscale') {
      let id = ctx.getImageData(0, 0, w, h);
      let d  = id.data;
      for (let i = 0; i < d.length; i += 4) {
        let g = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
        d[i] = d[i+1] = d[i+2] = g;
      }
      ctx.putImageData(id, 0, 0);
    }

    else if (task.type === 'blur') {
      ctx.filter = `blur(${p.radius}px)`;
      let tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      let tc  = tmp.getContext('2d');
      tc.filter = `blur(${p.radius}px)`;
      tc.drawImage(canvas, 0, 0);
      tc.filter = 'none';
      canvas = tmp; ctx = tc;
    }

    else if (task.type === 'watermark') {
      let pos   = p.pos;
      let size  = +p.size;
      ctx.globalAlpha = +p.opacity;
      ctx.font        = `bold ${size}px system-ui`;
      ctx.fillStyle   = '#fff';
      let tw = ctx.measureText(p.text).width;
      let pad = 16;
      let x = pos.includes('r') ? w - tw - pad : pad;
      let y = pos.includes('b') ? h - pad      : size + pad;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText(p.text, x+1, y+1);
      ctx.fillStyle = '#fff';
      ctx.fillText(p.text, x, y);
      ctx.globalAlpha = 1;
    }

    else if (task.type === 'quality') {
      // applied at export
    }
  }

  let quality  = tasks.value.find(t => t.type === 'quality')?.params.value ?? 92;
  let blob     = await new Promise(res => canvas.toBlob(res, fmt, quality / 100));
  let ext      = fmt.split('/')[1].replace('jpeg', 'jpg');
  let outName  = file.name.replace(/\.[^.]+$/, '') + '_processed.' + ext;
  return { blob, outName };
}

// ── file processing ───────────────────────────────────────────────────────────
let update = (id, patch) => files.value = files.value.map(f => f.id === id ? { ...f, ...patch } : f);
async function runAll() {
  for (let f of files.value.filter(f => f.status === 'pending')) {
    update(f.id, { status: 'processing' });
    try {
      let { blob, outName } = await processOne(f.file);
      update(f.id, { status: 'done', blobUrl: URL.createObjectURL(blob), outName });
    } catch(e) {
      update(f.id, { status: 'error', error: e.message });
    }
  }
}
function downloadAll() {
  files.value.filter(f => f.status === 'done').forEach(f =>
    Object.assign(document.createElement('a'), { href: f.blobUrl, download: f.outName }).click()
  );
}

// ── Task component ────────────────────────────────────────────────────────────
function TaskPane ({ task, index, total, children }) {
  
  let { id, type }    = task;
  let { icon, label } = TASK_TYPES[type];
  
  let moveUp   = () =>   moveTask(id, -1);
  let moveDown = () =>   moveTask(id,  1);
  let remove   = () => removeTask(id);
  
  return html`
    <div class='pane task'>
      <header>
        <span class='title'>
          <${Icon} name=${icon} /> ${label}
        </span>
        <menu class='actions'>
          <${GhostButton} icon='mdi:chevron-up'   onClick=${moveUp}   disabled=${index === 0}         />
          <${GhostButton} icon='mdi:chevron-down' onClick=${moveDown} disabled=${index === total - 1} />
          <${GhostButton} icon='mdi:close'        onClick=${remove}   />
        </menu>
      </header>
      <main>${children}</main>
    </div>
  `;
}

function      BlurTaskPane (props) {
  let { id, params: p } = props.task;
  
  return html`
    <${TaskPane} ...${props}>
      <input type="range" min=1 max=20 value=${p.radius}
        onInput=${e => updateTask(id, { radius: +e.target.value })} style="flex:1;accent-color:var(--accent)" />
      <span class="task-val">${p.radius}px</span>
    </${TaskPane}>
  `;
}
function      CropTaskPane (props) {
  let { id, params: p } = props.task;
  let field = (label, key) => html`
    <label class="task-label">${label}</label>
    <input type="number" class="field task-input sm" value=${p[key]}
      onInput=${e => updateTask(id, { [key]: +e.target.value })} />`;
  return html`
    <${TaskPane} ...${props}>
      ${field('X','x')} 
      ${field('Y','y')} 
      ${field('W','w')} 
      ${field('H','h')}
    </${TaskPane}>`;
}
function   ConvertTaskPane (props) {
  let { id, params: p } = props.task;
  
  return html`
    <${TaskPane} ...${props}>
      ${['webp', 'png', 'jpg'].map(f => html`
        <button class=${'chip' + (p.fmt === f ? ' active' : '')} onClick=${() => updateTask(id, { fmt: f })}>${f}</button>`)}
    </${TaskPane}>
  `;
}
function      FlipTaskPane (props) {
  let { id, params: p } = props.task;
  return html`
    <${TaskPane} ...${props}>
      <button class=${'chip' + (p.axis === 'h' ? ' active' : '')}
        onClick=${() => updateTask(id, { axis: 'h' })}>
        <${Icon} name="mdi:flip-horizontal" /> Horizontal
      </button>
      <button class=${'chip' + (p.axis === 'v' ? ' active' : '')}
        onClick=${() => updateTask(id, { axis: 'v' })}>
        <${Icon} name="mdi:flip-vertical" /> Vertical
      </button>
    </${TaskPane}>`;
}
function GrayscaleTaskPane (props) {
  return html`
    <${TaskPane} ...${props}>
      <span class="task-hint">No options</span>
    </${TaskPane}>
  `;
}
function    ResizeTaskPane (props) {
  let { id, params: p } = props.task;
  return html`
    <${TaskPane} ...${props}>
      <label class="task-label">W</label>
      <input type="number" class="field task-input" placeholder="px" value=${p.w}
        onInput=${e => updateTask(id, { w: e.target.value })} />
      <label class="task-label">H</label>
      <input type="number" class="field task-input" placeholder="px" value=${p.h}
        onInput=${e => updateTask(id, { h: e.target.value })} />
      <span class="task-hint">(leave one empty to keep ratio)</span>
    </${TaskPane}>`;
}
function    RotateTaskPane (props) {
  let { id, params: p } = props.task;
  return html`
    <${TaskPane} ...${props}>
      ${[90, 180, 270].map(d => html`
        <button class=${'chip' + (p.deg === d ? ' active' : '')}
          onClick=${() => updateTask(id, { deg: d })}>${d}°</button>`)}
      <input type="number" class="field task-input sm" value=${p.deg} min=0 max=359
        onInput=${e => updateTask(id, { deg: +e.target.value })} />
    </${TaskPane}>`;
}
function WatermarkTaskPane (props) {
  let { id, params: p } = props.task;
  let POSITIONS = [['tl','top-left'],['tr','top-right'],['bl','bottom-left'],['br','bottom-right']];
  return html`
    <${TaskPane} ...${props}>
      <input class="field task-input grow" type="text" value=${p.text} placeholder="Text"
        onInput=${e => updateTask(id, { text: e.target.value })} />
      <label class="task-label">Size</label>
      <input type="number" class="field task-input sm" value=${p.size} min=8 max=200
        onInput=${e => updateTask(id, { size: +e.target.value })} />
      <label class="task-label">Opacity</label>
      <input type="range" min=0 max=1 step=0.05 value=${p.opacity}
        onInput=${e => updateTask(id, { opacity: +e.target.value })}
        style="width:80px;accent-color:var(--accent)" />
      ${POSITIONS.map(([v, l]) => html`
        <button class=${'chip' + (p.pos === v ? ' active' : '')}
          onClick=${() => updateTask(id, { pos: v })} title=${l}>
          ${v.toUpperCase()}
        </button>`)}
    </${TaskPane}>`;
}

function      RangeTaskPane ({ task, index, total, min, max, step = 1, unit = '' }) {
  let { id, params: p } = task;
  return html`
    <${TaskPane} ...${{ task, index, total }}>
      <input type="range" min=${min} max=${max} step=${step} value=${p.value}
        onInput=${e => updateTask(id, { value: +e.target.value })}
        style="flex:1;accent-color:var(--accent)" />
      <span class="task-val">${p.value}${unit}</span>
    </${TaskPane}>`;
}
function BrightnessTaskPane (props) {
  return html`<${RangeTaskPane} ...${props} min=${-100} max=${100} />`;
}
function   ContrastTaskPane (props) {
  return html`<${RangeTaskPane} ...${props} min=${-100} max=${100} />`;
}
function    QualityTaskPane (props) {
  return html`<${RangeTaskPane} ...${props} min=${1} max=${100} unit="%" />`;
}

let TASK_PANE = {
  blur       : BlurTaskPane,
  brightness : BrightnessTaskPane,
  contrast   : ContrastTaskPane,
  convert    : ConvertTaskPane,
  crop       : CropTaskPane,
  flip       : FlipTaskPane,
  grayscale  : GrayscaleTaskPane,
  quality    : QualityTaskPane,
  resize     : ResizeTaskPane,
  rotate     : RotateTaskPane,
  watermark  : WatermarkTaskPane,
};

// ── TaskAdder ─────────────────────────────────────────────────────────────────
function TaskAdder() {
  return html`
    <div class="task-adder">
      <span class="adder-label">Add task</span>
      <div class="adder-chips">
        ${Object.entries(TASK_TYPES).map(([type, def]) => html`
          <button class="chip" onClick=${() => addTask(type)}>
            <${Icon} name=${def.icon} /> ${def.label}
          </button>`)}
      </div>
    </div>`;
}

// ── FileItem ──────────────────────────────────────────────────────────────────
function FileItem({ entry: e }) {
  let icon = {
    pending    : 'mdi:image-outline',
    processing : 'mdi:loading',
    done       : 'mdi:check-circle-outline',
    error      : 'mdi:alert-circle-outline',
  }[e.status];
  return html`
    <div class=${'file-item ' + e.status}>
      <${Icon} name=${icon} class=${e.status === 'processing' ? 'spin' : ''} />
      <span class="name">${e.file.name}</span>
      ${e.status === 'done' && html`
        <a class="icon-btn" href=${e.blobUrl} download=${e.outName}><${Icon} name="mdi:download" /></a>`}
      ${e.status !== 'processing' && html`
        <button class="icon-btn remove" onClick=${() => files.value = files.value.filter(f => f.id !== e.id)}>
          <${Icon} name="mdi:close" />
        </button>`}
    </div>`;
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  let list       = files.value;
  let taskList   = tasks.value;
  let pendingCnt = list.filter(f => f.status === 'pending').length;
  let hasDone    = list.some(f => f.status === 'done');
  let busy       = list.some(f => f.status === 'processing');

  return html`
    <div id="app-body">
      
      <${Dropzone} accept="image/*" icon="mdi:image-plus" multiple=${true} sig=${files} what="images" />
      
      ${list.length > 0 && html`
        <div class="file-list">
          ${list.map(e => html`<${FileItem} key=${e.id} entry=${e} />`)}
        </div>
      `}
      
      <${TaskAdder} />
      
      ${taskList.length > 0 && html`
        <div class="tasks">
          ${taskList.map( (task, index) => {
            let Pane = TASK_PANE[task.type];
            return Pane && html`<${Pane} task=${task} index=${index} total=${taskList.length} />`;
          })}
        </div>
      `}
      
      
      ${(list.length > 0 && taskList.length > 0) && html`
        <div id='app-actions'>
          <button class="btn primary" onClick=${runAll} disabled=${busy || pendingCnt === 0}>
            <${Icon} name=${busy ? 'mdi:loading' : 'mdi:play'} class=${busy ? 'spin' : ''} />
            ${busy ? 'Processing…' : 'Run on ' + pendingCnt + ' image' + (pendingCnt > 1 ? 's' : '')}
          </button>
          ${hasDone && html`
            <button class="btn secondary" onClick=${downloadAll}>
              <${Icon} name="mdi:download-multiple" /> Download all
            </button>`}
        </div>`}
    </div>`;
}

boot({ config, App });
