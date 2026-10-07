// apps/videos/app.js
//
// the videos app: one PWA, several modes as the views of #app, the <app-root> — a
// video-manager (library), a player (the shared engine) and a hinted editor. the main area
// is a mode bar plus a view per mode. the OS "open with" / launchQueue drops a launched
// clip into the player. the runtime binds zugriff (+ zugriff.app, html) to window before
// this runs, so nothing here imports the runtime.

import { signal }    from '@aufbau/signals';
import { useEffect } from 'preact/hooks';

import { Config }           from '/.shared/js/components/Config.js';

import lib          from './modules/library.js';
import { routes }   from './routes/index.js';
import { loadFile } from '/.shared/js/media/videoplayer.js';

// ::: the app handle — the data layer hangs off it as app.lib
const app = zugriff.app;
app.lib = lib;

// :::::: FRAME
// a mode is an app-view in the main area, mounted while it is on screen only.
// opening one stays one call: app.setRoute('player')

const current = signal('library');   // the mode on screen

app.setRoute = id => app.show(id);
app.root.addEventListener('navigate', event => { current.value = event.detail.to; });

// a clip opened via the OS "open with" arrives here on launch — into the player
function wireLaunchQueue () {
  if (!('launchQueue' in window) || !window.launchQueue?.setConsumer) return;
  window.launchQueue.setConsumer(async params => {
    if (!params?.files?.length) return;
    try {
      const file = await params.files[0].getFile();
      loadFile(file);
      app.setRoute('player');
    } catch (err) {
      console.warn('[videos] could not open the launched clip:', err);
    }
  });
}

// :::::: SHELL

function ModeBar () {
  return html`
    <header class="im-modebar">
      <div class="im-brand"><svg-icon icon="mdi:movie-open-outline"></svg-icon> <span>videos</span></div>
      <nav class="im-modes">
        ${routes.map(m => html`
          <button class=${'im-mode' + (current.value === m.id ? ' active' : '')} key=${m.id}
                  onClick=${() => app.setRoute(m.id)} title=${m.label}>
            <svg-icon icon=${m.icon}></svg-icon> <span>${m.label}</span>
          </button>`)}
      </nav>
      <div class="im-modebar-actions"><btn-icon icon='settings' label='Settings' onClick=${() => app.area('config')?.toggle()} /></div>
    </header>`;
}

// the library is at the root, the other modes at their id
function App () {
  useEffect(() => {
    wireLaunchQueue();
    Promise.all(['app-root', 'app-area'].map(tag => customElements.whenDefined(tag))).then(() => {
      current.value = app.root.view?.getAttribute('name') ?? 'library';
    });
  }, []);

  return html`
    <app-area name='main'>
      <${ModeBar} />
      ${routes.map(({ id, component: Mode }) => html`
        <app-view key=${id} name=${id} route=${id === 'library' ? '/' : `/${id}`} active=${id === 'library' || undefined}>
          ${current.value === id && html`<${Mode} />`}
        </app-view>
      `)}
    </app-area>
    <app-area name='config' dock='end'><${Config} /></app-area>
  `;
}

// :::::: BOOT

app.init({ App });
