// apps/videos/app.js
//
// the videos app: one PWA, several modes as the views of #app, the <app-root> — a
// video-manager (library), a player (the shared engine) and a hinted editor. the main area
// is a mode bar plus a view per mode. the OS "open with" / launchQueue drops a launched
// clip into the player. the runtime binds zugriff (+ zugriff.app, html) to window before
// this runs, so nothing here imports the runtime.

import { useEffect } from '/.shared/js/vendors.js';

import lib          from './modules/library.js';
import { modes }    from './views/index.js';
import { loadFile } from '/.shared/js/media/videoplayer.js';

// ::: the app handle — the data layer hangs off it as app.lib
const app = zugriff.app;
app.lib = lib;

const { Config, Views } = await zugriff.components('Config', 'Views');

// :::::: FRAME
// a mode is a view in the main area, in the dom while it is on screen only. the library
// is at the root, the other modes at their id

app.views = Object.fromEntries(modes.map(({ id, view }) =>
  [id, { route: id === 'library' ? '/' : `/${id}`, view, transient: true }]));

// a clip opened via the OS "open with" arrives here on launch — into the player
function wireLaunchQueue () {
  if (!('launchQueue' in window) || !window.launchQueue?.setConsumer) return;
  window.launchQueue.setConsumer(async params => {
    if (!params?.files?.length) return;
    try {
      const file = await params.files[0].getFile();
      loadFile(file);
      app.go('player');
    } catch (err) {
      console.warn('[videos] could not open the launched clip:', err);
    }
  });
}

// :::::: SHELL

function ModeBar () {
  return html`
    <header class="im-modebar">
      <div class="im-brand"><svg-icon icon="mdi:movie-open-outline" /> <span>videos</span></div>
      <nav class="im-modes">
        ${modes.map(m => html`
          <button class=${'im-mode' + (app.current.value === m.id ? ' active' : '')} key=${m.id}
                  onClick=${() => app.go(m.id)} title=${m.label}>
            <svg-icon icon=${m.icon} /> <span>${m.label}</span>
          </button>`)}
      </nav>
      <div class="im-modebar-actions"><btn-icon icon='settings' label='Settings' onClick=${() => app.area('config')?.toggle()} /></div>
    </header>`;
}

function App () {
  useEffect(() => { wireLaunchQueue(); }, []);

  return html`
    <app-area name='main'>
      <${ModeBar} />
      <${Views} />
    </app-area>
    <app-area name='config' dock='end'><${Config} /></app-area>
  `;
}

// :::::: BOOT

app.init({ App });
