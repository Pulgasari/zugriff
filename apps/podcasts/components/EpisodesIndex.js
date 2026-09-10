// apps/podcasts/components/EpisodesIndex.js

import Empty      from '/.shared/js/components/Empty.js';
import Index      from '/.shared/js/components/Index.js';
import Icon       from '/.shared/js/components/Icon.js';
import IconButton from '/.shared/js/components/IconButton.js';
import Progress   from '/.shared/js/components/Progress.js';
import Art        from './Artwork.js';
import PlayToggle from './PlayToggle.js';
import { fmtDate, fmtDuration, plain } from './../modules/methods.js';

const app = zugriff.app;
const { db, player, go } = app;

function Item ({ episode, showPodcast }) {
  const st      = db.stateOf(episode.id);
  const podcast = db.podcasts.get({ id: episode.podcastId });
  const teaser  = plain(episode.description).slice(0, 200);
  const dur     = st.duration || 0;
  const pct     = st.done ? 100 : (dur ? Math.min(100, st.position / dur * 100) : 0);

  const classNames = [st.done && 'done', player.episode?.id === episode.id && 'playing'].filter(Boolean).join(' ');

  return html`
    <aufbau-item class=${classNames}>
      <button class="ep-art" onClick=${() => go('episode', episode.id)} aria-label="Open episode">
        <${Art} src=${episode.image || podcast?.image} size=${48} />
      </button>
      <div class="ep-body">
        <div class="ep-meta">
          ${showPodcast && podcast && html`
            <button class="ep-podcast" onClick=${() => go('podcast', podcast.id)}>${podcast.title}</button>`}
          <span class="ep-date">${fmtDate(episode.pubDate)}</span>
          ${episode.duration && html`<span class="ep-dur">· ${fmtDuration(episode.duration)}</span>`}
        </div>
        <button class="ep-title" onClick=${() => go('episode', episode.id)}>${episode.title}</button>
        ${teaser && html`<div class="ep-teaser">${teaser}</div>`}
        ${(st.position || st.done) && html`<${Progress} value=${pct} />`}
      </div>
      <div class="ep-actions">
        <${PlayToggle} episode=${episode} />
        
        <${IconButton}
          active=${st.saved}
          icon=${st.saved ? 'mdi:bookmark' : 'mdi:bookmark-outline'}
          label=${st.saved ? 'Remove from list' : 'Save for later'}
          onClick=${() => db.toggleSaved(episode.id)} />
          
        <${IconButton}
          active=${st.done}
          icon=${st.done ? 'mdi:check-circle' : 'mdi:check-circle-outline'}
          label=${st.done ? 'Mark unplayed' : 'Mark as done'}
          onClick=${() => db.toggleDone(episode.id)} />
          
        ${episode.link && html`<${Link} href=${episode.link} icon='mdi:open-in-new' title="Open episode page" />`}
      </div>
    </aufbau-item>`;
}

export default function EpisodesIndex ({ episodes, showPodcast = false, empty }) {
  if (!episodes.length) return html`<${Empty} ...${empty} />`;

  return html`
    <${Index} viewmode='list'>
      ${episodes.map(ep => html`<${Item} key=${ep.id} episode=${ep} showPodcast=${showPodcast} />`)}
    </${Index}>`;
}
