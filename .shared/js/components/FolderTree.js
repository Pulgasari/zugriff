// components/FolderTree.js

// :::::: IMPORT

import { signal as persist, local } from '@aufbau/signals';

import Button  from './Button.js';
import Icon    from './Icon.js';
import Loading from './Loading.js';
import Tree    from './Tree.js';

// :::::: 

// one persisted expanded-set per key, so repeat renders reuse the same signal
const expandedStores = new Map;
const expandedSignal = key => {
  if (!expandedStores.has(key)) expandedStores.set(key, persist({ value: [], key, store: local }));
  return expandedStores.get(key);
};

// node value <-> identity. "f:"/"d:" prefix + sourceId + path; path itself may
// carry ':' so we split on the first separator after the sourceId only.
const nodeValue = (kind, sourceId, path) => `${kind}:${sourceId}:${path}`;
function parseValue (v = '') {
  const kind = v.slice(0, 1);
  const rest = v.slice(2);
  const sep  = rest.indexOf(':');
  return { kind, sourceId: rest.slice(0, sep), path: rest.slice(sep + 1) };
}

// prune a tree to the files whose path matches `q` (already lower-cased)
function filterTree (node, q) {
  if (node.kind === 'file') return node.path.toLowerCase().includes(q) ? node : null;
  const kids = (node.children ?? []).map(c => filterTree(c, q)).filter(Boolean);
  return kids.length ? { ...node, children: kids } : null;
}

// :::::: MAIN COMPONENT

function FolderTree ({
  lib,
  filter        = '',
  selected      = null,
  onOpen,
  onRemoveSource,
  labelOf       = node => node.name,
  fileIcon,
  noSourcesText = 'No folders open yet.',
  emptyText     = 'This folder is empty',
  noMatchText   = 'No matches',
  expandedKey   = 'foldertree:expanded',
}) {
  const expanded   = expandedSignal(expandedKey);
  const keyOf      = (sourceId, path) => `${sourceId}:${path}`;
  const isExpanded = (sourceId, path) => expanded.value.includes(keyOf(sourceId, path));

  const q = filter.trim().toLowerCase();

  // scanned folder tree -> <aufbau-tree> node list. a filter query forces every
  // matching branch open so the hits are visible without hand-expanding.
  const toNodes = (dir, sourceId, forceOpen) =>
    (dir.children ?? []).map(child => child.kind === 'file'
      ? {
          label    : labelOf(child),
          value    : nodeValue('f', sourceId, child.path),
          icon     : fileIcon,
          selected : selected?.sourceId === sourceId && selected?.path === child.path,
        }
      : {
          label    : child.name,
          value    : nodeValue('d', sourceId, child.path),
          expanded : forceOpen || isExpanded(sourceId, child.path),
          children : toNodes(child, sourceId, forceOpen),
        });

  const onSelect = e => {
    const { kind, sourceId, path } = parseValue(e.detail?.value);
    if (kind === 'f') onOpen?.(sourceId, path);
  };

  const onToggle = e => {
    const { kind, sourceId, path } = parseValue(e.detail?.value);
    if (kind !== 'd') return;
    const k   = keyOf(sourceId, path);
    const has = expanded.value.includes(k);
         if  (e.detail.expanded && !has) expanded.value = [...expanded.value, k];
    else if (!e.detail.expanded &&  has) expanded.value = expanded.value.filter(x => x !== k);
  };

  const renderSource = source => {
    // `?.` because these maps can be momentarily unset — a FolderLibrary seeds
    // perms/scanning lazily, and trees only exists once the app's scan populates it
    const state = lib.perms.value?.[source.id];
    const tree  = lib.trees.value?.[source.id];
    const busy  = lib.scanning.value?.[source.id];

    const remove = async () => {
      if (!confirm(`Close “${source.name}”? Your files are untouched — this only forgets the folder.`)) return;
      onRemoveSource?.(source.id);
      await lib.removeFolder(source.id);
    };

    let body;
    if (state !== 'granted') {
      // a lost grant: reconnect() re-grants the stored handle from within the click;
      // repick() is the reliable fallback when the browser won't re-grant it.
      const tryReconnect = () => lib.reconnect(source.id).then(res => {
        if (res.granted) return;
        const why = res.error ? (res.error.name || 'error') : `browser said “${res.state}”`;
        console.warn('[foldertree] reconnect failed', { source, ...res });
        toast.error(`Reconnect failed — ${why}. Try “Choose folder”.`);
      });
      const repick = () => lib.repick(source.id).then(ok => ok || toast({ error: 'Could not open that folder' }));
      body = html`
        <div class='reconnect'>
          <span>${state === 'denied' ? 'Permission was blocked.' : 'This folder needs permission again.'}</span>
          <div class='row'>
            <${Button} icon='folder-key'    label='Reconnect'     onClick=${tryReconnect} />
            <${Button} icon='folder-search' label='Choose folder' onClick=${repick}       />
          </div>
        </div>`;
    } else if (busy && !tree) {
      body = html`<${Loading} text='Scanning…' />`;
    } else {
      const view = q && tree ? filterTree(tree, q) : tree;
      body = view && view.children.length
        ? html`<${Tree} nodes=${toNodes(view, source.id, !!q)} onSelect=${onSelect} onToggle=${onToggle} />`
        : html`<div class="src-empty">${q ? noMatchText : emptyText}</div>`;
    }

    const disabled = busy || state !== 'granted';
    const refresh  = () => lib.scan(source.id).catch(() => {});
    return html`
      <div class='src' key=${source.id}>
        <div class='head'>
          <${Icon} name='folder' />
          <span class='name' title=${source.name}>${source.name}</span>
          <${Button} icon='refresh' title='refresh' onClick=${refresh} disabled=${disabled} />
          <${Button} icon='close'   title='close'   onClick=${remove} />
        </div>
        ${body}
      </div>
    `;
  };

  return html`
    <div class='tree'>
      ${lib.sources.value.length
        ? lib.sources.value.map(renderSource)
        : html`<p class='hint'>${noSourcesText}</p>`}
    </div>
  `;
}

export       { FolderTree };
export default FolderTree;
