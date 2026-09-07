// apps/prompts/modules/methods.js
// derived views over the library + ui state. plain functions read live off the global
// handle, so calling them inside render subscribes to the leaves they touch (never
// destructure at module top). zugriff.app is the reference point.

const app = () => zugriff.app;

// the prompt list after search / tag filter / sort
export function filteredPrompts () {
  const { db, state } = app();
  const q = state.search.toLowerCase();

  let list = db.prompts.value;
  if (q)             list = list.filter(p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
  if (state.activeTag) list = list.filter(p => p.tags?.includes(state.activeTag));

  return [...list].sort((a, b) => {
    if (state.sortBy === 'name') return a.title.localeCompare(b.title);
    return (b[state.sortBy] ?? 0) - (a[state.sortBy] ?? 0);
  });
}

// the currently selected prompt, or null
export function activePrompt () {
  const { db, state } = app();
  return db.prompts.value.find(p => p.id === state.activeId) ?? null;
}
