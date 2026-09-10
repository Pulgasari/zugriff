// prompts :: components/TagManager.js
// the inline tag editor in the sidebar: list existing tags, delete them, add a new one.

import Button     from '/.shared/js/components/Button.js';
import Icon       from '/.shared/js/components/Icon.js';
import IconButton from '/.shared/js/components/IconButton.js';

import { useState } from 'preact/hooks';

const app = zugriff.app;

function TagManager ({ show, onClose }) {
  const [name,  setName]  = useState('');
  const [color, setColor] = useState('#457b9d');
  if (!show) return null;

  const add = () => {
    if (!name.trim()) return;
    app.db.saveTag({ id: app.db.uid(), name: name.trim(), color });
    setName('');
  };

  return html`
    <div class='TagManager'>
      <header>
        <span>Manage Tags</span>
        <${IconButton} icon='close' onClick=${onClose} />
      </header>
      
      <div class="tag-manager-list">
        ${app.db.tags.value.map(t => html`
          <div class="tag-manager-row">
            <span class="tag-badge" style=${{ '--tag-color': t.color }}>${t.name}</span>
            <${IconButton} icon='trash' onClick=${() => app.removeTag(t.id)} />
          </div>`)}
        ${app.db.tags.value.length === 0 && html`<span class="empty-hint">No tags yet</span>`}
      </div>
      
      <div class="tag-manager-add">
        <input
          type="text"
          class="field tag-name-input"
          placeholder="Tag name"
          value=${name}
          onInput=${e => setName(e.target.value)}
          onKeyDown=${e => e.key === 'Enter' && add()} 
          />
          
        <input
          type="color" 
          class="tag-color-input"
          value=${color}
          onInput=${e => setColor(e.target.value)}
          />
          
        <${Button} icon='add' label='add' onClick=${add} disabled=${!name.trim()} />
      </div>
    </div>
  `;
}

export default TagManager;
