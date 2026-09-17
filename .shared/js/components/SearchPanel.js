// components/SearchPanel.js
// a filter dock bound to the shared app.state.search leaf.

import Button      from './Button.js';
import SearchInput from './SearchInput.js';

const app = zugriff.app;

function SearchPanel ({ placeholder, appStateId = 'search' }) {
  const clear   = ()      => app.state[appStateId] = '';
  const onInput = (event) => app.state[appStateId] = event.detail.value;

  return html`
    <div class='SearchPanel search-panel'>
      <${SearchInput} placeholder=${placeholder} value=${app.state[appStateId]} onInput=${onInput} />
      ${app.state[appStateId] && html`<${Button} aria-label='clear filter' icon='close' onClick=${clear} />`}    
    </div>
  `;
}

export       { SearchPanel };
export default SearchPanel;
