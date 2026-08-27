
import { html } from '@aufbau/kits/preact-htm';

export default function ({ alt='' loading = 'lazy', src )} {
  html`<img src=${src} alt=${alt} loading=${loading} />`;
}
