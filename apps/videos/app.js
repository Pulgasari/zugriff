// apps/videos/app.js
//
// the videos app: one PWA, several routes switched by ?mode= via the shared query-param
// router — a video-manager (library), a player (the shared engine) and a hinted editor. the
// shell is a mode bar plus the router outlet. the OS "open with" / launchQueue drops a
// launched clip into the player. the runtime binds zugriff (+ zugriff.app, html) to window
// before this runs, so nothing here imports the runtime.

import { Icon, Settings } from '/.shared/js/components/index.js';
import { createRouter }   from '/.shared/js/app/router.js';
import { useEffect }      from 'preact/hooks';

import lib          from './modules/library.js';
import { routes }   from './routes/index.js';
import { loadFile } from '/.shared/js/media/videoplayer.js';

// ::: the app handle — the data layer hangs off it as app.lib
const app = zugriff.app;
app.lib = lib;

const router = createRouter(app, { routes, param: 'mode', fallback: 'library' });

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
      <div class="im-brand"><${Icon} name="mdi:movie-open-outline" /> <span>videos</span></div>
      <nav class="im-modes">
        ${router.routes.map(m => html`
          <button class=${'im-mode' + (app.state.route === m.id ? ' active' : '')} key=${m.id}
                  onClick=${() => app.setRoute(m.id)} title=${m.label}>
            <${Icon} name=${m.icon} /> <span>${m.label}</span>
          </button>`)}
      </nav>
      <div class="im-modebar-actions"><${Settings} /></div>
    </header>`;
}

function App () {
  useEffect(() => { wireLaunchQueue(); }, []);
  return html`
    <>
      <${ModeBar} />
      <div id="app-main"><${router.Outlet} /></div>
    </>`;
}

// :::::: BOOT

app.init({ App });
