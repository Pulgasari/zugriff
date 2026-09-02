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

function toast (message, options = {}) {
  const opts = typeof message === 'string' ? { message, ...options } : { ...(message || {}) };
  return AufbauToast.notify({ ...DEFAULTS, ...opts });
}

export       { toast };
export default toast;
