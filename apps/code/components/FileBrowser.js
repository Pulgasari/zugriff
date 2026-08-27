// apps/code/components/FileBrowser.js
// the modal that grants / restores a workspace folder and renders its tree.

import { html, signal, useEffect } from '@aufbau/kits/preact-htm';
import state    from './../state.js';
import fs       from './../fs.js';
import Modal    from './Modal.js';
import Icon     from './Icon.js';
import TreeNode from './TreeNode.js';

export const filesSignal = signal([]);
const statusSignal       = signal('init');   // init | idle | ready | needs-restore | error
const errorSignal        = signal(null);
const savedHandleSignal  = signal(null);

export default function FileBrowser () {
  const files       = filesSignal.value;
  const status      = statusSignal.value;
  const errorMsg    = errorSignal.value;
  const savedHandle = savedHandleSignal.value;

  const applyDirectory = (handle, entries) => {
    filesSignal.value       = entries;
    state.currentDirHandle  = handle;
    savedHandleSignal.value = handle;
    statusSignal.value      = 'ready';
  };

  const clearWorkspace = async () => {
    try {
      await fs.clearRoot();
      filesSignal.value       = [];
      state.currentDirHandle  = null;
      savedHandleSignal.value = null;
      statusSignal.value      = 'idle';
      errorSignal.value       = null;
    } catch (e) {
      console.error(e);
      errorSignal.value  = 'Could not clear the workspace.';
      statusSignal.value = 'error';
    }
  };

  useEffect(() => {
    if (statusSignal.peek() !== 'init') return;
    (async () => {
      try {
        const handle = await fs.getSavedRoot();
        if (!handle) { statusSignal.value = 'idle'; return; }
        const ok = await fs.ensureReadPermission(handle);
        if (!ok) {
          savedHandleSignal.value = handle;
          statusSignal.value = 'needs-restore';
          return;
        }
        applyDirectory(handle, await fs.readDir(handle));
      } catch (e) {
        statusSignal.value = 'error';
        errorSignal.value  = 'Initialisation failed.';
      }
    })();
  }, []);

  const openDirectory = async () => {
    errorSignal.value = null;
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await fs.setRoot(dirHandle);
      applyDirectory(dirHandle, await fs.readDir(dirHandle));
    } catch (e) {
      if (e.name !== 'AbortError') {
        errorSignal.value  = 'Could not open the folder.';
        statusSignal.value = 'error';
      }
    }
  };

  const restoreDirectory = async () => {
    const handle = savedHandleSignal.peek();
    if (!handle) return;
    if (await fs.ensureReadPermission(handle)) {
      applyDirectory(handle, await fs.readDir(handle));
      return;
    }
    try {
      const newHandle = await window.showDirectoryPicker({ startIn: handle });
      await fs.setRoot(newHandle);
      applyDirectory(newHandle, await fs.readDir(newHandle));
    } catch (e) {
      if (e.name !== 'AbortError') {
        errorSignal.value  = 'Restore failed.';
        statusSignal.value = 'error';
      }
    }
  };

  return html`
    <${Modal} id="filebrowser" title="File Browser">

      <div class="filebrowser-header">
        <button class="btn-secondary btn-danger" onClick=${clearWorkspace}>Reset workspace</button>
        <button class="btn-primary" onClick=${openDirectory}>
          <${Icon} name="material-symbols:folder-open" />
          Grant a folder
        </button>
        ${status === 'needs-restore' && savedHandle && html`
          <button class="btn-secondary btn-accent" onClick=${restoreDirectory}>
            <${Icon} name="material-symbols:folder-open" />
            Open “${savedHandle.name}”
          </button>`}
      </div>

      ${errorMsg && html`
        <div class="filebrowser-error">
          <${Icon} name="material-symbols:error-outline" size="16" />
          ${errorMsg}
        </div>`}

      <div class="filebrowser-body">
        ${status === 'init' && html`
          <div class="none">
            <${Icon} name="material-symbols:hourglass-empty" size="24" /><br/>
            Loading saved session…
          </div>`}
        ${status === 'needs-restore' && html`
          <div class="none">
            <${Icon} name="material-symbols:lock-outline" size="24" /><br/>
            Reconnect <strong>${savedHandle?.name}</strong> to continue.
          </div>`}
        ${(status === 'ready' || status === 'idle') && html`
          ${files.length === 0
            ? html`<div class="none"><${Icon} name="material-symbols:info" size="24" /><br/>No folder loaded.</div>`
            : html`<ul class="tree-root">
                ${files.map(entry => html`<${TreeNode} key=${entry.name} entry=${entry} depth=${0} />`)}
              </ul>`}
        `}
      </div>

    </${Modal}>
  `;
}
