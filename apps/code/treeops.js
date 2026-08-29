// apps/code/treeops.js
//
// small shared state for the file-tree operations that both the local and the
// GitHub tree use: a one-slot clipboard (cut/copy → paste) and a version signal
// per source that bumps after any change so open folders reload.

import { signal } from '@aufbau/kits/preact-htm';
import { openPrompt } from '/.shared/js/components/index.js';

/** a promise-returning single-value prompt; resolves null on cancel */
export const ask = (title, value = '') => new Promise(resolve => openPrompt({
  title, value, placeholder: title,
  onConfirm: v => resolve(v),
  onCancel: () => resolve(null),
}));

// { source:'local'|'github', mode:'cut'|'copy', isDir, name, ctx } — ctx is the
// source-specific payload the paste handler needs (handles, or repo paths)
export const clipboard = signal(null);

export const version = { local: signal(0), github: signal(0) };
export const bump = source => { version[source].value++; };

// basic client-side name validation (no slashes, no dot-segments)
export const validName = name =>
  !!name && !/[\\/]/.test(name) && name !== '.' && name !== '..' && !name.includes('\0');
