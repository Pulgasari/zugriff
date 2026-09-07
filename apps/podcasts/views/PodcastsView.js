// apps/podcasts/views/PodcastsView.js
// the subscriptions grid / list.

import Empty          from '/.shared/js/components/Empty.js';
import Icon           from '/.shared/js/components/Icon.js';
import IconButton     from '/.shared/js/components/IconButton.js';
import PodcastCard    from './../components/PodcastCard.js';
import PodcastListRow from './../components/PodcastListRow.js';
import SortPicker     from './../components/SortPicker.js';
import { sortPodcasts } from './../modules/methods.js';

const app = zugriff.app;
const { db } = app;

export default function PodcastsView () {
  const list = sortPodcasts(db.podcasts.value, app.settings.podcastSort);

  return html`
    <div class="view">
      <div class="view-head">
        <h1>Podcasts</h1>
        <div class="view-tools">
          <${SortPicker} value=${app.settings.podcastSort} onChange=${v => app.settings.podcastSort = v}
             options=${[['recent', 'Recently updated'], ['alpha', 'A–Z']]} />
          <div class="seg">
            <${IconButton} icon="viewmode-grid" label="Grid" active=${app.settings.view === 'grid'} onClick=${() => app.settings.view = 'grid'} />
            <${IconButton} icon="viewmode-list" label="List" active=${app.settings.view === 'list'} onClick=${() => app.settings.view = 'list'} />
          </div>
          <${IconButton} icon="mdi:plus" label="Add podcast" onClick=${() => app.state.dialog = 'add'} />
        </div>
      </div>
      ${!list.length
        ? html`<${Empty} icon="mdi:rss" title="No subscriptions yet"
                 hint="Paste a podcast's RSS feed URL to subscribe."
                 action=${html`<button class="btn primary" onClick=${() => app.state.dialog = 'add'}>
                   <${Icon} name="mdi:plus" /> Add a podcast</button>`} />`
        : html`
          <aufbau-index class="pc-index" viewmode=${app.settings.view}
                        item-size="150px" gap=${app.settings.view === 'grid' ? '1.25rem' : '0'}>
            ${list.map(p => html`
              <aufbau-item key=${p.id}>
                ${app.settings.view === 'grid'
                  ? html`<${PodcastCard} podcast=${p} />`
                  : html`<${PodcastListRow} podcast=${p} />`}
              </aufbau-item>`)}
          </aufbau-index>`}
    </div>`;
}
