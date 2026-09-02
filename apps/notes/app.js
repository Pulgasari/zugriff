// apps/notes/app.js

// :::::: IMPORT

// ::: vendors
import { aufbau, html, preact, str } from '/.shared/js/vendors.js';
import { renderMD } from '@aufbau/import';


// ::: shared
import { boot, config } from '/.shared/js/app.js?slug=notes';
import { stored }       from '/.shared/js/lib/signals.js';

const { signal } = aufbau.signals;
const { computed, useEffect, useRef, Fragment } = preact;
const { AppSettings, Button, Empty, Icon, IconButton, InstallTip, Tree } = zugriff.components;
const { fs } = zugriff;

// ::: local
const app = zugriff.app;
import * as db from './db.js';

// :::::: STATE

// the open note, addressed by folder + path so it survives a rescan (the tree
// node object is replaced, the path is not)
const open     = stored(null, 'notes:open');       // { sourceId, path } | null
const filter   = signal('');                       // tree filter query
const expanded = stored({ value: [], 'notes:expanded' });     // ['sourceId:dir/path', …]
const navOpen  = signal(false);                     // mobile: is the tree drawer showing
const noteToc  = signal([]);                        // headings of the open note

app.state = {
  open      : null,
  filter    : '',
  expanded  : '',
  isNavOpen : false,
};

const keyOf      = (sourceId, path) => `${sourceId}:${path}`;
const isExpanded = (sourceId, path) => expanded.value.includes(keyOf(sourceId, path));

function openNote (sourceId, node) {
  open.value = { sourceId, path: node.path };
  navOpen.value = false;
}

// :::::: TREE HELPERS

function findByPath (node, path) {
  if (!node) return null;
  if (node.kind === 'file') return node.path === path ? node : null;
  for (const child of node.children ?? []) {
    const hit = findByPath(child, path);
    if (hit) return hit;
  }
  return null;
}

// prune a tree to the files whose name or path matches `q` (case-insensitive)
function filterTree (node, q) {
  if (node.kind === 'file') return node.path.toLowerCase().includes(q) ? node : null;
  const kids = (node.children ?? []).map(c => filterTree(c, q)).filter(Boolean);
  return kids.length ? { ...node, children: kids } : null;
}


// derive a note's display title: its first H1, else the filename without .md
const titleOf = node => node.name.replace(/\.[^.]+$/, '');

// :::::: SIDEBAR TREE
// the tree itself is <aufbau-tree>; this maps a scanned folder into the node
// shape it renders, and the value on each node ("f:"/"d:" + sourceId + path)
// is what the select/toggle events hand back so we can act on it.

const nodeValue = (kind, sourceId, path) => `${kind}:${sourceId}:${path}`;
function parseValue (v = '') {
  const kind = v.slice(0, 1);
  const rest = v.slice(2);
  const sep  = rest.indexOf(':');
  return { kind, sourceId: rest.slice(0, sep), path: rest.slice(sep + 1) };
}

function toTreeNodes (dir, sourceId, forceOpen) {
  return (dir.children ?? []).map(child => child.kind === 'file'
    ? {
        label    : titleOf(child),
        value    : nodeValue('f', sourceId, child.path),
        icon     : 'mdi:file-document-outline',
        selected : open.value?.sourceId === sourceId && open.value?.path === child.path,
      }
    : {
        label    : child.name,
        value    : nodeValue('d', sourceId, child.path),
        expanded : forceOpen || isExpanded(sourceId, child.path),
        children : toTreeNodes(child, sourceId, forceOpen),
      });
}

function onTreeSelect (e) {
  const { kind, sourceId, path } = parseValue(e.detail?.value);
  if (kind === 'f') { open.value = { sourceId, path }; navOpen.value = false; }
}

function onTreeToggle (e) {
  const { kind, sourceId, path } = parseValue(e.detail?.value);
  if (kind !== 'd') return;
  const k = keyOf(sourceId, path);
  const has = expanded.value.includes(k);
  if (e.detail.expanded && !has)      expanded.value = [...expanded.value, k];
  else if (!e.detail.expanded && has) expanded.value = expanded.value.filter(x => x !== k);
}

function SourceBlock ({ source }) {
  const state = db.perms.value[source.id];
  const tree  = db.trees.value[source.id];
  const busy  = db.scanning.value[source.id];
  const q     = filter.value.trim().toLowerCase();

  const remove = async () => {
    if (!confirm(`Close “${source.name}”? Your files are untouched — this only forgets the folder.`)) return;
    if (open.value?.sourceId === source.id) open.value = null;
    await db.removeFolder(source.id);
  };

  let body;
  if (state !== 'granted') {
    const tryReconnect = () => db.reconnect(source.id).then(res => {
      if (res.granted) return;
      const why = res.error ? `${res.error.name || 'error'}` : `browser said “${res.state}”`;
      console.warn('[notes] reconnect failed', { source, ...res });
      zugriff.toast.error(`Reconnect failed — ${why}. Try “Choose folder”.`);
    });
    const repick = () => db.repick(source.id).then(ok =>
      ok || zugriff.toast.error('Could not open that folder'));
    body = html`
      <div class="src-reconnect">
        <span>${state === 'denied' ? 'Permission was blocked.' : 'This folder needs permission again.'}</span>
        <div class="src-reconnect-row">
          <button class="btn small primary" onClick=${tryReconnect}>
            <${Icon} name="mdi:folder-key-outline" /> Reconnect</button>
          <button class="btn small ghost" title="Re-select the folder — always works"
                  onClick=${repick}>
            <${Icon} name="mdi:folder-search-outline" /> Choose folder</button>
        </div>
      </div>`;
  } else if (busy && !tree) {
    body = html`<div class="src-loading"><${Icon} name="svg-spinners:bars-scale-middle" /> Scanning…</div>`;
  } else {
    const view = q && tree ? filterTree(tree, q) : tree;
    body = view && view.children.length
      ? html`<${Tree} nodes=${toTreeNodes(view, source.id, !!q)}
                       onSelect=${onTreeSelect} onToggle=${onTreeToggle} />`
      : html`<div class="src-empty">${q ? 'No matches' : 'No markdown files here'}</div>`;
  }

  return html`
    <div class="src">
      <div class="src-head">
        <${Icon} name="mdi:folder-outline" />
        <span class="src-name" title=${source.name}>${source.name}</span>
        <button class="src-x" title="Refresh" onClick=${() => db.scan(source.id).catch(() => {})}
                disabled=${busy || state !== 'granted'}>
          <${Icon} name="refresh" /></button>
        <button class="src-x" title="Close folder" onClick=${remove}>
          <${Icon} name="close" /></button>
      </div>
      ${body}
    </div>`;
}

function Sidebar () {
  return html`
    <aside class=${'sidebar' + (navOpen.value ? ' open' : '')}>
      <div class="brand">
        <${Icon} name="notes" /> <span>Notes</span>
        <button class="ibtn nav-close" aria-label="Close" onClick=${() => navOpen.value = false}>
          <${Icon} name="close" /></button>
      </div>

      <div class="tree-filter">
        <${Icon} name="search" />
        <input type="search" placeholder="Filter notes…" value=${filter.value}
               onInput=${e => filter.value = e.target.value} />
        ${filter.value && html`
          <button class="ibtn" aria-label="Clear" onClick=${() => filter.value = ''}>
            <${Icon} name="close" /></button>`}
      </div>

      <div class="tree">
        ${db.sources.value.length
          ? db.sources.value.map(s => html`<${SourceBlock} key=${s.id} source=${s} />`)
          : html`<p class="tree-hint">No folders open yet.</p>`}
      </div>

      <div class="side-foot">
        <${InstallTip} show=${db.sources.value.length > 0} />
        <button class="btn small primary" onClick=${addFolder}>
          <${Icon} name="mdi:folder-plus-outline" /> Open a folder</button>
      </div>
    </aside>`;
}



// :::::: READER

// resolve the note the router points at, against the freshest scan
const currentNote = computed(() => {
  const o = open.value;
  if (!o) return null;
  const tree = db.trees.value[o.sourceId];
  const node = tree && findByPath(tree, o.path);
  return node ? { sourceId: o.sourceId, node } : null;
});

function AufbauElement ({ tag, ...rest }) {
  return html`<aufbau-${tag} ...${{ ...rest }]></aufbau-${tag}>`;
}

function Reader () {
  return html`<aufbau-reader></aufbau-reader>`;
}

function ReaderTOC () {
  return html`<aufbau-toc></aufbau-toc>`;
}



// the frame is always drawn — header (with the mobile menu button) included —
// so on a phone the tree drawer is always reachable, note open or not
function ReaderBody ({ note, bodyRef, onClick }) {
  const toc  = noteToc.value;
  const segs = note ? note.node.path.split('/') : [];

  return html`
    <div class="reader">
      <header class=${'reader-head' + (note ? '' : ' empty')}>
        <${Button} icon='menu' class="ibtn nav-open" aria-label="Open notes" onClick=${() => navOpen.value = true} />
        ${note
          ? html`<nav class="crumbs">
              ${segs.map((seg, i) => html`
                <span key=${i}>${i > 0 && html`<span class="crumb-sep">/</span>`}
                  <span class=${i === segs.length - 1 ? 'crumb last' : 'crumb'}>${seg}</span></span>`)}
            </nav>`
          : html`<span class="crumb head-brand">Notes</span>`}
        <span class="spacer"></span>
        <${AppSettings} />
      </header>

      ${note
        ? html`
          <div class="reader-scroll">
            <div class="reader-grid">
              <article class="md" ref=${bodyRef} onClick=${onClick}></article>
              ${toc.length > 2 && html`
                <aside class="toc">
                  <div class="toc-title">On this page</div>
                  ${toc.map(item => html`
                    <a key=${item.id} href=${'#' + item.id} class=${'toc-item lvl' + item.level}
                       onClick=${e => { e.preventDefault();
                         bodyRef.current?.querySelector('#' + CSS.escape(item.id))
                           ?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                      ${item.text}</a>`)}
                </aside>`}
            </div>
          </div>`
        : html`
          <div class="reader-empty">
            <${Empty} icon="mdi:file-document-outline" title="No note open"
              hint=${db.sources.value.length ? 'Choose a note to start reading.'
                                              : 'Open a folder of Markdown files to get started.'}
              action=${!db.sources.value.length && html`<${Button} class="primary" label='Open a folder' icon='mdi:folder-plus-outline' onClick=${addFolder} />`} />
          </div>`}
    </div>`;
}

// open a note reached through a relative link inside another note
function navigateRelative (from, href) {
  const clean = decodeURI(href.split(/[?#]/)[0]);
  const base  = from.node.path.split('/').slice(0, -1);
  const parts = [...base];
  for (const seg of clean.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop(); else parts.push(seg);
  }
  const target = parts.join('/');
  const tree   = db.trees.value[from.sourceId];
  const node   = tree && findByPath(tree, target);
  if (node) openNote(from.sourceId, node);
  else zugriff.toast.error('Linked note not found');
}

// :::::: ACTIONS

async function addFolder () {
  if (!fs.supported()) { zugriff.toast.error('This browser can’t open folders — try Chrome, Edge or another Chromium browser.'); return; }
  try {
    const rec = await db.addFolder();
    if (rec) zugriff.app.toast.({ message: `Opened ${rec.name}`, type: 'success' });
  } catch (err) { zugriff.app.toast({ message: err.message, type: 'error' }); }
}

// :::::: APP

function App () {
  useEffect(() => {
    db.load().catch(err => zugriff.toast.error('Could not open the library: ' + err.message));
  }, []);

  if (!db.ready.value) {
    return html`<div class="booting"><${Icon} name='loading' /></div>`;
  }

  return html`
    <${Fragment}>
      <${Sidebar} />
      ${navOpen.value && html`<div class="scrim-mobile" onClick=${() => navOpen.value = false}></div>`}
      <main id="app-main"><${Reader} /></main>
    </${Fragment}>
  `;
}

// :::::: BOOT

zugriff.app.init({ App });
