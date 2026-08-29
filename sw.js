// sw.js — the launcher's worker. same shared body as every app, imported by its
// absolute path so depth never matters.
import '/.shared/js/sw-core.js';
console.log('hello from sw.js in root directory!');
