// todo :: components/Config.js
// the settings area: the shared fields, where the tasks are synced, the
// reminders, and export and import as json or todo.txt.

import { gestalt }                     from '@aufbau/api';
import { effect }                      from '@aufbau/signals';
import { useEffect, useRef, useState } from 'preact/hooks';

import PopPrompt      from '@aufbau/elements/webcomponents/pop-prompt.js';
import { sharedSpec } from '/.shared/js/components/Settings.js';

import reminders  from '../modules/reminders.js';
import * as store from '../modules/store.js';
import sync       from '../modules/sync.js';

const app    = zugriff.app;

// :::::: FILES :::::::::::::::::::::::::::::::::::::::::::::::

function save (name, text, type) {
  const url  = URL.createObjectURL(new Blob([text], { type }));
  const link = Object.assign(document.createElement('a'), { download: name, href: url });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importFile (file) {
  if (!file) return;
  const text = await file.text();
  try {
    const count = file.name.endsWith('.json') || text.trimStart().startsWith('{')
      ? await store.merge(JSON.parse(text))
      : await store.fromTodoTxt(text);
    app.toast({ success: `${count} imported` });
  }
  catch (error) { app.toast(error); }
}

// :::::: SECTIONS ::::::::::::::::::::::::::::::::::::::::::::

function Shared () {
  const host = useRef(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
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

function Sync () {
  const place = sync.place.value;

  async function connectFolder () {
    try   { if (await sync.connect({ kind: 'folder' })) app.toast({ success: 'syncing with the folder' }); }
    catch (error) { app.toast(error); }
  }

  async function connectDav () {
    const url = await PopPrompt.prompt('webdav url of a folder', 'https://', { field: 'url' });
    if (!url) return;
    const username = await PopPrompt.prompt('username', '') ?? '';
    const password = await PopPrompt.prompt('password', '', { field: 'password' }) ?? '';
    try   { await sync.connect({ kind: 'webdav', password, url, username }); app.toast({ success: 'syncing with webdav' }); }
    catch (error) { app.toast(error); }
  }

  return html`
    <section class='config-section'>
      <h4>sync</h4>
      ${place
        ? html`
          <p class='hint'>${place.kind}: ${place.name}<br />${sync.status.value}</p>
          <div class='actions'>
            <btn-push icon='lucide:refresh-cw' label='sync now' onClick=${() => sync.pull()} />
            <btn-push icon='lucide:unlink' label='stop' onClick=${() => sync.disconnect()} />
          </div>`
        : html`
          <p class='hint'>a todo.json in a folder or on a webdav server, merged task by task.</p>
          <div class='actions'>
            ${zugriff.fs.supported() && html`<btn-push icon='lucide:folder' label='folder' onClick=${connectFolder} />`}
            <btn-push icon='lucide:server' label='webdav' onClick=${connectDav} />
          </div>`}
    </section>
  `;
}

function Reminders () {
  const [permission, setPermission] = useState(reminders.permission());
  const text = {
    default     : 'reminders show while the app is open.',
    denied      : 'notifications are blocked, reminders show as toasts.',
    granted     : 'notifications are on.',
    native      : 'reminders are scheduled on the device.',
    unsupported : 'this browser has no notifications, reminders show as toasts.',
  }[permission];

  return html`
    <section class='config-section'>
      <h4>reminders</h4>
      <p class='hint'>${text}</p>
      ${permission === 'default' && html`<btn-push icon='lucide:bell' label='allow notifications' onClick=${async () => setPermission(await reminders.ask())} />`}
    </section>
  `;
}

function Exchange () {
  const input = useRef(null);
  const stamp = new Date().toISOString().slice(0, 10);

  return html`
    <section class='config-section'>
      <h4>export and import</h4>
      <div class='actions'>
        <btn-push icon='lucide:download' label='json' onClick=${() => save(`todo-${stamp}.json`, JSON.stringify(store.snapshot(), null, 2), 'application/json')} />
        <btn-push icon='lucide:download' label='todo.txt' onClick=${() => save(`todo-${stamp}.txt`, store.toTodoTxt(), 'text/plain')} />
        <btn-push icon='lucide:upload' label='import' onClick=${() => input.current?.click()} />
      </div>
      <input ref=${input} type='file' accept='.json,.txt,application/json,text/plain' hidden
             onChange=${event => { importFile(event.currentTarget.files[0]); event.currentTarget.value = ''; }} />
    </section>
  `;
}

export function Config () {
  return html`
    <app-panel heading='Settings'>
      <${Shared} />
      <${Sync} />
      <${Reminders} />
      <${Exchange} />
    </app-panel>
  `;
}

export default Config;
