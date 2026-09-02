// apps/images/routes/convert.js
// convert route (ex image-converter): re-encode a batch of images.

import { html, signal } from '@aufbau/kits/preact-htm';
import { Icon } from '/.shared/js/components/index.js';
import { stored } from '/.shared/js/app/signals.js';
import { dropEntries, ImgDrop, ToolFileItem } from './tools.js';

const cvFiles   = signal([]);
const cvFormat  = stored('webp', 'images:convert:format');
const cvQuality = stored(90, 'images:convert:quality');
const CV_FORMATS = ['jpg', 'png', 'webp'];

const cvUpdate    = (id, patch) => cvFiles.value = cvFiles.value.map(f => f.id === id ? { ...f, ...patch } : f);
const cvAddFiles  = list => cvFiles.value = [...cvFiles.value, ...dropEntries(list)];
const cvRemove    = id => { const e = cvFiles.value.find(f => f.id === id); if (e?.blobUrl) URL.revokeObjectURL(e.blobUrl); URL.revokeObjectURL(e?.previewUrl); cvFiles.value = cvFiles.value.filter(f => f.id !== id); };
const cvConvertAll = () => Promise.all(cvFiles.value.filter(f => f.status === 'pending').map(cvConvertOne));

async function cvConvertOne (entry) {
  cvUpdate(entry.id, { status: 'converting' });
  try {
    const bitmap = await createImageBitmap(entry.file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (cvFormat.value === 'jpg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const mime = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' }[cvFormat.value];
    const blob = await new Promise(res => canvas.toBlob(res, mime, cvQuality.value / 100));
    if (!blob) throw new Error('Conversion failed');
    const blobUrl = URL.createObjectURL(blob);
    const outName = entry.file.name.replace(/\.[^.]+$/, '') + '.' + cvFormat.value;
    cvUpdate(entry.id, { status: 'done', blobUrl, outName });
  } catch (error) {
    cvUpdate(entry.id, { status: 'error', error: error.message });
  }
}

function cvDownloadAll () {
  cvFiles.value.filter(f => f.status === 'done').forEach(f =>
    Object.assign(document.createElement('a'), { href: f.blobUrl, download: f.outName }).click());
}

function ConvertMode () {
  const list       = cvFiles.value;
  const pendingCnt = list.filter(f => f.status === 'pending').length;
  const hasDone    = list.some(f => f.status === 'done');
  const lossy      = cvFormat.value !== 'png';

  return html`
    <div class="im-tool">
      <${ImgDrop} onFiles=${cvAddFiles} />

      ${list.length > 0 && html`
        <div class="im-tool-options">
          <div class="seg">
            ${CV_FORMATS.map(f => html`
              <button class=${'seg-btn' + (cvFormat.value === f ? ' active' : '')} key=${f}
                      onClick=${() => cvFormat.value = f}>${f.toUpperCase()}</button>`)}
          </div>
          ${lossy && html`
            <label class="im-quality">Quality
              <input type="range" min="10" max="100" value=${cvQuality.value}
                     onInput=${e => cvQuality.value = +e.target.value} />
              <span>${cvQuality.value}%</span>
            </label>`}
        </div>

        <div class="im-filelist">
          ${list.map(e => html`<${ToolFileItem} key=${e.id} entry=${e} onRemove=${cvRemove} />`)}
        </div>

        <div class="im-tool-actions">
          ${pendingCnt > 0 && html`<button class="btn primary" onClick=${cvConvertAll}>
            <${Icon} name="mdi:cog-outline" /> Convert ${pendingCnt} file${pendingCnt > 1 ? 's' : ''}</button>`}
          ${hasDone && html`<button class="btn" onClick=${cvDownloadAll}>
            <${Icon} name="mdi:download-multiple" /> Download all</button>`}
        </div>`}
    </div>`;
}
export { ConvertMode };
export default ConvertMode;
