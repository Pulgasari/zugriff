// apps/videos/routes/index.js
// the route table — id + nav metadata + component, in nav order. the shared router
// (see app.js) resolves ?mode= against these and renders the active one.

import LibraryRoute from './library.js';
import PlayerRoute  from './player.js';
import EditRoute    from './edit.js';

export const routes = [
  { id: 'library', label: 'Library', icon: 'mdi:folder-multiple-outline', component: LibraryRoute },
  { id: 'player',  label: 'Player',  icon: 'mdi:play-circle-outline',     component: PlayerRoute },
  { id: 'edit',    label: 'Edit',    icon: 'mdi:movie-edit-outline',      component: EditRoute },
];

export default routes;
