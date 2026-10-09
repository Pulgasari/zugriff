// apps/images/app.js
// the images app on the shared handle. the runtime binds zugriff (+ zugriff.app, html) to
// window before this runs, so nothing here imports the runtime. the modes are the views of
// #app, the <app-root>; the folder-library data layer hangs off the handle as app.lib, the
// open image tray lives in the state module.

// ::: vendors
import { useEffect } from '/.shared/js/vendors.js';

// ::: app modules
import lib                              from './modules/library.js';
import { setFiles, revokeAll, vError }  from './modules/state.js';

// ::: modes
import { modes }        from './views/index.js';
import { editCurrent }  from './views/edit.js';

// ::: shared components
const { Brand, Config, Views } = await zugriff.components('Brand', 'Config', 'Views');

// ::: the app handle — the data layer hangs off it as app.lib
const app = zugriff.app;
app.lib = lib;

// :::::: FRAME
// a mode is a view in the main area, in the dom while it is on screen only. the view
// mode is at the root, the others at their id

app.views = Object.fromEntries(modes.map(({ id, view }) =>
  [id, { route: id === 'view' ? '/' : `/${id}`, view, transient: true }]));

// ::::::

// files opened via the OS "open with" arrive here on launch — drop them into view
function wireLaunchQueue () {
  if (!('launchQueue' in window) || !window.launchQueue?.setConsumer) return;
  window.launchQueue.setConsumer(async params => {
    if (!params?.files?.length) return;
    try {
      const files = await Promise.all(params.files.map(h => h.getFile()));
      setFiles(files);
      app.go('view');
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
        ${modes.map(m => html`
          <button class=${'im-mode' + (app.current.value === m.id ? ' active' : '')} key=${m.id}
                  onClick=${() => m.id === 'edit' ? editCurrent() : app.go(m.id)}
                  title=${m.label}>
            <svg-icon icon=${m.icon} /> <span>${m.label}</span>
          </button>`)}
      </nav>
      <div class="im-modebar-actions"><btn-icon icon='settings' label='Settings' onClick=${() => app.area('config')?.toggle()} /></div>
    </header>`;
}

function App () {
  useEffect(() => {
    wireLaunchQueue();
    return () => revokeAll();
  }, []);

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
