// apps/code/vendors.js
// the app's local vendor hub. `html` is the tag bound once in the shared runtime
// (window.html) and re-exported here; the preact hooks come straight from the
// importmap-pinned preact instance (the single copy dedupes across the runtime).
// signals are NOT re-exported here on purpose — components import the extended
// `signal` directly from @aufbau/signals so `signal` keeps meaning the carrier,
// not preact's leaf signal.

export * from 'preact/hooks';

const html = window.html;

export { html };
