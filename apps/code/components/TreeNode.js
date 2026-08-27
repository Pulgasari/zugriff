// apps/code/components/TreeNode.js
// one row of the file tree; a directory lazily loads its children on first open,
// a file opens into the editor.

import { html, useState } from '@aufbau/kits/preact-htm';
import state from './../state.js';
import Icon  from './Icon.js';

export default function TreeNode ({ entry, depth = 0 }) {
  const [children,  setChildren]  = useState([]);
  const [isLoaded,  setIsLoaded]  = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen,    setIsOpen]    = useState(false);
  const isDir  = entry.kind === 'directory';
  const indent = depth * 16;

  const loadChildren = async () => {
    if (isLoaded) return;
    setIsLoading(true);
    const entries = [];
    for await (const child of entry.values()) entries.push(child);
    entries.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1);
    setChildren(entries);
    setIsLoaded(true);
    setIsLoading(false);
  };

  const toggle = async () => {
    if (!isDir) return;
    if (!isOpen) await loadChildren();
    setIsOpen(v => !v);
  };

  const openFile = async () => {
    if (isDir) return;
    await state.openFile(entry);
    state.closeModal();
  };

  return html`
    <li class=${'tree-node ' + (isDir ? 'is-dir' : 'is-file')}>
      <div
        class=${'tree-row ' + (isDir ? 'clickable' : '')}
        style=${`padding-left: ${indent + 6}px`}
        onClick=${isDir ? toggle : openFile}
      >
        ${isDir
          ? html`<span class=${'tree-arrow ' + (isOpen ? 'open' : '')}>
              <${Icon} name=${isLoading ? 'material-symbols:progress-activity' : 'material-symbols:chevron-right'} size="16" />
            </span>`
          : html`<span class="tree-arrow-spacer"></span>`}

        <${Icon}
          name=${isDir ? (isOpen ? 'folder-open' : 'folder') : 'file'}
          color=${isDir ? '#f6c744' : '#888'}
          size="16"
        />
        <span class="tree-name">${entry.name}</span>
      </div>

      ${isOpen && isLoaded && html`
        <ul class="tree-children">
          ${children.length === 0
            ? html`<li class="tree-empty">Empty</li>`
            : children.map(child => html`<${TreeNode} key=${child.name} entry=${child} depth=${depth + 1} />`)}
        </ul>
      `}
    </li>
  `;
}
