// shared/js/components/Toast.js
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

/** show a toast. pass a string message, or an options object. */
export function toast (message, options = {}) {
  const opts = typeof message === 'string' ? { message, ...options } : { ...(message || {}) };
  return AufbauToast.notify({ ...DEFAULTS, ...opts });
}

toast.info    = (message, o) => toast(message, { type: 'info',    ...o });
toast.success = (message, o) => toast(message, { type: 'success', ...o });
toast.warning = (message, o) => toast(message, { type: 'warning', ...o });
toast.error   = (message, o) => toast(message, { type: 'error', duration: 6000, ...o });

export default toast;
