// .shared/js/transitions.js

import { pendingSlots } from './components/Slot.js';

const
frame                = () => new Promise(resolve => requestAnimationFrame(() => resolve())),
timeoutAfter         = ms => new Promise(resolve => setTimeout(resolve, ms)),
prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// :::::: SETTLE

async function settled (root) {
  for (let round = 0; round < 5; round++) {
    await frame(); // the render
    await frame(); // the effects it scheduled, e.g. a slot starting its import

    const undefinedTags = new Set([...root.querySelectorAll(':not(:defined)')].map(element => element.localName));
    const waiting       = [...undefinedTags].map(tag => customElements.whenDefined(tag));
    const slots         = pendingSlots();

    if (!waiting.length && !slots.length) return;
    await Promise.all([...waiting, ...slots]).catch(() => {});
  }
}

const settle = (root, { timeout = 1500 } = {}) => Promise.race([settled(root), timeoutAfter(timeout)]);

// :::::: TRANSITION

async function transition (update, { root = document.getElementById('app-main') ?? document.getElementById('app'), timeout = 1500 } = {}) {
  const run = async () => { await update(); if (root) await settle(root, { timeout }); };

  if (!document.startViewTransition || prefersReducedMotion()) return run();
  await document.startViewTransition(run).finished.catch(() => {});
}

// :::::: EXPORT

export { settle, transition };
export default transition;
