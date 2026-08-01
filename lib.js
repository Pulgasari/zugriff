// lib.js

import * as preactCore    from 'preact';
import * as preactHooks   from 'preact/hooks';
import * as preactSignals from '@preact/signals';
import htm from 'htm';

// Central namespace export for preact ecosystem & HTM
export const preact = { ...preactCore, ...preactHooks, ...preactSignals };
export const html = htm.bind(preactCore.h);
