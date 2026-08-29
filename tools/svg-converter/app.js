// tools/svg-converter/app.js

// ::: vendors
import { html, signal, useEffect, useRef } from '@aufbau/kits/preact-htm';
import { PDFDocument } from 'pdf-lib';

// ::: shared
import { boot, config } from './../../.shared/js/app.js?slug=svg-converter';
import { Dropzone, Icon, Slider } from './../../.shared/js/components/index.js';

// ::: local

// ── state ─────────────────────────────────────────────────────────────────────
let svgSrc   = signal('');   // raw SVG string
let fileName = signal('');
let outW     = signal(0);    // 0 = natural
let outH     = signal(0);
let quality  = signal(92);
let status   = signal('idle'); // idle | error
let errMsg   = signal('');

// natural dimensions parsed from SVG
let natW = signal(0);
let natH = signal(0);
let lockAR = signal(true);

let FORMATS = ['png', 'jpg', 'webp', 'pdf'];

// ── load ──────────────────────────────────────────────────────────────────────
function loadSVG(file) {
  if (!file || !file.type.includes('svg')) { errMsg.value = 'Not an SVG file'; status.value = 'error'; return; }
  let reader = new FileReader();
  reader.onload = e => {
    let src = e.target.result;
    svgSrc.value   = src;
    fileName.value = file.name.replace(/\.svg$/i, '');
    errMsg.value   = '';
    status.value   = 'idle';
    // parse natural size
    let parser = new DOMParser();
    let doc    = parser.parseFromString(src, 'image/svg+xml');
    let svg    = doc.querySelector('svg');
    let w = parseFloat(svg?.getAttribute('width'))  || 0;
    let h = parseFloat(svg?.getAttribute('height')) || 0;
    if ((!w || !h) && svg?.getAttribute('viewBox')) {
      let [,, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
      w = vw; h = vh;
    }
    natW.value = w || 800;
    natH.value = h || 600;
    outW.value = 0;
    outH.value = 0;
  };
  reader.readAsText(file);
}

// ── drag & drop ───────────────────────────────────────────────────────────────

// ── dimensions ────────────────────────────────────────────────────────────────
let resolvedW = () => outW.value || natW.value;
let resolvedH = () => outH.value || natH.value;

function setW(v) {
  outW.value = v;
  if (lockAR.value && v && natW.value)
    outH.value = Math.round(v * natH.value / natW.value);
}
function setH(v) {
  outH.value = v;
  if (lockAR.value && v && natH.value)
    outW.value = Math.round(v * natW.value / natH.value);
}

// ── render SVG to canvas ──────────────────────────────────────────────────────
function svgToCanvas(w, h) {
  return new Promise((resolve, reject) => {
    let blob = new Blob([svgSrc.value], { type: 'image/svg+xml' });
    let url  = URL.createObjectURL(blob);
    let img  = new Image();
    img.onload = () => {
      let canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      let ctx = canvas.getContext('2d');
      if (false) { // jpg needs white bg
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── export ────────────────────────────────────────────────────────────────────
async function doExport(fmt) {
  let w = resolvedW(), h = resolvedH();
  let name = fileName.value || 'image';

  if (fmt === 'pdf') {
    let canvas  = await svgToCanvas(w, h);
    let pngData = canvas.toDataURL('image/png');
    let pdfDoc  = await PDFDocument.create();
    let page    = pdfDoc.addPage([w, h]);
    let pngImg  = await pdfDoc.embedPng(pngData);
    page.drawImage(pngImg, { x: 0, y: 0, width: w, height: h });
    let bytes   = await pdfDoc.save();
    download(new Blob([bytes], { type: 'application/pdf' }), name + '.pdf');
    return;
  }

  let mime   = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[fmt];
  let canvas = await svgToCanvas(w, h);

  // jpg: white bg
  if (fmt === 'jpg') {
    let ctx = canvas.getContext('2d');
    let id  = ctx.getImageData(0, 0, w, h);
    let tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    let tc  = tmp.getContext('2d');
    tc.fillStyle = '#fff';
    tc.fillRect(0, 0, w, h);
    tc.putImageData(id, 0, 0);
    let blob = await new Promise(res => tmp.toBlob(res, mime, quality.value / 100));
    download(blob, name + '.' + fmt);
    return;
  }

  let blob = await new Promise(res => canvas.toBlob(res, mime, quality.value / 100));
  download(blob, name + '.' + fmt);
}

let download = (blob, name) => {
  let a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: name,
  });
  a.click();
  URL.revokeObjectURL(a.href);
};

// ── SVG Preview ───────────────────────────────────────────────────────────────
function Preview() {
  let ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = svgSrc.value;
    let svg = ref.current?.querySelector('svg');
    if (svg) { svg.style.width = '100%'; svg.style.height = '100%'; }
  }, [svgSrc.value]);
  return html`<div class="svg-preview" ref=${ref} />`;
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  let hasSvg = !!svgSrc.value;
  let w = resolvedW(), h = resolvedH();
  let jpgOrWebp = true; // quality applies to jpg/webp

  return html`
    <div id="app-body">
      
      ${!hasSvg ? html`
        <${Dropzone} accept='image/svg+xml,.svg' multiple=${false} what='an SVG' onFiles=${entries => loadSVG(entries[0].file)} />
      ` : html`

        <div class="content">

          <div class="preview-wrap">
            <${Preview} />
            <div class="preview-meta">
              <span>${natW.value} × ${natH.value}px</span>
              <span>${fileName.value}.svg</span>
              <button class="ghost-btn" onClick=${() => { svgSrc.value = ''; fileName.value = ''; }}>
                <${Icon} name="mdi:close" /> Remove
              </button>
            </div>
          </div>

          <div class="settings">

            <div class="setting-group">
              <label class="setting-label">Output size</label>
              <div class="size-row">
                <div class="size-field">
                  <span class="size-unit">W</span>
                  <input type="number" class="field size-input" placeholder=${natW.value}
                    value=${outW.value || ''} min=1
                    onInput=${e => setW(+e.target.value || 0)} />
                  <span class="size-unit">px</span>
                </div>
                <button class=${'lock-btn' + (lockAR.value ? ' active' : '')}
                  onClick=${() => lockAR.value = !lockAR.value}
                  title=${lockAR.value ? 'Unlock aspect ratio' : 'Lock aspect ratio'}>
                  <${Icon} name=${lockAR.value ? 'mdi:lock-outline' : 'mdi:lock-open-outline'} />
                </button>
                <div class="size-field">
                  <span class="size-unit">H</span>
                  <input type="number" class="field size-input" placeholder=${natH.value}
                    value=${outH.value || ''} min=1
                    onInput=${e => setH(+e.target.value || 0)} />
                  <span class="size-unit">px</span>
                </div>
                ${(outW.value || outH.value) && html`
                  <button class="ghost-btn" onClick=${() => { outW.value = 0; outH.value = 0; }}
                    title="Reset to natural size">
                    <${Icon} name="mdi:refresh" />
                  </button>`}
              </div>
              <span class="size-hint">→ ${w} × ${h}px</span>
            </div>

            <div class="setting-group">
              <label class="setting-label">Quality <span class="setting-sub">(jpg / webp)</span></label>
              <${Slider} min=1 max=100 unit="%"
                value=${quality.value} onChange=${v => quality.value = v} />
            </div>

            <div class="setting-group">
              <label class="setting-label">Export as</label>
              <div class="export-btns">
                ${FORMATS.map(fmt => html`
                  <button class="btn primary" onClick=${() => doExport(fmt)}>
                    <${Icon} name=${fmt === 'pdf' ? 'mdi:file-pdf-box' : 'mdi:download'} />
                    .${fmt}
                  </button>`)}
              </div>
            </div>

          </div>

        </div>

        ${status.value === 'error' && html`
          <div class="err-row">
            <${Icon} name="mdi:alert-circle-outline" /> ${errMsg.value}
          </div>`}
      `}
    </div>`;
}

boot({ config, App });
