// components/SearchPanel.js
// a filter dock bound to the shared app.state.search leaf.

import Button      from './Button.js';
import SearchInput from './SearchInput.js';

const app = zugriff.app;

function SearchPanel ({ placeholder, signal = app.state.search }) {
  const clear   = ()      => signal = '';
  const onInput = (event) => signal = event.detail.value;

  return html`
    <div class='SearchPanel'>
      <${SearchInput} placeholder=${placeholder} value=${signal} onInput=${onInput} />
      ${signal && html`<${Button} aria-label='clear filter' icon='close' onClick=${clear} />`}    
    </div>
  `;
}

export       { SearchPanel };
export default SearchPanel;
