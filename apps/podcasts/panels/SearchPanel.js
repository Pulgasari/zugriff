// apps/podcasts/panels/SearchPanel.js
// a filter bar docked at the bottom of the scroll area — writes the shared
// app.state.search leaf that the episode views filter on.

import Icon   from '/.shared/js/components/Icon.js';
import Button from '/.shared/js/components/Button.js';

const app = zugriff.app;

export default function SearchPanel ({ placeholder }) {
  const onInput = e => app.state.search = e.target.value;

  return html`
    <div class="search-dock">
      <div class="search-bar">
        <${Icon} name="search" />
        <input type="search" placeholder=${placeholder} value=${app.state.search} onInput=${onInput} />
        ${app.state.search && html`<${Button} class="ibtn" aria-label="Clear filter" icon='close' onClick=${() => app.state.search = ''} />`}
      </div>
    </div>`;
}
