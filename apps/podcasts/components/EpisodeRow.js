// apps/podcasts/components/EpisodeRow.js
// one episode in a list — artwork, meta, teaser, progress and the row actions.

import Icon        from '/.shared/js/components/Icon.js';
import IconButton  from '/.shared/js/components/IconButton.js';
import Art         from './Artwork.js';
import PlayToggle  from './PlayToggle.js';
import ProgressBar from './ProgressBar.js';
import { fmtDate, fmtDuration, plain } from './../modules/methods.js';

const app = zugriff.app;
const { db, player, go } = app;

export default function EpisodeRow ({ episode, showPodcast = false }) {
  const st      = db.stateOf(episode.id);
  const podcast = db.podcastById.value[episode.podcastId];
  const teaser  = plain(episode.description).slice(0, 200);

  return html`
    <div class=${'ep' + (st.done ? ' done' : '') + (player.current.value?.id === episode.id ? ' playing' : '')}>
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
        <${ProgressBar} state=${st} />
      </div>
      <div class="ep-actions">
        <${PlayToggle} episode=${episode} />
        <${IconButton} icon=${st.saved ? 'mdi:bookmark' : 'mdi:bookmark-outline'}
                    label=${st.saved ? 'Remove from list' : 'Save for later'}
                    active=${st.saved} onClick=${() => db.toggleSaved(episode.id)} />
        <${IconButton} icon=${st.done ? 'mdi:check-circle' : 'mdi:check-circle-outline'}
                    label=${st.done ? 'Mark unplayed' : 'Mark as done'}
                    active=${st.done} onClick=${() => db.toggleDone(episode.id)} />
        ${episode.link && html`
          <a class="ibtn" href=${episode.link} target="_blank" rel="noopener" title="Open episode page">
            <${Icon} name="mdi:open-in-new" />
          </a>`}
      </div>
    </div>
  `;
}
