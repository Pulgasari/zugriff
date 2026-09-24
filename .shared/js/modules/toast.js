// .shared/js/modules/toast.js
// one toast system for every app, a thin layer over <aufbau-toast>. input
// handling (strings, errors, { error: … } level keys) lives in AufbauToast,
// this only adds the zugriff defaults. also bound to the runtime as zugriff.toast.
//
//   toast('Saved');
//   toast(error);
//   toast({ error: 'Could not save' });
//   toast.error('Could not save');
//   toast({ heading: 'Done', message: 'All files exported', duration: 6000 });

import AufbauToast, { toToastOptions } from '@aufbau/elements/AufbauToast.js';

const DEFAULTS = { duration: 3000 };

// defaults first, so anything the caller passes (inside the input or as options) wins
const toast = (input, options) => AufbauToast.notify({ ...DEFAULTS, ...toToastOptions(input, options) });

const level = type => (input, options) => toast(input, { ...options, type });

toast.error   = level('error');
toast.info    = level('info');
toast.success = level('success');
toast.warn    = level('warning');

export       { toast };
export default toast;
