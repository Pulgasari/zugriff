// bla/registry.js

export function createRegistry ({ defaults = {}, apps = [] }) {
  // Normalize each entry with fallbacks and default values
  const normalizedApps = apps.map(entry => ({
    ...defaults,
    ...entry,
    short_name : entry.short_name ?? entry.name,
    id         : entry.id         ?? entry.slug.replace(/-/g, '_'),
    categories : entry.categories ?? [],
  }));

  // Create a Map for O(1) lookups
  const map = new Map(normalizedApps.map(app => [app.slug, app]));

  // Extract all unique categories
  const categories = [...new Set(normalizedApps.flatMap(app => app.categories))].sort();   

  // Public Registry API
  const registry = {
    has    : slug => map.has(slug),
    get    : slug => map.get(slug) ?? null,
    getAll : ()   => normalizedApps,
  };

  return {
    categories,
    registry,
  };
}
