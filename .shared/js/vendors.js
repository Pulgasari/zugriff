// .shared/js/vendors.js

//
import { createHtml }                  from '@pulgasari/htx';
import { isArray, isObject, isString } from '@pulgasari/is';

// ::: pulgasari utils
export * from '@pulgasari/is';
export * from '@pulgasari/obj';
export * from '@pulgasari/str';
export * from '@pulgasari/timing';

// ::: preact + htm
//import htm from 'htm';
import * as preactCore  from 'preact';
import * as preactHooks from 'preact/hooks';
import { preactSignal, PreactSignal, computed, effect, batch, untracked } from '@aufbau/signals';

const { h, Fragment } = preactCore;

const signal = preactSignal;
const Signal = PreactSignal;

const preact = {
  ...preactCore,
  ...preactHooks,
  signal, Signal, computed, effect, batch, untracked,
};

// htx
const html = createHtml(h, Fragment);
const htx  = createHtml(h, Fragment);

// :::::: EXPORT

export * from 'preact';
export * from 'preact/hooks';
export { signal, Signal, computed, effect, batch, untracked };
export { html, preact };
//export { htm, html, preact };
