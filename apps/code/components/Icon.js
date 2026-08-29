// apps/code/components/Icon.js
//
// a thin wrapper over the shared <Icon>: it first maps the code editor's own
// short aliases (./../icons.js) to their iconify id, then delegates. every
// other prop (size, color, class …) is forwarded untouched.

import { html } from '@aufbau/kits/preact-htm';
import { Icon as BaseIcon } from './../../../.shared/js/components/index.js';
import { resolve } from './../icons.js';

export default function Icon ({ name, ...rest }) {
  return html`<${BaseIcon} name=${resolve(name)} ...${rest} />`;
}
