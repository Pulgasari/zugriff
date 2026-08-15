// apps/image-converter/app.js

// ::: vendors
import { html, signal } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot } from './../../shared/js/app.js';
import { Button, Dropzone, Icon, Picker } from './../../shared/js/components/index.js';
import { stored } from './../../shared/js/lib/signals.js';

// ::: local
import * as config from './app.config.js';

const APP_ID = 'image-converter';

// ── state ────────────────────────────────────────────────────────────────────
let files   = signal([]); // { id, file, status, blobUrl, outName, error }
let format  = stored( 'webp' , APP_ID + '--format'  );
let quality = stored( 90     , APP_ID + '--quality' );
let FORMATS = ['jpg', 'png', 'webp'];

// ── helpers ──────────────────────────────────────────────────────────────────
let update = (id, patch) => files.value = files.value.map(file => file.id === id ? { ...file, ...patch } : file);
let convertAll = () => Promise.all(files.value.filter(file => file.status === 'pending').map(convertOne));

async function convertOne (entry) {
  update(entry.id, { status: 'converting' });
  try {
    let bitmap = await createImageBitmap(entry.file);
    let canvas = document.createElement('canvas');
    canvas.width  = bitmap.width;
    canvas.height = bitmap.height;
    let ctx = canvas.getContext('2d');

    // JPG has no alpha — fill white bg first
    if (format.value === 'jpg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    let mime = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' }[format.value];
    let blob = await new Promise(res => canvas.toBlob(res, mime, quality.value / 100 ));
    if (!blob) throw new Error('Conversion failed');

    let blobUrl = URL.createObjectURL(blob);
    let outName = entry.file.name.replace(/\.[^.]+$/, '') + '.' + format.value;
    update(entry.id, { status: 'done', blobUrl, outName });
  } catch (error) {
    update(entry.id, { status: 'error', error: error.message });
  }
}

function downloadAll() {
  files.value.filter(file => file.status === 'done').forEach(
    file => Object.assign(document.createElement('a'), { href: file.blobUrl, download: file.outName }).click()
  );
}

// ── components ───────────────────────────────────────────────────────────────

function QualitySlider() {
  if (format.value === 'png') return null;
  return html`
    <div class="quality-row">
      <label>Quality</label>
      <input type="range" min="0" max="100" value=${quality.value}
        onInput=${e => quality.value = +e.target.value} />
      <span class="quality-val">${quality.value}%</span>
    </div>`;
}

function FileItem ({ entry }) {
  let icon = { 
    pending    : 'mdi:image-outline', 
    converting : 'loading', 
    done       : 'mdi:check-circle-outline', 
    error      : 'mdi:alert-circle-outline'
  }[entry.status];
  let label = { 
    pending    : '—', 
    converting : 'converting…', 
    done       : entry.outName, 
    error      : entry.error
  }[entry.status];
  
  return html`
    <div class=${'file-item shadow ' + entry.status}>
      
      <div class='thumb'>
        <img src=${entry.previewUrl} alt=${entry.file.name} />
      </div>
      
      <${Icon} name=${icon} />
      <span class="name">${entry.file.name}</span>
      <span class="label">${label}</span>
      
      ${entry.status === 'done' && html`
        <a class="icon-btn" href=${entry.blobUrl} download=${entry.outName} title="Download">
          <${Icon} name="mdi:download" />
        </a>
      `}
        
      ${entry.status !== 'converting' && html`
        <button class="icon-btn remove" onClick=${() => files.value = files.value.filter(file => file.id !== entry.id)} title="Remove">
          <${Icon} name="close" />
        </button>
      `}
      
    </div>
  `;
}

function App() {
  let list       = files.value;
  let pendingCnt = list.filter(f => f.status === 'pending').length;
  let hasDone    = list.some(f => f.status === 'done');

  return html`
    <div id="app-body">
    
      <${Dropzone} accept='image/*' multiple=${true} sig=${files} what='images' />
      
      ${list.length > 0 && html`
        
        <div id='app-options'>
          <${Picker} options=${FORMATS} sig=${format} />
          <${QualitySlider} />
        </div>
        
        <div class="file-list">
          ${list.map( entry => html`<${FileItem} key=${entry.id} entry=${entry} />` )}
        </div>
        
        <div id='app-actions'>
          ${pendingCnt > 0 && html`<${Button} className='primary'   onClick=${convertAll}  icon='mdi:cog-outline'   label=${`Convert ${pendingCnt} file${pendingCnt > 1 ? 's' : ''}`} />`}
          ${hasDone        && html`<${Button} className='secondary' onClick=${downloadAll} icon='download-multiple' label='Download all' />`}
        </div>
        
      `}
      
    </div>`;
}

boot({ config, App });
