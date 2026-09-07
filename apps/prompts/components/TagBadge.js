// apps/prompts/components/TagBadge.js
// a coloured tag chip, optionally with a remove button.

import Icon from '/.shared/js/components/Icon.js';

const app = zugriff.app;

export default function TagBadge ({ tagId, removable, onRemove }) {
  const tag = app.db.tags.value.find(t => t.id === tagId);
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
