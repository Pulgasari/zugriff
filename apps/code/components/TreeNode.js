// apps/code/components/TreeNode.js
// one row of the local file tree. a directory lazily loads its children; a file
// opens in the editor. each node also carries the row actions (new/rename/
// delete/cut/copy/paste) via <RowMenu>, operating through fsops on `parent` (the
// containing directory handle). after any change treeops.bump('local') fires so
// every open folder reloads.

import { html, useState, useEffect } from '@aufbau/kits/preact-htm';
import state from './../state.js';
import * as fsops from './../fsops.js';
import { clipboard, version, bump, ask, validName } from './../treeops.js';
import Icon from './Icon.js';
import RowMenu from './RowMenu.js';

const readEntries = async (dir) => {
  const out = [];
  for await (const e of dir.values()) out.push(e);
  return out.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1);
};

export default function TreeNode ({ entry, parent, depth = 0 }) {
  const [children,  setChildren]  = useState([]);
  const [isLoaded,  setIsLoaded]  = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen,    setIsOpen]    = useState(false);
  const isDir  = entry.kind === 'directory';
  const indent = depth * 16;

  const reload = async () => { setChildren(await readEntries(entry)); setIsLoaded(true); };

  // reload an open folder whenever something changed anywhere in the local tree
  useEffect(() => { if (isDir && isOpen && isLoaded) reload().catch(() => {}); }, [version.local.value]);

  const toggle = async () => {
    if (!isDir) return openFile();
    if (isOpen) { setIsOpen(false); return; }
    if (!isLoaded) { setIsLoading(true); try { await reload(); } finally { setIsLoading(false); } }
    setIsOpen(true);
  };

  const openFile = async () => { await state.openFile(entry); state.closeModal(); };

  // ── actions ────────────────────────────────────────────────────────────
  const newFile = async () => {
    const name = await ask('New file');
    if (!validName(name)) return;
    if (await fsops.exists(entry, name)) return;
    await fsops.createFile(entry, name); setIsOpen(true); await reload(); bump('local');
  };
  const newFolder = async () => {
    const name = await ask('New folder');
    if (!validName(name)) return;
    if (await fsops.exists(entry, name)) return;
    await fsops.createDir(entry, name); setIsOpen(true); await reload(); bump('local');
  };
  const renameEntry = async () => {
    const name = await ask('Rename', entry.name);
    if (name === null || !validName(name) || name === entry.name) return;
    await fsops.rename(parent, entry, name);
    if (!isDir) state.closeById(entry);
    bump('local');
  };
  const del = async () => {
    if (!confirm(`Delete “${entry.name}”?`)) return;
    await fsops.remove(parent, entry.name);
    if (!isDir) state.closeById(entry);
    bump('local');
  };
  const setClip = mode => { clipboard.value = { source: 'local', mode, isDir, name: entry.name, ctx: { entry, parent } }; };
  const paste = async () => {
    const cb = clipboard.value;
    if (!cb || cb.source !== 'local') return;
    let name = cb.name;
    if (await fsops.exists(entry, name)) { name = await ask('Name exists — new name', name); if (!validName(name)) return; }
    if (cb.mode === 'copy') await fsops.copyInto(cb.ctx.entry, entry, name);
    else { await fsops.moveInto(cb.ctx.entry, cb.ctx.parent, entry); clipboard.value = null; state.closeById(cb.ctx.entry); }
    setIsOpen(true); await reload(); bump('local');
  };

  const items = [
    isDir && { label: 'New File',   icon: 'material-symbols:note-add-outline',        onClick: newFile },
    isDir && { label: 'New Folder', icon: 'material-symbols:create-new-folder-outline', onClick: newFolder },
    isDir && clipboard.value && clipboard.value.source === 'local' && { label: 'Paste', icon: 'paste', onClick: paste },
    { label: 'Rename', icon: 'material-symbols:edit-outline', onClick: renameEntry },
    { label: 'Copy',   icon: 'copy', onClick: () => setClip('copy') },
    { label: 'Cut',    icon: 'cut',  onClick: () => setClip('cut') },
    { label: 'Delete', icon: 'material-symbols:delete-outline', onClick: del, danger: true },
  ];

  return html`
    <li class=${'tree-node ' + (isDir ? 'is-dir' : 'is-file')}>
      <div class="tree-row clickable" style=${`padding-left: ${indent + 6}px`} onClick=${toggle}>
        ${isDir
          ? html`<span class=${'tree-arrow ' + (isOpen ? 'open' : '')}>
              <${Icon} name=${isLoading ? 'material-symbols:progress-activity' : 'material-symbols:chevron-right'} />
            </span>`
          : html`<span class="tree-arrow-spacer"></span>`}
        <${Icon} name=${isDir ? (isOpen ? 'folder-open' : 'folder') : 'file'} color=${isDir ? '#f6c744' : '#888'} />
        <span class="tree-name">${entry.name}</span>
        <${RowMenu} items=${items} />
      </div>

      ${isOpen && isLoaded && html`
        <ul class="tree-children">
          ${children.length === 0
            ? html`<li class="tree-empty">Empty</li>`
            : children.map(child => html`<${TreeNode} key=${child.name} entry=${child} parent=${entry} depth=${depth + 1} />`)}
        </ul>`}
    </li>`;
}
