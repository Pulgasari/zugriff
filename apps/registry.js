// apps/registry.js
//
// the single source of truth for the /apps — the same idea as tools/registry.js,
// but a separate list because apps are their own thing: they don't render inside
// the tools shell and they don't link the tools css. the launcher merges both
// lists; each app pulls its own entry from here via app.config.js.
//
// adding an app: copy apps/template/, add an entry here, done.

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
];

// ── defaults every app inherits ────────────────────────────────────────────

export const defaults = {
  base        : 'apps',
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
  if (!entry) throw new Error(`[apps/registry] no app "${slug}"`);
  return entry;
}

export const categories = [...new Set(registry.flatMap(entry => entry.categories ?? []))].sort();

export default registry;
