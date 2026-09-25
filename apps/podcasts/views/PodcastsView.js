// podcasts :: views/PodcastsView.js

import { enumSignal } from '@aufbau/signals';

import IconButton from '/.shared/js/components/IconButton.js';
import Picker     from '/.shared/js/components/Picker.js';
import View       from '/.shared/js/components/View.js';

import PodcastsIndex    from './../components/PodcastsIndex.js';
import { useTable }     from './../modules/hooks.js';
import { sortPodcasts } from './../modules/methods.js';

const app = zugriff.app;

const sorting  = enumSignal('newest', ['newest', 'alpha']);
const viewmode = enumSignal('list', ['grid', 'list']);

function PodcastsView () {
  const podcasts = useTable('podcasts', () => app.db.podcasts.toValues(), ['all']);
  if (!podcasts) return null;
  const sortedPodcasts = sortPodcasts(podcasts, sorting);

  return html`
    <${View}>
      <header>
        <h1>Podcasts</h1>
        <div class="view-tools">
          <${Picker} signal=${sorting} />
          <${Picker} signal=${viewmode} look='segments' />
          <${IconButton} icon|label='add' onClick=${() => app.state.dialog = 'add'} />    
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
