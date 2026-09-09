// App.js

function Slot ({ map }) {
  const xxx = {};
  for (const [id, component] of Object.entries(map) {
    xxx[id] = await zugriff.app['view'](component);
  }
}

function App ({ children, dialogs, views }) {
  return html`<div id='app'>
    <main id="app-main">
      ${children}
    </main>
    <${PlayerPanel} />
    <${Dock} />
    ${dialog === 'add'      && html`<${AddPodcastDialog} />`}
    ${dialog === 'settings' && html`<${SettingsPanel} />`}

    ${dialogs && html`<${Slot} map=${dialogs} />`}
    ${views   && html`<${Slot} map=${views}   />`}
  </div>`;
}


const body = () => {
    switch (route.name) {
      case 'podcasts' : return html`<${PodcastsView} />`;
      case 'podcast'  : return html`<${PodcastDetailView} id=${route.id} />`;
      case 'episode'  : return html`<${EpisodeDetailView} id=${route.id} />`;
      case 'saved'    : return html`<${SavedView} />`;.
      default         : return html`<${LatestView} />`;
    }
  };

  
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::::

/*
app.init({
  dialogs: {
    add      : 'AddPodcastDialog',
    settings : 'SettingsPanel',
  },
  views: {
    home     : 'LatestView',
    episode  : 'EpisodeDetailView',
    podcasts : 'PodcastsView',
    podcast  : 'PodcastDetailView',
    saved    : 'SavedView',
  },
});
*/

