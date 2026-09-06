// components/Brand.js

import Icon from './Icon.js';

function Brand ({ app, icon, name, ...rest }) {
  icon ??= app?.config?.icon ?? '';
  name ??= app?.config?.name ?? '';
  
  return html`
    <div id='app-brand' ...${rest}>
      <${Icon} name=${icon} />
      <span>${name}</span>
    </div>
  `;
}

export       { Brand };
export default Brand;
