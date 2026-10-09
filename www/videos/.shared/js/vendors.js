// .shared/js/vendors.js

/*
// ::: htx
export * from '@htx/preact';

// ::: preact
export * from 'preact';
export * from 'preact/hooks';
export * from '@aufbau/signals';

// ::: pulgasari utils
export * from '@pulgasari/is';
export * from '@pulgasari/obj';
export * from '@pulgasari/str';
export * from '@pulgasari/timing';
*/

//

import { isArray, isObject, isString } from '@pulgasari/is';



// ::: preact + htm
//import htm from 'htm';
import * as preactCore  from 'preact';
import * as preactHooks from 'preact/hooks';
import { Signal, batch, computed, effect, signal, untracked } from '@aufbau/signals';

const { h, Fragment } = preactCore;

const preact = {
  ...preactCore,
  ...preactHooks,
  signal, Signal, computed, effect, batch, untracked,
};

// htx
//const html = createHtml(h, Fragment);
//const htx  = createHtml(h, Fragment);


// :::::: EXPORT

// ::: htx
export * from '@htx/preact';

// ::: preact
export * from 'preact';
export * from 'preact/hooks';
export { preact };

// ::: signals
export { signal, Signal, computed, effect, batch, untracked };

// ::: pulgasari utils
export * from '@pulgasari/is';
export * from '@pulgasari/obj';
export * from '@pulgasari/str';
export * from '@pulgasari/timing';
