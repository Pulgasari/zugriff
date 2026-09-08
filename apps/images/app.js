// apps/images/app.js
// the images app on the shared handle. the runtime binds zugriff (+ zugriff.app, html) to
// window before this runs, so nothing here imports the runtime. several routes switch by
// ?mode= via the shared query-param router; the folder-library data layer hangs off the
// handle as app.lib, the open image tray lives in the state module.

// ::: vendors
import { useEffect } from 'preact/hooks';

// ::: app modules
import lib                              from './modules/library.js';
import { setFiles, revokeAll, vError }  from './modules/state.js';

// ::: routes + router
import { routes }       from './routes/index.js';
import { editCurrent }  from './routes/edit.js';
import { createRouter } from '/.shared/js/app/router.js';

// ::: shared components
const
Brand    = await zugriff.component('Brand'),
Icon     = await zugriff.component('Icon'),
Settings = await zugriff.component('Settings');

// ::: the app handle — the data layer hangs off it as app.lib
const app = zugriff.app;
app.lib = lib;

const router = createRouter(app, { routes, param: 'mode', fallback: 'view' });

// ::::::

// files opened via the OS "open with" arrive here on launch — drop them into view
function wireLaunchQueue () {
  if (!('launchQueue' in window) || !window.launchQueue?.setConsumer) return;
  window.launchQueue.setConsumer(async params => {
    if (!params?.files?.length) return;
    try {
      const files = await Promise.all(params.files.map(h => h.getFile()));
      setFiles(files);
      app.setRoute('view');
    } catch (err) {
      vError.value = 'could not open the launched file — ' + (err?.message || err);
    }
  });
}

// :::::: SHELL

function ModeBar () {
  return html`
    <header class="im-modebar">
      <${Brand} app=${app} />
      <nav class="im-modes">
        ${router.routes.map(m => html`
          <button class=${'im-mode' + (app.state.route === m.id ? ' active' : '')} key=${m.id}
                  onClick=${() => m.id === 'edit' ? editCurrent() : app.setRoute(m.id)}
                  title=${m.label}>
            <${Icon} name=${m.icon} /> <span>${m.label}</span>
          </button>`)}
      </nav>
      <div class="im-modebar-actions"><${Settings}/></div>
    </header>`;
}

function App () {
  useEffect(() => { wireLaunchQueue(); return () => revokeAll(); }, []);
  return html`
    <>
      <${ModeBar} />
      <div id="app-main"><${router.Outlet} /></div>
    </>
  `;
}

// :::::: BOOT

app.init({ App });
