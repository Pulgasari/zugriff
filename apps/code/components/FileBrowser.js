// apps/code/components/FileBrowser.js
// the modal that grants / restores a workspace folder and renders its tree.

import { html, signal, useEffect } from '@aufbau/kits/preact-htm';
import state    from './../state.js';
import fs       from './../fs.js';
import * as fsaccess from '/.shared/js/filesystem/fsaccess.js';   // picks via the platform seam (browser picker or native SAF)
import * as fsops from './../fsops.js';
import { clipboard, version, bump, ask, validName } from './../treeops.js';
import Modal    from './Modal.js';
import Icon     from './Icon.js';
import RowMenu  from './RowMenu.js';
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
      const dirHandle = await fsaccess.pickDirectory({ id: 'zugriff-code', mode: 'readwrite' });
      if (!dirHandle) return;   // cancelled
      await fs.setRoot(dirHandle);
      applyDirectory(dirHandle, await fs.readDir(dirHandle));
    } catch (e) {
      if (e.name !== 'AbortError') {
        errorSignal.value  = 'Could not open the folder.';
        statusSignal.value = 'error';
      }
    }
  };

  // re-read the root listing whenever anything in the local tree changes
  useEffect(() => {
    const root = state.currentDirHandle;
    if (root && statusSignal.peek() === 'ready') fs.readDir(root).then(e => { filesSignal.value = e; }).catch(() => {});
  }, [version.local.value]);

  // ── root-level actions ─────────────────────────────────────────────────
  const rootNewFile = async () => {
    const root = state.currentDirHandle; if (!root) return;
    const name = await ask('New file'); if (!validName(name) || await fsops.exists(root, name)) return;
    await fsops.createFile(root, name); bump('local');
  };
  const rootNewFolder = async () => {
    const root = state.currentDirHandle; if (!root) return;
    const name = await ask('New folder'); if (!validName(name) || await fsops.exists(root, name)) return;
    await fsops.createDir(root, name); bump('local');
  };
  const rootPaste = async () => {
    const root = state.currentDirHandle, cb = clipboard.value;
    if (!root || !cb || cb.source !== 'local') return;
    let name = cb.name;
    if (await fsops.exists(root, name)) { name = await ask('Name exists — new name', name); if (!validName(name)) return; }
    if (cb.mode === 'copy') await fsops.copyInto(cb.ctx.entry, root, name);
    else { await fsops.moveInto(cb.ctx.entry, cb.ctx.parent, root); clipboard.value = null; state.closeById(cb.ctx.entry); }
    bump('local');
  };

  const restoreDirectory = async () => {
    const handle = savedHandleSignal.peek();
    if (!handle) return;
    if (await fs.ensureReadPermission(handle)) {
      applyDirectory(handle, await fs.readDir(handle));
      return;
    }
    try {
      const newHandle = await fsaccess.pickDirectory({ id: 'zugriff-code', mode: 'readwrite', startIn: handle });
      if (!newHandle) return;   // cancelled
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
          <${Icon} name="material-symbols:error-outline" />
          ${errorMsg}
        </div>`}

      <div class="filebrowser-body">
        ${status === 'init' && html`
          <div class="none">
            <${Icon} name="material-symbols:hourglass-empty" /><br/>
            Loading saved session…
          </div>`}
        ${status === 'needs-restore' && html`
          <div class="none">
            <${Icon} name="material-symbols:lock-outline" /><br/>
            Reconnect <strong>${savedHandle?.name}</strong> to continue.
          </div>`}
        ${status === 'ready' && html`
          <div class="tree-rootbar">
            <button class="rowmenu-btn" title="New file"   onClick=${rootNewFile}><${Icon} name="material-symbols:note-add-outline" /></button>
            <button class="rowmenu-btn" title="New folder" onClick=${rootNewFolder}><${Icon} name="material-symbols:create-new-folder-outline" /></button>
            ${clipboard.value?.source === 'local' && html`<button class="rowmenu-btn" title="Paste" onClick=${rootPaste}><${Icon} name="paste" /></button>`}
          </div>`}
        ${(status === 'ready' || status === 'idle') && html`
          ${files.length === 0
            ? html`<div class="none"><${Icon} name="material-symbols:info" /><br/>No folder loaded.</div>`
            : html`<ul class="tree-root">
                ${files.map(entry => html`<${TreeNode} key=${entry.name} entry=${entry} parent=${state.currentDirHandle} depth=${0} />`)}
              </ul>`}
        `}
      </div>

    </${Modal}>
  `;
}
