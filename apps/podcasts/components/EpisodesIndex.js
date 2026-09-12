// podcasts :: components/EpisodesIndex.js

import ActionMenu from '/.shared/js/components/ActionMenu.js';
import Button     from '/.shared/js/components/Button.js';
import Date       from '/.shared/js/components/Date.js';
import Empty      from '/.shared/js/components/Empty.js';
import Index      from '/.shared/js/components/Index.js';
import Progress   from '/.shared/js/components/Progress.js';

import Artwork    from './Artwork.js';
import PlayToggle from './PlayToggle.js';

const app = zugriff.app;

function Item ({ episode }) {
  const state      = app.db.stateOf(episode.id);
  const podcast    = app.db.podcasts.get({ id: episode.podcastId });
  const dur        = state.duration || 0;
  const pct        = state.done ? 100 : (dur ? Math.min(100, state.position / dur * 100) : 0);
  const classNames = [state.done && 'done', app.player.episode?.id === episode.id && 'playing'].filter(Boolean).join(' ');     

  return html`
    <aufbau-item class=${classNames}>
      <${Artwork}
        aria-label='open episode'
        onClick=${() => app.go('episode', episode.id)}
        src=${episode.image || podcast?.image} 
      />
      
      <div class='meta'>
        <${Button} label=${podcast.title} onClick=${() => app.go('podcast', podcast.id)} />       
        <${Date} value=${episode.pubDate} />
        <span class='dur'>${zugriff.fmt.duration(episode.duration)}</span>
      </div>
      
      <${Button} class='title' label=${episode.title} onClick=${() => app.go('episode', episode.id)} />
      
      ${(state.position || state.done) && html`<${Progress} value=${pct} />`}

      <${ActionMenu} items=${[
        html`<${PlayToggle} episode=${episode} />`,
        { 
          icon    : state.saved ? 'bookmark'         : 'bookmark-outline', 
          label   : state.saved ? 'Remove from list' : 'Save for later',
          onClick : () => app.db.toggleSaved(episode.id)
        },{
          icon    : state.done ? 'mdi:check-circle' : 'mdi:check-circle-outline',
          label   : state.done ? 'Mark unplayed'    : 'Mark as done',
          onClick : () => app.db.toggleDone(episode.id),
        },{
          icon  : 'mdi:open-in-new',
          href  : episode.link,
          title : 'open episode page',
        }
      ]}/>
    </aufbau-item>
  `;
}

function EpisodesIndex ({ episodes, empty }) {
  if (!episodes.length) return html`<${Empty} ...${empty} />`;

  return html`
    <${Index} viewmode='list'>
      ${episodes.map(episode => html`
        <${Item} key=${episode.id} episode=${episode} />
      `)}
    </${Index}>
  `;
}

export default EpisodesIndex;

