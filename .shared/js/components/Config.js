// components/Config.js
// the settings of an app as an <app-config>: the shared fields (palette, skin,
// geometry, density and the registry schema) and the app's own (app.settings), all
// bound to app.state. an app.settings entry for a shared key changes that field. the frame is the app's: <Config> puts them in an <app-panel>,
// <ConfigFields> alone goes into a view or a modal. an app's own sections, which are
// more than fields, go in as children. onChange hears every change, after app.state
//
//   <app-area name='config' dock='end'><${Config} /></app-area>
//   <app-area name='config' dock='end'><${Config}><${Sync} /></${Config}></app-area>

import { gestalt } from '@aufbau/api';

import { effect, useEffect, useRef } from './../vendors.js';
import { sharedSpec }                from './Settings.js';

function specOf (app, palettes) {
  const spec = sharedSpec(app.config, palettes);
  for (const [key, field] of Object.entries(app.settings)) spec[key] = { ...spec[key], ...field };
  return spec;
}

// the fields, written into app.state, following it while open
function ConfigFields ({ onChange }) {
  const app  = globalThis.zugriff?.app;
  const host = useRef(null);

  useEffect(() => {
    const element = host.current;
    if (!app || !element) return;
    let closed = false;

    const keys   = Object.keys(specOf(app, []));
    const values = () => Object.fromEntries(keys.map(key => [key, app.state['$' + key]]));

    // the palette names come from aufbau's palettes.css, loaded once
    gestalt.palettes().then(palettes => {
      if (closed) return;
      element.values = values();
      element.spec   = specOf(app, palettes);
    });

    const onConfig = event => {
      const { key, values } = event.detail;
      app.state[key] = values[key];
      onChange?.(key, values[key]);
    };
    element.addEventListener('config', onConfig);

    const follow = effect(() => {
      const next = values();
      if (element.spec && Object.keys(element.spec).length) element.values = next;
    });

    return () => { closed = true; follow(); element.removeEventListener('config', onConfig); };
  }, []);

  return html`<app-config ref=${host}></app-config>`;
}

function Config ({ heading = 'Settings', onChange, children }) {
  return html`
    <app-panel heading=${heading}>
      <${ConfigFields} onChange=${onChange} />
      ${children}
    </app-panel>
  `;
}

export { Config, ConfigFields };
export default Config;
