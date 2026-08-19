// apps/registry.js
// adding an app: copy apps/template/, add an entry here, done.

import { createRegistry } from './../shared/js/registry.js';

export const { registry, categories } = createRegistry ({
  defaults: {
    base        : 'apps',
    lang        : 'en',
    theme       : 'dracula',
    color       : '#282a36',   // theme_color / background_color for the manifest + <meta theme-color>
    dir         : 'ltr',
    display     : 'standalone',
    orientation : 'any',       // the manifest orientation (apps aren't locked to portrait)
    viewport    : 'width=device-width, initial-scale=1, viewport-fit=cover',
  },

  apps: [
    {
      slug        : 'file-explorer',
      name        : 'File Explorer',
      short_name  : 'Files',
      icon        : 'mdi:folder-outline',
      description : 'Browse the private on-device storage — the same OPFS the cli uses.',
      categories  : ['files'],
    },
    {
      slug        : 'image-editor',
      name        : 'Image Editor',
      short_name  : 'Editor',
      icon        : 'mdi:image-edit-outline',
      description : 'Crop, rotate, flip and adjust images — all on your device.',
      categories  : ['image'],
      autopack    : true,
    },
    {
      slug        : 'gifmaker',
      name        : 'Gifmaker',
      icon        : 'mdi:animation-play-outline',
      description : 'Turn a stack of images into an animation — nudge, reorder, export as GIF or a project zip.',
      categories  : ['image'],
    },
    {
      slug        : 'podcasts',
      name        : 'Podcasts',
      icon        : 'mdi:podcast',
      description : 'Subscribe by RSS, play episodes, track progress, mark them done and keep a listen-later list.',
      categories  : ['media'],
    },
    {
      slug        : 'notes',
      name        : 'Notes',
      icon        : 'mdi:notebook-outline',
      description : 'Open a folder of Markdown files and read it as a live, foldered notebook — the folder tree is the outline.',
      categories  : ['files', 'docs'],
    },
    {
      slug        : 'ebooks',
      name        : 'eBooks',
      icon        : 'mdi:bookshelf',
      description : 'Point it at your book folders and read your EPUB and PDF library — covers, search and remembered reading position.',
      categories  : ['docs', 'media'],
    },
  ],
});

export default registry;


/*
export const defaults = {
  base        : 'apps',
  lang        : 'en',
  theme       : 'dracula',
  dir         : 'ltr',
  display     : 'standalone',
  orientation : 'portrait',
  viewport    : 'width=device-width, initial-scale=1, viewport-fit=cover',
};

export const podcasts = {
  ...defaults,
  id          : 'podcasts',
  slug        : 'podcasts',
  name        : 'Podcasts',
  short_name  : 'Podcasts',
  icon        : 'mdi:podcast',
  description : 'Subscribe by RSS, play episodes, track progress, mark them done and keep a listen-later list.',
  categories  : ['media'],
};

export const apps = [
  {
    slug        : 'file-explorer',
    name        : 'File Explorer',
    short_name  : 'Files',
    icon        : 'mdi:folder-outline',
    description : 'Browse the private on-device storage — the same OPFS the cli uses.',
    categories  : ['files'],
  },
  {
    slug        : 'image-editor',
    name        : 'Image Editor',
    short_name  : 'Editor',
    icon        : 'mdi:image-edit-outline',
    description : 'Crop, rotate, flip and adjust images — all on your device.',
    categories  : ['image'],
  },
  {
    slug        : 'gifmaker',
    name        : 'Gifmaker',
    short_name  : 'Gifmaker',
    icon        : 'mdi:animation-play-outline',
    description : 'Turn a stack of images into an animation — nudge, reorder, export as GIF or a project zip.',
    categories  : ['image'],
  },
  {
    slug        : 'podcasts',
    name        : 'Podcasts',
    short_name  : 'Podcasts',
    icon        : 'mdi:podcast',
    description : 'Subscribe by RSS, play episodes, track progress, mark them done and keep a listen-later list.',
    categories  : ['media'],
  },
];



const withDefaults = entry => ({
  ...defaults,
  ...entry,
  short_name : entry.short_name ?? entry.name,
  id         : entry.id         ?? entry.slug.replace(/-/g, '_'),
});

export const 
registry   = apps.map(withDefaults),
bySlug     = Object.fromEntries(registry.map(entry => [entry.slug, entry])),
//bySlug   = new Map(registry.map(app => [app.slug, app])),
categories = [...new Set(registry.flatMap(entry => entry.categories ?? []))].sort();

export function appMeta (slug) {
  const entry = bySlug[slug];
  if (!entry) throw new Error(`[apps/registry] no app "${slug}"`);
  return entry;
}

export default registry;
*/
