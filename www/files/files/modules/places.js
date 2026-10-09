// files :: modules/places.js
// what the user marks in the folder: bookmarks, and the type a folder is given.
// both belong to the granted folder they were made in, a different folder
// starts empty. a path is the array of names below the root, [] the root.
//
// folder types: audio, images, documents and videos are built in, more are
// made with a name and an icon. a folder has one type or none; suggest() reads
// a listing and names the category most of its files belong to. what a type
// changes is only its icon for now, a default view per type comes later.

const app = zugriff.app;

app.state.$extend({
  bookmarks   : { type: 'scalar', value: [] },   // [{ folder, name, path }]
  folderTyped : { type: 'scalar', value: {} },   // { 'folder:a/b': typeId }
  folderTypes : { type: 'scalar', value: [] },   // the user's own, [{ icon, id, label }]
});

// :::::: TYPES :::::::::::::::::::::::::::::::::::::::::::::::::

// the built-in ones carry the id of the scan category they stand for
export const BUILTIN = [
  { icon: 'lucide:music',     id: 'audio',     label: 'Audio'     },
  { icon: 'lucide:file-text', id: 'documents', label: 'Documents' },
  { icon: 'lucide:image',     id: 'images',    label: 'Images'    },
  { icon: 'lucide:film',      id: 'video',     label: 'Videos'    },
];

const folderId = () => app.db.folder.value?.addedAt ?? app.db.folder.value?.name ?? '';
const keyOf    = path => `${folderId()}:${path.join('/')}`;

export const types = () => [...BUILTIN, ...app.state.$folderTypes];

export const typeOf = path => {
  const id = app.state.$folderTyped[keyOf(path)];
  return id ? types().find(type => type.id === id) ?? null : null;
};

export function setType (path, id) {
  const typed = { ...app.state.$folderTyped };
  if (id) typed[keyOf(path)] = id;
  else delete typed[keyOf(path)];
  app.state.folderTyped = typed;
}

export function addType ({ icon = 'lucide:folder', label }) {
  const id = `custom-${Date.now().toString(36)}`;
  app.state.folderTypes = [...app.state.$folderTypes, { icon, id, label }];
  return id;
}

// the category most of the files belong to, when it is most of them
export function suggest (entries, categoryOf) {
  const files  = entries.filter(entry => entry.kind === 'file');
  const counts = {};
  for (const entry of files) counts[categoryOf(entry)] = (counts[categoryOf(entry)] ?? 0) + 1;

  const [id, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];
  return id && count / files.length >= 0.6 ? BUILTIN.find(type => type.id === id) ?? null : null;
}

// :::::: BOOKMARKS :::::::::::::::::::::::::::::::::::::::::::::

const samePath = (a, b) => a.join('/') === b.join('/');

export const bookmarks = () => app.state.$bookmarks.filter(bookmark => bookmark.folder === folderId());

export const isBookmarked = path => bookmarks().some(bookmark => samePath(bookmark.path, path));

export function toggleBookmark (path, name) {
  const all = app.state.$bookmarks;
  app.state.bookmarks = isBookmarked(path)
    ? all.filter(bookmark => !(bookmark.folder === folderId() && samePath(bookmark.path, path)))
    : [...all, { folder: folderId(), name, path }];
}
