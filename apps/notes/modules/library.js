// apps/notes/modules/library.js
//
// the whole data layer: a folder library that accepts markdown. FolderLibrary
// owns the rest — the granted folders, their permissions, the recursive scan
// into `lib.trees` and reading a note back off disk.

import FolderLibrary from '/.shared/js/modules/folders.js';

// what counts as a note: markdown and its usual spellings. a folder full of
// anything else simply scans to nothing.
const lib = new FolderLibrary({ accept: 'md, markdown, mdown, mkd, mdwn, mdtxt' });

export { lib };
export default lib;
