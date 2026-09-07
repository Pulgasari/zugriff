// apps/code/components/FileList.js
// the open-file tabs.

import { html } from './../vendors.js';
import Icon from '/.shared/js/components/Icon.js';

const app = zugriff.app;

export default function FileList () {
  const openFiles  = app.files.open.value;
  const activeFile = app.files.active.value;

  return html`
    <div id="filelist">
      ${openFiles.length === 0
        ? html`<div class="filelist-empty">No files open</div>`
        : openFiles.map(file => html`
            <div
              class=${'file-tab' + (file === activeFile ? ' active' : '')}
              onClick=${() => (app.files.active.value = file)}
            >
              <${Icon} name="material-symbols:description" color="#888" />
              <span class="tab-name">${file.name}</span>
              ${file.isDirty && html`<span class="tab-dirty">●</span>`}
              <button class="tab-close" onClick=${e => { e.stopPropagation(); app.files.close(file); }}>
                <${Icon} name="material-symbols:close" />
              </button>
            </div>
          `)
      }
    </div>
  `;
}
