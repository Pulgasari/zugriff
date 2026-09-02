// apps/images/routes/index.js
// the route table — id + nav metadata + component, in nav order. the shared
// router (see app.js) resolves ?mode= against these and renders the active one.

import LibraryMode from './library.js';
import ViewMode    from './view.js';
import EditMode    from './edit.js';
import ConvertMode from './convert.js';
import BatchMode   from './batch.js';

export const routes = [
  { id: 'library', label: 'Library', icon: 'mdi:folder-multiple-image',  component: LibraryMode },
  { id: 'view',    label: 'View',    icon: 'mdi:image-outline',          component: ViewMode },
  { id: 'edit',    label: 'Edit',    icon: 'mdi:image-edit-outline',     component: EditMode },
  { id: 'convert', label: 'Convert', icon: 'mdi:image-sync-outline',     component: ConvertMode },
  { id: 'batch',   label: 'Batch',   icon: 'mdi:image-multiple-outline', component: BatchMode },
];

export default routes;
