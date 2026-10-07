// components/Config.js
// the settings of an app as the content of its config area: <app-config> with the
// shared fields (palette, skin, geometry, density and the registry schema), bound
// to zugriff.app.state, in an <app-panel>. an app's own sections go in as children.
//
//   <app-area name='config' dock='end'><${Config} /></app-area>
//   <app-area name='config' dock='end'><${Config}><${Sync} /></${Config}></app-area>

import { gestalt } from '@aufbau/api';

import { effect, useEffect, useRef } from './../vendors.js';
import { sharedSpec }                from './Settings.js';

// the shared fields, written into app.state, following it while open
function SharedConfig () {
  const app  = globalThis.zugriff?.app;
  const host = useRef(null);

  useEffect(() => {
    const element = host.current;
    if (!app || !element) return;
    let closed = false;

    gestalt.palettes().then(palettes => {
      if (closed) return;
      const spec = sharedSpec(app.config, palettes);
      element.values = Object.fromEntries(Object.keys(spec).map(key => [key, app.state['$' + key]]));
      element.spec   = spec;
    });

    const onConfig = event => { app.state[event.detail.key] = event.detail.values[event.detail.key]; };
    element.addEventListener('config', onConfig);

    const keys   = Object.keys(sharedSpec(app.config, []));
    const follow = effect(() => {
      const values = Object.fromEntries(keys.map(key => [key, app.state['$' + key]]));
      if (element.spec && Object.keys(element.spec).length) element.values = values;
    });

    return () => { closed = true; follow(); element.removeEventListener('config', onConfig); };
  }, []);

  return html`<app-config ref=${host}></app-config>`;
}

function Config ({ heading = 'Settings', children }) {
  return html`
    <app-panel heading=${heading}>
      <${SharedConfig} />
      ${children}
    </app-panel>
  `;
}

export { Config, SharedConfig };
export default Config;
