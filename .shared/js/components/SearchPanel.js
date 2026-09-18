// components/SearchPanel.js

import Button      from './Button.js';
import SearchInput from './SearchInput.js';

const app = zugriff.app;

function SearchPanel ({ placeholder, appStateId: id = 'search' }) {
  const clear   = ()      => app.state[id] = '';
  const onInput = (event) => app.state[id] = event.detail.value;
  const value   = app.state['$' + id];   // the leaf's value; the bare name is its signal

  return html`
    <div class='SearchPanel search-panel'>
      <${SearchInput} ...${{ onInput, placeholder, value }} />
      ${value && html`<${Button} aria-label='clear filter' icon='close' onClick=${clear} />`}    
    </div>
  `;
}

export       { SearchPanel };
export default SearchPanel;
