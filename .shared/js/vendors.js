// .shared/js/vendors.js

// ::: pulgasari utils
export * from '@pulgasari/is';
export * from '@pulgasari/obj';
export * from '@pulgasari/str';
export * from '@pulgasari/timing';

// ::: preact + htm
import htm from 'htm';
import * as preactCore  from 'preact';
import * as preactHooks from 'preact/hooks';
import { preactSignal, PreactSignal, computed, effect, batch, untracked } from '@aufbau/signals';

const signal = preactSignal;
const Signal = PreactSignal;

const preact = {
  ...preactCore,
  ...preactHooks,
  signal, Signal, computed, effect, batch, untracked,
};

// fragment-aware binding: htm emits an empty-string tag for `<>...</>`, which plain
// htm.bind(h) would render as a literal empty element. mapping it to preact's Fragment
// makes `<>...</>` a real fragment, so components skip the explicit <${Fragment}> wrapper.
const { h, Fragment } = preactCore;
const html = htm.bind((type, props, ...children) => h(type || Fragment, props, ...children));

export * from 'preact';
export * from 'preact/hooks';
export { signal, Signal, computed, effect, batch, untracked };
export { htm, html, preact };


