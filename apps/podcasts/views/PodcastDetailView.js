// podcasts :: views/PodcastDetailView.js

import Button from '/.shared/js/components/Button.js';
import Empty  from '/.shared/js/components/Empty.js';
import Icon   from '/.shared/js/components/Icon.js';
import Link   from '/.shared/js/components/Link.js';
import Picker from '/.shared/js/components/Picker.js';
import View   from '/.shared/js/components/View.js';

import Art           from './../components/Artwork.js';
import EpisodesIndex from './../components/EpisodesIndex.js';
import SearchPanel   from '/.shared/js/components/SearchPanel.js';
import { plain, filterEpisodes, sortEpisodes } from './../modules/methods.js';

const app = zugriff.app;
const { db, go, thumbs } = app;

const sorting = 'newest';

export default function PodcastDetailView ({ id }) {
  const back    = { label: 'Podcasts', onClick: () => app.go('podcasts') };
  const podcast = app.db.getPodcast(id);
  if (!podcast) return html`<${View} back=${back}><${Empty} icon='alert' title='Podcast not found' /></${View}>`;      

  const all       = sortEpisodes(app.db.getEpisodes(id), sorting);
  const episodes  = filterEpisodes(all, false);
  const doneCount = all.filter(e => app.db.stateOf(e.id).done).length;

  const remove = async () => {
    if (!confirm(`Unsubscribe from “${podcast.title}”? This removes its episodes and their progress.`)) return;
    const artwork = [podcast.image, ...all.map(e => e.image)].filter(Boolean);
    await app.db.unsubscribe(id);
    app.thumbs.evict(artwork).catch(() => {});
    app.toast.success('Unsubscribed');
    app.go('podcasts');
  };

  const refreshOne = async () => {
    app.state.busy = 'Refreshing…';
    try {
      const { added } = await app.db.refresh(id);
      const message = added ? `${added} new episode(s)` : 'Up to date';
      app.toast.success(message);
    }
    catch (e) { app.toast(e); }
    finally   { app.state.busy = ''; }
  };

  return html`
    <${View} id='podcast' back=${back}>
      <header>
        <h1>${podcast.title}</h1>
        <div class='actions'>
          <${Button} icon='refresh' onClick=${refreshOne} disabled=${!!app.state.busy} />
          <${Button} icon='trash'   onClick=${remove} class='danger' />
        </div>
      </header>

      <div class='info'>
        <${Art} src=${podcast.image} size=${140} />
        ${podcast.author && html`<div class='author'>${podcast.author}</div>`}
        <div class='stats'>${episodes.length} episodes · ${doneCount} done</div>
        ${podcast.description && html`<p class='about'>${plain(podcast.description).slice(0, 400)}</p>`}
        ${podcast.link        && html`<${Link} href=${podcast.link} icon='mdi:web' label='Website' />`}
      </div>

      <div>
        <span>Episodes</span>
        <${Picker}
          value=${sorting}
          onChange=${v => sorting = v}
          options=${['newest', 'oldest', 'alpha']}
          />
      </div>

      <${EpisodesIndex}
        episodes=${episodes}
        empty=${{ 
          icon  : 'mdi:magnify-close', 
          title : 'Nothing matches your filter' 
        }}
        />
    </${View}>
    ${all.length > 0 && html`<${SearchPanel} placeholder='filter episodes …' />`}
  `;
}
