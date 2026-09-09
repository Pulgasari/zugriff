// apps/podcasts/views/SavedView.js
// the "listen later" list — every bookmarked episode, newest-saved first.

import EpisodesIndex from './../components/EpisodesIndex.js';

const app = zugriff.app;
const { db } = app;

export default function SavedView () {
  const list = db.savedEpisodes.value;

  const empty = {
    icon: 'bookmarks', title: 'Your list is empty',
    hint: 'Tap the bookmark on any episode to keep it here.',
  };

  return html`
    <div class="view">
      <div class="view-head"><h1>Listen later</h1></div>
      <${EpisodesIndex} episodes=${list} showPodcast empty=${empty} />
    </div>
  `;
}
