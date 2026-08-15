// apps/prompt-manager/app.js

// ::: vendors
import { computed, effect, html, signal, useEffect, useRef, useState } from '@aufbau/kits/preact-htm';
import { BunkerDB } from '@bunker/db';

// ::: shared
import { boot } from './../../shared/js/app.js';
import { Icon } from './../../shared/js/components/index.js';

// ::: local
import * as config from './app.config.js';

// ── db ────────────────────────────────────────────────────────────────────────
let db = new BunkerDB ('promptmanagerx');
await db.setup({ prompts: {}, tags: {} });
/*
await db.setup({
  prompts : { keyPath: 'id' },
  tags    : { keyPath: 'id' },
});
*/

// ── state ─────────────────────────────────────────────────────────────────────
let prompts    = signal([]);
let tags       = signal([]);
let search     = signal('');
let activeTag  = signal(null);   // tag id filter
let sortBy     = signal('name'); // name | createdAt | updatedAt
let activeId   = signal(null);   // selected prompt id
let editMode   = signal(false);  // false = view, true = edit/create
let mobilePane = signal('list'); // list | detail (mobile only)

// ── derived ───────────────────────────────────────────────────────────────────
let filteredPrompts = computed(() => {
  let list = prompts.value;
  let q    = search.value.toLowerCase();
  if (q)               list = list.filter(p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
  if (activeTag.value) list = list.filter(p => p.tags?.includes(activeTag.value));
  return [...list].sort((a, b) => {
    if (sortBy.value === 'name') return a.title.localeCompare(b.title);
    return (b[sortBy.value] ?? 0) - (a[sortBy.value] ?? 0);
  });
});

let activePrompt = computed(() =>
  prompts.value.find(p => p.id === activeId.value) ?? null
);

// ── db helpers ────────────────────────────────────────────────────────────────
async function loadAll() {
  let [ps, ts] = await Promise.all([db.prompts.getAll(), db.tags.getAll()]);
  prompts.value = Object.values(ps);
  tags.value    = Object.values(ts);
}

async function savePrompt (data) {
  await db.prompts.set(data.id, data);
  await loadAll();
}
async function deletePrompt (id) {
  await db.prompts.delete(id);
  if (activeId.value === id) { activeId.value = null; editMode.value = false; }
  await loadAll();
}

async function saveTag (tag) {
  await db.tags.set(tag.id, tag);
  await loadAll();
}
async function deleteTag (id) {
  await db.tags.delete(id);
  // remove tag from all prompts
  let updated = prompts.value
    .filter(p => p.tags?.includes(id))
    .map(p => ({ ...p, tags: p.tags.filter(t => t !== id) }));
  for (let p of updated) await db.prompts.set(p.id, p);
  if (activeTag.value === id) activeTag.value = null;
  await loadAll();
}

let uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// ── initial load ──────────────────────────────────────────────────────────────
await loadAll();

// ── copy ──────────────────────────────────────────────────────────────────────
let copied = signal(false);
function copyPrompt(content) {
  navigator.clipboard.writeText(content);
  copied.value = true;
  setTimeout(() => copied.value = false, 1500);
}

// ── TagBadge ──────────────────────────────────────────────────────────────────
function TagBadge({ tagId, removable, onRemove }) {
  let tag = tags.value.find(t => t.id === tagId);
  if (!tag) return null;
  return html`
    <span class="tag-badge" style=${{ '--tag-color': tag.color }}>
      ${tag.name}
      ${removable && html`
        <button class="tag-remove" onClick=${e => { e.stopPropagation(); onRemove(tagId); }}>
          <${Icon} name="mdi:close" />
        </button>`}
    </span>`;
}

// ── PromptItem ────────────────────────────────────────────────────────────────
function PromptItem({ prompt }) {
  let isActive = activeId.value === prompt.id;
  let onClick  = () => {
    activeId.value  = prompt.id;
    editMode.value  = false;
    mobilePane.value = 'detail';
  };
  return html`
    <div class=${'prompt-item' + (isActive ? ' active' : '')} onClick=${onClick}>
      <div class="prompt-item-title">${prompt.title || html`<em>Untitled</em>`}</div>
      ${prompt.tags?.length > 0 && html`
        <div class="prompt-item-tags">
          ${prompt.tags.map(tid => html`<${TagBadge} tagId=${tid} />`)}
        </div>`}
      <div class="prompt-item-meta">
        ${new Date(prompt.updatedAt).toLocaleDateString()}
      </div>
    </div>`;
}

// ── TagManager ────────────────────────────────────────────────────────────────
function TagManager({ show, onClose }) {
  let [name,  setName]  = useState('');
  let [color, setColor] = useState('#457b9d');
  if (!show) return null;

  let add = () => {
    if (!name.trim()) return;
    saveTag({ id: uid(), name: name.trim(), color });
    setName('');
  };

  return html`
    <div class="tag-manager">
      <div class="tag-manager-header">
        <span>Manage Tags</span>
        <button class="icon-btn" onClick=${onClose}><${Icon} name="mdi:close" /></button>
      </div>
      <div class="tag-manager-list">
        ${tags.value.map(t => html`
          <div class="tag-manager-row">
            <span class="tag-badge" style=${{ '--tag-color': t.color }}>${t.name}</span>
            <button class="icon-btn remove" onClick=${() => deleteTag(t.id)}>
              <${Icon} name="mdi:trash-can-outline" />
            </button>
          </div>`)}
        ${tags.value.length === 0 && html`<span class="empty-hint">No tags yet</span>`}
      </div>
      <div class="tag-manager-add">
        <input class="tag-name-input" type="text" placeholder="Tag name"
          value=${name} onInput=${e => setName(e.target.value)}
          onKeyDown=${e => e.key === 'Enter' && add()} />
        <input type="color" class="tag-color-input" value=${color}
          onInput=${e => setColor(e.target.value)} />
        <button class="btn primary sm" onClick=${add} disabled=${!name.trim()}>
          <${Icon} name="mdi:plus" /> Add
        </button>
      </div>
    </div>`;
}

// ── Panel 1: Sidebar ──────────────────────────────────────────────────────────
function Sidebar() {
  let [showTags, setShowTags] = useState(false);
  let SORTS = [
    { id: 'name',      label: 'Name'    },
    { id: 'updatedAt', label: 'Updated' },
    { id: 'createdAt', label: 'Created' },
  ];

  return html`
    <div class="sidebar">

      <div class="sidebar-top">
        <button class="btn primary full" onClick=${() => {
          activeId.value  = null;
          editMode.value  = true;
          mobilePane.value = 'detail';
        }}>
          <${Icon} name="mdi:plus" /> New Prompt
        </button>
      </div>

      <div class="search-row">
        <${Icon} name="mdi:magnify" class="search-icon" />
        <input class="search-input" type="text" placeholder="Search…"
          value=${search.value} onInput=${e => search.value = e.target.value} />
        ${search.value && html`
          <button class="icon-btn" onClick=${() => search.value = ''}>
            <${Icon} name="mdi:close" />
          </button>`}
      </div>

      <div class="tag-filter">
        <div class="tag-filter-header">
          <span class="section-label">Tags</span>
          <button class="icon-btn" title="Manage tags" onClick=${() => setShowTags(s => !s)}>
            <${Icon} name="mdi:tag-edit-outline" />
          </button>
        </div>
        <${TagManager} show=${showTags} onClose=${() => setShowTags(false)} />
        <div class="tag-filter-list">
          <button class=${'tag-filter-btn' + (!activeTag.value ? ' active' : '')}
            onClick=${() => activeTag.value = null}>All</button>
          ${tags.value.map(t => html`
            <button
              class=${'tag-filter-btn' + (activeTag.value === t.id ? ' active' : '')}
              style=${{ '--tag-color': t.color }}
              onClick=${() => activeTag.value = activeTag.value === t.id ? null : t.id}>
              ${t.name}
            </button>`)}
        </div>
      </div>

      <div class="sort-row">
        <span class="section-label">Sort</span>
        ${SORTS.map(s => html`
          <button class=${'sort-btn' + (sortBy.value === s.id ? ' active' : '')}
            onClick=${() => sortBy.value = s.id}>${s.label}</button>`)}
      </div>

      <div class="prompt-list zebra">
        ${filteredPrompts.value.length === 0
          ? html`<div class="empty-hint">No prompts found</div>`
          : filteredPrompts.value.map(p => html`<${PromptItem} key=${p.id} prompt=${p} />`)}
      </div>

    </div>`;
}

// ── Panel 2: Detail / Edit ────────────────────────────────────────────────────
function Detail() {
  let prompt = activePrompt.value;
  let isEdit = editMode.value;

  let [title,   setTitle]   = useState('');
  let [content, setContent] = useState('');
  let [selTags, setSelTags] = useState([]);

  // sync form when prompt changes
  /*
  effect(() => {
    if (isEdit) {
      setTitle(prompt?.title   ?? '');
      setContent(prompt?.content ?? '');
      setSelTags(prompt?.tags  ?? []);
    }
  });
  */
  useEffect(() => {
    if (isEdit) {
      setTitle(prompt?.title   ?? '');
      setContent(prompt?.content ?? '');
      setSelTags(prompt?.tags  ?? []);
    }
  }, [isEdit, prompt?.id]);

  if (!isEdit && !prompt) return html`
    <div class="detail-empty">
      <${Icon} name="mdi:text-box-outline" size="40" />
      <span>Select a prompt or create a new one</span>
    </div>`;
    
  if (!isEdit && prompt) return html`
    <div class="detail-view">
      
      <div class="detail-header">
        <h2 class="detail-title">${prompt.title || html`<em>Untitled</em>`}</h2>
        <div class="detail-header-actions">
          <button class="icon-btn" title="Copy" onClick=${() => copyPrompt(prompt.content)}>
            <${Icon} name=${copied.value ? 'mdi:check' : 'mdi:content-copy'} />
          </button>
          <button class="icon-btn" title="Edit" onClick=${() => editMode.value = true}>
            <${Icon} name="mdi:pencil-outline" />
          </button>
          <button class="icon-btn remove" title="Delete" onClick=${() => {
            if (confirm('Delete this prompt?')) deletePrompt(prompt.id);
          }}>
            <${Icon} name="mdi:trash-can-outline" />
          </button>
          <button class="icon-btn mobile-only" onClick=${() => mobilePane.value = 'list'}>
            <${Icon} name="mdi:arrow-left" />
          </button>
        </div>
      </div>

      ${prompt.tags?.length > 0 && html`
        <div class="detail-tags">
          ${prompt.tags.map(tid => html`<${TagBadge} tagId=${tid} />`)}
        </div>`}

      <div class="detail-meta">
        Created ${new Date(prompt.createdAt).toLocaleString()} ·
        Updated ${new Date(prompt.updatedAt).toLocaleString()}
      </div>

      <pre class="detail-content">${prompt.content}</pre>

    </div>`;

  // ── edit form ──
  let save = async () => {
    let now  = Date.now();
    let data = {
      id:        prompt?.id ?? uid(),
      title:     title.trim(),
      content,
      tags:      selTags,
      createdAt: prompt?.createdAt ?? now,
      updatedAt: now,
    };
    await savePrompt(data);
    activeId.value  = data.id;
    editMode.value  = false;
  };

  let toggleTag = tid => setSelTags(s => s.includes(tid) ? s.filter(x => x !== tid) : [...s, tid]);

  return html`
    <div class="detail-edit">

      <div class="detail-header">
        <input class="edit-title-input" type="text" placeholder="Prompt title…"
          value=${title} onInput=${e => setTitle(e.target.value)} />
        <div class="detail-header-actions">
          <button class="icon-btn mobile-only" onClick=${() => mobilePane.value = 'list'}>
            <${Icon} name="mdi:arrow-left" />
          </button>
        </div>
      </div>

      <div class="edit-tag-picker">
        ${tags.value.map(t => html`
          <button
            class=${'tag-toggle' + (selTags.includes(t.id) ? ' active' : '')}
            style=${{ '--tag-color': t.color }}
            onClick=${() => toggleTag(t.id)}>
            <${Icon} name=${selTags.includes(t.id) ? 'mdi:check' : 'mdi:tag-outline'} />
            ${t.name}
          </button>`)}
        ${tags.value.length === 0 && html`<span class="empty-hint">No tags — create some in the sidebar</span>`}
      </div>

      <textarea
        class="edit-content"
        placeholder="Prompt content…"
        value=${content}
        onInput=${e => setContent(e.target.value)}
      />

      <div class="edit-actions">
        <button class="btn primary" onClick=${save} disabled=${!content.trim()}>
          <${Icon} name="mdi:content-save-outline" /> Save
        </button>
        <button class="btn secondary" onClick=${() => {
          editMode.value = false;
          if (!prompt) { activeId.value = null; mobilePane.value = 'list'; }
        }}>
          Cancel
        </button>
        ${prompt && html`
          <button class="btn danger" onClick=${() => confirm('Delete this prompt?') && deletePrompt(prompt.id)}>
            <${Icon} name="mdi:trash-can-outline" /> Delete
          </button>`}
      </div>

    </div>`;
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  let mp = mobilePane.value;
  return html`
    <div id="app-body">
      <div class=${'panel-layout' + (mp === 'detail' ? ' mobile-detail' : '')}>
        <${Sidebar} />
        <${Detail} />
      </div>
    </div>
  `;
}

boot({ config, App });
