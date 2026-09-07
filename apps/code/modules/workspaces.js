// apps/code/modules/workspaces.js
// the editable sources behind the app, bundled as app.workspaces: the granted local
// folder (File System Access) and the GitHub client, plus the tree helpers both trees
// share (a one-slot cut/copy clipboard and a per-source version signal that bumps
// after a change so open folders reload). `dir` holds the active local root handle.

import fs         from './fs.js';
import * as fsops  from './fsops.js';
import * as github from './github.js';
import { clipboard, version, bump, ask, validName } from './treeops.js';

const workspaces = {
  dir : null,        // the active local root FileSystemDirectoryHandle, or null

  local  : fs,       // saved-root lifecycle + directory reads / permissions
  fsops,             // local file/folder operations
  github,            // the browser GitHub client (signals + api)

  clipboard, version, bump,   // shared tree clipboard + refresh signals
  ask, validName,             // tree prompt + name validation
};

export default workspaces;
export { workspaces };
