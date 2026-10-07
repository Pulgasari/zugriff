// apps/images/app.js
// the images app on the shared handle. the runtime binds zugriff (+ zugriff.app, html) to
// window before this runs, so nothing here imports the runtime. the modes are the views of
// #app, the <app-root>; the folder-library data layer hangs off the handle as app.lib, the
// open image tray lives in the state module.

// ::: vendors
import { signal }    from '@aufbau/signals';
import { useEffect } from 'preact/hooks';

// ::: app modules
import lib                              from './modules/library.js';
import { setFiles, revokeAll, vError }  from './modules/state.js';

// ::: routes + router
import { routes }       from './routes/index.js';
import { editCurrent }  from './routes/edit.js';

// ::: shared components
const
Brand      = await zugriff.component('Brand'),
Config     = await zugriff.component('Config'),
Icon       = await zugriff.component('Icon');

// ::: the app handle — the data layer hangs off it as app.lib
const app = zugriff.app;
app.lib = lib;

// :::::: FRAME
// a mode is an app-view in the main area, mounted while it is on screen only.
// opening one stays one call: app.setRoute('edit')

const current = signal('view');   // the mode on screen

app.setRoute = id => app.show(id);
app.root.addEventListener('navigate', event => { current.value = event.detail.to; });

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
        ${routes.map(m => html`
          <button class=${'im-mode' + (current.value === m.id ? ' active' : '')} key=${m.id}
                  onClick=${() => m.id === 'edit' ? editCurrent() : app.setRoute(m.id)}
                  title=${m.label}>
            <${Icon} name=${m.icon} /> <span>${m.label}</span>
          </button>`)}
      </nav>
      <div class="im-modebar-actions"><btn-icon icon='settings' label='Settings' onClick=${() => app.area('config')?.toggle()} /></div>
    </header>`;
}

// the view mode is at the root, the others at their id
function App () {
  useEffect(() => {
    wireLaunchQueue();
    Promise.all(['app-root', 'app-area'].map(tag => customElements.whenDefined(tag))).then(() => {
      current.value = app.root.view?.getAttribute('name') ?? 'view';
    });
    return () => revokeAll();
  }, []);

  return html`
    <app-area name='main'>
      <${ModeBar} />
      ${routes.map(({ id, component: Mode }) => html`
        <app-view key=${id} name=${id} route=${id === 'view' ? '/' : `/${id}`} active=${id === 'view' || undefined}>
          ${current.value === id && html`<${Mode} />`}
        </app-view>
      `)}
    </app-area>
    <app-area name='config' dock='end'><${Config} /></app-area>
  `;
}

// :::::: BOOT

app.init({ App });
