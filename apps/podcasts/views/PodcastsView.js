// apps/podcasts/views/PodcastsView.js
// the subscriptions grid / list.

import Empty          from '/.shared/js/components/Empty.js';
import Icon           from '/.shared/js/components/Icon.js';
import IconButton     from '/.shared/js/components/IconButton.js';
import PodcastCard    from './../components/PodcastCard.js';
import PodcastListRow from './../components/PodcastListRow.js';
import SortPicker     from './../components/SortPicker.js';
import View           from '/.shared/js/components/View.js';
import { sortPodcasts } from './../modules/methods.js';

const app = zugriff.app;

export default function PodcastsView () {
  const list = sortPodcasts(app.db.podcasts, app.settings.podcastSort);

  return html`
    <${View}>
    
      <header>
        <h1>Podcasts</h1>
        <div class="view-tools">
          <${SortPicker} 
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
      
      ${!list.length
        ? html`<${Empty} 
            icon="rss" title="No subscriptions yet"
            hint="Paste a podcast's RSS feed URL to subscribe."
            />`
        : html`
          <aufbau-index 
            viewmode=${app.settings.view}
            item-size="150px" 
            gap='1rem'>
            ${list.map(p => html`
              <aufbau-item key=${p.id}>
                ${app.settings.view === 'grid'
                  ? html`<${PodcastCard}    podcast=${p} />`
                  : html`<${PodcastListRow} podcast=${p} />`}
              </aufbau-item>`)}
          </aufbau-index>`}
    </${View}>`;
}
