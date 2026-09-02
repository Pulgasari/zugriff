// apps/images/context.js
// the app handle, shared by the shell and every route. zugriff.app is memoized,
// so importing this anywhere returns the one instance.

import { zugriff } from '/.shared/js/runtime.js';

export const app = zugriff.app('images');
