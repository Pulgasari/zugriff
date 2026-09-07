// podcasts :: SavedView.js

export default function SavedView () {
  const list = db.savedEpisodes.value;
  return html`
    <div class="view">
      <div class="view-head"><h1>Listen later</h1></div>
      ${!list.length
        ? html`<${Empty} icon="bookmarks" title="Your list is empty"
                 hint="Tap the bookmark on any episode to keep it here." />`
        : html`<div class="ep-list">${list.map(ep => html`<${EpisodeRow} episode=${ep} showPodcast key=${ep.id} />`)}</div>`}
    </div>
  `;
}
