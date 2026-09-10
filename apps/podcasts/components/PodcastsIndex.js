// apps/podcasts/components/PodcastsIndex.js

import Empty from '/.shared/js/components/Empty.js';
import Index from '/.shared/js/components/Index.js';
import Art   from './Artwork.js';
import { fmtDate } from './../modules/methods.js';

const app = zugriff.app;

function Item ({ podcast }) {
  const episodes = app.db.episodes.where({ podcastId: podcast.id });
  return html`
    <aufbau-item onClick=${() => app.go('podcast', podcast.id)}>
      <${Art} src=${podcast.image} />
      <div class="title">${podcast.title}</div>
      <div class="sub">${episodes.length} episode(s) · ${fmtDate(podcast.lastEpisodeAt)}</div>
    </aufbau-item>
  `;
}

export default function PodcastsIndex ({ podcasts, empty }) {
  if (!podcasts.length) return html`<${Empty} ...${empty} />`;

  return html`
    <${Index} viewmode=${app.settings.view} itemSize='150px' gap='1rem'>
      ${podcasts.map(p => html`<${Item} key=${p.id} podcast=${p} />`)}
    </${Index}>`;
}
