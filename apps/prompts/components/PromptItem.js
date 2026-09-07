// apps/prompts/components/PromptItem.js
// one row in the prompt list; selecting it opens the prompt in the detail pane.

import TagBadge from './TagBadge.js';

const app = zugriff.app;

export default function PromptItem ({ prompt }) {
  const isActive = app.state.activeId === prompt.id;

  return html`
    <div class=${'prompt-item' + (isActive ? ' active' : '')} onClick=${() => app.openPrompt(prompt.id)}>
      <div class="prompt-item-title">${prompt.title || html`<em>Untitled</em>`}</div>
      ${prompt.tags?.length > 0 && html`
        <div class="prompt-item-tags">
          ${prompt.tags.map(tid => html`<${TagBadge} tagId=${tid} />`)}
        </div>`}
      <div class="prompt-item-meta">${new Date(prompt.updatedAt).toLocaleDateString()}</div>
    </div>`;
}
