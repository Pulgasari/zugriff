// apps/podcasts/views/PodcastDetailView.js
// one podcast: header, actions (refresh / website / unsubscribe) and its episodes.

import Button from '/.shared/js/components/Button.js';
import Empty  from '/.shared/js/components/Empty.js';
import Icon   from '/.shared/js/components/Icon.js';
import Link   from '/.shared/js/components/Link.js';
import View   from '/.shared/js/components/View.js';

import Art           from './../components/Artwork.js';
import EpisodesIndex from './../components/EpisodesIndex.js';
import SortPicker    from './../components/SortPicker.js';
import SearchPanel   from '/.shared/js/components/SearchPanel.js';
import { plain, filterEpisodes, sortEpisodes } from './../modules/methods.js';

const app = zugriff.app;
const { db, go, thumbs } = app;

export default function PodcastDetailView ({ id }) {
  const back = { label: 'Podcasts', onClick: () => go('podcasts') };

  const podcast = db.podcastById.value[id];
  if (!podcast) return html`<${View} back=${back}><${Empty} icon="mdi:alert-outline" title="Podcast not found" /></${View}>`;

  const all = sortEpisodes(db.episodesByPodcast.value[id] ?? [], app.settings.episodeSort);
  const eps = filterEpisodes(all, false);
  const doneCount = all.filter(e => db.stateOf(e.id).done).length;

  const remove = async () => {
    if (!confirm(`Unsubscribe from “${podcast.title}”? This removes its episodes and their progress.`)) return;
    const artwork = [podcast.image, ...all.map(e => e.image)].filter(Boolean);
    await db.unsubscribe(id);
    thumbs.evict(artwork).catch(() => {});
    app.toast.success('Unsubscribed');
    go('podcasts');
  };

  const refreshOne = async () => {
    app.state.busy = 'Refreshing…';
    try {
      const { added } = await db.refresh(id, app.settings.proxy);
      app.toast.success(added ? `${added} new episode${added === 1 ? '' : 's'}` : 'Up to date');
    } catch (err) { app.toast.error(err); }
    finally { app.state.busy = ''; }
  };

  return html`
    <${View} back=${back}>
      <header>
        <${Art} src=${podcast.image} size=${140} />
        <div class="pd-info">
          <h1>${podcast.title}</h1>
          ${podcast.author && html`<div class="pd-author">${podcast.author}</div>`}
          <div class="pd-stats">${eps.length} episodes · ${doneCount} done</div>
          ${podcast.description && html`<p class="pd-desc">${plain(podcast.description).slice(0, 400)}</p>`}
          <div class="pd-actions">
            <${Button} icon='refresh' label='refresh' onClick=${refreshOne} disabled=${!!app.state.busy} />
            ${podcast.link && html`<${Link} href=${podcast.link} icon='mdi:web' label='Website' />`}
            <${Button} class="danger" icon='trash' label='Unsubscribe' onClick=${remove} />
          </div>
        </div>
      </header>

      <div class="pd-tools">
        <span class="pd-tools-label">Episodes</span>
        <${SortPicker} value=${app.settings.episodeSort} onChange=${v => app.settings.episodeSort = v}
           options=${[['newest', 'Newest'], ['oldest', 'Oldest'], ['alpha', 'A–Z']]} />
      </div>

      <${EpisodesIndex}
        episodes=${eps}
        empty=${{ icon: 'mdi:magnify-close', title: 'Nothing matches your filter' }}
        />
    </${View}>
    ${all.length > 0 && html`<${SearchPanel} placeholder=${`Filter ${podcast.title}…`} />`}`;
}
