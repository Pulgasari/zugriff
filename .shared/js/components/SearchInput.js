// components/SearchInput.js
// aufbau-input has no 'search' value type (it falls back to text), so the
// search look is just a leading icon; override via props.

import { html } from './../vendors.js';
import Input    from './Input.js';

function SearchInput ({ ...props }) {
  return html`<${Input} icon='search' ...${props} />`;
}

export       { SearchInput };
export default SearchInput;
