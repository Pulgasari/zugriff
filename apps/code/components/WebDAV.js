// apps/code/components/WebDAV.js
// the WebDAV modal: add a connection (url + credentials), pick one, browse its tree
// and open files. saving a WebDAV file PUTs it back (see modules/files.js). DIRECT
// only — the server must send CORS headers for the browser to reach it.

import { html, useState, useEffect } from './../vendors.js';
import Modal from './Modal.js';
import Icon from '/.shared/js/components/Icon.js';
import WebDAVTree from './WebDAVTree.js';

const app = zugriff.app;
const webdav = app.workspaces.webdav;
const { clipboard, version, bump, ask, validName } = app.workspaces;

export default function WebDAV () {
  const conns  = webdav.connections.value;
  const active = webdav.active.value;
  const busy   = webdav.busy.value;
  const err    = webdav.error.value;

  const [name,     setName]     = useState('');
  const [url,      setUrl]      = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rootTree, setRootTree] = useState(null);
  const [treeErr,  setTreeErr]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [showList, setShowList] = useState(false);

  // load the root listing when a connection is active
  useEffect(() => {
    if (!active) { setRootTree(null); return; }
    let stop = false;
    setLoading(true); setTreeErr(null);
    webdav.list('').then(entries => { if (!stop) setRootTree(entries); })
      .catch(e => { if (!stop) setTreeErr(e.message); })
      .finally(() => { if (!stop) setLoading(false); });
    return () => { stop = true; };
  }, [active && active.id, version.webdav.value]);

  const doAdd = async () => {
    try { await webdav.addConnection({ name, url, username, password }); setName(''); setUrl(''); setUsername(''); setPassword(''); setShowList(false); }
    catch (e) { webdav.error.value = e.message; }
  };

  // root-level (connection top) actions
  const runRoot = fn => async () => { try { await fn(); bump('webdav'); } catch (e) { if (e) webdav.error.value = e.message; } };
  const rootNewFile   = runRoot(async () => { const n = await ask('New file');   if (!validName(n)) return; await webdav.createFileAt(n, ''); });
  const rootNewFolder = runRoot(async () => { const n = await ask('New folder'); if (!validName(n)) return; await webdav.createFolderAt(n); });
  const rootPaste = runRoot(async () => {
    const cb = clipboard.value;
    if (!cb || cb.source !== 'webdav') return;
    if (cb.ctx.connId !== active.id) throw new Error('Paste must stay in the same connection.');
    if (cb.mode === 'copy') await webdav.copyPath(cb.ctx.path, cb.name, { isDir: cb.isDir });
    else { await webdav.renamePath(cb.ctx.path, cb.name, { isDir: cb.isDir }); clipboard.value = null; if (!cb.isDir) app.files.closeById(app.files.webdavId(active.id, cb.ctx.path)); }
  });

  const picking = showList || !active;

  // ── the add-connection + saved-connections block ──────────────────────────
  const pickerSection = html`
    <div class="gh-connect">
      <p class="gh-hint">
        Connect a <strong>WebDAV</strong> server — a self-hosted Nextcloud/ownCloud, an
        <code>rclone serve webdav</code>, or any DAV endpoint. It must send
        <em>CORS</em> headers for the browser to reach it. Use an app-password where the
        server offers one; credentials stay on this device.
      </p>
      <input class="gh-input" type="text"     placeholder="Name (optional)"                value=${name}     onInput=${e => setName(e.target.value)} />
      <input class="gh-input" type="url"      placeholder="https://cloud.example.com/remote.php/dav/files/me/" value=${url} onInput=${e => setUrl(e.target.value)} />
      <input class="gh-input" type="text"     placeholder="Username"                       value=${username} onInput=${e => setUsername(e.target.value)} />
      <input class="gh-input" type="password" placeholder="Password / app-password"        value=${password} onInput=${e => setPassword(e.target.value)}
        onKeyDown=${e => e.key === 'Enter' && doAdd()} />
      <button class="btn-primary" disabled=${!!busy || !url.trim()} onClick=${doAdd}>${busy || 'Connect'}</button>

      ${conns.length > 0 && html`
        <ul class="gh-repolist">
          ${conns.map(c => html`
            <li key=${c.id}>
              <span class="gh-reporow" onClick=${() => { webdav.selectConnection(c.id); setShowList(false); }}>
                <${Icon} name="material-symbols:cloud-outline" />
                <span class="gh-reponame">${c.name}</span>
                <span class="gh-ro">${new URL(c.url).host}</span>
              </span>
              <button class="rowmenu-btn" title="Remove" onClick=${() => webdav.removeConnection(c.id)}>
                <${Icon} name="material-symbols:close" />
              </button>
            </li>`)}
        </ul>`}
    </div>`;

  return html`
    <${Modal} id="webdav" title="WebDAV">
      ${err && html`<div class="gh-error"><${Icon} name="material-symbols:error-outline" /> ${err}</div>`}

      ${picking ? pickerSection : html`
        <div class="gh-repobar">
          <button class="gh-repochip" onClick=${() => setShowList(true)} title="Change connection">
            <${Icon} name="material-symbols:cloud-outline" /> ${active.name}
          </button>
          <button class="gh-textbtn" onClick=${() => { webdav.active.value = null; }}>Close</button>
        </div>

        <div class="tree-rootbar">
          <button class="rowmenu-btn" title="New file"   onClick=${rootNewFile}><${Icon} name="material-symbols:note-add-outline" /></button>
          <button class="rowmenu-btn" title="New folder" onClick=${rootNewFolder}><${Icon} name="material-symbols:create-new-folder-outline" /></button>
          ${clipboard.value?.source === 'webdav' && html`<button class="rowmenu-btn" title="Paste" onClick=${rootPaste}><${Icon} name="paste" /></button>`}
        </div>

        <div class="filebrowser-body">
          ${loading && html`<div class="none"><${Icon} name="material-symbols:hourglass-empty" /><br/>Loading…</div>`}
          ${treeErr && html`<div class="gh-error"><${Icon} name="material-symbols:error-outline" /> ${treeErr}</div>`}
          ${rootTree && !loading && html`
            <ul class="tree-root">
              ${rootTree.length === 0
                ? html`<li class="tree-empty">Empty</li>`
                : rootTree.map(entry => html`<${WebDAVTree} key=${entry.path} entry=${entry} depth=${0} />`)}
            </ul>`}
        </div>
      `}
    </${Modal}>`;
}
