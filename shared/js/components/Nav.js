// shared/js/components/Nav.js
//
// the three places that are not a single app: the terminal, the tools list and
// the apps list. `here` marks which one is showing. `base` is the path back up
// to /zugriff/ — the tools list lives there, so it *is* the base.
//
//   <${Nav} here='cli'   base='./../' />   from /zugriff/cli/
//   <${Nav} here='tools' base='./'    />   from /zugriff/
//   <${Nav} here='apps'  base='./../' />   from /zugriff/apps/

import { html } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';

export default function Nav ({ here, base = './' }) {
  // the page we are on links to itself, rather than up and back down again
  const links = [
    { id: 'cli',   label: 'cli',   icon: 'mdi:console',        href: here === 'cli'   ? './' : `${base}cli/` },
    { id: 'tools', label: 'tools', icon: 'mdi:apps',           href: here === 'tools' ? './' : base },
    { id: 'apps',  label: 'apps',  icon: 'mdi:widgets-outline', href: here === 'apps'  ? './' : `${base}apps/` },
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
