// podcasts :: views/PodcastDetailView.js

//import { enumSignal } from '@aufbau/signals';

import Button      from '/.shared/js/components/Button.js';
import Empty       from '/.shared/js/components/Empty.js';
import Icon        from '/.shared/js/components/Icon.js';
import Link        from '/.shared/js/components/Link.js';
import Picker      from '/.shared/js/components/Picker.js';
import SearchPanel from '/.shared/js/components/SearchPanel.js';
import View        from '/.shared/js/components/View.js';

import Artwork       from './../components/Artwork.js';
import EpisodesIndex from './../components/EpisodesIndex.js';

import { useTable } from './../modules/hooks.js';
import { plain, filterEpisodes, sortEpisodes } from './../modules/methods.js';

// :::::: MAIN

const app            = zugriff.app;
const sorting        = 'newest';
const sortingOptions = ['newest', 'oldest', 'alpha'];
//const indexSorting   = enumSignal('newest', ['newest', 'oldest', 'alpha']);

function PodcastDetailView ({ id }) {
  const back    = { label: 'Podcasts', onClick: () => app.go('podcasts') };
  const podcast = useTable('podcasts', () => app.db.podcasts.get(id), ['one', id]);
  const rows    = useTable('episodes', () => app.db.episodes.toValues(id + ':'), ['of', id]);
  if (podcast === null || !rows) return null;
  if (!podcast) return html`<${View} back=${back}><${Empty} icon='alert' title='Podcast not found' /></${View}>`;      

  const all       = sortEpisodes(rows.map(episode => ({ ...episode, podcast })), sorting);
  const episodes  = filterEpisodes(all, false);
  const doneCount = all.filter(episode => app.library.stateOf(episode.id).done).length;

  const remove = async () => {
    if (!confirm(`Unsubscribe from “${podcast.title}”? This removes its episodes and their progress.`)) return;
    const artwork = [podcast.image, ...all.map(episode => episode.image)].filter(Boolean);
    await app.library.unsubscribe(id);
    app.thumbs.evict(artwork).catch(() => {});
    app.toast.success('unsubscribed');
    app.go('podcasts');
  };

  const refreshOne = async () => {
    app.state.busy = 'refreshing…';
    try {
      const { added } = await app.library.refresh(id);
      const message = added ? `${added} new episode(s)` : 'Up to date';
      app.toast.success(message);
    }
    catch (e) { app.toast(e); }
    finally   { app.state.busy = ''; }
  };

  return html`
    <${View} class='podcast-view' id='podcast' back=${back}>
      <header>
        <${Button} icon='arrow-left' ...${back} />
        <h1>${podcast.title}</h1>
        <div class='actions'>
          <${Button} icon='refresh' onClick=${refreshOne} disabled=${!!app.state.$busy} />
          <${Button} icon='trash'   onClick=${remove} class='danger' />
        </div>
      </header>

      <main>
        <${Artwork} src=${podcast.image} />

        <div class='info'>
          <div class='stats'>${episodes.length} episodes · ${doneCount} done</div>
          ${podcast.title       && html`<div class='title'>${podcast.title}</div>`}
          ${podcast.author      && html`<div class='author'>${podcast.author}</div>`}
          ${podcast.description && html`<p class='about'>${plain(podcast.description).slice(0, 400)}</p>`}
          ${podcast.link        && html`<${Link} href=${podcast.link} icon='mdi:web' label='Website' />`}
        </div>

        <div>
          <span>Episodes</span>
          <${Picker} onChange=${v => sorting = v} options=${sortingOptions} value=${sorting} />
        </div>
  
        <${EpisodesIndex} episodes=${episodes}
          empty=${{ 
            icon  : 'mdi:magnify-close', 
            title : 'Nothing matches your filter' 
          }}
        />
      </main>
    </${View}>
    ${all.length > 0 && html`<${SearchPanel} placeholder='filter episodes …' />`}
  `;
}

export default PodcastDetailView;
