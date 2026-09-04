// .shared/js/vendors.js
// the single vendor hub. every module pulls its framework + utils from here, so
// there is exactly one preact/htm/signals runtime instance and one place to
// repoint a vendor. the extended @aufbau/signals carriers stay a direct import
// (state.js, and apps that need persisted signals) so the plain `signal` here
// keeps meaning preact's leaf signal.

// ::: preact + htm + signals, bundled by the aufbau kit (externalises preact via
//     the importmap, so this is the only instance)
//export { default as aufbau } from '@aufbau/kits/preact-htm';
//export * from '@aufbau/kits/preact-htm';   // html, preact, render, str, signal, computed, effect, Fragment, hooks

// aufbau
export { default as aufbau } from '@aufbau/runtime';

// ::: pulgasari utils
export * from '@pulgasari/is';
export * from '@pulgasari/obj';
export * from '@pulgasari/str';
export * from '@pulgasari/timing';


// ::: preact + htm
import htm from 'htm'; 
import * as preactCore    from 'preact';
import * as preactHooks   from 'preact/hooks';
import * as preactSignals from '@preact/signals';

const preact = { 
  ...preactCore,
  ...preactHooks,
  ...preactSignals,
};

const html = htm.bind(preact.h);

export * from 'preact';
export * from 'preact/hooks';
export * from '@preact/signals';
export { htm, html, preact };


