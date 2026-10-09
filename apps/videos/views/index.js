// apps/videos/views/index.js
// the modes, in nav order: id, nav label and icon, the view

import LibraryMode from './library.js';
import PlayerMode  from './player.js';
import EditMode    from './edit.js';

export const modes = [
  { id: 'library', label: 'Library', icon: 'mdi:folder-multiple-outline', view: LibraryMode },
  { id: 'player',  label: 'Player',  icon: 'mdi:play-circle-outline',     view: PlayerMode },
  { id: 'edit',    label: 'Edit',    icon: 'mdi:movie-edit-outline',      view: EditMode },
];

export default modes;
