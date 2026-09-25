// .shared/js/transitions.js
// how an app appears, and how it moves from one view to the next.
//
// reveal: boot.js puts :root.is-loading on an app page, which keeps #app hidden
// (index.html). app.init() renders, waits until the page has settled and then
// calls reveal(), so the frame, the dock and the first view appear together
// instead of one after the other.
//
// transition: a view change as a view transition. the update runs inside it and
// the page is only captured once the new view has settled, so the browser shows
// the old view until then and cross fades to the finished new one, never to an
// empty slot. without support, or with reduced motion, the update just runs.
//
// both are zugriff only for now, a candidate for aufbau or domina later.

import { pendingSlots } from './components/Slot.js';

const $root = document.documentElement;

const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

const timeoutAfter = ms => new Promise(resolve => setTimeout(resolve, ms));

const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// :::::: SETTLE

/**
 * resolves once `root` has rendered, the views and dialogs it started loading are
 * there, and every custom element in it is defined. rendering can reveal new
 * slots and elements, so it goes round until nothing is left, a few times at most
 */
async function settled (root) {
  for (let round = 0; round < 5; round++) {
    await frame();                                   // the render
    await frame();                                   // the effects it scheduled, e.g. a slot starting its import

    const undefinedTags = new Set([...root.querySelectorAll(':not(:defined)')].map(element => element.localName));
    const waiting       = [...undefinedTags].map(tag => customElements.whenDefined(tag));
    const slots         = pendingSlots();

    if (!waiting.length && !slots.length) return;
    await Promise.all([...waiting, ...slots]).catch(() => {});
  }
}

/** settled(), capped at `timeout` ms: a slow import or a missing element never keeps the app hidden */
export const settle = (root, { timeout = 1500 } = {}) => Promise.race([settled(root), timeoutAfter(timeout)]);

// :::::: REVEAL

/** waits for `root` and the fonts to settle, then shows the app */
export async function reveal (root, options) {
  await Promise.race([Promise.all([settle(root, options), document.fonts?.ready]), timeoutAfter(options?.timeout ?? 1500)]);
  $root.classList.remove('is-loading');
  $root.classList.add('is-ready');
}

// :::::: TRANSITION

/**
 * runs `update` as a view transition. `root` is where the new view renders, the
 * transition waits for it to settle before the browser captures the new state
 */
export async function transition (update, { root = document.getElementById('app-main') ?? document.getElementById('app'), timeout = 1500 } = {}) {
  const run = async () => { await update(); if (root) await settle(root, { timeout }); };

  if (!document.startViewTransition || prefersReducedMotion()) return run();
  await document.startViewTransition(run).finished.catch(() => {});
}

export default transition;
