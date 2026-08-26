// shared/js/components/Taplet.js

import Icon from './Icon.js';

export default function Taplet ({ icon, size, title, onClick }) {
  return html`
    <button class="taplet" title=${title} onClick=${onClick}>
      <${Icon} name=${icon} size=${size} />
    </button>
  `;
}
