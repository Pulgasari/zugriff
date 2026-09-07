// apps/prompts/components/TagManager.js
// the inline tag editor in the sidebar: list existing tags, delete them, add a new one.

import Icon        from '/.shared/js/components/Icon.js';
import { useState } from 'preact/hooks';

const app = zugriff.app;

export default function TagManager ({ show, onClose }) {
  const [name,  setName]  = useState('');
  const [color, setColor] = useState('#457b9d');
  if (!show) return null;

  const add = () => {
    if (!name.trim()) return;
    app.db.saveTag({ id: app.db.uid(), name: name.trim(), color });
    setName('');
  };

  return html`
    <div class="tag-manager">
      <div class="tag-manager-header">
        <span>Manage Tags</span>
        <button class="icon-btn" onClick=${onClose}><${Icon} name="mdi:close" /></button>
      </div>
      <div class="tag-manager-list">
        ${app.db.tags.value.map(t => html`
          <div class="tag-manager-row">
            <span class="tag-badge" style=${{ '--tag-color': t.color }}>${t.name}</span>
            <button class="icon-btn remove" onClick=${() => app.removeTag(t.id)}>
              <${Icon} name="mdi:trash-can-outline" />
            </button>
          </div>`)}
        ${app.db.tags.value.length === 0 && html`<span class="empty-hint">No tags yet</span>`}
      </div>
      <div class="tag-manager-add">
        <input class="field tag-name-input" type="text" placeholder="Tag name"
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
