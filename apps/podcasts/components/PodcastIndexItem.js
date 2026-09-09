// apps/podcasts/components/PodcastCard.js
// a podcast tile for the grid view.

import Art from './Artwork.js';
import { fmtDate } from './../modules/methods.js';

const app = zugriff.app;

export default function PodcastIndexItem ({ podcast }) {
  const episodes = app.db.episodesByPodcast.value[podcast.id] ?? [];
  return html`
    <aufbau-item key=${podcast.id} onClick=${() => app.go('podcast', podcast.id)}>
      <${Art} src=${podcast.image} />
      <div class="title">${podcast.title}</div>
      <div class="sub">${episodes.length} episode(s) · ${fmtDate(podcast.lastEpisodeAt)}</div>
    </aufbau-item>
  `;
}

