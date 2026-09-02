// components/Sidebar.js
// the responsive sidebar shell several apps rebuild by hand: a static column on
// a wide screen, a slide-in drawer with a scrim on a phone. it is controlled —
// the app owns the open/close signal and the content:
//
//   <${Sidebar} open=${navOpen.value} onClose=${() => navOpen.value = false}>
//     …nav content…
//   <//>
//
// pass `onClose` to get the mobile scrim (tap-to-close); omit it for a sidebar
// that never becomes a drawer. extra class names go through `class`.

import { html, preact } from './../vendors.js';
const { Fragment } = preact;

function Sidebar ({ isOpen = false, onClose, class: klass = '', children }) {
  const asideClass = ['z-sidebar', isOpen && 'is-open', klass].filter(Boolean).join(' ');

  return html`
    <${Fragment}>
      <aside class=${asideClass}>${children}</aside>
      ${onClose && html`<div class=${'z-sidebar-scrim' + (isOpen ? ' is-open' : '')} onClick=${onClose}></div>`}      
    </${Fragment}>
  `;
}

export       { Sidebar };
export default Sidebar;
