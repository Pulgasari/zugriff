// the play/pause control for one episode, reflecting the live player state
function PlayToggle ({ episode, size = 20 }) {
  const isCurrent = player.current.value?.id === episode.id;
  const isPlaying = isCurrent && player.playing.value;
  const icon = isCurrent && player.waiting.value ? 'svg-spinners:bars-scale-middle'
             : isPlaying ? 'mdi:pause' : 'mdi:play';
  return html`
    <button class=${'play-toggle' + (isCurrent ? ' current' : '')}
            title=${isPlaying ? 'Pause' : 'Play'} aria-label=${isPlaying ? 'Pause' : 'Play'}
            onClick=${() => player.play(episode)}>
      <${Icon} name=${icon} />
    </button>`;
}

export default PlayToggle;
