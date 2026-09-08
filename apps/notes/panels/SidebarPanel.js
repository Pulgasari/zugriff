// notes :: panels/SidebarPanel.js

import Button     from '/.shared/js/components/Button.js';
import Icon       from '/.shared/js/components/Icon.js';
import InstallTip from '/.shared/js/components/InstallTip.js';

import SourceBlock from './../components/SourceBlock.js';

const app = zugriff.app;

function SidebarPanel () {
  return html`
    <aside class=${'sidebar' + (app.state.isNavOpen ? ' open' : '')}>
      <div class="brand">
        <${Icon} name="notes" /> <span>Notes</span>
        <${Button} class="ibtn nav-close" icon='close' aria-label="Close" onClick=${() => app.state.isNavOpen = false} />
      </div>

      <div class="tree-filter">
        <${Icon} name="search" />
        <input type="search" placeholder="Filter notes…" value=${app.state.filter} onInput=${e => app.state.filter = e.target.value} />
        ${app.state.filter && html`<${Button} class="ibtn" icon='close' aria-label="Clear" onClick=${() => app.state.filter = ''} />`}
      </div>

      <div class="tree">
        ${app.lib.sources.value.length
          ? app.lib.sources.value.map(s => html`<${SourceBlock} key=${s.id} source=${s} />`)
          : html`<p class="tree-hint">No folders open yet.</p>`}
      </div>

      <div class="side-foot">
        <${InstallTip} show=${app.lib.sources.value.length > 0} />
        <${Button} class="small" icon='folder-add' label='Open a folder' onClick=${addFolder} />
      </div>
    </aside>
  `;
}

export default SidebarPanel;
