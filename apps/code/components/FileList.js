// apps/code/components/FileList.js
// the open-file tabs.

import { html } from '@aufbau/kits/preact-htm';
import state from './../state.js';
import Icon  from './Icon.js';

export default function FileList () {
  const openFiles  = state.openFiles.value;
  const activeFile = state.activeFile.value;

  return html`
    <div id="filelist">
      ${openFiles.length === 0
        ? html`<div class="filelist-empty">No files open</div>`
        : openFiles.map(file => html`
            <div
              class=${'file-tab' + (file === activeFile ? ' active' : '')}
              onClick=${() => (state.activeFile.value = file)}
            >
              <${Icon} name="material-symbols:description" size="14" color="#888" />
              <span class="tab-name">${file.name}</span>
              ${file.isDirty && html`<span class="tab-dirty">●</span>`}
              <button class="tab-close" onClick=${e => { e.stopPropagation(); state.closeFile(file); }}>
                <${Icon} name="material-symbols:close" size="14" />
              </button>
            </div>
          `)
      }
    </div>
  `;
}
