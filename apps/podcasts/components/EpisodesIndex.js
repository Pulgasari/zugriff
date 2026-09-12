// apps/podcasts/components/EpisodesIndex.js

import ActionMenu from '/.shared/js/components/ActionMenu.js';
import Button     from '/.shared/js/components/Button.js';
import Empty      from '/.shared/js/components/Empty.js';
import Index      from '/.shared/js/components/Index.js';
import Icon       from '/.shared/js/components/Icon.js';
import IconButton from '/.shared/js/components/IconButton.js';
import Link       from '/.shared/js/components/Link.js';
import Progress   from '/.shared/js/components/Progress.js';

import Artwork    from './Artwork.js';
import PlayToggle from './PlayToggle.js';
import { fmtDate, fmtDuration, plain } from './../modules/methods.js';

const app = zugriff.app;
const { db, player, go } = app;

function Item ({ episode, showPodcast }) {
  const st      = app.db.stateOf(episode.id);
  const isDone  = st.done;
  const podcast = app.db.podcasts.get({ id: episode.podcastId });
  const teaser  = plain(episode.description).slice(0, 200);
  const dur     = st.duration || 0;
  const pct     = isDone ? 100 : (dur ? Math.min(100, st.position / dur * 100) : 0);
  const showTeaser = false;

  const classNames = [st.done && 'done', app.player.episode?.id === episode.id && 'playing'].filter(Boolean).join(' ');
/*
<button >
  <${Art} src=${episode.image || podcast?.image} size=${48} />
</button>
*/

  return html`
    <aufbau-item class=${classNames}>
      <${Artwork}
        aria-label='open episode'
        onClick=${() => app.go('episode', episode.id)}
        src=${episode.image || podcast?.image} 
        />
      
      <div class="meta">
        ${showPodcast && podcast && html`<${Button} class='podcast' label=${podcast.title} onClick=${() => app.go('podcast', podcast.id)} />`}       
        <${Date value=${episode.pubDate} />
        ${episode.duration && html`<span class='dur'>· ${fmtDuration(episode.duration)}</span>`}
      </div>
      
      <${Button} class='title' label=${episode.title} onClick=${() => app.go('episode', episode.id)} />
      
      ${(st.position || isDone) && html`<${Progress} value=${pct} />`}

      <${ActionMenu} items=${[
        html`<${PlayToggle} episode=${episode} />`,
        { 
          icon    : st.saved ? 'bookmark'         : 'bookmark-outline', 
          label   : st.saved ? 'Remove from list' : 'Save for later',
          onClick : () => app.db.toggleSaved(episode.id)
        },{
          icon    : isDone ? 'mdi:check-circle' : 'mdi:check-circle-outline',
          label   : isDone ? 'Mark unplayed'    : 'Mark as done',
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

function EpisodesIndex ({ episodes, showPodcast = false, empty }) {
  if (!episodes.length) return html`<${Empty} ...${empty} />`;

  return html`
    <${Index} viewmode='list'>
      ${episodes.map(episode => html`
        <${Item} key=${episode.id} episode=${episode} showPodcast=${showPodcast} />
      `)}
    </${Index}>
  `;
}

export default EpisodesIndex;

