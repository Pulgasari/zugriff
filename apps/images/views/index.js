// apps/images/views/index.js
// the modes, in nav order: id, nav label and icon, the view

import LibraryMode from './library.js';
import ViewMode    from './view.js';
import EditMode    from './edit.js';
import ConvertMode from './convert.js';
import BatchMode   from './batch.js';

export const modes = [
  { id: 'library', label: 'Library', icon: 'mdi:folder-multiple-image',  view: LibraryMode },
  { id: 'view',    label: 'View',    icon: 'mdi:image-outline',          view: ViewMode },
  { id: 'edit',    label: 'Edit',    icon: 'mdi:image-edit-outline',     view: EditMode },
  { id: 'convert', label: 'Convert', icon: 'mdi:image-sync-outline',     view: ConvertMode },
  { id: 'batch',   label: 'Batch',   icon: 'mdi:image-multiple-outline', view: BatchMode },
];

export default modes;
