// downloader :: components/Grabber.js
// links in, packages out: a field to paste into, the clipboard, and what the
// plugins found, grouped, to look through before it starts.

import { useState } from 'preact/hooks';

import * as engine  from '../modules/engine.js';
import * as grabber from '../modules/grabber.js';

const app = zugriff.app;
const fmt = zugriff.fmt;

const Empty = await zugriff.component('Empty');

const TARGETS = [['library', 'library'], ['folder', 'folder'], ['webdav', 'webdav'], ['save', 'save']];

export async function grabText (text) {
  const count = await grabber.grab(text);
  if (!count) app.toast({ warning: 'no links in there' });
  else app.go('grab');
  return count;
}

async function fromClipboard () {
  try   { await grabText(await navigator.clipboard.readText()); }
  catch { app.toast({ warning: 'the clipboard can not be read here, paste into the field' }); }
}

async function start (group, target) {
  const entries = group.entries.filter(entry => entry.selected);
  if (!entries.length) return;
  await engine.add({ entries, name: group.name, target });
  grabber.drop(group.id);
  if (!grabber.found.peek().length) app.go('queue');
}

function Group ({ group }) {
  const [target, setTarget] = useState(app.state.$target ?? 'library');
  const chosen = group.entries.filter(entry => entry.selected);
  const size   = chosen.reduce((sum, entry) => sum + (entry.size ?? 0), 0);
  const all    = chosen.length === group.entries.length;

  return html`
    <section class='package found'>
      <header>
        <input type='checkbox' checked=${all} title='all' onChange=${() => group.entries.forEach(entry => grabber.update(group.id, entry.id, { selected: !all }))} />
        <input class='name' type='text' value=${group.name} onChange=${event => grabber.update(group.id, null, { name: event.currentTarget.value })} />
        <span class='status'>${chosen.length}/${group.entries.length}${size ? ` · ${fmt.bytes(size)}` : ''}</span>
        <btn-icon icon='lucide:x' title='drop' onClick=${() => grabber.drop(group.id)} />
      </header>
      ${group.entries.map(entry => html`
        <label key=${entry.id} class='entry' data-error=${entry.error ? '' : null}>
          <input type='checkbox' checked=${entry.selected} disabled=${Boolean(entry.error)} onChange=${() => grabber.update(group.id, entry.id, { selected: !entry.selected })} />
          <span class='body'>
            <span class='name'>${entry.name}</span>
            <span class='status'>${entry.error ?? [entry.kind === 'hls' ? 'hls stream' : '', entry.size ? fmt.bytes(entry.size) : '', entry.plugin ?? new URL(entry.url).hostname].filter(Boolean).join(' · ')}</span>
          </span>
        </label>
      `)}
      <footer>
        <input-value look='segments' value=${target} onChange=${event => setTarget(event.currentTarget.value)}>
          ${TARGETS.map(([value, label]) => html`<input-option value=${value}>${label}</input-option>`)}
        </input-value>
        <btn-push icon='lucide:download' label='start' disabled=${!chosen.length} onClick=${() => start(group, target)} />
      </footer>
    </section>
  `;
}

export function Grabber () {
  const [text, setText] = useState('');
  const found = grabber.found.value;

  async function submit (event) {
    event.preventDefault();
    if (await grabText(text)) setText('');
  }

  return html`
    <form class='grab' onSubmit=${submit}>
      <textarea rows='4' placeholder='paste links, one or many, in any text' value=${text} onInput=${event => setText(event.currentTarget.value)}></textarea>
      <div class='actions'>
        <btn-push icon='lucide:clipboard-paste' label='from the clipboard' onClick=${fromClipboard} />
        <btn-push icon='lucide:search' label=${grabber.busy.value ? `finding … ${grabber.pending.value}` : 'find links'} disabled=${!text.trim() || grabber.busy.value} onClick=${submit} />
      </div>
    </form>
    ${found.length
      ? html`
        <div class='found-head'>
          <span>${found.length} ${found.length === 1 ? 'package' : 'packages'}</span>
          <btn-push icon='lucide:download' label='start all' onClick=${() => found.forEach(group => start(group, app.state.$target ?? 'library'))} />
          <btn-push icon='lucide:x' label='clear' onClick=${grabber.clear} />
        </div>
        ${found.map(group => html`<${Group} key=${group.id} group=${group} />`)}`
      : html`<${Empty} icon='lucide:link' title='No links yet' hint='paste them above, drop them on the app or share them into it' />`}
  `;
}

export default Grabber;
