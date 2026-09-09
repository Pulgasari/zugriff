// apps/podcasts/views/PodcastsView.js
// the subscriptions grid / list.

import IconButton       from '/.shared/js/components/IconButton.js';
import Picker           from '/.shared/js/components/Picker.js';
import View             from '/.shared/js/components/View.js';
import PodcastsIndex    from './../components/PodcastsIndex.js';
import { sortPodcasts } from './../modules/methods.js';

const app = zugriff.app;

export default function PodcastsView () {
  const list = sortPodcasts(app.db.podcasts.value, app.settings.podcastSort);

  return html`
    <${View}>
      <header>
        <h1>Podcasts</h1>
        <div class="view-tools">
          <${Picker}
            value=${app.settings.podcastSort}
            onChange=${v => app.settings.podcastSort = v}
            options=${['recent', 'alpha']}
            />
          <div class="seg">
            <${IconButton} icon="viewmode-grid" label="Grid" active=${app.settings.view === 'grid'} onClick=${() => app.settings.view = 'grid'} />
            <${IconButton} icon="viewmode-list" label="List" active=${app.settings.view === 'list'} onClick=${() => app.settings.view = 'list'} />
          </div>
          <${IconButton} icon="add" label="Add podcast" onClick=${() => app.state.dialog = 'add'} />
        </div>
      </header>

      <${PodcastsIndex}
        podcasts=${list}
        empty=${{
          icon: 'rss', 
          title: 'No subscriptions yet',
          hint: "Paste a podcast's RSS feed URL to subscribe." 
        }}
        />
    </${View}>`;
}
