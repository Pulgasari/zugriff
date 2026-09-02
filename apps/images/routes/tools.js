// apps/images/routes/tools.js
// shared pieces for the file-list tool routes (convert + batch).

import { html, useRef, useState } from '@aufbau/kits/preact-htm';
import { Icon } from '/.shared/js/components/index.js';
import { isImageFile } from '../state.js';

const uid = () => (crypto.randomUUID?.() ?? (Date.now().toString(36) + Math.random().toString(36).slice(2)));

/** File list -> pending entries with a preview url (images only) */
function dropEntries (fileList) {
  return [...fileList]
    .filter(isImageFile)
    .map(f => ({ id: uid(), file: f, status: 'pending', previewUrl: URL.createObjectURL(f) }));
}

function ImgDrop ({ onFiles, label }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const onDrop = e => { e.preventDefault(); setOver(false); if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files); };
  return html`
    <div class=${'im-drop' + (over ? ' over' : '')}
         onDragOver=${e => { e.preventDefault(); setOver(true); }}
         onDragLeave=${e => { if (e.target === e.currentTarget) setOver(false); }}
         onDrop=${onDrop}
         onClick=${() => inputRef.current?.click()}>
      <${Icon} name="mdi:image-plus" />
      <p>${label || 'Drop images here, or click to choose'}</p>
      <input ref=${inputRef} type="file" accept="image/*" multiple hidden
             onChange=${e => { onFiles(e.target.files); e.target.value = ''; }} />
    </div>`;
}

function ToolFileItem ({ entry, onRemove }) {
  const icon = {
    pending    : 'mdi:image-outline',
    converting : 'mdi:loading',
    processing : 'mdi:loading',
    done       : 'mdi:check-circle-outline',
    error      : 'mdi:alert-circle-outline',
  }[entry.status];
  const busyRow = entry.status === 'converting' || entry.status === 'processing';
  const label = {
    pending    : '',
    converting : 'converting…',
    processing : 'processing…',
    done       : entry.outName,
    error      : entry.error,
  }[entry.status];
  return html`
    <div class=${'im-fileitem ' + entry.status}>
      <div class="im-fi-thumb"><img src=${entry.previewUrl} alt=${entry.file.name} /></div>
      <${Icon} name=${icon} class=${busyRow ? 'spin' : ''} />
      <span class="im-fi-name">${entry.file.name}</span>
      ${label && html`<span class="im-fi-label">${label}</span>`}
      ${entry.status === 'done' && html`
        <a class="tbtn" href=${entry.blobUrl} download=${entry.outName} title="Download"><${Icon} name="mdi:download" /></a>`}
      ${!busyRow && html`
        <button class="tbtn" title="Remove" onClick=${() => onRemove(entry.id)}><${Icon} name="mdi:close" /></button>`}
    </div>`;
}
export { uid, dropEntries, ImgDrop, ToolFileItem };
