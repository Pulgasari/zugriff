// apps/code/components/GitHubTree.js
// one row of the GitHub repo tree, with the same row actions as the local tree.
// GitHub mutations are single commits (git data API, see github.js); because a
// commit advances the branch head (folder shas change), the refresh after an op
// is a root reload driven by the GitHub modal on treeops.version.github — this
// node just fires the op and bumps.

import { html, useState } from '@aufbau/kits/preact-htm';
import state from './../state.js';
import * as github from './../github.js';
import { clipboard, bump, ask, validName } from './../treeops.js';
import Icon from './Icon.js';
import RowMenu from './RowMenu.js';

export default function GitHubTree ({ entry, prefix = '', depth = 0 }) {
  const [children,  setChildren]  = useState([]);
  const [isLoaded,  setIsLoaded]  = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen,    setIsOpen]    = useState(false);
  const [err,       setErr]       = useState(null);

  const isDir    = entry.type === 'tree';
  const fullPath = prefix ? `${prefix}/${entry.path}` : entry.path;
  const indent   = depth * 16;
  const repo     = github.repo.value;
  const branch   = github.branch.value;
  const readOnly = !!repo?.readOnly;

  const fail = e => setErr(e.message || String(e));

  const toggle = async () => {
    if (!isDir) return openFile();
    if (isOpen) { setIsOpen(false); return; }
    if (!isLoaded) {
      setIsLoading(true); setErr(null);
      try { setChildren(await github.listTree(entry.sha)); setIsLoaded(true); }
      catch (e) { fail(e); } finally { setIsLoading(false); }
    }
    setIsOpen(true);
  };

  const openFile = async () => {
    setIsLoading(true); setErr(null);
    try {
      const { text, binary } = await github.readBlob(entry.sha);
      state.openGithubFile({ owner: repo.owner, name: repo.name, branch, path: fullPath, sha: entry.sha, content: binary ? '' : text, binary, readOnly });
      state.closeModal();
    } catch (e) { fail(e); } finally { setIsLoading(false); }
  };

  // ── actions ────────────────────────────────────────────────────────────
  const meta   = { isDir, sha: entry.sha, mode: entry.mode };
  const idOf   = path => state.githubId(repo.owner, repo.name, branch, path);
  const CANCEL = Symbol('cancel');
  // run a mutation: refresh on success, surface real errors, ignore cancels
  const run = fn => async () => {
    try { await fn(); bump('github'); }
    catch (e) { if (e !== CANCEL) github.error.value = e.message; }
  };

  const newFile   = run(async () => { const n = await ask('New file');   if (!validName(n)) throw CANCEL; await github.createFileAt(`${fullPath}/${n}`, ''); });
  const newFolder = run(async () => { const n = await ask('New folder'); if (!validName(n)) throw CANCEL; await github.createFolderAt(`${fullPath}/${n}`); });
  const renameEntry = run(async () => {
    const n = await ask('Rename', entry.path);
    if (n === null || !validName(n) || n === entry.path) throw CANCEL;
    await github.renamePath(fullPath, prefix ? `${prefix}/${n}` : n, meta);
    if (!isDir) state.closeById(idOf(fullPath));
  });
  const del = run(async () => {
    if (!confirm(`Delete “${entry.path}” from ${repo.name}? This commits to ${branch}.`)) throw CANCEL;
    await github.deletePath(fullPath, meta);
    if (!isDir) state.closeById(idOf(fullPath));
  });
  const setClip = mode => { clipboard.value = { source: 'github', mode, isDir, name: entry.path, ctx: { path: fullPath, sha: entry.sha, mode: entry.mode, repo, branch } }; };
  const paste = run(async () => {
    const cb = clipboard.value;
    if (!cb || cb.source !== 'github') throw CANCEL;
    if (cb.ctx.repo.owner !== repo.owner || cb.ctx.repo.name !== repo.name || cb.ctx.branch !== branch)
      throw new Error('Paste must stay in the same repo and branch.');
    const dest = `${fullPath}/${cb.name}`;
    const m = { isDir: cb.isDir, sha: cb.ctx.sha, mode: cb.ctx.mode };
    if (cb.mode === 'copy') await github.copyPath(cb.ctx.path, dest, m);
    else { await github.renamePath(cb.ctx.path, dest, m); clipboard.value = null; if (!cb.isDir) state.closeById(idOf(cb.ctx.path)); }
  });

  const items = readOnly ? [] : [
    isDir && { label: 'New File',   icon: 'material-symbols:note-add-outline',        onClick: newFile },
    isDir && { label: 'New Folder', icon: 'material-symbols:create-new-folder-outline', onClick: newFolder },
    isDir && clipboard.value?.source === 'github' && { label: 'Paste', icon: 'paste', onClick: paste },
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
        <span class="tree-name">${entry.path}</span>
        ${!isDir && isLoading && html`<${Icon} name="material-symbols:progress-activity" />`}
        ${items.length > 0 && html`<${RowMenu} items=${items} />`}
      </div>

      ${err && html`<div class="tree-empty" style="color:var(--c-null,#e06c75)">${err}</div>`}

      ${isOpen && isLoaded && html`
        <ul class="tree-children">
          ${children.length === 0
            ? html`<li class="tree-empty">Empty</li>`
            : children.map(child => html`<${GitHubTree} key=${child.path} entry=${child} prefix=${fullPath} depth=${depth + 1} />`)}
        </ul>`}
    </li>`;
}
