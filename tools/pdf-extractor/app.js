// tools/pdf-extractor/app.js

// ::: vendors
import { computed, html, signal, useEffect, useRef } from '@aufbau/kits/preact-htm';
import { PDFDocument } from 'pdf-lib';
import * as PDFJS from 'pdfjs';

// ::: shared
import { boot, config } from './../../shared/js/app.js?slug=pdf-extractor';
import { Dropzone, Icon, Picker, Slider } from './../../shared/js/components/index.js';

// ::: local

// the worker url comes out of the importmap instead of being pinned here
PDFJS.GlobalWorkerOptions.workerSrc = import.meta.resolve('pdfjs-worker');

// ── state ─────────────────────────────────────────────────────────────────────
let pdfDoc     = signal(null);   // PDFJS document
let pdfBytes   = signal(null);   // raw ArrayBuffer for pdf-lib
let fileName   = signal('');
let pageCount  = signal(0);
let pages      = signal([]);     // [{ num, thumb, selected }]
let format     = signal('pdf');
let quality    = signal(92);
let scale      = signal(2);      // render scale for image export
let status     = signal('idle'); // idle | loading | exporting
let errMsg     = signal('');

let FORMATS = ['pdf', 'png', 'jpg', 'webp'];
let selected = computed(() => pages.value.filter(p => p.selected));

// ── load PDF ──────────────────────────────────────────────────────────────────
async function loadPDF(file) {
  if (!file?.type?.includes('pdf') && !file?.name?.endsWith('.pdf')) {
    errMsg.value = 'Not a PDF file'; return;
  }
  status.value = 'loading';
  errMsg.value = '';
  try {
    let buf    = await file.arrayBuffer();
    pdfBytes.value = buf.slice(0);
    let doc    = await PDFJS.getDocument({ data: buf }).promise;
    pdfDoc.value  = doc;
    fileName.value = file.name.replace(/\.pdf$/i, '');
    pageCount.value = doc.numPages;

    // generate thumbnails
    let thumbs = [];
    for (let i = 1; i <= doc.numPages; i++) {
      let thumb = await renderPage(doc, i, 0.3);
      thumbs.push({ num: i, thumb, selected: true });
    }
    pages.value = thumbs;
    status.value = 'idle';
  } catch(e) {
    errMsg.value = e.message;
    status.value = 'idle';
  }
}

// ── render page to data URL ───────────────────────────────────────────────────
async function renderPage(doc, pageNum, sc = 2) {
  let page     = await doc.getPage(pageNum);
  let viewport = page.getViewport({ scale: sc });
  let canvas   = document.createElement('canvas');
  canvas.width   = viewport.width;
  canvas.height  = viewport.height;
  let ctx      = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// ── selection ─────────────────────────────────────────────────────────────────
let togglePage  = num  => pages.value = pages.value.map(p => p.num === num ? { ...p, selected: !p.selected } : p);
let selectAll   = ()   => pages.value = pages.value.map(p => ({ ...p, selected: true }));
let selectNone  = ()   => pages.value = pages.value.map(p => ({ ...p, selected: false }));
let selectInvert= ()   => pages.value = pages.value.map(p => ({ ...p, selected: !p.selected }));

// ── export ────────────────────────────────────────────────────────────────────
let download = (blob, name) => {
  let a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: name,
  });
  a.click();
  URL.revokeObjectURL(a.href);
};

async function doExport() {
  let sel  = selected.value;
  if (!sel.length) return;
  status.value = 'exporting';
  let fmt  = format.value;
  let doc  = pdfDoc.value;
  let name = fileName.value || 'page';

  try {
    if (fmt === 'pdf') {
      let srcDoc = await PDFDocument.load(pdfBytes.value);
      let outDoc = await PDFDocument.create();
      let nums   = sel.map(p => p.num - 1); // 0-indexed for pdf-lib
      let copied = await outDoc.copyPages(srcDoc, nums);
      copied.forEach(p => outDoc.addPage(p));
      let bytes  = await outDoc.save();
      download(new Blob([bytes], { type: 'application/pdf' }), name + '_extracted.pdf');
    } else {
      let mime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[fmt];
      let sc   = scale.value;
      for (let p of sel) {
        let canvas = await renderPage(doc, p.num, sc);
        // jpg: white bg
        let exportCanvas = canvas;
        if (fmt === 'jpg') {
          exportCanvas = document.createElement('canvas');
          exportCanvas.width  = canvas.width;
          exportCanvas.height = canvas.height;
          let ctx = exportCanvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(canvas, 0, 0);
        }
        let blob = await new Promise(res => exportCanvas.toBlob(res, mime, quality.value / 100));
        download(blob, `${name}_p${p.num}.${fmt}`);
        await new Promise(r => setTimeout(r, 80)); // stagger downloads
      }
    }
  } catch(e) { errMsg.value = e.message; }
  status.value = 'idle';
}


// ── PageThumb ─────────────────────────────────────────────────────────────────
function PageThumb({ page }) {
  let canvasRef = useRef(null);
  useEffect(() => {
    let el = canvasRef.current;
    if (!el || !page.thumb) return;
    el.width  = page.thumb.width;
    el.height = page.thumb.height;
    el.getContext('2d').drawImage(page.thumb, 0, 0);
  }, [page.thumb]);

  return html`
    <div class=${'page-thumb' + (page.selected ? ' selected' : '')}
         onClick=${() => togglePage(page.num)}>
      <div class="thumb-canvas-wrap">
        <canvas ref=${canvasRef} class="thumb-canvas" />
        <div class="thumb-check">
          <${Icon} name=${page.selected ? 'mdi:check-circle' : 'mdi:circle-outline'} />
        </div>
      </div>
      <span class="thumb-num">Page ${page.num}</span>
    </div>`;
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  let hasPdf  = !!pdfDoc.value;
  let st      = status.value;
  let busy    = st === 'loading' || st === 'exporting';
  let selCnt  = selected.value.length;
  let fmt     = format.value;

  let reset = () => {
    pdfDoc.value = null; pdfBytes.value = null;
    pages.value = []; fileName.value = '';
    pageCount.value = 0; status.value = 'idle'; errMsg.value = '';
  };

  return html`
    <div id="app-body">
      
      ${!hasPdf ? html`
        ${st === 'loading' ? html`
          <div class="loading-row">
            <${Icon} name="mdi:loading" class="spin" /> Loading PDF…
          </div>` : html`<${Dropzone} accept='.pdf,application/pdf' multiple=${false} what='a PDF' onFiles=${entries => loadPDF(entries[0].file)} />`}
      ` : html`
        
        <div class="file-bar">
          <${Icon} name="mdi:file-pdf-box" />
          <span class="fname">${fileName.value}.pdf</span>
          <span class="page-count">${pageCount.value} pages</span>
          <button class="ghost-btn" onClick=${reset}>
            <${Icon} name="mdi:close" /> Remove
          </button>
        </div>

        <div class="sel-bar">
          <span class="sel-info">${selCnt} of ${pageCount.value} selected</span>
          <button class="ghost-btn" onClick=${selectAll}>All</button>
          <button class="ghost-btn" onClick=${selectNone}>None</button>
          <button class="ghost-btn" onClick=${selectInvert}>Invert</button>
        </div>

        <div class="pages-grid">
          ${pages.value.map(p => html`<${PageThumb} key=${p.num} page=${p} />`)}
        </div>

        <div class="export-panel">

          <${Picker} options=${FORMATS} value=${fmt} onChange=${f => format.value = f} />

          ${fmt !== 'pdf' && html`
            <${Slider} label="Quality" min=1 max=100 unit="%"
              value=${quality.value} onChange=${v => quality.value = v} />
            <div class="setting-row">
              <label>Scale</label>
              <${Picker}
                options=${[{ value: 1, label: '1×' }, { value: 2, label: '2×' }, { value: 3, label: '3×' }]}
                value=${scale.value} onChange=${s => scale.value = +s} />
              <span class="val hint">higher = sharper</span>
            </div>`}

          <button class="btn primary" onClick=${doExport}
            disabled=${busy || selCnt === 0}>
            <${Icon} name=${busy ? 'mdi:loading' : 'mdi:download'} class=${busy ? 'spin' : ''} />
            ${busy ? 'Exporting…'
              : fmt === 'pdf'
              ? `Extract ${selCnt} page${selCnt !== 1 ? 's' : ''} as PDF`
              : `Export ${selCnt} page${selCnt !== 1 ? 's' : ''} as .${fmt}`}
          </button>

          ${errMsg.value && html`
            <div class="err-row">
              <${Icon} name="mdi:alert-circle-outline" /> ${errMsg.value}
            </div>`}

        </div>
      `}
    </div>`;
}

boot({ config, App });
