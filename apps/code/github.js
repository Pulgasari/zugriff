// apps/code/github.js
//
// a tiny GitHub client that runs entirely in the browser. api.github.com sends
// CORS headers, so a static page can talk to it directly — the only thing it
// can't do statically is the OAuth token exchange (needs a secret / a backend),
// so v1 authenticates with a Personal Access Token the user pastes in. the token
// is kept on-device in IndexedDB (@bunker/db) and sent only to api.github.com.
//
// a fine-grained token scoped to the repos you want, with "Contents: read/write",
// is enough to browse and commit.

import { signal } from '@aufbau/kits/preact-htm';
import { db, setup } from './db.js';

const API      = 'https://api.github.com';
const TOKEN_ID = 'github-token';
const SEL_ID   = 'github-selection';

// ── state ────────────────────────────────────────────────────────────────────

export const
token   = signal(null),        // the PAT string, or null
user    = signal(null),        // { login, avatar_url, … } once validated
repos   = signal([]),          // the user's repositories
repo    = signal(null),        // the selected repo { owner, name, default_branch }
branch  = signal(null),        // the selected branch name
busy    = signal(''),          // a label while a request is in flight
error   = signal(null),        // last error message
ready   = signal(false);       // token load + (maybe) validation done

export const connected = () => !!user.value;

// ── low-level request ────────────────────────────────────────────────────────

async function api (path, { method = 'GET', body, raw = false } = {}) {
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    method,
    headers: {
      'Authorization' : `Bearer ${token.value}`,
      'Accept'        : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const j = await res.json(); if (j.message) msg = j.message; } catch {}
    if (res.status === 401) msg = 'Token invalid or expired.';
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') msg = 'GitHub rate limit reached — try again later.';
    throw new Error(msg);
  }
  return raw ? res : res.json();
}

// ── base64 <-> utf-8 (chunked, so large files don't blow the call stack) ─────

const toText = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), c => c.charCodeAt(0)));
function fromText (text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// ── auth ─────────────────────────────────────────────────────────────────────

export async function load () {
  await setup();
  const saved = await db.get('auth', TOKEN_ID);
  if (saved) {
    token.value = saved;
    try { await refreshUser(); await loadRepos(); } catch { /* stale token — stay disconnected */ }
  }
  const sel = await db.get('auth', SEL_ID);
  if (sel) { repo.value = sel.repo ?? null; branch.value = sel.branch ?? null; }
  ready.value = true;
}

async function refreshUser () {
  user.value = await api('/user');
}

/** validate + store a pasted token. returns the user, or throws. */
export async function connect (pat) {
  const t = (pat || '').trim();
  if (!t) throw new Error('Paste a token first.');
  token.value = t;
  error.value = null;
  busy.value  = 'Connecting…';
  try {
    await refreshUser();
    await db.set('auth', TOKEN_ID, t);
    await loadRepos();
    return user.value;
  } catch (e) {
    token.value = null; user.value = null;
    throw e;
  } finally {
    busy.value = '';
  }
}

export async function disconnect () {
  await setup();
  await db.delete('auth', TOKEN_ID);
  await db.delete('auth', SEL_ID);
  token.value = user.value = repo.value = branch.value = null;
  repos.value = [];
}

// ── repos / branches ─────────────────────────────────────────────────────────

export async function loadRepos () {
  busy.value = 'Loading repos…';
  try {
    // the repos you can push to, most-recently-updated first (two pages = 200)
    const page = n => api(`/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member&page=${n}`);
    const [a, b] = await Promise.all([page(1), page(2)]);
    repos.value = [...a, ...b].map(r => ({
      owner: r.owner.login, name: r.name, full: r.full_name,
      default_branch: r.default_branch, private: r.private, updated: r.updated_at,
    }));
  } finally { busy.value = ''; }
}

export async function selectRepo (r) {
  repo.value   = r;
  branch.value = r.default_branch;
  await persistSelection();
}

export async function listBranches () {
  const r = repo.value;
  const list = await api(`/repos/${r.owner}/${r.name}/branches?per_page=100`);
  return list.map(b => b.name);
}

export async function selectBranch (name) {
  branch.value = name;
  await persistSelection();
}

async function persistSelection () {
  await setup();
  await db.set('auth', SEL_ID, { repo: repo.value, branch: branch.value });
}

// ── tree / files ─────────────────────────────────────────────────────────────

/** the root tree sha + head commit sha of the selected branch */
export async function branchHead () {
  const r = repo.value, b = branch.value;
  const info = await api(`/repos/${r.owner}/${r.name}/branches/${encodeURIComponent(b)}`);
  return { commit: info.commit.sha, tree: info.commit.commit.tree.sha };
}

/** immediate children of a tree (lazy, one level — scales to huge repos) */
export async function listTree (treeSha) {
  const r = repo.value;
  const data = await api(`/repos/${r.owner}/${r.name}/git/trees/${treeSha}`);
  return (data.tree || []).sort((a, b) =>
    a.type === b.type ? a.path.localeCompare(b.path) : a.type === 'tree' ? -1 : 1,
  );
}

/** decode a blob to text; returns { text, binary } */
export async function readBlob (blobSha) {
  const r = repo.value;
  const data = await api(`/repos/${r.owner}/${r.name}/git/blobs/${blobSha}`);
  if (data.encoding !== 'base64') return { text: data.content ?? '', binary: false };
  try {
    const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, '')), c => c.charCodeAt(0));
    // a NUL byte in the first chunk is a good-enough "this is binary" signal
    if (bytes.subarray(0, 8000).includes(0)) return { text: '', binary: true };
    return { text: new TextDecoder('utf-8', { fatal: false }).decode(bytes), binary: false };
  } catch {
    return { text: '', binary: true };
  }
}

/** commit a single file's new content back to the branch; returns the new sha */
export async function commitFile ({ owner, name, path, branch: br, message, content, sha }) {
  const res = await api(`/repos/${owner}/${name}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    body: { message, content: fromText(content), sha, branch: br },
  });
  return res.content.sha;
}

export { toText, fromText };
