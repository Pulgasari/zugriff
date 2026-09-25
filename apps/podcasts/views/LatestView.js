// apps/podcasts/views/LatestView.js

import Button             from '/.shared/js/components/Button.js';
import Icon               from '/.shared/js/components/Icon.js';
import IconButton         from '/.shared/js/components/IconButton.js';
import SearchPanel        from '/.shared/js/components/SearchPanel.js';
import View               from '/.shared/js/components/View.js';

import EpisodesIndex      from './../components/EpisodesIndex.js';
import { useTable }        from './../modules/hooks.js';
import { filterEpisodes, sortEpisodes } from './../modules/methods.js';

const app = zugriff.app;

export default function LatestView () {
  const podcasts = useTable('podcasts', () => app.db.podcasts.toValues(), ['all']);
  const episodes = useTable('episodes', () => app.db.episodes.toValues(), ['all']);
  if (!podcasts || !episodes) return null;

  const hasSubs = podcasts.length > 0;
  const byId    = Object.fromEntries(podcasts.map(podcast => [podcast.id, podcast]));

  // the join happens once here, so neither a row nor the filter has to look a
  // podcast up for itself
  const         joined = episodes.map(ep => ({ ...ep, podcast: byId[ep.podcastId] }));
  const   sortedEpisodes = sortEpisodes(joined, 'newest');
  const filteredEpisodes = filterEpisodes(sortedEpisodes, true).slice(0, 200);

  const empty = !hasSubs
    ? {
      icon   : 'mdi:rss', title: 'No subscriptions yet',
      hint   : 'Add a podcast by its RSS feed URL to see its latest episodes here.',
      action : html`<${Button} icon='add' label='Add a podcast' onClick=${() => app.state.dialog = 'add'} />`     
    } : { 
      icon  : app.state.$search ? 'mdi:magnify-close' : 'mdi:playlist-remove',
      title : app.state.$search ? 'Nothing matches your filter' : 'No episodes found',
      hint  : app.state.$search ? '' : 'Try refreshing your feeds.'
    };

  return html`
    <${View}>
      <header>
        <h1>Latest episodes</h1>
        <div class="view-tools">
          <${IconButton}
            icon="refresh" 
            onClick=${() => app.actions.run('refresh-all')} 
            disabled=${!!app.state.$busy} 
          />
        </div>
      </header>

      <main>
        ${hasSubs && html`<${SearchPanel} placeholder="filter episodes …" />`}
        <${EpisodesIndex} episodes=${filteredEpisodes} empty=${empty} />
      </main>
    </${View}>
  `;
}
