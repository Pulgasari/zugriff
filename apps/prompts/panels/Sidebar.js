// prompts :: panels/Sidebar.js

// the list pane: new-prompt button, search, tag filter + manager, sort, and the filtered
// prompt list. reads ui state off app.state, the library off app.db.

import Icon        from '/.shared/js/components/Icon.js';
import Picker      from '/.shared/js/components/Picker.js';

import TagManager          from './../components/TagManager.js';
import PromptItem          from './../components/PromptItem.js';
import { filteredPrompts } from './../modules/methods.js';

import { useState } from 'preact/hooks';

const app = zugriff.app;

const SORTS = [
  { value: 'name',      label: 'Name'    },
  { value: 'updatedAt', label: 'Updated' },
  { value: 'createdAt', label: 'Created' },
];

export default function Sidebar () {
  const [showTags, setShowTags] = useState(false);
  const list = filteredPrompts();

  return html`
    <div class="sidebar">

      <div class="sidebar-top">
        <button class="btn primary full" onClick=${() => app.newPrompt()}>
          <${Icon} name="mdi:plus" /> New Prompt
        </button>
      </div>

      <div class="search-row">
        <${Icon} name="mdi:magnify" class="search-icon" />
        <input class="search-input" type="text" placeholder="Search…"
          value=${app.state.search} onInput=${e => app.state.search = e.target.value} />
        ${app.state.search && html`
          <button class="icon-btn" onClick=${() => app.state.search = ''}>
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
          <button class=${'tag-filter-btn' + (!app.state.activeTag ? ' active' : '')}
            onClick=${() => app.state.activeTag = null}>All</button>
          ${app.db.tags.value.map(t => html`
            <button
              class=${'tag-filter-btn' + (app.state.activeTag === t.id ? ' active' : '')}
              style=${{ '--tag-color': t.color }}
              onClick=${() => app.state.activeTag = app.state.activeTag === t.id ? null : t.id}>
              ${t.name}
            </button>`)}
        </div>
      </div>

      <div class="sort-row">
        <span class="section-label">Sort</span>
        <${Picker} options=${SORTS} value=${app.state.sortBy} onChange=${id => app.state.sortBy = id} />
      </div>

      <div class="prompt-list zebra">
        ${list.length === 0
          ? html`<div class="empty-hint">No prompts found</div>`
          : list.map(p => html`<${PromptItem} key=${p.id} prompt=${p} />`)}
      </div>

    </div>`;
}
