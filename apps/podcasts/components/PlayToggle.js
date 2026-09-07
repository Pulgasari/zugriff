// apps/podcasts/components/PlayToggle.js
// the play/pause control for one episode, reflecting the live player state.

import Icon from '/.shared/js/components/Icon.js';

const app = zugriff.app;
const { player } = app;

export default function PlayToggle ({ episode, size = 20 }) {
  const isCurrent = player.episode?.id === episode.id;
  const isPlaying = isCurrent && player.isPlaying;
  const icon = isCurrent && player.isWaiting ? 'svg-spinners:bars-scale-middle'
             : isPlaying ? 'mdi:pause' : 'mdi:play';
  return html`
    <button class=${'play-toggle' + (isCurrent ? ' current' : '')}
            title=${isPlaying ? 'Pause' : 'Play'} aria-label=${isPlaying ? 'Pause' : 'Play'}
            onClick=${() => player.play(episode)}>
      <${Icon} name=${icon} />
    </button>`;
}
