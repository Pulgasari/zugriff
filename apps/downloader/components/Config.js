// downloader :: components/Config.js
// the settings area: the shared fields and the queue's, the targets a finished
// file can go to, the user's plugins and what the library takes up.

import { gestalt }                     from '@aufbau/api';
import { effect }                      from '@aufbau/signals';
import { useEffect, useRef, useState } from 'preact/hooks';

import PopPrompt      from '@aufbau/elements/webcomponents/pop-prompt.js';
import { sharedSpec } from '/.shared/js/components/Settings.js';
import * as dav       from '/.shared/js/modules/webdav/client.js';

import * as engine  from '../modules/engine.js';
import * as plugins from '../modules/plugins.js';

const app = zugriff.app;
const fmt = zugriff.fmt;
const fs  = zugriff.fs;


export const FIELDS = {
  parallel   : { type: 'number',  label: 'At once',              min: 1, max: 8,     step: 1,   default: 3 },
  perHost    : { type: 'number',  label: 'At once per host',     min: 1, max: 4,     step: 1,   default: 2 },
  retries    : { type: 'number',  label: 'Tries',                min: 1, max: 10,    step: 1,   default: 5 },
  limit      : { type: 'number',  label: 'Limit, KiB/s',         min: 0, max: 20480, step: 256, default: 0 },
  target     : { type: 'enum',    label: 'Target',               look: 'segments', values: ['library', 'folder', 'webdav', 'save'], default: 'library' },
  subfolders : { type: 'boolean', label: 'A folder per package', default: true },
  autostart  : { type: 'boolean', label: 'Go on at start',       default: true },
};

// :::::: SECTIONS ::::::::::::::::::::::::::::::::::::::::::::

function Fields () {
  const host = useRef(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let closed = false;

    gestalt.palettes().then(palettes => {
      if (closed) return;
      const spec = { ...FIELDS, ...sharedSpec(app.config, palettes) };
      element.values = Object.fromEntries(Object.keys(spec).map(key => [key, app.state['$' + key]]));
      element.spec   = spec;
    });

    const onConfig = event => {
      app.state[event.detail.key] = event.detail.values[event.detail.key];
      if (event.detail.key in FIELDS) engine.pump();
    };
    element.addEventListener('config', onConfig);

    const keys   = [...Object.keys(FIELDS), ...Object.keys(sharedSpec(app.config, []))];
    const follow = effect(() => {
      const values = Object.fromEntries(keys.map(key => [key, app.state['$' + key]]));
      if (element.spec && Object.keys(element.spec).length) element.values = values;
    });

    return () => { closed = true; follow(); element.removeEventListener('config', onConfig); };
  }, []);

  return html`<app-config ref=${host}></app-config>`;
}

function Targets () {
  const [places, setPlaces] = useState({});

  useEffect(() => { app.db.meta.get('targets').then(value => setPlaces(value ?? {})); }, []);

  const store = async next => { await app.db.meta.set('targets', next); setPlaces(next); };

  async function pickFolder () {
    try {
      const handle = await fs.pickDirectory({ id: 'downloader', mode: 'readwrite' });
      if (handle) await store({ ...places, folder: fs.dehydrate(handle) });
    }
    catch (error) { app.toast(error); }
  }

  async function addDav () {
    const url = await PopPrompt.prompt('webdav url', 'https://', { field: 'url' });
    if (!url) return;
    const username = await PopPrompt.prompt('username', '') ?? '';
    const password = await PopPrompt.prompt('password', '', { field: 'password' }) ?? '';
    const path     = await PopPrompt.prompt('folder on the server', 'downloads') ?? '';
    const place    = { password, path, url, username };
    try   { await dav.test(place); await store({ ...places, webdav: place }); app.toast({ success: 'webdav place added' }); }
    catch (error) { app.toast(error); }
  }

  const folderName = places.folder ? fs.hydrate(places.folder)?.name ?? 'a folder' : null;

  return html`
    <section class='config-section'>
      <h4>targets</h4>
      <div class='target'>
        <span><b>folder</b> ${folderName ?? 'none yet'}</span>
        ${fs.supported() && html`<btn-tap icon='lucide:folder' label=${folderName ? 'change' : 'choose'} onClick=${pickFolder} />`}
        ${folderName && html`<btn-icon icon='lucide:x' title='forget' onClick=${() => store({ ...places, folder: null })} />`}
      </div>
      <div class='target'>
        <span><b>webdav</b> ${places.webdav ? `${places.webdav.url} ${places.webdav.path}` : 'none yet'}</span>
        <btn-tap icon='lucide:server' label=${places.webdav ? 'change' : 'add'} onClick=${addDav} />
        ${places.webdav && html`<btn-icon icon='lucide:x' title='forget' onClick=${() => store({ ...places, webdav: null })} />`}
      </div>
    </section>
  `;
}

function Plugins () {
  const sources = app.state.$plugins ?? [];

  async function add () {
    const url = await PopPrompt.prompt('the url of a plugin module', 'https://', { field: 'url' });
    if (!url) return;
    app.state.plugins = [...sources, url];
    const [result] = (await plugins.usePlugins(app.state.$plugins)).slice(-1);
    if (result?.status === 'rejected') app.toast({ error: `the plugin did not load: ${result.reason?.message ?? result.reason}` });
  }

  const removeAt = index => {
    app.state.plugins = sources.filter((_, at) => at !== index);
    plugins.usePlugins(app.state.$plugins);
  };

  return html`
    <section class='config-section'>
      <h4>plugins</h4>
      <p class='hint'>built in: ${plugins.BUILT_IN.map(plugin => plugin.name).join(', ')}. your own run in a worker each, away from the page.</p>
      ${sources.map((source, index) => html`
        <div class='target'><span>${source}</span><btn-icon icon='lucide:x' title='remove' onClick=${() => removeAt(index)} /></div>
      `)}
      <btn-tap icon='lucide:plus' label='add a plugin' onClick=${add} />
    </section>
  `;
}

function Storage () {
  const [estimate, setEstimate] = useState(null);
  const library = engine.downloads.value.filter(item => item.state === 'done' && item.place === 'library');

  useEffect(() => { engine.storage().then(setEstimate); }, [library.length]);

  return html`
    <section class='config-section'>
      <h4>storage</h4>
      <p class='hint'>
        ${library.length} ${library.length === 1 ? 'file' : 'files'} in the library
        ${estimate && html`<br />${fmt.bytes(estimate.usage)} of ${fmt.bytes(estimate.quota)} used by this site`}
      </p>
      <btn-tap icon='lucide:broom' label='clear failed and cancelled' onClick=${() => engine.clearEnded()} />
    </section>
  `;
}

export function Config () {
  return html`
    <app-panel heading='Settings'>
      <${Fields} />
      <${Targets} />
      <${Plugins} />
      <${Storage} />
    </app-panel>
  `;
}

export default Config;
