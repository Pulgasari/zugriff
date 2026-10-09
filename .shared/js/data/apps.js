// .shared/js/data/apps.js
// ---------------------
// registry.get('ebooks')     -> the resolved entry, or null
// registry.getAll('app')     -> every app entry (omit the arg for all)
// registry.categories('app') -> sorted, de-duped categories for that kind

const defaults = {
  lang        : 'en',
  theme       : 'dracula',
  color       : '#282a36',     // theme_color / background_color for the manifest + <meta theme-color>
  dir         : 'ltr',
  display     : 'standalone',
  viewport    : 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  aufbau      : { elements: { mode: 'auto' } },
};

// settings every app carries, predefined here so the shared Settings can render
// them for any app without the app spelling them out. `font` is an enum whose
// values are filled from @aufbau/webfonts at runtime — this module stays
// import-free so the node asset generator can read it, so the catalog is folded
// in on the browser side (components/Settings.js, `source: 'webfonts'`), not here.
export const appSettingsSchema = {
  font : { type: 'enum', look: 'combobox', source: 'webfonts', values: [], default: '' },
  dir  : { type: 'enum', values: ['ltr', 'rtl'], default: 'ltr' },
};

// defaults that differ by kind
const typeDefaults = {
  app  : { base: 'apps', orientation: 'any',     settings: appSettingsSchema },   // apps aren't locked to portrait
};

// ── the entries ────────────────────────────────
const entries = [

  // ── apps
  { // zugriff.dev/audio-manager/
    build       : { android: ['capacitor', 'capacitor-live'] },
    type        : 'app',
    slug        : 'audio-manager',
    name        : 'Audio Manager',
    short_name  : 'Music',
    icon        : 'mdi:music-box-multiple-outline',
    description : 'Grant your music folders and browse the library by song, album and artist — ID3 tags and cover art read on device.',
    categories  : ['media'],
  },
  { // zugriff.dev/cli/
    type        : 'app',
    slug        : 'cli',
    name        : 'CLI',
    short_name  : 'CLI',
    icon        : 'mdi:console',
    description : 'A terminal in the browser: files in the origin private file system, wasm tools run in a worker.',
    categories  : ['code', 'files'],
  },
  { // zugriff.dev/code/
    build       : { android: ['capacitor', 'capacitor-live'] },
    categories  : ['code', 'files'],
    description : 'A mobile-first code editor — edit a local folder or your GitHub repos with Monaco, a code keyboard and a command palette.',    
    icon        : 'mdi:code-braces',
    name        : 'Code',
    short_name  : 'Code',
    slug        : 'code',
    type        : 'app',
  },
  { // zugriff.dev/downloader/
    build       : { android: ['capacitor', 'capacitor-live'] },
    type        : 'app',
    slug        : 'downloader',
    name        : 'Downloader',
    icon        : 'lucide:download-cloud',
    description : 'Paste or share links, they become packages: a queue fetches them resumably and puts the files where they belong.',
    categories  : ['files', 'network'],
    manifest    : {
      launch_handler : { client_mode: ['focus-existing', 'auto'] },
      share_target   : { action: './', method: 'GET', params: { text: 'text', title: 'title', url: 'url' } },
    },
  },
  { // zugriff.dev/ebooks/
    build       : { android: ['capacitor', 'capacitor-live'] },
    type        : 'app',
    slug        : 'ebooks',
    name        : 'eBooks',
    icon        : 'mdi:bookshelf',
    description : 'Point it at your book folders and read your EPUB and PDF library — covers, search and remembered reading position.',
    categories  : ['docs', 'media'],
  },
  { // zugriff.dev/feeds/
    build       : { android: ['capacitor', 'capacitor-live'] },
    type        : 'app',
    slug        : 'feeds',
    name        : 'RSS Reader',
    short_name  : 'Feeds',
    icon        : 'mdi:rss',
    description : 'Follow RSS/Atom feeds, skim the latest across all of them, and jump to the original — YouTube channels get their own section.',
    categories  : ['media'],
  },
  { // zugriff.dev/files/
    build       : { android: ['capacitor', 'capacitor-live'], plugins: ['filesync'] },
    categories  : ['files'],
    description : 'Grant a folder from your device and browse it — the folder is the root, nothing leaves your machine.',
    geometry    : 'pill',
    icon        : 'mdi:folder-outline',
    name        : 'File Explorer',
    palette     : 'synthwave',
    short_name  : 'Files',
    skin        : 'andromeda',
    slug        : 'files',
    type        : 'app',
  },
  { // zugriff.dev/icons/
    build       : { android: ['capacitor', 'capacitor-live'] },
    categories  : ['design'],
    type        : 'app',
    slug        : 'icons',
    name        : 'Icons',
    short_name  : 'Icons',
    icon        : 'mdi:emoticon-outline',
    description : 'Browse and search the whole Iconify library by set, copy or download any icon, and keep favourites.',
  },
  { // zugriff.dev/images/
    build       : { android: ['capacitor', 'capacitor-live'] },
    type        : 'app',
    slug        : 'images',
    name        : 'Images',
    short_name  : 'Images',
    icon        : 'mdi:image-multiple-outline',
    description : 'View, edit, convert and batch-process images, and browse image folders — all on your device.',
    categories  : ['image'],
    manifest    : {
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
    },
  },
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
  { // zugriff.dev/notes/
    build       : { android: ['capacitor', 'capacitor-live'] },
    type        : 'app',
    slug        : 'notes',
    name        : 'Notes',
    icon        : 'mdi:notebook-outline',
    description : 'Open a folder of Markdown files and read it as a live, foldered notebook — the folder tree is the outline.',
    categories  : ['files', 'docs'],
  },
  { // zugriff.dev/podcasts/
    build       : { android: ['capacitor', 'capacitor-live'] },
    type        : 'app',
    slug        : 'podcasts',
    name        : 'Podcasts',
    icon        : 'mdi:podcast',
    description : 'Subscribe by RSS, play episodes, track progress, mark them done and keep a listen-later list.',
    categories  : ['media'],
  },
  { // zugriff.dev/prompts/
    build       : { android: ['capacitor', 'capacitor-live'] },
    type        : 'app',
    slug        : 'prompts',
    name        : 'Prompt Manager',
    short_name  : 'Prompts',
    icon        : 'mingcute:ai-fill',
    description : 'Keep, tag and search your prompts — stored on this device.',
    categories  : ['tool'],
  },
  { // zugriff.dev/todo/
    build       : { android: ['capacitor', 'capacitor-live'] },
    type        : 'app',
    slug        : 'todo',
    name        : 'Todo',
    icon        : 'lucide:list-checks',
    description : 'Tasks for one person, offline: typed in one line, ticked with a swipe, synced through a folder or webdav.',
    categories  : ['productivity'],
  },
  { // zugriff.dev/tools/
    type        : 'app',
    slug        : 'tools',
    name        : 'Tools',
    icon        : 'mdi:toolbox-outline',
    description : 'Small tools in one place: convert, format, inspect, minify, generate — all in the browser.',
    categories  : ['tool'],
  },
  { // zugriff.dev/videos/
    build       : { android: ['capacitor', 'capacitor-live'] },
    type        : 'app',
    slug        : 'videos',
    name        : 'Videos',
    short_name  : 'Videos',
    icon        : 'mdi:movie-open-outline',
    description : 'Browse your video folders, play them, and make quick edits — trim, rotate, flip — all on your device.',
    categories  : ['media'],
    manifest    : {
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
    },
  },

];

// ── normalise + index ────────────────────────────────────────────────────────

const normalize = e => ({
  ...defaults,
  ...typeDefaults[e.type],
  ...e,
  short_name : e.short_name ?? e.name,
  id         : e.id         ?? e.slug.replace(/-/g, '_'),
  categories : e.categories ?? [],
});

const all = entries.map(normalize);
const map = new Map(all.map(e => [e.slug, e]));

const list = type => (type ? all.filter(e => e.type === type) : all);

export const registry = {
  has        : slug => map.has(slug),
  get        : slug => map.get(slug) ?? null,
  getAll     : type => list(type),
  categories : type => [...new Set(list(type).flatMap(e => e.categories))].sort(),
};

export { defaults };
export default registry;
