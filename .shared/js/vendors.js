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

function setProp (props, key, value) {
  if (key === 'class' || key === 'className' || key.startsWith('class:')) {
    if (!props._classes) props._classes = [];
    if (value != null && value !== false) {
      props._classes.push({ key, value });
    }
  } 
  else props[key] = value;
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

  // 1. Process classes collected during htm prop parsing / spreading
  if (props._classes) {
    for (const { key, value } of props._classes) {
      if (key.startsWith('class:')) {
        const className = key.slice(6);
        if (value) classList.push(className);
      } 
      else addClass(classList, value);
    }
  }

  for (const [key, value] of Object.entries(props)) {
    if (key === '_classes') continue;
    if (key.startsWith('class:')) {
      const className = key.slice(6);
      if (value) classList.push(className);
    } else if (key === 'class' || key === 'className') {
      // Handle strings, objects, or arrays passed to class/className
      addClass(classList, value);
    } 
    else newProps[key] = value; // preserve all other props
    
  }

  // build classList
  if (classList.length > 0) newProps.class = classList.join(' ');

  // done!
  return h (targetType, newProps, ...children);
}

const html = htm.bind(customH);

// :::::: EXPORT

export * from 'preact';
export * from 'preact/hooks';
export { signal, Signal, computed, effect, batch, untracked };
export { htm, html, preact };
