// Loading.js
// <${Loading} />                       just the spinner
// <${Loading} text='Scanning…' />      spinner + a label
// <${Loading}>${anything}<//>          spinner + arbitrary content

import { html } from './../vendors.js';

function Loading ({ text, children, class: klass }) {
  return html`
    <div class=${klass ? 'loading ' + klass : 'loading'}>
      <svg-icon icon='loading'></svg-icon>
      ${children ?? (text && html`<span>${text}</span>`)}
    </div>
  `;
}

export       { Loading };
export default Loading;
