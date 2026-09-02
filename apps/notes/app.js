// apps/notes/app.js
//
// notes on the new app runtime: one `zugriff.app('notes')` handle carries the
// config, the reactive state and the mount. ephemeral ui state (the tree filter,
// the mobile drawer, the open note's table of contents) lives on app.state — each
// key is its own signal, so a write only wakes the effects that read it. the two
// bits that must survive a reload (the open note, the expanded folders) stay on
// their own persisted signals for now.

// :::::: IMPORTS

// ::: vendors
import { html, computed, Fragment, useEffect, useRef, useState } from '/.shared/js/vendors.js';
import { signal as persisted, local }                           from '@aufbau/signals';

// ::: shared runtime
import { zugriff } from '/.shared/js/runtime.js';
import * as fs     from '/.shared/js/filesystem/fsaccess.js';

// ::: local
import * as db from './db.js';

const app = zugriff.app('notes');
const { AppSettings, Button, Empty, Icon, InstallTip, Tree } = zugriff.components;
const toast = app.toast;

// :::::: STATE

// ephemeral ui state — on the shared deepSignal
app.state.filter    = '';       // tree filter query
app.state.isNavOpen = false;    // mobile: is the tree drawer showing

// durable state — kept apart, hydrates from + persists to localStorage
const open     = persisted({ value: null, key: 'notes:open',     store: local });   // { sourceId, path } | null
const expanded = persisted({ value: [],   key: 'notes:expanded', store: local });   // ['sourceId:dir/path', …]

const keyOf      = (sourceId, path) => `${sourceId}:${path}`;
const isExpanded = (sourceId, path) => expanded.value.includes(keyOf(sourceId, path));

function openNote (sourceId, node) {
  open.value = { sourceId, path: node.path };
  app.state.isNavOpen = false;
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

// derive a note's display title: the filename without its extension
const titleOf = node => node.name.replace(/\.[^.]+$/, '');

// :::::: SIDEBAR TREE
// the tree itself is <aufbau-tree>; this maps a scanned folder into the node shape
// it renders, and the value on each node ("f:"/"d:" + sourceId + path) is what the
// select/toggle events hand back so we can act on it.

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
  if (kind === 'f') { open.value = { sourceId, path }; app.state.isNavOpen = false; }
}

function onTreeToggle (e) {
  const { kind, sourceId, path } = parseValue(e.detail?.value);
  if (kind !== 'd') return;
  const k   = keyOf(sourceId, path);
  const has = expanded.value.includes(k);
  if (e.detail.expanded && !has)      expanded.value = [...expanded.value, k];
  else if (!e.detail.expanded && has) expanded.value = expanded.value.filter(x => x !== k);
}

function SourceBlock ({ source }) {
  const state = db.perms.value[source.id];
  const tree  = db.trees.value[source.id];
  const busy  = db.scanning.value[source.id];
  const q     = app.state.filter.trim().toLowerCase();

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
      toast.error(`Reconnect failed — ${why}. Try “Choose folder”.`);
    });
    const repick = () => db.repick(source.id).then(ok =>
      ok || toast.error('Could not open that folder'));
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
    <aside class=${'sidebar' + (app.state.isNavOpen ? ' open' : '')}>
      <div class="brand">
        <${Icon} name="notes" /> <span>Notes</span>
        <button class="ibtn nav-close" aria-label="Close" onClick=${() => app.state.isNavOpen = false}>
          <${Icon} name="close" /></button>
      </div>

      <div class="tree-filter">
        <${Icon} name="search" />
        <input type="search" placeholder="Filter notes…" value=${app.state.filter}
               onInput=${e => app.state.filter = e.target.value} />
        ${app.state.filter && html`
          <button class="ibtn" aria-label="Clear" onClick=${() => app.state.filter = ''}>
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

function Reader () {
  return html`<${ReaderBody} note=${currentNote.value} />`;
}

// the open note: read its text off disk and hand it to <aufbau-reader>, which owns
// the markdown pipeline. the transform hook resolves folder-relative images to blob
// urls (before the reader paints, so no broken-image flash) and tags links;
// <aufbau-toc> builds the "on this page" list off the rendered headings.
function NoteView ({ note }) {
  const root = db.sourceById(note.sourceId)?.handle;
  const urls = useRef([]);
  const [text, setText] = useState(null);

  useEffect(() => {
    let alive = true;
    setText(null);
    db.readNote(note.node.handle)
      .then(({ text }) => { if (alive) setText(text); })
      .catch(err => { toast.error('Could not read that note: ' + err.message); if (alive) setText(''); });
    return () => {
      alive = false;
      urls.current.forEach(URL.revokeObjectURL);
      urls.current = [];
    };
  }, [note.sourceId, note.node.path, note.node.handle]);

  // runs inside the reader, over the parsed markup, before it is committed
  const transform = async frag => {
    urls.current.forEach(URL.revokeObjectURL);
    urls.current = [];

    // relative images → blob urls from the same granted folder
    await Promise.all([...frag.querySelectorAll('img')].map(async img => {
      const src = img.getAttribute('src') || '';
      if (!src || /^([a-z]+:)?\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return;
      const handle = await fs.resolveRelative(root, note.node.path, src);
      if (!handle) return;
      try {
        const url = URL.createObjectURL(await handle.getFile());
        urls.current.push(url);
        img.src = url;
        img.loading = 'lazy';
      } catch {}
    }));

    // relative .md links open the sibling note in-app; the rest open safely
    frag.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (/^([a-z]+:)?\/\//i.test(href) || href.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      else if (href.startsWith('#'))                                    a.classList.add('anchor-link');
      else if (/\.(md|markdown)(#|$)/i.test(href))                      { a.classList.add('note-link'); a.dataset.href = href; }
    });
  };

  // in-app navigation for note-to-note and anchor links (delegated on the reader)
  const onClick = e => {
    const a = e.target.closest('a');
    if (!a) return;
    if (a.classList.contains('anchor-link')) {
      e.preventDefault();
      document.getElementById('notes-reader')?.querySelector(decodeURIComponent(a.getAttribute('href')))
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (a.classList.contains('note-link')) {
      e.preventDefault();
      navigateRelative(note, a.dataset.href);
    }
  };

  if (text == null) return html`<div class="reader-scroll"><div class="reader-grid"><div class="md-loading">…</div></div></div>`;

  return html`
    <div class="reader-scroll">
      <div class="reader-grid">
        <aufbau-reader id="notes-reader" class="md" format="markdown"
                       raw=${text} transform=${transform} onClick=${onClick}></aufbau-reader>
        <aside class="toc"><aufbau-toc target="#notes-reader" selector="h1, h2, h3"></aufbau-toc></aside>
      </div>
    </div>`;
}

// the frame is always drawn — header (with the mobile menu button) included — so on
// a phone the tree drawer is always reachable, note open or not
function ReaderBody ({ note }) {
  const segs = note ? note.node.path.split('/') : [];

  return html`
    <div class="reader">
      <header class=${'reader-head' + (note ? '' : ' empty')}>
        <${Button} icon='menu' class="ibtn nav-open" aria-label="Open notes" onClick=${() => app.state.isNavOpen = true} />
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
        ? html`<${NoteView} note=${note} />`
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
  else toast.error('Linked note not found');
}

// :::::: ACTIONS

async function addFolder () {
  if (!fs.supported()) { toast.error('This browser can’t open folders — try Chrome, Edge or another Chromium browser.'); return; }
  try {
    const rec = await db.addFolder();
    if (rec) toast.success(`Opened ${rec.name}`);
  } catch (err) { toast.error(err.message); }
}

// :::::: APP

function App () {
  useEffect(() => {
    db.load().catch(err => toast.error('Could not open the library: ' + err.message));
  }, []);

  if (!db.ready.value) {
    return html`<div class="booting"><${Icon} name='loading' /></div>`;
  }

  return html`
    <${Fragment}>
      <${Sidebar} />
      ${app.state.isNavOpen && html`<div class="scrim-mobile" onClick=${() => app.state.isNavOpen = false}></div>`}
      <main id="app-main"><${Reader} /></main>
    <//>`;
}

// :::::: BOOT

app.init({ App });
