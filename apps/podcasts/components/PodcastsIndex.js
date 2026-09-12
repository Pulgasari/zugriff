// podcasts :: components/PodcastsIndex.js

import Artwork from './Artwork.js';
import Empty   from '/.shared/js/components/Empty.js';
import Index   from '/.shared/js/components/Index.js';

const viewmode = 'list';

function Item ({ podcast }) {
  const episodes = zugriff.app.db.episodes.where({ podcastId: podcast.id });
  return html`
    <aufbau-item onClick=${() => zugriff.app.go('podcast', podcast.id)}>
      <${Artwork} src=${podcast.image} />
      <div class="title">${podcast.title}</div>
      <div class="sub">${episodes.length} episode(s) · ${zugriff.fmt.date(podcast.lastEpisodeAt)}</div>
    </aufbau-item>
  `;
}

function PodcastsIndex ({ podcasts, empty }) {
  return !podcasts.length
  ? html`<${Empty} ...${empty} />`
  : html`
    <${Index} viewmode=${viewmode} itemSize='150px'>
      ${podcasts.map(p => html`<${Item} key=${p.id} podcast=${p} />`)}
    </${Index}>
  `;
}

export default PodcastsIndex;
