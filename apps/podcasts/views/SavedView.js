// podcasts :: views/SavedView.js
// the "listen later" list — every bookmarked episode, newest-saved first.

import EpisodesIndex from './../components/EpisodesIndex.js';
import View          from '/.shared/js/components/View.js';

const app = zugriff.app;

export default function SavedView () {
  const list = app.db.savedEpisodes;

  const empty = {
    icon  : 'bookmarks',
    title : 'Your list is empty',
    hint  : 'Tap the bookmark on any episode to keep it here.',
  };

  return html`
    <${View}>
      <header><h1>Listen later</h1></header>
      <${EpisodesIndex} episodes=${list} empty=${empty} />
    </${View}>
  `;
}
