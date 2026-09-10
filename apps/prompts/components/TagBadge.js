// apps/prompts/components/TagBadge.js
// a coloured tag chip, optionally with a remove button.

import Icon       from '/.shared/js/components/Icon.js';
import IconButton from '/.shared/js/components/IconButton.js';

const app = zugriff.app;

function TagBadge ({ tagId, removable, onRemove }) {
  const tag = zugriff.app.db.tags.value.find(t => t.id === tagId);
  //const tag = zugriff.app.lib.tags.findByCriteria({ id: tagId });
  if (!tag) return null;

  return html`
    <span class="tag-badge" style=${{ '--tag-color': tag.color }}>
      ${tag.name}
      ${removable && html`<${IconButton} icon='close' onClick=${e => { e.stopPropagation(); onRemove(tagId); }} />`}      
    </span>
  `;
}

export default TagBadge;
