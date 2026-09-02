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
