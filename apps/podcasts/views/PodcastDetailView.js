// apps/podcasts/views/PodcastDetailView.js
// one podcast: header, actions (refresh / website / unsubscribe) and its episodes.

import Empty      from '/.shared/js/components/Empty.js';
import Icon       from '/.shared/js/components/Icon.js';
import Button     from '/.shared/js/components/Button.js';
import Art        from './../components/Artwork.js';
import EpisodeRow from './../components/EpisodeRow.js';
import SortPicker from './../components/SortPicker.js';
import SearchPanel from '/.shared/js/components/SearchPanel.js';
import { plain, filterEpisodes, sortEpisodes } from './../modules/methods.js';

const app = zugriff.app;
const { db, go, thumbs } = app;

export default function PodcastDetailView ({ id }) {
  const podcast = db.podcastById.value[id];
  if (!podcast) return html`<${Empty} icon="mdi:alert-outline" title="Podcast not found" />`;

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
    <div class="view">
      <${Button} class="back" icon="arrow-left" label="Podcasts" onClick=${() => go('podcasts')} />

      <header class="pd-head">
        <${Art} src=${podcast.image} size=${140} className="pd-art" />
        <div class="pd-info">
          <h1>${podcast.title}</h1>
          ${podcast.author && html`<div class="pd-author">${podcast.author}</div>`}
          <div class="pd-stats">${eps.length} episodes · ${doneCount} done</div>
          ${podcast.description && html`<p class="pd-desc">${plain(podcast.description).slice(0, 400)}</p>`}
          <div class="pd-actions">
            <button class="btn" onClick=${refreshOne} disabled=${!!app.state.busy}>
              <${Icon} name="mdi:refresh" /> Refresh</button>
            ${podcast.link && html`<a class="btn ghost" href=${podcast.link} target="_blank" rel="noopener">
              <${Icon} name="mdi:web" /> Website</a>`}
            <button class="btn danger" onClick=${remove}>
              <${Icon} name="mdi:trash-can-outline" /> Unsubscribe</button>
          </div>
        </div>
      </header>

      <div class="pd-tools">
        <span class="pd-tools-label">Episodes</span>
        <${SortPicker} value=${app.settings.episodeSort} onChange=${v => app.settings.episodeSort = v}
           options=${[['newest', 'Newest'], ['oldest', 'Oldest'], ['alpha', 'A–Z']]} />
      </div>

      ${eps.length
        ? html`<div class="ep-list">${eps.map(ep => html`<${EpisodeRow} episode=${ep} key=${ep.id} />`)}</div>`
        : html`<${Empty} icon="mdi:magnify-close" title="Nothing matches your filter" />`}
    </div>
    ${all.length > 0 && html`<${SearchPanel} placeholder=${`Filter ${podcast.title}…`} />`}`;
}
