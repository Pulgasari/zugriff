// apps/code/components/WebDAVTree.js
// one row of the WebDAV tree, with the same row actions as the local / GitHub trees.
// webdav.list() returns full relative paths, so each node carries its own `entry.path`
// (no prefix threading). every mutation is a single request; the refresh after an op
// is a root reload driven by the WebDAV modal on treeops.version.webdav.

import { html, useState } from './../vendors.js';
import Icon from '/.shared/js/components/Icon.js';
import RowMenu from './RowMenu.js';

const app = zugriff.app;
const webdav = app.workspaces.webdav;
const { clipboard, bump, ask, validName } = app.workspaces;

const parentOf = path => path.split('/').slice(0, -1).join('/');

export default function WebDAVTree ({ entry, depth = 0 }) {
  const [children,  setChildren]  = useState([]);
  const [isLoaded,  setIsLoaded]  = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen,    setIsOpen]    = useState(false);
  const [err,       setErr]       = useState(null);

  const isDir  = entry.isDir;
  const path   = entry.path;
  const indent = depth * 16;
  const conn   = webdav.active.value;

  const fail = e => setErr(e.message || String(e));

  const toggle = async () => {
    if (!isDir) return openFile();
    if (isOpen) { setIsOpen(false); return; }
    if (!isLoaded) {
      setIsLoading(true); setErr(null);
      try { setChildren(await webdav.list(path)); setIsLoaded(true); }
      catch (e) { fail(e); } finally { setIsLoading(false); }
    }
    setIsOpen(true);
  };

  const openFile = async () => {
    setIsLoading(true); setErr(null);
    try {
      const { text, binary } = await webdav.readFile(path);
      app.files.openWebdav({ connId: conn.id, connName: conn.name, path, content: binary ? '' : text, binary });
      app.closeModal();
    } catch (e) { fail(e); } finally { setIsLoading(false); }
  };

  // ── actions ────────────────────────────────────────────────────────────
  const idOf   = p => app.files.webdavId(conn.id, p);
  const CANCEL = Symbol('cancel');
  const run = fn => async () => {
    try { await fn(); bump('webdav'); }
    catch (e) { if (e !== CANCEL) webdav.error.value = e.message; }
  };

  const newFile   = run(async () => { const n = await ask('New file');   if (!validName(n)) throw CANCEL; await webdav.createFileAt(`${path}/${n}`, ''); });
  const newFolder = run(async () => { const n = await ask('New folder'); if (!validName(n)) throw CANCEL; await webdav.createFolderAt(`${path}/${n}`); });
  const renameEntry = run(async () => {
    const n = await ask('Rename', entry.name);
    if (n === null || !validName(n) || n === entry.name) throw CANCEL;
    const parent = parentOf(path);
    await webdav.renamePath(path, parent ? `${parent}/${n}` : n, { isDir });
    if (!isDir) app.files.closeById(idOf(path));
  });
  const del = run(async () => {
    if (!confirm(`Delete “${entry.name}” from ${conn.name}?`)) throw CANCEL;
    await webdav.deletePath(path, { isDir });
    if (!isDir) app.files.closeById(idOf(path));
  });
  const setClip = mode => { clipboard.value = { source: 'webdav', mode, isDir, name: entry.name, ctx: { connId: conn.id, path } }; };
  const paste = run(async () => {
    const cb = clipboard.value;
    if (!cb || cb.source !== 'webdav') throw CANCEL;
    if (cb.ctx.connId !== conn.id) throw new Error('Paste must stay in the same connection.');
    const dest = `${path}/${cb.name}`;
    if (cb.mode === 'copy') await webdav.copyPath(cb.ctx.path, dest, { isDir: cb.isDir });
    else { await webdav.renamePath(cb.ctx.path, dest, { isDir: cb.isDir }); clipboard.value = null; if (!cb.isDir) app.files.closeById(idOf(cb.ctx.path)); }
  });

  const items = [
    isDir && { label: 'New File',   icon: 'material-symbols:note-add-outline',          onClick: newFile },
    isDir && { label: 'New Folder', icon: 'material-symbols:create-new-folder-outline', onClick: newFolder },
    isDir && clipboard.value?.source === 'webdav' && { label: 'Paste', icon: 'paste', onClick: paste },
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
        ${!isDir && isLoading && html`<${Icon} name="material-symbols:progress-activity" />`}
        <${RowMenu} items=${items} />
      </div>

      ${err && html`<div class="tree-empty" style="color:var(--c-null,#e06c75)">${err}</div>`}

      ${isOpen && isLoaded && html`
        <ul class="tree-children">
          ${children.length === 0
            ? html`<li class="tree-empty">Empty</li>`
            : children.map(child => html`<${WebDAVTree} key=${child.path} entry=${child} depth=${depth + 1} />`)}
        </ul>`}
    </li>`;
}
