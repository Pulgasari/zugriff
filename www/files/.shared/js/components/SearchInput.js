// components/SearchInput.js
// an input-search, its icon can be overridden via props.

import { html } from './../vendors.js';

function SearchInput ({ ...props }) {
  return html`<input-search ...${props}></input-search>`;
}

export       { SearchInput };
export default SearchInput;
