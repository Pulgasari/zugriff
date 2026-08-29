// apps/images/filters.js
//
// the images app's filter layer — a thin, reusable wrapper over @aufbau/filters,
// shared by the edit mode (live preview + bake on export) and the batch mode (a
// pipeline task). one curated catalogue, two entry points:
//
//   preview(el, id, opts)   non-destructive, live — sets a css/svg filter on a
//                           dom element (used for the editor's on-canvas preview)
//   bake(canvas, id, opts)  destructive — bakes the effect into a canvas in place
//                           via aufbau's filterCanvas (used on export and in batch)
//
// aufbau's filterCanvas can realise every filter (its own imageData pass, the
// ctx.filter bridge for css/svg, or webgl), so `bake` handles the whole catalogue;
// `preview` only works for the css/svg-backed ones — a canvas-only effect (pixelate,
// dither) has no cheap live form, so it previews as a no-op and shows on export.

import { applyFilter, removeFilter, filterCanvas, filterCss, list } from '@aufbau/filters';

export const NONE = 'none';

// a photo-oriented subset, in a deliberate order; anything not in the installed
// catalogue is skipped so this never breaks if the catalogue changes.
const CURATED = [
  'grayscale', 'sepia', 'invert', 'saturate', 'hue-saturation', 'duotone', 'instacolor',
  'posterize', 'solarize', 'sharpen', 'blur', 'glow', 'grain', 'vignette', 'halftone',
  'dot-screen', 'scanlines', 'night-vision', 'thermal', 'tilt-shift', 'emboss', 'edges',
  'rgb-shift', 'pixelate', 'dither',
];

const meta = new Map(((() => { try { return list(); } catch { return []; } })()).map(f => [f.id, f]));

// [{ id, name, amount:{default,min,max,step}|null, previewable }]
export const EFFECTS = [
  { id: NONE, name: 'None', amount: null, previewable: true, cssBacked: true },
  ...CURATED.filter(id => meta.has(id)).map(id => {
    const f = meta.get(id);
    return {
      id,
      name       : f.name,
      amount     : f.vars?.amount ?? null,
      previewable: !!(f.backends?.css || f.backends?.svg),
      cssBacked  : !!f.backends?.css,   // realisable as a plain css filter string
    };
  }),
];

export const effectById = id => EFFECTS.find(e => e.id === id) ?? null;

/** live, non-destructive preview on a dom element (css filter or injected svg url) */
export function preview (el, id, opts) {
  if (!el) return;
  if (!id || id === NONE) { removeFilter(el); return; }
  try { applyFilter(el, id, opts || {}); }
  catch { removeFilter(el); }   // canvas-only effect — no live form; it bakes on export
}

/** destructive — bake the effect into a canvas in place (export / batch) */
export function bake (canvas, id, opts) {
  if (!canvas || !id || id === NONE) return;
  try { filterCanvas(canvas, id, opts || {}); }
  catch (err) { console.warn('[images] filter bake failed:', id, err); }
}

/**
 * a plain css `filter` value for a css-backed effect, or '' otherwise. lets a
 * caller drop the effect straight into an element's inline style alongside other
 * declarations (e.g. the viewer's transform) without touching el.style itself —
 * the safe path when the element's style is re-rendered by the framework.
 */
export function cssValue (id, opts) {
  if (!id || id === NONE) return '';
  try { return filterCss(id, opts || {}) || ''; }
  catch { return ''; }
}
