// podcasts :: components/ProgressBar.js
// TODO: move to shared components

function ProgressBar ({ state }) {
  if (!state || (!state.position && !state.done)) return null;
  const dur = state.duration || 0;
  const pct = state.done ? 100 : (dur ? Math.min(100, (state.position / dur) * 100) : 0);
  
  return html`
    <aufbau-progress
      class="ep-progress" 
      value=${pct}
    ></aufbau-progress>
  `;
}

export default ProgressBar;
