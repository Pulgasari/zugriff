// podcasts :: EpisodeDetailView.js

function EpisodeDetailView ({ id }) {
  const episode = episodeById.value[id];
  if (!episode) return html`
    <div class="view">
      <${Button} class="back" icon="arrow-left" label="Back" onClick=${() => go('latest')} />
      <${Empty} icon="mdi:alert-outline" title="Episode not found" />
    </div>`;

  const podcast = podcastById.value[episode.podcastId];
  const st      = db.stateOf(id);
  const paras   = paragraphs(episode.description);
  const dur     = st.duration || episode.duration || 0;
  const pct     = st.done ? 100 : (dur && st.position ? Math.min(100, (st.position / dur) * 100) : 0);

  const isCurrent = player.current.value?.id === id;
  const isPlaying = isCurrent && player.playing.value;

  return html`
    <div class="view">
      <${Button} class="back" icon="arrow-left" label=${podcast ? podcast.title : 'Back'}
                 onClick=${() => podcast ? go('podcast', podcast.id) : go('latest')} />

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

          <div class="ed-actions">
            <button class="btn primary" onClick=${() => player.play(episode)}>
              <${Icon} name=${isPlaying ? 'mdi:pause' : 'mdi:play'} />
              ${isPlaying ? 'Pause' : st.position && !st.done ? 'Resume' : 'Play'}
            </button>
            <${IconButton} icon=${st.saved ? 'mdi:bookmark' : 'mdi:bookmark-outline'}
                        label=${st.saved ? 'Remove from list' : 'Save for later'}
                        active=${st.saved} size=${20} onClick=${() => db.toggleSaved(id)} />
            <${IconButton} icon=${st.done ? 'mdi:check-circle' : 'mdi:check-circle-outline'}
                        label=${st.done ? 'Mark unplayed' : 'Mark as done'}
                        active=${st.done} size=${20} onClick=${() => db.toggleDone(id)} />
            ${episode.link && html`<a class="btn ghost" href=${episode.link} target="_blank" rel="noopener">
              <${Icon} name="mdi:open-in-new" /> Episode page</a>`}
          </div>

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
    </div>`;
}
