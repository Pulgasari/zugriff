// .shared/js/components/Empty.js

/*
<${Empty} 
  icon="mdi:inbox-outline" 
  title="Nothing here yet" 
  hint="Add something to get started" 
  action=${html`<button…`}
  />
*/

import { html } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';

function Empty ({ icon, title, hint, action, children }) {
  return html`
    <div class="empty">
      ${icon  && html`<${Icon} name=${icon} />`}
      ${title && html`<p class="empty-title">${title}</p>`}
      ${hint  && html`<p class="empty-hint">${hint}</p>`}
      ${action}
      ${children}
    </div>`;
}

export       { Empty };
export default Empty;
