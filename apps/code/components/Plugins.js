// apps/code/components/Plugins.js — placeholder plugins modal (not yet built out).

import { html } from '@aufbau/kits/preact-htm';
import Modal from './Modal.js';

export default function Plugins () {
  return html`<${Modal} id="plugins" title="Plugins">Plugins</${Modal}>`;
}
