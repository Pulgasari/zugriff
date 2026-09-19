// .shared/js/vendors.js

//
import { isArray, isObject, isString } from '@pulgasari/is';

// ::: pulgasari utils
export * from '@pulgasari/is';
export * from '@pulgasari/obj';
export * from '@pulgasari/str';
export * from '@pulgasari/timing';

// ::: preact + htm
import htm from 'htm';
import * as preactCore from 'preact';
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

// :::::: CUSTOM H

function addClass (classList, value) {
  if (!value) return;
  else if (isString(value)) classList.push(value);
  else if  (isArray(value)) for (const item of value) addClass(classList, item);
  else if (isObject(value)) for (const [className, enabled] of Object.entries(value)) if (enabled) classList.push(className);        
}

/* 
Custom h function for preact/htm to support:
- Fragment fallback for empty tags (<>...</>)
- Merging multiple class and className attributes
- Object syntax (e.g. class=${{ active: isTrue, disabled: false }})
- Directive syntax (e.g. class:active=${isTrue})
*/
function customH (type, props, ...children) {
  const targetType = type || Fragment;

  if (!props) return h (targetType, props, ...children);

  const newProps  = {};
  const classList = [];

  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('class:')) {
      // Handle conditional class directives: class:active=${condition}
      const className = key.slice(6);
      if (value) classList.push(className);
    } else if (key === 'class' || key === 'className') {
      // Handle strings, objects, or arrays passed to class/className
      addClass(classList, value);
    } 
    else newProps[key] = value; // preserve all other props
    
  }

  if (classList.length > 0) {
    newProps.class = classList.join(' ');
  }

  return h (targetType, newProps, ...children);
}

const html = htm.bind(customH);

// :::::: EXPORT

export * from 'preact';
export * from 'preact/hooks';
export { signal, Signal, computed, effect, batch, untracked };
export { htm, html, preact };
