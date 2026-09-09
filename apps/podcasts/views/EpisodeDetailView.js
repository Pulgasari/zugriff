// apps/podcasts/views/EpisodeDetailView.js
// one episode: artwork, meta, actions and the full description.

import Empty      from '/.shared/js/components/Empty.js';
import Icon       from '/.shared/js/components/Icon.js';
import View       from '/.shared/js/components/View.js';
import ActionMenu from '/.shared/js/components/ActionMenu.js';
import Art        from './../components/Artwork.js';
import { fmtDate, fmtDuration, paragraphs } from './../modules/methods.js';

const app = zugriff.app;
const { db, player, go } = app;

export default function EpisodeDetailView ({ id }) {
  const episode = db.episodeById.value[id];
  if (!episode) return html`
    <${View} back=${{ label: 'Back', onClick: () => go('latest') }}>
      <${Empty} icon="mdi:alert-outline" title="Episode not found" />
    <//>`;

  const podcast = db.podcastById.value[episode.podcastId];
  const st      = db.stateOf(id);
  const paras   = paragraphs(episode.description);
  const dur     = st.duration || episode.duration || 0;
  const pct     = st.done ? 100 : (dur && st.position ? Math.min(100, (st.position / dur) * 100) : 0);

  const isCurrent = player.episode?.id === id;
  const isPlaying = isCurrent && player.isPlaying;

  const actions = [
    { primary  : true,
      icon     : isPlaying ? 'mdi:pause' : 'mdi:play',
      label    : isPlaying ? 'Pause' : st.position && !st.done ? 'Resume' : 'Play',
      onClick  : () => player.play(episode) },
    { iconOnly : true, active: st.saved,
      icon     : st.saved ? 'mdi:bookmark' : 'mdi:bookmark-outline',
      label    : st.saved ? 'Remove from list' : 'Save for later',
      onClick  : () => db.toggleSaved(id) },
    { iconOnly : true, active: st.done,
      icon     : st.done ? 'mdi:check-circle' : 'mdi:check-circle-outline',
      label    : st.done ? 'Mark unplayed' : 'Mark as done',
      onClick  : () => db.toggleDone(id) },
    episode.link && { icon: 'mdi:open-in-new', label: 'Episode page', href: episode.link },
  ].filter(Boolean);

  const back = {
    label   : podcast ? podcast.title : 'Back',
    onClick : () => podcast ? go('podcast', podcast.id) : go('latest'),
  };

  return html`
    <${View} back=${back}>
      <header class="ed-head">
        <${Art} src=${episode.image || podcast?.image} size=${160} className="ed-art" />
        <div class="ed-info">
          ${podcast && html`<button class="ed-podcast" onClick=${() => go('podcast', podcast.id)}>${podcast.title}</button>`}
          <h1>${episode.title}</h1>
          <div class="ed-meta">
            <span>${fmtDate(episode.pubDate)}</span>
            ${episode.duration && html`<span>· ${fmtDuration(episode.duration)}</span>`}
            ${st.done && html`<span class="ed-done">· <${Icon} name="mdi:check-circle" /> done</span>`}
          </div>

          <${ActionMenu} items=${actions} />

          ${(st.position > 0 || st.done) && html`
            <div class="ed-progress">
              <aufbau-progress class="ep-progress" value=${pct}></aufbau-progress>
              <span class="ed-progress-label">
                ${st.done ? 'Finished' : `${fmtDuration(st.position)}${dur ? ' / ' + fmtDuration(dur) : ''}`}
              </span>
            </div>`}
        </div>
      </header>

      ${paras.length
        ? html`<div class="ed-desc">${paras.map((p, i) => html`<p key=${i}>${p}</p>`)}</div>`
        : html`<p class="ed-desc empty-hint">No description.</p>`}
    <//>`;
}
