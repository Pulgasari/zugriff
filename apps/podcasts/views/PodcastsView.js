// podcasts :: views/PodcastsView.js

import IconButton from '/.shared/js/components/IconButton.js';
import Picker     from '/.shared/js/components/Picker.js';
import View       from '/.shared/js/components/View.js';

import PodcastsIndex    from './../components/PodcastsIndex.js';
import { useTable }     from './../modules/hooks.js';
import { sortPodcasts } from './../modules/methods.js';

const app = zugriff.app;

const sorting  = 'newest';
const viewmode = 'list';

function PodcastsView () {
  const podcasts = useTable('podcasts', () => app.db.podcasts.toValues(), ['all']);
  if (!podcasts) return null;

  const sortedPodcasts = sortPodcasts(podcasts, sorting);

  return html`
    <${View}>
      <header>
        <h1>Podcasts</h1>
        <div class="view-tools">
          <${Picker}
            value=${sorting}
            onChange=${v => sorting = v}
            options=${['newest', 'alpha']}
            />
          <div class="seg">
            <${IconButton} icon='viewmode-grid' label='grid' active=${viewmode === 'grid'} onClick=${() => viewmode = 'grid'} />
            <${IconButton} icon='viewmode-list' label='list' active=${viewmode === 'list'} onClick=${() => viewmode = 'list'} />
          </div>
          <${IconButton} icon="add" label="Add podcast" onClick=${() => app.state.dialog = 'add'} />
        </div>
      </header>
      
      <main>
        <${PodcastsIndex}
          podcasts=${sortedPodcasts}
          empty=${{
            icon  : 'rss', 
            title : 'No subscriptions yet',
            hint  : "Paste a podcast's RSS feed URL to subscribe." 
          }}
        />
      </main>
    </${View}>
  `;
}

export default PodcastsView;
