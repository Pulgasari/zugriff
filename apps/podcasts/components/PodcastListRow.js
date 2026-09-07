// apps/podcasts/components/PodcastListRow.js
// a podcast row for the list view.

import Art from './Artwork.js';
import { fmtDate } from './../modules/methods.js';

const app = zugriff.app;
const { db, go } = app;

export default function PodcastListRow ({ podcast }) {
  const eps = db.episodesByPodcast.value[podcast.id] ?? [];
  return html`
    <button class="pc-row" onClick=${() => go('podcast', podcast.id)}>
      <${Art} src=${podcast.image} size=${56} />
      <div class="pc-row-body">
        <div class="pc-title">${podcast.title}</div>
        <div class="pc-sub">${podcast.author ? podcast.author + ' · ' : ''}${eps.length} episode${eps.length === 1 ? '' : 's'}</div>
      </div>
      <div class="pc-row-date">${fmtDate(podcast.lastEpisodeAt)}</div>
    </button>`;
}
