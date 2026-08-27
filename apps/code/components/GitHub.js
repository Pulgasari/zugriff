// apps/code/components/GitHub.js
// the GitHub modal: paste a token to connect, pick a repo + branch, browse the
// tree and open files. saving a GitHub file commits it back (see state.js).

import { html, useState, useEffect } from '@aufbau/kits/preact-htm';
import * as github from './../github.js';
import Modal from './Modal.js';
import Icon from './Icon.js';
import GitHubTree from './GitHubTree.js';

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

export default function GitHub () {
  const user   = github.user.value;
  const repos  = github.repos.value;
  const repo   = github.repo.value;
  const branch = github.branch.value;
  const busy   = github.busy.value;
  const err    = github.error.value;

  const [pat,       setPat]       = useState('');
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

  // load the root tree when repo + branch are set
  useEffect(() => {
    if (!user || !repo || !branch) { setRootTree(null); return; }
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
  }, [user, repo && repo.full, branch]);

  const doConnect = async () => {
    try { await github.connect(pat); setPat(''); }
    catch (e) { github.error.value = e.message; }
  };

  const filtered = query
    ? repos.filter(r => r.full.toLowerCase().includes(query.toLowerCase()))
    : repos;

  // ── not connected ────────────────────────────────────────────────────────
  if (!user) {
    return html`
      <${Modal} id="github" title="GitHub">
        <div class="gh-connect">
          <p class="gh-hint">
            Paste a <strong>fine-grained personal access token</strong> with
            <em>Contents: read and write</em> on the repositories you want to edit.
            It is stored only on this device and sent only to GitHub.
          </p>
          <a class="gh-link" href=${TOKEN_URL} target="_blank" rel="noopener">
            <${Icon} name="material-symbols:open-in-new" size="16" /> Create a token
          </a>
          <input
            class="gh-input"
            type="password"
            placeholder="github_pat_…"
            value=${pat}
            onInput=${e => setPat(e.target.value)}
            onKeyDown=${e => e.key === 'Enter' && doConnect()}
            autoFocus
          />
          ${err && html`<div class="gh-error"><${Icon} name="material-symbols:error-outline" size="16" /> ${err}</div>`}
          <button class="btn-primary" disabled=${!!busy} onClick=${doConnect}>
            ${busy || 'Connect'}
          </button>
        </div>
      </${Modal}>`;
  }

  // ── connected ────────────────────────────────────────────────────────────
  const pickingRepo = showList || !repo;

  return html`
    <${Modal} id="github" title="GitHub">
      <div class="gh-head">
        <span class="gh-user">
          <${Icon} name="mdi:github" size="18" /> ${user.login}
        </span>
        <button class="gh-textbtn" onClick=${() => github.disconnect()}>Disconnect</button>
      </div>

      ${err && html`<div class="gh-error"><${Icon} name="material-symbols:error-outline" size="16" /> ${err}</div>`}

      ${pickingRepo ? html`
        <div class="gh-repopick">
          <div class="search-row">
            <${Icon} name="material-symbols:search" size="18" />
            <input class="gh-input" type="search" placeholder="Filter repositories…"
              value=${query} onInput=${e => setQuery(e.target.value)} />
          </div>
          ${busy && html`<div class="gh-busy">${busy}</div>`}
          <ul class="gh-repolist">
            ${filtered.map(r => html`
              <li key=${r.full} onClick=${() => { github.selectRepo(r); setShowList(false); }}>
                <${Icon} name=${r.private ? 'material-symbols:lock-outline' : 'material-symbols:public'} size="14" />
                <span class="gh-reponame">${r.full}</span>
              </li>`)}
            ${filtered.length === 0 && html`<li class="tree-empty">No repositories match.</li>`}
          </ul>
        </div>
      ` : html`
        <div class="gh-repobar">
          <button class="gh-repochip" onClick=${() => setShowList(true)} title="Change repository">
            <${Icon} name="material-symbols:folder-open" size="16" /> ${repo.full}
          </button>
          <select class="gh-branch" value=${branch} onChange=${e => github.selectBranch(e.target.value)}>
            ${(branches ?? [branch]).map(b => html`<option value=${b}>${b}</option>`)}
          </select>
        </div>

        <div class="filebrowser-body">
          ${loadingTree && html`<div class="none"><${Icon} name="material-symbols:hourglass-empty" size="24" /><br/>Loading tree…</div>`}
          ${treeErr && html`<div class="gh-error"><${Icon} name="material-symbols:error-outline" size="16" /> ${treeErr}</div>`}
          ${rootTree && !loadingTree && html`
            <ul class="tree-root">
              ${rootTree.map(entry => html`<${GitHubTree} key=${entry.path} entry=${entry} prefix="" depth=${0} />`)}
            </ul>`}
        </div>
      `}
    </${Modal}>`;
}
