// shared/js/registry.js
// ---------------------
// registry.get('ebooks')     -> the resolved entry, or null
// registry.getAll('tool')    -> every tool entry (omit the arg for all)
// registry.categories('app') -> sorted, de-duped categories for that kind

const defaults = {
  lang        : 'en',
  theme       : 'dracula',
  color       : '#282a36',     // theme_color / background_color for the manifest + <meta theme-color>
  dir         : 'ltr',
  display     : 'standalone',
  viewport    : 'width=device-width, initial-scale=1, viewport-fit=cover',
  aufbau      : { elements: { mode: 'auto' } },
};

// settings every app carries, predefined here so the shared Settings panel can
// render them for any app without the app spelling them out. `font` is an enum
// whose values are filled from @aufbau/webfonts at runtime — this module stays
// import-free so the node asset generator can read it, so the catalog is folded
// in on the browser side (shared/js/lib/settings.js), not here.
export const appSettingsSchema = {
  font : { type: 'enum', look: 'combobox', source: 'webfonts', values: [], default: '' },
  dir  : { type: 'enum', values: ['ltr', 'rtl'], default: 'ltr' },
};

// defaults that differ by kind
const typeDefaults = {
  app  : { base: 'apps', orientation: 'any',     settings: appSettingsSchema },   // apps aren't locked to portrait
  tool : {               orientation: 'portrait' },
};

// ── the entries ────────────────────────────────
const entries = [

  // ── apps
  {
    type        : 'app',
    slug        : 'files',
    name        : 'File Explorer',
    short_name  : 'Files',
    icon        : 'mdi:folder-outline',
    description : 'Grant a folder from your device and browse it — the folder is the root, nothing leaves your machine.',
    categories  : ['files'],
  },
  {
    type        : 'app',
    slug        : 'code',
    name        : 'Code',
    short_name  : 'Code',
    icon        : 'mdi:code-braces',
    description : 'A mobile-first code editor — edit a local folder or your GitHub repos with Monaco, a code keyboard and a command palette.',
    categories  : ['code', 'files'],
  },
  {
    type        : 'app',
    slug        : 'image-editor',
    name        : 'Image Editor',
    short_name  : 'Editor',
    icon        : 'mdi:image-edit-outline',
    description : 'Crop, rotate, flip and adjust images — all on your device.',
    categories  : ['image'],
  },
  {
    type        : 'app',
    slug        : 'gifmaker',
    name        : 'Gifmaker',
    icon        : 'mdi:animation-play-outline',
    description : 'Turn a stack of images into an animation — nudge, reorder, export as GIF or a project zip.',
    categories  : ['image'],
  },
  {
    type        : 'app',
    slug        : 'image-viewer',
    name        : 'Image Viewer',
    short_name  : 'Viewer',
    icon        : 'mdi:image-outline',
    description : 'Open and view images — set it as your device’s image opener, or drop files straight in.',
    categories  : ['image'],
    // registers the installed PWA as a handler for image files, so Android (and
    // desktop) can "open with" it; the launched files arrive via launchQueue.
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
    },
  },
  {
    type        : 'app',
    slug        : 'images',
    name        : 'Images',
    short_name  : 'Images',
    icon        : 'mdi:image-multiple-outline',
    description : 'View, edit, convert and batch-process images, and browse image folders — all on your device.',
    categories  : ['image'],
    // one app, several modes switched by ?mode= (a query param, not a subpath —
    // the launcher rewrite only serves the shell for /images/). it registers as
    // an image handler, like the viewer, so the OS "open with" sends files here;
    // the shortcuts deep-link a mode.
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
  {
    type        : 'app',
    slug        : 'podcasts',
    name        : 'Podcasts',
    icon        : 'mdi:podcast',
    description : 'Subscribe by RSS, play episodes, track progress, mark them done and keep a listen-later list.',
    categories  : ['media'],
    autopack    : true,   // built into an Android package by the build-android workflow
  },
  {
    type        : 'app',
    slug        : 'feeds',
    name        : 'RSS Reader',
    short_name  : 'Feeds',
    icon        : 'mdi:rss',
    description : 'Follow RSS/Atom feeds, skim the latest across all of them, and jump to the original — YouTube channels get their own section.',
    categories  : ['media'],
  },
  {
    type        : 'app',
    slug        : 'audio-manager',
    name        : 'Audio Manager',
    short_name  : 'Music',
    icon        : 'mdi:music-box-multiple-outline',
    description : 'Grant your music folders and browse the library by song, album and artist — ID3 tags and cover art read on device.',
    categories  : ['media'],
  },
  {
    type        : 'app',
    slug        : 'icons',
    name        : 'Icons',
    short_name  : 'Icons',
    icon        : 'mdi:emoticon-outline',
    description : 'Browse and search the whole Iconify library by set, copy or download any icon, and keep favourites.',
    categories  : ['design'],
  },
  {
    type        : 'app',
    slug        : 'notes',
    name        : 'Notes',
    icon        : 'mdi:notebook-outline',
    description : 'Open a folder of Markdown files and read it as a live, foldered notebook — the folder tree is the outline.',
    categories  : ['files', 'docs'],
    autopack    : true,   // built into an Android package by the build-android workflow
  },
  {
    type        : 'app',
    slug        : 'ebooks',
    name        : 'eBooks',
    icon        : 'mdi:bookshelf',
    description : 'Point it at your book folders and read your EPUB and PDF library — covers, search and remembered reading position.',
    categories  : ['docs', 'media'],
  },
  {
    type        : 'app',
    slug        : 'videoplayer',
    name        : 'Video Player',
    short_name  : 'Video',
    icon        : 'mdi:play-circle-outline',
    description : 'Open a video off your device and play it — frame-stepping, loop, crop, mirror, rotate and reverse, tuned for the phone.',
    categories  : ['media'],
  },
  {
    type        : 'app',
    slug        : 'prompts',
    name        : 'Prompt Manager',
    short_name  : 'Prompts',
    icon        : 'mingcute:ai-fill',
    description : 'Keep, tag and search your prompts — stored on this device.',
    categories  : ['tool'],
  },

  // ── tools ───────────────────────────────────────────────────────────────
  {
    type        : 'tool',
    slug        : 'audio-converter',
    name        : 'Audio Converter',
    icon        : 'mdi:waveform',
    description : 'Convert audio files between formats, entirely in the browser.',
    categories  : ['media'],
  },
  {
    type        : 'tool',
    slug        : 'audio-cutter',
    name        : 'Audio Cutter',
    icon        : 'mdi:content-cut',
    description : 'Trim an audio file down to the part you actually want.',
    categories  : ['media'],
  },
  {
    type        : 'tool',
    slug        : 'audio-snippets-generator',
    name        : 'Audio Snippets',
    short_name  : 'Audio Snippets',
    icon        : 'mdi:music-box-multiple-outline',
    description : 'Slice one recording into a batch of evenly cut snippets.',
    categories  : ['media'],
  },
  {
    type        : 'tool',
    slug        : 'base64-decoder',
    name        : 'Base64 Decoder',
    icon        : 'material-symbols:key-visualizer',
    description : 'Decode Base64 back into readable text.',
    categories  : ['converter'],
  },
  {
    type        : 'tool',
    slug        : 'base64-encoder',
    name        : 'Base64 Encoder',
    icon        : 'material-symbols:key-visualizer',
    description : 'Encode text as Base64.',
    categories  : ['converter'],
  },
  {
    type        : 'tool',
    slug        : 'colorpicker',
    name        : 'Colorpicker',
    icon        : 'streamline-ultimate:color-palette',
    description : 'Pick a colour and read it back in every notation.',
    categories  : ['design'],
  },
  {
    type        : 'tool',
    slug        : 'css-minifyer',
    name        : 'CSS Minifyer',
    icon        : 'devicon-plain:css',
    description : 'Shrink CSS with csso.',
    categories  : ['minifier'],
  },
  {
    type        : 'tool',
    slug        : 'csv-converter',
    name        : 'CSV Converter',
    icon        : 'mdi:table',
    description : 'Turn CSV into JSON, YAML, TOML or a JS object.',
    categories  : ['converter'],
  },
  {
    type        : 'tool',
    slug        : 'csv-inspector',
    name        : 'CSV Inspector',
    icon        : 'mdi:table-search',
    description : 'Browse CSV as a searchable tree.',
    categories  : ['inspector'],
  },
  {
    type        : 'tool',
    slug        : 'downloader',
    name        : 'Downloader',
    icon        : 'material-symbols:download',
    description : 'Fetch a file by URL and save it locally.',
    categories  : ['tool'],
  },
  {
    type        : 'tool',
    slug        : 'html-minifyer',
    name        : 'HTML Minifyer',
    icon        : 'fa:html5',
    description : 'Shrink HTML with html-minifier-terser.',
    categories  : ['minifier'],
  },
  {
    type        : 'tool',
    slug        : 'icon-generator',
    name        : 'Icon Generator',
    icon        : 'mdi:image-size-select-large',
    description : 'Render an SVG into the PNG app icons a manifest needs.',
    categories  : ['tool', 'design'],
  },
  {
    type        : 'tool',
    slug        : 'image-batch-processor',
    name        : 'Image Batch Processor',
    short_name  : 'Image Batch',
    icon        : 'mdi:image-multiple-outline',
    description : 'Resize, crop and convert a whole pile of images at once.',
    categories  : ['image'],
  },
  {
    type        : 'tool',
    slug        : 'image-converter',
    name        : 'Image Converter',
    icon        : 'mdi:image-sync-outline',
    description : 'Convert images to JPG, PNG or WebP.',
    categories  : ['image', 'converter'],
  },
  {
    type        : 'tool',
    slug        : 'js-minifyer',
    name        : 'JS Minifyer',
    icon        : 'akar-icons:javascript-fill',
    description : 'Shrink JavaScript with terser.',
    categories  : ['minifier'],
  },
  {
    type        : 'tool',
    slug        : 'json-converter',
    name        : 'JSON Converter',
    icon        : 'mdi:code-json',
    description : 'Turn JSON into CSV, YAML, TOML or a JS object.',
    categories  : ['converter'],
  },
  {
    type        : 'tool',
    slug        : 'json-formatter',
    name        : 'JSON Formatter',
    icon        : 'mdi:code-braces',
    description : 'Pretty-print JSON with the indentation you want.',
    categories  : ['formatter'],
  },
  {
    type        : 'tool',
    slug        : 'json-inspector',
    name        : 'JSON Inspector',
    icon        : 'mdi:code-json',
    description : 'Browse JSON as a searchable tree.',
    categories  : ['inspector'],
  },
  {
    type        : 'tool',
    slug        : 'json-minifyer',
    name        : 'JSON Minifyer',
    icon        : 'mdi:code-json',
    description : 'Strip every byte of whitespace out of JSON.',
    categories  : ['minifier'],
  },
  {
    type        : 'tool',
    slug        : 'password-generator',
    name        : 'Password Generator',
    short_name  : 'Passwords',
    icon        : 'mdi:lock-outline',
    description : 'Generate passwords from crypto-grade randomness.',
    categories  : ['generator'],
  },
  {
    type        : 'tool',
    slug        : 'pdf-extractor',
    name        : 'PDF Extractor',
    icon        : 'mdi:file-pdf-box',
    description : 'Pull text, pages and images out of a PDF.',
    categories  : ['document'],
  },
  {
    type        : 'tool',
    slug        : 'pixel-art-creator',
    name        : 'Pixel Art Creator',
    short_name  : 'Pixel Art',
    icon        : 'mdi:grid',
    description : 'Draw pixel art on a grid and export it as SVG or PNG.',
    categories  : ['design'],
  },
  {
    type        : 'tool',
    slug        : 'svg-converter',
    name        : 'SVG Converter',
    icon        : 'mdi:svg',
    description : 'Rasterise SVG to PNG at any size.',
    categories  : ['image', 'converter'],
  },
  {
    type        : 'tool',
    slug        : 'svg-pixel-pattern-generator',
    name        : 'SVG Pixel Pattern Generator',
    short_name  : 'Pixel Patterns',
    icon        : 'mdi:dots-grid',
    description : 'Build tileable pixel patterns and export them as SVG.',
    categories  : ['design', 'generator'],
  },
  {
    type        : 'tool',
    slug        : 'toml-converter',
    name        : 'TOML Converter',
    icon        : 'mdi:file-cog-outline',
    description : 'Turn TOML into JSON, CSV, YAML or a JS object.',
    categories  : ['converter'],
  },
  {
    type        : 'tool',
    slug        : 'toml-inspector',
    name        : 'TOML Inspector',
    icon        : 'mdi:file-search-outline',
    description : 'Browse TOML as a searchable tree.',
    categories  : ['inspector'],
  },
  {
    type        : 'tool',
    slug        : 'uuid-generator',
    name        : 'UUID Generator',
    icon        : 'mdi:identifier',
    description : 'Generate UUIDs in bulk and copy them out.',
    categories  : ['generator'],
  },
  {
    type        : 'tool',
    slug        : 'xml-minifyer',
    name        : 'XML Minifyer',
    icon        : 'mdi:xml',
    description : 'Strip whitespace and comments out of XML.',
    categories  : ['minifier'],
  },
  {
    type        : 'tool',
    slug        : 'yaml-converter',
    name        : 'YAML Converter',
    icon        : 'mdi:file-document-outline',
    description : 'Turn YAML into JSON, CSV, TOML or a JS object.',
    categories  : ['converter'],
  },
  {
    type        : 'tool',
    slug        : 'yaml-inspector',
    name        : 'YAML Inspector',
    icon        : 'mdi:file-search-outline',
    description : 'Browse YAML as a searchable tree.',
    categories  : ['inspector'],
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
