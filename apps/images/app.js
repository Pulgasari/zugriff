// apps/images/app.js

// :::::: IMPORT

import { Fragment }  from 'preact';
import { useEffect } from 'preact/hooks';

const // shared components
Brand    = await zugriff.component('Brand'),
Icon     = await zugriff.component('Icon'),
Settings = await zugriff.component('Settings');

import { app } from './context.js';

import { setFiles, revokeAll, vError } from './state.js';

import { routes }       from './routes/index.js';
import { editCurrent }  from './routes/edit.js';
import { createRouter } from '/.shared/js/app/router.js';
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
      <div class="im-brand"><${Icon} name='images' /> <span>images</span></div>
      <${Brand} icon='images' text='images' />
      <${Brand} app=${app} />
      <nav class="im-modes">
        ${router.routes.map(m => html`
          <button class=${'im-mode' + (app.state.route === m.id ? ' active' : '')} key=${m.id}
                  onClick=${() => m.id === 'edit' ? editCurrent() : app.setRoute(m.id)}
                  title=${m.label}>
            <${Icon} name=${m.icon} /> <span>${m.label}</span>
          </button>`)}
      </nav>
      <div class="im-modebar-actions"><${AppSettings} /></div>
    </header>`;
}

function App () {
  useEffect(() => { wireLaunchQueue(); return () => revokeAll(); }, []);
  return html`
    <${Fragment}>
      <${ModeBar} />
      <div id="app-main"><${router.Outlet} /></div>
    </${Fragment}>
  `;
}

// :::::: BOOT

app.init({ App });
