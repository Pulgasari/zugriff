// apps/podcasts/views/LatestView.js
// the mixed "latest episodes" stream across all subscriptions.

import Empty      from '/.shared/js/components/Empty.js';
import Icon       from '/.shared/js/components/Icon.js';
import IconButton from '/.shared/js/components/IconButton.js';
import EpisodeRow from './../components/EpisodeRow.js';
import SearchBar  from './../panels/SearchPanel.js';
import { filterEpisodes } from './../modules/methods.js';

const app = zugriff.app;
const { db } = app;
const { busy, dialog, search } = app.ui;

export default function LatestView () {
  const hasSubs = db.podcasts.value.length > 0;
  const recent = filterEpisodes(
    [...db.episodes.value].sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0)),
    true,
  ).slice(0, 200);

  return html`
    <div class="view">
      <div class="view-head">
        <h1>Latest episodes</h1>
        <div class="view-tools">
          <${IconButton} icon="refresh" label="Refresh all feeds"
                         onClick=${() => app.actions.run('refresh-all')} disabled=${!!busy.value} />
        </div>
      </div>
      ${!hasSubs
        ? html`<${Empty} icon="mdi:rss" title="No subscriptions yet"
                 hint="Add a podcast by its RSS feed URL to see its latest episodes here."
                 action=${html`<button class="btn primary" onClick=${() => dialog.value = 'add'}>
                   <${Icon} name="mdi:plus" /> Add a podcast</button>`} />`
        : !recent.length
        ? html`<${Empty} icon=${search.value ? 'mdi:magnify-close' : 'mdi:playlist-remove'}
                 title=${search.value ? 'Nothing matches your filter' : 'No episodes found'}
                 hint=${search.value ? '' : 'Try refreshing your feeds.'} />`
        : html`<div class="ep-list">${recent.map(ep => html`<${EpisodeRow} episode=${ep} showPodcast key=${ep.id} />`)}</div>`}
    </div>
    ${hasSubs && html`<${SearchBar} placeholder="Filter episodes…" />`}
  `;
}
