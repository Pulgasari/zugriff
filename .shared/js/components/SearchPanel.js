// components/SearchPanel.js

import Button      from './Button.js';
import SearchInput from './SearchInput.js';

const app = zugriff.app;

function SearchPanel ({ placeholder, signal, appStateId: id = 'search' }) {
  let clear, onInput, value;

  if (signal !== undefined) {
    clear   = ()      => signal.value = '';
    onInput = (event) => signal.value = event.detail.value;
    value   = signal.value;
  }

  else {
    clear   = ()      => app.state[id] = '';
    onInput = (event) => app.state[id] = event.detail.value;
    value   = app.state['$' + id];   // the leaf's value; the bare name is its signal
  }
  
  return html`
    <div class='SearchPanel search-panel'>
      <${SearchInput} ...${{ onInput, placeholder, value }} />
      ${value && html`<${Button} aria-label='clear filter' icon='close' onClick=${clear} />`}    
    </div>
  `;
}

export       { SearchPanel };
export default SearchPanel;
