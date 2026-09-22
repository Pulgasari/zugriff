// podcasts :: components/ExploreEpisodesIndex.js

// episode hits from the directory. an episode on its own is nothing to subscribe to,
// so the row is a way into the podcast it came from — which is what every action here
// does: open it, remember it, or read the episode's page in the store.

import ActionMenu from '/.shared/js/components/ActionMenu.js';
import Button     from '/.shared/js/components/Button.js';
import Date       from '/.shared/js/components/Date.js';
import Empty      from '/.shared/js/components/Empty.js';
import Index      from '/.shared/js/components/Index.js';

import Artwork    from './Artwork.js';

import { plain } from './../modules/methods.js';

const app    = zugriff.app;
const TEASER = 200;

const explorer = {};
explorer.rememberedPodcasts = new Set; // stub
explorer.subscribedPodcasts = new Set; // stub



function EpisodeItem ({ author, date, description, duration, image, link, podcast, podcastId, title, url,     episode, remembered, subscribed }) {
  const open   = () => app.go('explore-podcast', url);
  const teaser = plain(description).slice(0, TEASER);

  const isRemembered = explorer.rememberedPodcasts.has(podcastId);
  const isSubscribed = explorer.subscribedPodcasts.has(podcastId);

  return html`
    <aufbau-item class:subscribed=${subscribed}>
      <${Artwork} aria-label='open podcast' onClick=${open} src=${image} />

      <div class='meta'>
        <${Date} value=${date} />
        <span class='dur'>${zugriff.fmt.duration(duration)}</span>
      </div>

      <${Button} class='title' label=${title} onClick=${open} />

      ${teaser && html`<p class='teaser'>${teaser}</p>`}

      <${ActionMenu} items=${[
        {
          icon    : subscribed ? 'check' : 'mdi:podcast',
          label   : podcast || 'Podcast',
          title   : subscribed ? 'in your library' : 'open this podcast',
          onClick : open,
        },{
          icon    : remembered ? 'bookmark' : 'bookmark-unfilled',
          label   : remembered ? 'Forget'   : 'Remember',
          title   : remembered ? 'Remove the podcast from the shortlist' : 'Keep the podcast for a closer look later',
          onClick : () => app.explore.toggleRemembered({ author, image, url, id: podcastId, title: podcast }),
        },
        // an item with an empty href would render as a button that goes nowhere
        link && {
          icon  : 'mdi:open-in-new',
          href  : link,
          title : 'open the episode in the store',
        },
      ].filter(Boolean)} />
    </aufbau-item>
  `;
}

function ExploreEpisodesIndex ({ episodes, remembered, subscribed, empty }) {
  if (!episodes.length) return html`<${Empty} ...${empty} />`;

  return html`
    <${Index} viewmode='list'>
      ${episodes.map(EpisodeItem)}
    </${Index}>
  `;
}

export default ExploreEpisodesIndex;
