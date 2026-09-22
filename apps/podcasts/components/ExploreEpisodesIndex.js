// podcasts :: components/ExploreEpisodes.js
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

function Item ({ episode, remembered, subscribed }) {
  const open   = () => app.go('explore-podcast', episode.url);
  const teaser = plain(episode.description).slice(0, TEASER);

  return html`
    <aufbau-item class:subscribed=${subscribed}>
      <${Artwork} aria-label='open podcast' onClick=${open} src=${episode.image} />

      <div class='meta'>
        <${Date} value=${episode.date} />
        <span class='dur'>${zugriff.fmt.duration(episode.duration)}</span>
      </div>

      <${Button} class='title' label=${episode.title} onClick=${open} />

      ${teaser && html`<p class='teaser'>${teaser}</p>`}

      <${ActionMenu} items=${[
        {
          icon    : subscribed ? 'check' : 'mdi:podcast',
          label   : episode.podcast || 'Podcast',
          title   : subscribed ? 'in your library' : 'open this podcast',
          onClick : open,
        },{
          icon    : remembered ? 'bookmark' : 'bookmark-unfilled',
          label   : remembered ? 'Forget'   : 'Remember',
          title   : remembered ? 'Remove the podcast from the shortlist' : 'Keep the podcast for a closer look later',
          onClick : () => app.explore.toggleRemembered({
            id     : episode.podcastId,
            url    : episode.url,
            title  : episode.podcast,
            author : episode.author,
            image  : episode.image,
          }),
        },
        // an item with an empty href would render as a button that goes nowhere
        episode.link && {
          icon  : 'mdi:open-in-new',
          href  : episode.link,
          title : 'open the episode in the store',
        },
      ].filter(Boolean)} />
    </aufbau-item>
  `;
}

function ExploreEpisodes ({ episodes, remembered, subscribed, empty }) {
  if (!episodes.length) return html`<${Empty} ...${empty} />`;

  return html`
    <${Index} class='explore-episodes' viewmode='list'>
      ${episodes.map(episode => html`
        <${Item}
          key=${episode.id}
          episode=${episode}
          remembered=${remembered.has(episode.podcastId)}
          subscribed=${subscribed.has(episode.podcastId)}
        />
      `)}
    </${Index}>
  `;
}

export default ExploreEpisodes;
