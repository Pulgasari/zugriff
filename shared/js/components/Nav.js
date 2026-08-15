// shared/js/components/Nav.js
//
// the two places that are not an app: the terminal and the app list.
// `here` marks which one is showing.
//
//   <${Nav} here='cli'  base='./../' />   from /zugriff/cli/
//   <${Nav} here='apps' base='./'    />   from /zugriff/

import { html } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';

export default function Nav ({ here, base = './' }) {
  // the page we are on links to itself, rather than up and back down again
  const links = [
    { id: 'cli',  label: 'cli',  icon: 'mdi:console', href: here === 'cli'  ? './' : `${base}cli/` },
    { id: 'apps', label: 'apps', icon: 'mdi:apps',    href: here === 'apps' ? './' : base },
  ];

  return html`
    <nav class='actions'>
      ${links.map(link => html`
        <a
          key=${link.id}
          class=${'ghost-btn' + (here === link.id ? ' active' : '')}
          href=${link.href}
          aria-current=${here === link.id ? 'page' : null}
        >
          <${Icon} name=${link.icon} /> ${link.label}
        </a>`)}
    </nav>`;
}
