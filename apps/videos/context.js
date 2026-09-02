// apps/videos/context.js
// the app handle, shared by the shell and every route (zugriff.app is memoized).

import { zugriff } from '/.shared/js/runtime.js';

export const app = zugriff.app('videos');
