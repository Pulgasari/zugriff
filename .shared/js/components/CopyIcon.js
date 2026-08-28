// shared/js/components/CopyIcon.js

import { html, signal } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';

const copied = signal(null);

export function copy (str, time = 1500) {
  navigator.clipboard.writeText(str);
  copied.value = str;
  setTimeout(() => { if (copied.value === str) copied.value = null; }, time);
}

export default function CopyIcon ({ content }) {
  const isCopied = copied.value === content;
  return html`
    <${Icon}
      name=${isCopied ? 'mdi:check' : 'mdi:content-copy'}
      onClick=${() => copy(content)}
      title='Copy to Clipboard'
    />`;
}
