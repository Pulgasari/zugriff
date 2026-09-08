import AufbauToast from '@aufbau/elements/AufbauToast.js';

const isError  = sth => sth instanceof Error;
const isString = sth => typeof sth === 'string';

const DEFAULTS    = { duration: 3000, dismissible: true };
const LEVEL_TYPES = ['error', 'info', 'success', 'warn'];

/**
 * Extracts a message string from a string, Error instance, or unknown object.
 */
function extractMessage (val) {
  if (!val) return '';
  if (isString(val)) return val;
  if (isError(val) || (typeof val === 'object' && val.message)) {
    return val.message;
  }
  return String(val);
}

function toast (message, options = {}) {
  let opts = {};

  if (isError(message)) {
    opts = { message: message.message, type: 'error', ...options };
  } else if (typeof message === 'string') {
    opts = { message, ...options };
  } else {
    opts = { ...(message || {}) };
  }

  // Support level shorthand keys inside object arguments (e.g. { error }, { info }, { warn }, { success })
  for (const type of LEVEL_TYPES) {
    if (type in opts) {
      const val = opts[type];
      delete opts[type];
      opts.type = opts.type || type;
      opts.message = opts.message || extractMessage(val);
      break;
    }
  }

  if (opts.message && typeof opts.message !== 'string') {
    opts.message = extractMessage(opts.message);
  }

  return AufbauToast.notify({ ...DEFAULTS, ...opts });
}

// Level shortcuts — toast.error('…'), toast.success({ title, message }), …
const level = type => (message, options = {}) => toast(message, { ...options, type });
toast.error   = level('error');
toast.success = level('success');
toast.info    = level('info');
toast.warn    = level('warn');

export       { toast };
export default toast;


// .shared/js/app/toast.js
// one toast system for every app, on top of <aufbau-toast>. it is imperative —
// there is no component to render; call it from anywhere and a stacked toast
// appears top-right and dismisses itself. also bound to the runtime as
// zugriff.toast (see runtime.js).
//
//   import { toast } from '/.shared/js/components/index.js';
//   toast('Saved');
//   toast.error('Could not save');
//   toast({ title: 'Done', message: 'All files exported', duration: 6000 });
/*
import AufbauToast from '@aufbau/elements/AufbauToast.js';

const DEFAULTS = { duration: 3000, dismissible: true };

function toast (message, options = {}) {
  const opts = typeof message === 'string' ? { message, ...options } : { ...(message || {}) };
  return AufbauToast.notify({ ...DEFAULTS, ...opts });
}

// level shortcuts — toast.error('…'), toast.success({ title, message }), …
const level = type => (message, options = {}) => toast(message, { ...options, type });
toast.error   = level('error');
toast.success = level('success');
toast.info    = level('info');
toast.warn    = level('warn');

export       { toast };
export default toast;
*/
