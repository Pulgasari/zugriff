// .shared/js/data/apps.js
// ---------------------
// registry.get('ebooks')     -> the resolved entry, or null
// registry.getAll('app')     -> every app entry (omit the arg for all)
// registry.categories('app') -> sorted, de-duped categories for that kind

const defaults = {
  base        : 'apps',
  build       : { android: ['capacitor', 'capacitor-live'] },
  color       : '#282a36', // theme_color / background_color for the manifest + <meta theme-color>
  dir         : 'ltr',
  display     : 'standalone',
  icon        : 'mdi:music-box-multiple-outline', // deprecated ???
  lang        : 'en',
  orientation : 'any',
  palette     : 'zombie',
  type        : 'app', // deprecated ???
  viewport    : 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  aufbau      : { elements: { mode: 'auto' } },
  // settings every app carries, predefined here so the shared Settings can render
  // them for any app without the app spelling them out. `font` is an enum whose
  // values are filled from @aufbau/webfonts at runtime — this module stays
  // import-free so the node asset generator can read it, so the catalog is folded
  // in on the browser side (components/Settings.js, `source: 'webfonts'`), not here.
  settings    : {
    dir  : { type: 'enum', look: 'segments', default: 'ltr',     values: ['ltr', 'rtl'], },
    font : { type: 'enum', look: 'combobox', default: 'manrope', values: [], source: 'webfonts' },
  },
};

const apps = {
  audio      : { name: 'Audio',      categories: ['media'],            description : 'An audio files manager and player.' },
  cli        : { name: 'CLI',        categories: ['code', 'files'],    description : 'A terminal in the browser: files in the origin private file system, wasm tools run in a worker.' },
  code       : { name: 'Code',       categories: ['code', 'files'],    description : 'A code editor.' },
  downloader : { name: 'Downloader', categories: ['files', 'network'], description : 'A downloads manager.' },
  ebooks     : { name: 'eBooks',     categories: ['media'],            description : 'An eBooks manager and reader.' },
  feeds      : { name: 'feeds',      categories: ['docs', 'media'],    description : 'A RSS/atom feeds manager and reader.' },
  files      : { name: 'files',      categories: ['files'],            description : 'A files manager.' },
  icons      : { name: 'icons',      categories: ['design'],           description : 'An iconify browser.' },
  images     : { name: 'images',     categories: ['image'],            description : 'An images manager, viewer and editor.' },
  notes      : { name: 'Notes',      categories: ['docs', 'files'],    description : 'A notes manager based on markdown.' },
  podcasts   : { name: 'Podcasts',   categories: ['media'],            description : 'A podcasts manager and player.' },
  prompts    : { name: 'Prompts',    categories: ['tool'],             description : 'A prompts manager.' },
  todo       : { name: 'Todo',       categories: ['productivity'],     description : 'A todo/tasks manager.' },
  tools      : { name: 'Tools',      categories: ['tool'],             description : 'A collection of micro-tools.' },
  videos     : { name: 'Videos',     categories: ['media'],            description : 'A videos manager and player.' },
};

apps.downloader.manifest = {
  launch_handler : { client_mode: ['focus-existing', 'auto'] },
  share_target   : { action: './', method: 'GET', params: { text: 'text', title: 'title', url: 'url' } },
};

apps.files.geometry = 'pill';
apps.files.palette  = 'synthwave';
apps.files.skin     = 'andromeda';
apps.files.plugins  = ['filesync'];
apps.files.manifest = {
  launch_handler : { client_mode: ['focus-existing', 'auto'] },
  file_handlers  : [{
    action : './',
    accept : {
      'image/png'    : ['.png'],
      'image/jpeg'   : ['.jpg', '.jpeg', '.jfif'],
      'image/gif'    : ['.gif'],
      'image/webp'   : ['.webp'],
      'image/avif'   : ['.avif'],
      'image/bmp'    : ['.bmp'],
      'image/svg+xml': ['.svg'],
      'image/x-icon' : ['.ico'],
      'image/heic'   : ['.heic'],
      'image/heif'   : ['.heif'],
      'image/tiff'   : ['.tif', '.tiff'],
    },
  }],
  shortcuts : [
    { name: 'Library', short_name: 'Library', url: './?mode=library' },
    { name: 'Edit',    short_name: 'Edit',    url: './?mode=edit'    },
    { name: 'Convert', short_name: 'Convert', url: './?mode=convert' },
    { name: 'Batch',   short_name: 'Batch',   url: './?mode=batch'   },
  ],
};

apps.videos.manifest = {
  launch_handler : { client_mode: ['focus-existing', 'auto'] },
  file_handlers  : [{
    action : './',
    accept : {
      'video/mp4'         : ['.mp4', '.m4v'],
      'video/webm'        : ['.webm'],
      'video/quicktime'   : ['.mov'],
      'video/x-matroska'  : ['.mkv'],
      'video/x-msvideo'   : ['.avi'],
      'video/ogg'         : ['.ogv'],
      'video/mpeg'        : ['.mpg', '.mpeg'],
    },
  }],
  shortcuts : [
    { name: 'Library', short_name: 'Library', url: './?mode=library' },
    { name: 'Player',  short_name: 'Player',  url: './?mode=player'  },
    { name: 'Edit',    short_name: 'Edit',    url: './?mode=edit'    },
  ],
};

const entries = [
  { // zugriff.dev/looksmaxx/
    type        : 'app',
    slug        : 'looksmaxx',
    name        : 'Looksmaxx',
    short_name  : 'Looksmaxx',
    icon        : 'mdi:face-woman-shimmer',
    description : 'Load a photo and try on hair colours and hairstyles — MediaPipe hair segmentation, all on your device.',
    categories  : ['image'],
    color       : '#1e1b2e',
  },

];

// ── normalise + index ────────────────────────────────────────────────────────

    slug        : 'audio-manager',
    short_name  : 'Music',
    
const normalize = entry => ({
  ...defaults,
  ...typeDefaults[entry.type],
  ...entry,
  short_name : entry.short_name ?? entry.name,
  id         : entry.id         ?? entry.slug.replace(/-/g, '_'),
  categories : entry.categories ?? [],
});

const all  = entries.map(normalize);
const map  = new Map(all.map(e => [e.slug, e]));
const list = type => (type ? all.filter(e => e.type === type) : all);

const registry = {
  has        : slug => map.has(slug),
  get        : slug => map.get(slug) ?? null,
  getAll     : type => list(type),
  categories : type => [...new Set(list(type).flatMap(e => e.categories))].sort(),
};

export { defaults, registry };
export default registry;
