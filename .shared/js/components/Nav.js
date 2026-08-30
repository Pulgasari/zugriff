// shared/js/components/Nav.js

import { html } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';

function Nav ({ here, base = './' }) {
  const links = [
    { id: 'cli',   label: 'cli',   icon: 'mdi:console',         href: 'https://zugriff.dev/cli/'   },
    { id: 'apps',  label: 'apps',  icon: 'mdi:widgets-outline', href: 'https://zugriff.dev/apps'   },
    { id: 'tools', label: 'tools', icon: 'mdi:apps',            href: 'https://zugriff.dev/tools/' },    
  ];

  return html`
    <nav class='actions'>
      ${links.map(link => html`
        <a
          key=${link.id}
          class=${'btn ghost' + (here === link.id ? ' active' : '')}
          href=${link.href}
          aria-current=${here === link.id ? 'page' : null}
        >
          <${Icon} name=${link.icon} /> ${link.label}
        </a>`)}
    </nav>`;
}

export       { Nav };
export default Nav;
