// apps/podcasts/panels/PlayerPanel.js
// the docked player bar — artwork/meta, transport, scrubber and speed/done/close.

import Icon       from '/.shared/js/components/Icon.js';
import IconButton from '/.shared/js/components/IconButton.js';
import Art        from './../components/Artwork.js';
import { fmtDuration } from './../modules/methods.js';

const RATES = [0.8, 1, 1.2, 1.5, 1.75, 2];

const app = zugriff.app;
const { db, player } = app;

export default function PlayerPanel () {
  const ep = player.episode;
  if (!ep) return null;

  const podcast = db.podcastById.value[ep.podcastId];
  const dur     = player.duration || ep.duration || 0;
  const t       = player.time;

  const cycleRate = () => {
    const i = RATES.indexOf(player.rate);
    player.setRate(RATES[(i + 1) % RATES.length] ?? 1);
  };

  return html`
    <footer class="player">
      <div class="pl-meta">
        <${Art} src=${ep.image || podcast?.image} size=${52} />
        <div class="pl-info">
          <div class="pl-title" title=${ep.title}>${ep.title}</div>
          <div class="pl-podcast">${podcast?.title || ''}</div>
        </div>
      </div>

      <div class="pl-controls">
        <${IconButton} icon="mdi:rewind-15" label="Back 15s" size=${22} onClick=${() => player.skip(-15)} />
        <button class="pl-play" title=${player.isPlaying ? 'Pause' : 'Play'} onClick=${player.toggle}>
          <${Icon} name=${player.isWaiting ? 'svg-spinners:bars-scale-middle' : player.isPlaying ? 'mdi:pause' : 'mdi:play'} />
        </button>
        <${IconButton} icon="mdi:fast-forward-30" label="Forward 30s" size=${22} onClick=${() => player.skip(30)} />
      </div>

      <div class="pl-scrub">
        <span class="pl-time">${fmtDuration(t)}</span>
        <input class="pl-range" type="range" min="0" max=${Math.max(dur, 1)} step="1" value=${Math.min(t, dur || t)}
               onInput=${e => player.seek(Number(e.target.value))} />
        <span class="pl-time">${dur ? '-' + fmtDuration(dur - t) : ''}</span>
      </div>

      <div class="pl-right">
        <button class="rate" title="Playback speed" onClick=${cycleRate}>${player.rate}×</button>
        <${IconButton} icon=${db.stateOf(ep.id).done ? 'mdi:check-circle' : 'mdi:check-circle-outline'}
                    label="Mark as done" active=${db.stateOf(ep.id).done} onClick=${() => db.toggleDone(ep.id)} />
        <${IconButton} icon="mdi:close" label="Close player" onClick=${() => player.close()} />
      </div>
    </footer>`;
}
