// apps/code/components/GitHub.js
// the GitHub modal: paste a token to connect, pick a repo + branch, browse the
// tree and open files. saving a GitHub file commits it back (see state.js).
// public repos can also be pinned by owner/name and browsed read-only, with or
// without a token.

import { html, useState, useEffect } from '@aufbau/kits/preact-htm';
import * as github from './../github.js';
import { clipboard, version, bump, ask, validName } from './../treeops.js';
import state from './../state.js';
import Modal from './Modal.js';
import Icon from './Icon.js';
import GitHubTree from './GitHubTree.js';

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

export default function GitHub () {
  const user   = github.user.value;
  const repos  = github.repos.value;
  const pubs   = github.publicRepos.value;
  const repo   = github.repo.value;
  const branch = github.branch.value;
  const busy   = github.busy.value;
  const err    = github.error.value;

  const [pat,       setPat]       = useState('');
  const [pub,       setPub]       = useState('');
  const [query,     setQuery]     = useState('');
  const [branches,  setBranches]  = useState(null);
  const [rootTree,  setRootTree]  = useState(null);
  const [treeErr,   setTreeErr]   = useState(null);
  const [loadingTree, setLoadingTree] = useState(false);
  const [showList,  setShowList]  = useState(false);

  // load branches when the repo changes
  useEffect(() => {
    if (!repo) { setBranches(null); return; }
    let stop = false;
    github.listBranches().then(b => { if (!stop) setBranches(b); }).catch(() => {});
    return () => { stop = true; };
  }, [repo && repo.full]);

  // load the root tree when repo + branch are set (a token is not required —
  // public repos browse unauthenticated)
  useEffect(() => {
    if (!repo || !branch) { setRootTree(null); return; }
    let stop = false;
    setLoadingTree(true); setTreeErr(null);
    (async () => {
      try {
        const head = await github.branchHead();
        const entries = await github.listTree(head.tree);
        if (!stop) setRootTree(entries);
      } catch (e) { if (!stop) setTreeErr(e.message); }
      finally { if (!stop) setLoadingTree(false); }
    })();
    return () => { stop = true; };
  }, [user, repo && repo.full, branch, version.github.value]);

  const doConnect = async () => {
    try { await github.connect(pat); setPat(''); }
    catch (e) { github.error.value = e.message; }
  };

  const doAddPublic = async () => {
    const input = pub.trim();
    if (!input) return;
    try { const r = await github.addPublicRepo(input); setPub(''); github.selectRepo(r); setShowList(false); }
    catch (e) { github.error.value = e.message; }
  };

  // root-level (repo top) actions
  const runRoot = fn => async () => { try { await fn(); bump('github'); } catch (e) { if (e) github.error.value = e.message; } };
  const rootNewFile   = runRoot(async () => { const n = await ask('New file');   if (!validName(n)) return; await github.createFileAt(n, ''); });
  const rootNewFolder = runRoot(async () => { const n = await ask('New folder'); if (!validName(n)) return; await github.createFolderAt(n); });
  const rootPaste = runRoot(async () => {
    const cb = clipboard.value;
    if (!cb || cb.source !== 'github') return;
    if (cb.ctx.repo.owner !== repo.owner || cb.ctx.repo.name !== repo.name || cb.ctx.branch !== branch) throw new Error('Paste must stay in the same repo and branch.');
    const m = { isDir: cb.isDir, sha: cb.ctx.sha, mode: cb.ctx.mode };
    if (cb.mode === 'copy') await github.copyPath(cb.ctx.path, cb.name, m);
    else { await github.renamePath(cb.ctx.path, cb.name, m); clipboard.value = null; if (!cb.isDir) state.closeById(state.githubId(repo.owner, repo.name, branch, cb.ctx.path)); }
  });

  const filtered = query
    ? repos.filter(r => r.full.toLowerCase().includes(query.toLowerCase()))
    : repos;

  // ── the "add / pick a public repo" block, shown in every picker state ─────
  const publicSection = html`
    <div class="gh-public">
      <div class="search-row">
        <${Icon} name="material-symbols:public" />
        <input class="gh-input" type="text" placeholder="Add a public repo — owner/name or URL"
          value=${pub} onInput=${e => setPub(e.target.value)}
          onKeyDown=${e => e.key === 'Enter' && doAddPublic()} />
        <button class="gh-textbtn" disabled=${!!busy || !pub.trim()} onClick=${doAddPublic}>Add</button>
      </div>
      ${pubs.length > 0 && html`
        <ul class="gh-repolist">
          ${pubs.map(r => html`
            <li key=${r.full}>
              <span class="gh-reporow" onClick=${() => { github.selectRepo(r); setShowList(false); }}>
                <${Icon} name=${r.private ? 'material-symbols:lock-outline' : 'material-symbols:public'} />
                <span class="gh-reponame">${r.full}</span>
                <span class="gh-ro">read-only</span>
              </span>
              <button class="rowmenu-btn" title="Remove" onClick=${() => github.removePublicRepo(r.full)}>
                <${Icon} name="material-symbols:close" />
              </button>
            </li>`)}
        </ul>`}
    </div>`;

  const pickingRepo = showList || !repo;

  return html`
    <${Modal} id="github" title="GitHub">
      ${user ? html`
        <div class="gh-head">
          <span class="gh-user"><${Icon} name="mdi:github" /> ${user.login}</span>
          <button class="gh-textbtn" onClick=${() => github.disconnect()}>Disconnect</button>
        </div>
      ` : null}

      ${err && html`<div class="gh-error"><${Icon} name="material-symbols:error-outline" /> ${err}</div>`}

      ${pickingRepo ? html`
        ${!user ? html`
          <div class="gh-connect">
            <p class="gh-hint">
              Paste a <strong>fine-grained personal access token</strong> with
              <em>Contents: read and write</em> to edit your own repositories, or
              just add a public repo below to browse it read-only.
            </p>
            <a class="gh-link" href=${TOKEN_URL} target="_blank" rel="noopener">
              <${Icon} name="material-symbols:open-in-new" /> Create a token
            </a>
            <input class="gh-input" type="password" placeholder="github_pat_…"
              value=${pat} onInput=${e => setPat(e.target.value)}
              onKeyDown=${e => e.key === 'Enter' && doConnect()} autoFocus />
            <button class="btn-primary" disabled=${!!busy} onClick=${doConnect}>${busy || 'Connect'}</button>
          </div>
        ` : null}

        ${publicSection}

        ${user ? html`
          <div class="gh-repopick">
            <div class="search-row">
              <${Icon} name="material-symbols:search" />
              <input class="gh-input" type="search" placeholder="Filter repositories…"
                value=${query} onInput=${e => setQuery(e.target.value)} />
            </div>
            ${busy && html`<div class="gh-busy">${busy}</div>`}
            <ul class="gh-repolist">
              ${filtered.map(r => html`
                <li key=${r.full} onClick=${() => { github.selectRepo(r); setShowList(false); }}>
                  <span class="gh-reporow">
                    <${Icon} name=${r.private ? 'material-symbols:lock-outline' : 'material-symbols:public'} />
                    <span class="gh-reponame">${r.full}</span>
                  </span>
                </li>`)}
              ${filtered.length === 0 && html`<li class="tree-empty">No repositories match.</li>`}
            </ul>
          </div>
        ` : null}
      ` : html`
        <div class="gh-repobar">
          <button class="gh-repochip" onClick=${() => setShowList(true)} title="Change repository">
            <${Icon} name=${repo.readOnly ? 'material-symbols:public' : 'material-symbols:folder-open'} /> ${repo.full}
            ${repo.readOnly && html`<span class="gh-ro">read-only</span>`}
          </button>
          <select class="gh-branch" value=${branch} onChange=${e => github.selectBranch(e.target.value)}>
            ${(branches ?? [branch]).map(b => html`<option value=${b}>${b}</option>`)}
          </select>
        </div>

        ${github.canWrite() && html`
          <div class="tree-rootbar">
            <button class="rowmenu-btn" title="New file"   onClick=${rootNewFile}><${Icon} name="material-symbols:note-add-outline" /></button>
            <button class="rowmenu-btn" title="New folder" onClick=${rootNewFolder}><${Icon} name="material-symbols:create-new-folder-outline" /></button>
            ${clipboard.value?.source === 'github' && html`<button class="rowmenu-btn" title="Paste" onClick=${rootPaste}><${Icon} name="paste" /></button>`}
          </div>`}

        <div class="filebrowser-body">
          ${loadingTree && html`<div class="none"><${Icon} name="material-symbols:hourglass-empty" /><br/>Loading tree…</div>`}
          ${treeErr && html`<div class="gh-error"><${Icon} name="material-symbols:error-outline" /> ${treeErr}</div>`}
          ${rootTree && !loadingTree && html`
            <ul class="tree-root">
              ${rootTree.map(entry => html`<${GitHubTree} key=${entry.path} entry=${entry} prefix="" depth=${0} />`)}
            </ul>`}
        </div>
      `}
    </${Modal}>`;
}
