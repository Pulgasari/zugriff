// apps/code/modules/db.js
//
// the app's single IndexedDB (via @bunker/db). the stores share it:
//   workspace — the granted local root directory handle (fs.js)
//   auth      — the GitHub token and last selection (github.js)
//   webdav    — the saved WebDAV connections (webdav.js)
// one createDb + one setup so the object stores are declared together and never
// race each other on first open.

import { createDb } from '@bunker/db';

export const db = createDb('zugriff-code');

let ready;
export const setup = () => (ready ??= db.setup({ workspace: {}, auth: {}, webdav: {} }));

export default db;
