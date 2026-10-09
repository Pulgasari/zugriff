// prompts :: modules/lib.js

// a BunkerDB store of prompts + tags,
// exposed as two plain signals (app.lib.prompts / app.lib.tags) 
// plus the crud helpers that keep them in sync.

import { signal } from '@aufbau/signals';
import { BunkerDB } from '@bunker/db';

const db = new BunkerDB('zugriff:prompts');
await db.setup({ prompts: {}, tags: {} });

// ── signals ────────────────────────────────────────────────────────────────

export const prompts = signal([]);
export const tags    = signal([]);

// ── helpers ────────────────────────────────────────────────────────────────

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

export async function load () {
  const [ps, ts] = await Promise.all([db.prompts.getAll(), db.tags.getAll()]);
  prompts.value = Object.values(ps);
  tags.value    = Object.values(ts);
}

export async function savePrompt (data) {
  await db.prompts.set(data.id, data);
  await load();
}

export async function deletePrompt (id) {
  await db.prompts.delete(id);
  await load();
}

export async function saveTag (tag) {
  await db.tags.set(tag.id, tag);
  await load();
}

export async function deleteTag (id) {
  await db.tags.delete(id);
  // drop the tag off every prompt that carried it
  const updated = prompts.value.filter(p => p.tags?.includes(id)).map(p => ({ ...p, tags: p.tags.filter(t => t !== id) }));
  for (const p of updated) await db.prompts.set(p.id, p);
  await load();
}

// ── initial load ─────────────────────────────────────────────────────────────

await load();
