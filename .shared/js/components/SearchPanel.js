// components/SearchPanel.js
// a filter dock bound to the shared app.state.search leaf.

import { html }   from './../vendors.js';
import SearchInput from './SearchInput.js';
import Button      from './Button.js';

const app = zugriff.app;

function SearchPanel ({ placeholder }) {
  const search = app.state.search;

  return html`
    <div class='SearchPanel'>
      <${SearchInput}
        placeholder=${placeholder}
        value=${search}
        onInput=${e => app.state.search = e.detail.value}
      />
      ${search && html`<${Button} aria-label='Clear filter' icon='close' onClick=${() => app.state.search = ''} />`}
    </div>`;
}

export       { SearchPanel };
export default SearchPanel;
