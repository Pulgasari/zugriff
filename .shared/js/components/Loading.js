// Loading.js
// <${Loading} />                       just the spinner
// <${Loading} text='Scanning…' />      spinner + a label
// <${Loading}>${anything}<//>          spinner + arbitrary content

import { html } from './../vendors.js';
import Icon     from './Icon.js';

function Loading ({ text, children, class: klass }) {
  return html`
    <div class=${klass ? 'loading ' + klass : 'loading'}>
      <${Icon} name='loading' />
      ${children ?? (text && html`<span>${text}</span>`)}
    </div>
  `;
}

export       { Loading };
export default Loading;
