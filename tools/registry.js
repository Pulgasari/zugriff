// tools/registry.js
//
// the single source of truth for what an app is called and how it shows up.
// the launcher renders this list, and every app pulls its own entry from here
// via app.config.js — this is what /apps.json + the php index used to do.
//
// adding an app: copy tools/template/, add an entry here, done.

export const apps = [
  {
    slug        : 'audio-converter',
    name        : 'Audio Converter',
    icon        : 'mdi:waveform',
    description : 'Convert audio files between formats, entirely in the browser.',
    categories  : ['media'],
  },
  {
    slug        : 'audio-cutter',
    name        : 'Audio Cutter',
    icon        : 'mdi:content-cut',
    description : 'Trim an audio file down to the part you actually want.',
    categories  : ['media'],
  },
  {
    slug        : 'audio-snippets-generator',
    name        : 'Audio Snippets',
    short_name  : 'Audio Snippets',
    icon        : 'mdi:music-box-multiple-outline',
    description : 'Slice one recording into a batch of evenly cut snippets.',
    categories  : ['media'],
  },
  {
    slug        : 'base64-decoder',
    name        : 'Base64 Decoder',
    icon        : 'material-symbols:key-visualizer',
    description : 'Decode Base64 back into readable text.',
    categories  : ['converter'],
  },
  {
    slug        : 'base64-encoder',
    name        : 'Base64 Encoder',
    icon        : 'material-symbols:key-visualizer',
    description : 'Encode text as Base64.',
    categories  : ['converter'],
  },
  {
    slug        : 'colorpicker',
    name        : 'Colorpicker',
    icon        : 'streamline-ultimate:color-palette',
    description : 'Pick a colour and read it back in every notation.',
    categories  : ['design'],
  },
  {
    slug        : 'css-minifyer',
    name        : 'CSS Minifyer',
    icon        : 'devicon-plain:css',
    description : 'Shrink CSS with csso.',
    categories  : ['minifier'],
  },
  {
    slug        : 'csv-converter',
    name        : 'CSV Converter',
    icon        : 'mdi:table',
    description : 'Turn CSV into JSON, YAML, TOML or a JS object.',
    categories  : ['converter'],
  },
  {
    slug        : 'csv-inspector',
    name        : 'CSV Inspector',
    icon        : 'mdi:table-search',
    description : 'Browse CSV as a searchable tree.',
    categories  : ['inspector'],
  },
  {
    slug        : 'downloader',
    name        : 'Downloader',
    icon        : 'material-symbols:download',
    description : 'Fetch a file by URL and save it locally.',
    categories  : ['tool'],
  },
  {
    slug        : 'html-minifyer',
    name        : 'HTML Minifyer',
    icon        : 'fa:html5',
    description : 'Shrink HTML with html-minifier-terser.',
    categories  : ['minifier'],
  },
  {
    slug        : 'icon-generator',
    name        : 'Icon Generator',
    icon        : 'mdi:image-size-select-large',
    description : 'Render an SVG into the PNG app icons a manifest needs.',
    categories  : ['tool', 'design'],
  },
  {
    slug        : 'image-batch-processor',
    name        : 'Image Batch Processor',
    short_name  : 'Image Batch',
    icon        : 'mdi:image-multiple-outline',
    description : 'Resize, crop and convert a whole pile of images at once.',
    categories  : ['image'],
  },
  {
    slug        : 'image-converter',
    name        : 'Image Converter',
    icon        : 'mdi:image-sync-outline',
    description : 'Convert images to JPG, PNG or WebP.',
    categories  : ['image', 'converter'],
  },
  {
    slug        : 'js-minifyer',
    name        : 'JS Minifyer',
    icon        : 'akar-icons:javascript-fill',
    description : 'Shrink JavaScript with terser.',
    categories  : ['minifier'],
  },
  {
    slug        : 'json-converter',
    name        : 'JSON Converter',
    icon        : 'mdi:code-json',
    description : 'Turn JSON into CSV, YAML, TOML or a JS object.',
    categories  : ['converter'],
  },
  {
    slug        : 'json-formatter',
    name        : 'JSON Formatter',
    icon        : 'mdi:code-braces',
    description : 'Pretty-print JSON with the indentation you want.',
    categories  : ['formatter'],
  },
  {
    slug        : 'json-inspector',
    name        : 'JSON Inspector',
    icon        : 'mdi:code-json',
    description : 'Browse JSON as a searchable tree.',
    categories  : ['inspector'],
  },
  {
    slug        : 'json-minifyer',
    name        : 'JSON Minifyer',
    icon        : 'mdi:code-json',
    description : 'Strip every byte of whitespace out of JSON.',
    categories  : ['minifier'],
  },
  {
    slug        : 'password-generator',
    name        : 'Password Generator',
    short_name  : 'Passwords',
    icon        : 'mdi:lock-outline',
    description : 'Generate passwords from crypto-grade randomness.',
    categories  : ['generator'],
  },
  {
    slug        : 'pdf-extractor',
    name        : 'PDF Extractor',
    icon        : 'mdi:file-pdf-box',
    description : 'Pull text, pages and images out of a PDF.',
    categories  : ['document'],
  },
  {
    slug        : 'pixel-art-creator',
    name        : 'Pixel Art Creator',
    short_name  : 'Pixel Art',
    icon        : 'mdi:grid',
    description : 'Draw pixel art on a grid and export it as SVG or PNG.',
    categories  : ['design'],
  },
  {
    slug        : 'prompt-manager',
    name        : 'Prompt Manager',
    icon        : 'mingcute:ai-fill',
    description : 'Keep, tag and search your prompts — stored on this device.',
    categories  : ['tool'],
  },
  {
    slug        : 'svg-converter',
    name        : 'SVG Converter',
    icon        : 'mdi:svg',
    description : 'Rasterise SVG to PNG at any size.',
    categories  : ['image', 'converter'],
  },
  {
    slug        : 'svg-pixel-pattern-generator',
    name        : 'SVG Pixel Pattern Generator',
    short_name  : 'Pixel Patterns',
    icon        : 'mdi:dots-grid',
    description : 'Build tileable pixel patterns and export them as SVG.',
    categories  : ['design', 'generator'],
  },
  {
    slug        : 'toml-converter',
    name        : 'TOML Converter',
    icon        : 'mdi:file-cog-outline',
    description : 'Turn TOML into JSON, CSV, YAML or a JS object.',
    categories  : ['converter'],
  },
  {
    slug        : 'toml-inspector',
    name        : 'TOML Inspector',
    icon        : 'mdi:file-search-outline',
    description : 'Browse TOML as a searchable tree.',
    categories  : ['inspector'],
  },
  {
    slug        : 'uuid-generator',
    name        : 'UUID Generator',
    icon        : 'mdi:identifier',
    description : 'Generate UUIDs in bulk and copy them out.',
    categories  : ['generator'],
  },
  {
    slug        : 'xml-minifyer',
    name        : 'XML Minifyer',
    icon        : 'mdi:xml',
    description : 'Strip whitespace and comments out of XML.',
    categories  : ['minifier'],
  },
  {
    slug        : 'yaml-converter',
    name        : 'YAML Converter',
    icon        : 'mdi:file-document-outline',
    description : 'Turn YAML into JSON, CSV, TOML or a JS object.',
    categories  : ['converter'],
  },
  {
    slug        : 'yaml-inspector',
    name        : 'YAML Inspector',
    icon        : 'mdi:file-search-outline',
    description : 'Browse YAML as a searchable tree.',
    categories  : ['inspector'],
  },
];

// ── defaults every app inherits ────────────────────────────────────────────

export const defaults = {
  lang        : 'en',
  theme       : 'dracula',
  dir         : 'ltr',
  display     : 'standalone',
  orientation : 'portrait',
  viewport    : 'width=device-width, initial-scale=1, viewport-fit=cover',
};

const withDefaults = entry => ({
  ...defaults,
  ...entry,
  short_name : entry.short_name ?? entry.name,
  id         : entry.id         ?? entry.slug.replace(/-/g, '_'),
});

export const registry = apps.map(withDefaults);

export const bySlug = Object.fromEntries(registry.map(entry => [entry.slug, entry]));

/** the entry for one app — throws early rather than rendering a nameless app */
export function appMeta (slug) {
  const entry = bySlug[slug];
  if (!entry) throw new Error(`[registry] no app "${slug}"`);
  return entry;
}

export const categories = [...new Set(registry.flatMap(entry => entry.categories ?? []))].sort();

export default registry;
