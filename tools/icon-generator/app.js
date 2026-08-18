// tools/icon-generator/app.js
//
// the client side replacement for the Imagick routine that used to sit in
// global.php: an svg goes in, the png sizes a web app manifest needs come out.

// ::: vendors
import { html, signal, computed } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot } from './../../shared/js/app.js';
import { Dropzone, Icon, Button } from './../../shared/js/components/index.js';
import { stored } from './../../shared/js/lib/signals.js';

// ::: local
import * as config from './app.config.js';

// ── state ──────────────────────────────────────────────────────────────────

const SIZES = [16, 32, 64, 96, 128, 180, 192, 256, 512, 1024];

const files    = signal([]);          // entries from the dropzone
const source   = signal(null);        // { name, svg, url }
const sizes    = stored([192, 512], 'icon-generator:sizes');
const padding  = stored(0,          'icon-generator:padding');   // percent
const bg       = stored('',         'icon-generator:bg');        // '' = transparent
const results  = signal([]);         // { size, blob, url }
const busy     = signal(false);
const errMsg   = signal('');

const hasSource = computed(() => !!source.value);

// ── loading ────────────────────────────────────────────────────────────────

async function useFile (file) {
  errMsg.value = '';

  if (!/svg/i.test(file.type) && !/\.svg$/i.test(file.name)) {
    errMsg.value = `${file.name} is not an svg`;
    return;
  }

  const svg = await file.text();
  source.value = {
    name : file.name.replace(/\.svg$/i, ''),
    svg,
    url  : URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })),
  };
  results.value = [];
}

// the dropzone hands us entries — we only ever want the newest svg
function onFiles (entries) {
  const entry = entries[entries.length - 1];
  if (entry) useFile(entry.file);
}

// ── rendering ──────────────────────────────────────────────────────────────

async function renderSize (image, size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  if (bg.value) {
    ctx.fillStyle = bg.value;
    ctx.fillRect(0, 0, size, size);
  }

  const inset = Math.round(size * (padding.value / 100));
  const box   = size - inset * 2;

  // keep the aspect ratio — a non-square source is centred, never stretched
  const scale = Math.min(box / image.width, box / image.height);
  const w     = image.width  * scale;
  const h     = image.height * scale;
  ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error(`could not render ${size}px`);

  return { size, blob, url: URL.createObjectURL(blob) };
}

async function generate () {
  if (!source.value || !sizes.value.length) return;

  busy.value    = true;
  errMsg.value  = '';
  results.value.forEach(result => URL.revokeObjectURL(result.url));
  results.value = [];

  try {
    // decoding through an <img> keeps the svg's own viewBox intact
    const image = new Image();
    image.src = source.value.url;
    await image.decode();

    const ordered = [...sizes.value].sort((a, b) => a - b);
    results.value = [];
    for (const size of ordered) {
      results.value = [...results.value, await renderSize(image, size)];
    }
  } catch (error) {
    errMsg.value = error.message;
  } finally {
    busy.value = false;
  }
}

// ── download ───────────────────────────────────────────────────────────────

function save (href, name) {
  const a = Object.assign(document.createElement('a'), { href, download: name });
  a.click();
}

const iconName = size => `icon-${size}.png`;

function downloadAll () {
  results.value.forEach(result => save(result.url, iconName(result.size)));
  save(source.value.url, 'icon.svg');
}

function toggleSize (size) {
  const active = sizes.value.includes(size);
  sizes.value = active
    ? sizes.value.filter(value => value !== size)
    : [...sizes.value, size].sort((a, b) => a - b);
}

// ── components ─────────────────────────────────────────────────────────────

function SizePicker () {
  return html`
    <div class="size-picker">
      ${SIZES.map(size => html`
        <button
          class=${'chip' + (sizes.value.includes(size) ? ' active' : '')}
          onClick=${() => toggleSize(size)}>
          ${size}
        </button>`)}
    </div>`;
}

function Options () {
  return html`
    <div class="options">
      <label class="option">
        <span>Padding</span>
        <input type="range" min="0" max="25" value=${padding.value}
               onInput=${event => padding.value = +event.target.value} />
        <span class="option-value">${padding.value}%</span>
      </label>

      <label class="option">
        <span>Background</span>
        <input type="color" value=${bg.value || '#282a36'}
               onInput=${event => bg.value = event.target.value} />
        <button class="chip" onClick=${() => bg.value = ''} disabled=${!bg.value}>
          transparent
        </button>
      </label>
    </div>`;
}

function Results () {
  if (!results.value.length) return null;

  return html`
    <div class="results">
      ${results.value.map(result => html`
        <figure class="result" key=${result.size}>
          <img src=${result.url} alt=${iconName(result.size)}
               width=${Math.min(result.size, 128)} height=${Math.min(result.size, 128)} />
          <figcaption>
            <span>${iconName(result.size)}</span>
            <button class="icon-btn" title="Download"
                    onClick=${() => save(result.url, iconName(result.size))}>
              <${Icon} name="mdi:download" />
            </button>
          </figcaption>
        </figure>`)}
    </div>`;
}

function App () {
  return html`
    <div id="app-body">

      <${Dropzone} accept="image/svg+xml,.svg" multiple=${false}
                   sig=${files} onFiles=${onFiles} what="an app.svg" />

      ${errMsg.value && html`
        <div class="err-block">
          <${Icon} name="mdi:alert-circle-outline" /> ${errMsg.value}
        </div>`}

      ${hasSource.value && html`
        <div class="source">
          <img class="source-preview" src=${source.value.url} alt=${source.value.name} />
          <span class="source-name">${source.value.name}.svg</span>
        </div>

        <${SizePicker} />
        <${Options} />

        <div id="app-actions">
          <${Button} className="primary" onClick=${generate}
                     disabled=${busy.value || !sizes.value.length}
                     icon=${busy.value ? 'loading' : 'mdi:cog-outline'}
                     label=${busy.value ? 'Rendering…' : `Render ${sizes.value.length} size${sizes.value.length === 1 ? '' : 's'}`} />
          ${results.value.length > 0 && html`
            <${Button} className="secondary" onClick=${downloadAll}
                       icon="download-multiple" label="Download all" />`}
        </div>

        <${Results} />
      `}

    </div>`;
}

boot({ config, App });
