// apps/videos/context.js
// the app handle, shared by the shell and every route (zugriff.app is memoized).
// the folder-library data layer hangs off it as `app.lib`, so routes reach the
// whole thing behind one namespace.

import { zugriff } from '/.shared/js/runtime.js';
import { lib }     from './library.js';

export const app = zugriff.app('videos');

app.lib = lib;
