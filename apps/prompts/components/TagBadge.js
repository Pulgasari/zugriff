// apps/prompts/components/TagBadge.js
// a coloured tag chip, optionally with a remove button.


const app = zugriff.app;

function TagBadge ({ tagId, removable, onRemove }) {
  const tag = zugriff.app.lib.tags.value.find(t => t.id === tagId);
  //const tag = zugriff.app.lib.tags.findByCriteria({ id: tagId });
  if (!tag) return null;

  return html`
    <span class="tag-badge" style=${{ '--tag-color': tag.color }}>
      ${tag.name}
      ${removable && html`<btn-icon icon='close' onClick=${e => { e.stopPropagation(); onRemove(tagId); }} />`}      
    </span>
  `;
}

export default TagBadge;
