// apps/code/components/GitHubTree.js
// one row of the GitHub repo tree. a folder lazily fetches its children (one
// tree level per open, so it scales to huge repos); a file is read and opened
// in the editor. `prefix` is the parent's full path — GitHub's non-recursive
// tree returns basenames, so we accumulate the path as we descend.

import { html, useState } from '@aufbau/kits/preact-htm';
import state from './../state.js';
import * as github from './../github.js';
import Icon from './Icon.js';

export default function GitHubTree ({ entry, prefix = '', depth = 0 }) {
  const [children,  setChildren]  = useState([]);
  const [isLoaded,  setIsLoaded]  = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen,    setIsOpen]    = useState(false);
  const [err,       setErr]       = useState(null);

  const isDir    = entry.type === 'tree';
  const fullPath = prefix ? `${prefix}/${entry.path}` : entry.path;
  const indent   = depth * 16;

  const toggle = async () => {
    if (!isDir) return openFile();
    if (isOpen) { setIsOpen(false); return; }
    if (!isLoaded) {
      setIsLoading(true); setErr(null);
      try { setChildren(await github.listTree(entry.sha)); setIsLoaded(true); }
      catch (e) { setErr(e.message); }
      finally { setIsLoading(false); }
    }
    setIsOpen(true);
  };

  const openFile = async () => {
    setIsLoading(true); setErr(null);
    try {
      const { text, binary } = await github.readBlob(entry.sha);
      state.openGithubFile({
        owner: github.repo.value.owner, name: github.repo.value.name,
        branch: github.branch.value, path: fullPath, sha: entry.sha,
        content: binary ? '' : text, binary,
      });
      state.closeModal();
    } catch (e) { setErr(e.message); }
    finally { setIsLoading(false); }
  };

  return html`
    <li class=${'tree-node ' + (isDir ? 'is-dir' : 'is-file')}>
      <div class=${'tree-row clickable'} style=${`padding-left: ${indent + 6}px`} onClick=${toggle}>
        ${isDir
          ? html`<span class=${'tree-arrow ' + (isOpen ? 'open' : '')}>
              <${Icon} name=${isLoading ? 'material-symbols:progress-activity' : 'material-symbols:chevron-right'} size="16" />
            </span>`
          : html`<span class="tree-arrow-spacer"></span>`}
        <${Icon} name=${isDir ? (isOpen ? 'folder-open' : 'folder') : 'file'} color=${isDir ? '#f6c744' : '#888'} size="16" />
        <span class="tree-name">${entry.path}</span>
        ${!isDir && isLoading && html`<${Icon} name="material-symbols:progress-activity" size="14" />`}
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
