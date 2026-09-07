// apps/podcasts/panels/SearchPanel.js
// a filter bar docked at the bottom of the scroll area — writes the shared
// app.ui.search signal that the episode views filter on.

import Icon   from '/.shared/js/components/Icon.js';
import Button from '/.shared/js/components/Button.js';

const app = zugriff.app;
const { search } = app.ui;

export default function SearchPanel ({ placeholder }) {
  const onInput = e => search.value = e.target.value;

  return html`
    <div class="search-dock">
      <div class="search-bar">
        <${Icon} name="search" />
        <input type="search" placeholder=${placeholder} value=${search.value} onInput=${onInput} />
        ${search.value && html`<${Button} class="ibtn" aria-label="Clear filter" icon='close' onClick=${() => search.value = ''} />`}
      </div>
    </div>`;
}
