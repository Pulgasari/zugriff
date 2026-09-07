// apps/prompts/panels/Detail.js
// the detail pane: an empty hint, a read view (copy / edit / delete), or the edit form.
// the selected prompt + edit flag come off app.state; saving / deleting go through the app.

import Icon      from '/.shared/js/components/Icon.js';
import TagBadge  from './../components/TagBadge.js';
import { signal }  from '@aufbau/signals';
import { useState, useEffect } from 'preact/hooks';
import { activePrompt } from './../modules/methods.js';

const app = zugriff.app;

// transient "copied" feedback, local to this pane
const copied = signal(false);
function copyPrompt (content) {
  navigator.clipboard.writeText(content);
  copied.value = true;
  setTimeout(() => copied.value = false, 1500);
}

export default function Detail () {
  const prompt = activePrompt();
  const isEdit = app.state.editMode;

  const [title,   setTitle]   = useState('');
  const [content, setContent] = useState('');
  const [selTags, setSelTags] = useState([]);

  // sync the form when the edited prompt changes
  useEffect(() => {
    if (isEdit) {
      setTitle(prompt?.title   ?? '');
      setContent(prompt?.content ?? '');
      setSelTags(prompt?.tags  ?? []);
    }
  }, [isEdit, prompt?.id]);

  if (!isEdit && !prompt) return html`
    <div class="detail-empty">
      <${Icon} name="mdi:text-box-outline" />
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
          <button class="icon-btn" title="Edit" onClick=${() => app.state.editMode = true}>
            <${Icon} name="mdi:pencil-outline" />
          </button>
          <button class="icon-btn remove" title="Delete" onClick=${() => { if (confirm('Delete this prompt?')) app.removePrompt(prompt.id); }}>
            <${Icon} name="mdi:trash-can-outline" />
          </button>
          <button class="icon-btn mobile-only" onClick=${() => app.state.mobilePane = 'list'}>
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
  const save = () => {
    const now = Date.now();
    app.savePrompt({
      id:        prompt?.id ?? app.db.uid(),
      title:     title.trim(),
      content,
      tags:      selTags,
      createdAt: prompt?.createdAt ?? now,
      updatedAt: now,
    });
  };

  const toggleTag = tid => setSelTags(s => s.includes(tid) ? s.filter(x => x !== tid) : [...s, tid]);

  return html`
    <div class="detail-edit">

      <div class="detail-header">
        <input class="edit-title-input" type="text" placeholder="Prompt title…"
          value=${title} onInput=${e => setTitle(e.target.value)} />
        <div class="detail-header-actions">
          <button class="icon-btn mobile-only" onClick=${() => app.state.mobilePane = 'list'}>
            <${Icon} name="mdi:arrow-left" />
          </button>
        </div>
      </div>

      <div class="edit-tag-picker">
        ${app.db.tags.value.map(t => html`
          <button
            class=${'tag-toggle' + (selTags.includes(t.id) ? ' active' : '')}
            style=${{ '--tag-color': t.color }}
            onClick=${() => toggleTag(t.id)}>
            <${Icon} name=${selTags.includes(t.id) ? 'mdi:check' : 'mdi:tag-outline'} />
            ${t.name}
          </button>`)}
        ${app.db.tags.value.length === 0 && html`<span class="empty-hint">No tags — create some in the sidebar</span>`}
      </div>

      <textarea class="edit-content" placeholder="Prompt content…"
        value=${content} onInput=${e => setContent(e.target.value)} />

      <div class="edit-actions">
        <button class="btn primary" onClick=${save} disabled=${!content.trim()}>
          <${Icon} name="mdi:content-save-outline" /> Save
        </button>
        <button class="btn secondary" onClick=${() => app.cancelEdit()}>Cancel</button>
        ${prompt && html`
          <button class="btn danger" onClick=${() => confirm('Delete this prompt?') && app.removePrompt(prompt.id)}>
            <${Icon} name="mdi:trash-can-outline" /> Delete
          </button>`}
      </div>

    </div>`;
}
