// apps/code/modules/files.js
// the open editor documents — the tab list, the active tab, and the operations that
// open / patch / save / close them. a file carries a `source` ('local' | 'github')
// and a stable `id` (a FileSystemHandle for local, a `gh:…` string for github) so the
// tabs and the editor match records regardless of source. sources live on
// app.workspaces; this module reads them through the zugriff.app global.

import { signal } from '@aufbau/signals';

// ── open documents ─────────────────────────────────────────────────────────────

const open   = signal([]);     // the open tabs
const active = signal(null);   // the active tab, or null

// language guessed from the file extension — Monaco's built-in modes only
const LANG_BY_EXT = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  json: 'json', css: 'css', scss: 'scss', less: 'less',
  html: 'html', htm: 'html', xml: 'xml', svg: 'xml',
  md: 'markdown', markdown: 'markdown',
  php: 'php', py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
  java: 'java', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp',
  cs: 'csharp', sh: 'shell', bash: 'shell', yml: 'yaml', yaml: 'yaml',
  sql: 'sql', toml: 'ini', ini: 'ini',
};
const languageOf = name => LANG_BY_EXT[name.split('.').pop().toLowerCase()] ?? 'plaintext';

const openById  = id => open.value.find(f => f.id === id);
const activate  = fileObj => {
  open.value   = [...open.value, fileObj];
  active.value = fileObj;
  return fileObj;
};

// ── operations ───────────────────────────────────────────────────────────────

/** open a local file from its handle (or activate it if already open) */
const openLocal = async (handle) => {
  const existing = openById(handle);
  if (existing) { active.value = existing; return existing; }

  const file    = await handle.getFile();
  const content = await file.text();
  return activate({
    id: handle, source: 'local', handle,
    name: handle.name, content, language: languageOf(handle.name), isDirty: false,
  });
};

/** open a GitHub file. `meta` = { owner, name, branch, path, sha, content, binary, readOnly } */
const openGithub = (meta) => {
  const id = githubId(meta.owner, meta.name, meta.branch, meta.path);
  const existing = openById(id);
  if (existing) { active.value = existing; return existing; }

  return activate({
    id, source: 'github',
    name: meta.path.split('/').pop(),
    content: meta.content,
    language: languageOf(meta.path),
    isDirty: false,
    readOnly: !!meta.binary || !!meta.readOnly,
    gh: { owner: meta.owner, name: meta.name, branch: meta.branch, path: meta.path, sha: meta.sha },
  });
};

/** open a WebDAV file. `meta` = { connId, connName, path, content, binary, readOnly } */
const openWebdav = (meta) => {
  const id = webdavId(meta.connId, meta.path);
  const existing = openById(id);
  if (existing) { active.value = existing; return existing; }

  return activate({
    id, source: 'webdav',
    name: meta.path.split('/').pop(),
    content: meta.content,
    language: languageOf(meta.path),
    isDirty: false,
    readOnly: !!meta.binary || !!meta.readOnly,
    dav: { connId: meta.connId, connName: meta.connName, path: meta.path },
  });
};

/** replace the record for a file in the open list (keeps `active` in sync) */
const patch = (file, delta) => {
  const next = { ...file, ...delta };
  open.value = open.value.map(f => f.id === file.id ? next : f);
  if (active.value?.id === file.id) active.value = next;
  return next;
};

/** save the active file back to its source (local disk, a GitHub commit, or a WebDAV PUT) */
const save = async ({ message } = {}) => {
  const file = active.value;
  if (!file || file.readOnly) return false;

  if (file.source === 'github') {
    const gh = file.gh;
    const newSha = await zugriff.app.workspaces.github.commitFile({
      owner: gh.owner, name: gh.name, path: gh.path, branch: gh.branch,
      message: message || `Update ${gh.path}`, content: file.content, sha: gh.sha,
    });
    patch(file, { isDirty: false, gh: { ...gh, sha: newSha } });
    return true;
  }

  if (file.source === 'webdav') {
    const webdav = zugriff.app.workspaces.webdav;
    const conn   = webdav.connectionById(file.dav.connId);
    if (!conn) return false;   // connection was removed
    await webdav.writeFile(file.dav.path, file.content, conn);
    patch(file, { isDirty: false });
    return true;
  }

  // local
  if (!file.handle?.createWritable) return false;
  if (!(await zugriff.app.workspaces.local.ensureWritePermission(file.handle))) return false;
  const writable = await file.handle.createWritable();
  await writable.write(file.content);
  await writable.close();
  patch(file, { isDirty: false });
  return true;
};

/** the gh id string for a repo path (to find/close an open GitHub tab) */
const githubId = (owner, name, branch, path) => `gh:${owner}/${name}@${branch}:${path}`;

/** the dav id string for a connection path (to find/close an open WebDAV tab) */
const webdavId = (connId, path) => `dav:${connId}:${path}`;

/** close a file (activates the previous tab, or none) */
const close = (file) => {
  const rest = open.value.filter(f => f.id !== file.id);
  open.value = rest;
  if (active.value?.id === file.id) active.value = rest.at(-1) ?? null;
};

/** close any open tab matching an id (a local handle, or a gh:… string) */
const closeById = (id) => {
  const f = open.value.find(x => x.id === id);
  if (f) close(f);
};

// ── the module ────────────────────────────────────────────────────────────────

const files = {
  open, active, languageOf,
  openLocal, openGithub, openWebdav, patch, save, close, closeById, githubId, webdavId,
};

export default files;
export { files };
