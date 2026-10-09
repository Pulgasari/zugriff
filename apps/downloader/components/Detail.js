// downloader :: components/Detail.js
// the download in the context area: where it comes from, how far it is, what
// went wrong, and a finished file in the library shown by <media-file>.

import { useEffect, useState } from '/.shared/js/vendors.js';

import * as engine               from '../modules/engine.js';
import { closeDetail, selected } from '../modules/frame.js';
import { progressOf, seconds }   from './Rows.js';

const fmt = zugriff.fmt;
const app = zugriff.app;


function Preview ({ download }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let made = null;
    engine.fileOf(download.id).then(file => {
      if (!file?.size) return;
      made = URL.createObjectURL(file.type || !download.type ? file : new File([file], download.name, { type: download.type }));
      setUrl(made);
    });
    return () => { if (made) URL.revokeObjectURL(made); };
  }, [download.id, download.state]);

  return url ? html`<media-file src=${url} type=${download.type ?? ''} label=${download.name}></media-file>` : null;
}

async function saveFile (download) {
  const file = await engine.fileOf(download.id);
  if (file) engine.save(file, download.name);
  else app.toast({ warning: 'the file is not in the library anymore' });
}

async function copy (text) {
  try   { await navigator.clipboard.writeText(text); app.toast({ success: 'copied' }); }
  catch { app.toast({ warning: 'the clipboard can not be written here' }); }
}

export function Detail () {
  const download = engine.downloads.value.find(item => item.id === selected.value);
  if (!download) return html`<app-panel heading='Download'><p class='hint'>Pick a download to see it here.</p></app-panel>`;

  const meter    = engine.live.value[download.id];
  const progress = progressOf(download, meter);
  const pack     = engine.packages.value.find(item => item.id === download.package);

  const facts = [
    ['state',     download.state + (progress != null && download.state !== 'done' ? ` · ${Math.round(progress * 100)} %` : '')],
    ['error',     download.error],
    ['speed',     meter?.speed ? `${fmt.bytes(meter.speed)}/s${meter.eta ? ` · ${seconds(meter.eta)} left` : ''}` : null],
    ['size',      download.size ? fmt.bytes(download.size) : null],
    ['received',  download.state !== 'done' && download.received ? fmt.bytes(meter?.received ?? download.received) : null],
    ['segments',  download.segments ? `${download.segment ?? 0} of ${download.segments}` : null],
    ['package',   pack?.name],
    ['target',    download.target],
    ['saved to',  download.place],
    ['type',      download.type],
    ['transport', download.transport],
    ['plugin',    download.plugin],
    ['hash',      download.hash ? `${download.hash.algorithm} ${download.hash.value}` : null],
    ['attempts',  download.attempts || null],
    ['etag',      download.etag],
    ['added',     new Date(download.created).toLocaleString()],
  ].filter(([, value]) => value != null && value !== '');

  return html`
    <app-panel heading=${download.name} key=${download.id}>
      <div class='detail'>
        ${download.state === 'done' && download.place === 'library' && html`<${Preview} download=${download} />`}
        <a class='url' href=${download.url} target='_blank' rel='noopener noreferrer'>${download.url}</a>
        <dl>${facts.map(([key, value]) => html`<dt>${key}</dt><dd>${value}</dd>`)}</dl>
        <div class='actions'>
          ${(download.state === 'running' || download.state === 'queued') && html`<btn-push icon='lucide:pause' label='pause' onClick=${() => engine.pause(download.id)} />`}
          ${download.state === 'paused' && html`<btn-push icon='lucide:play' label='resume' onClick=${() => engine.resume(download.id)} />`}
          ${(download.state === 'failed' || download.state === 'cancelled' || download.state === 'done') && html`<btn-push icon='lucide:rotate-cw' label=${download.state === 'done' ? 'again' : 'retry'} onClick=${() => engine.retry(download.id)} />`}
          ${download.state !== 'done' && download.state !== 'cancelled' && html`<btn-push icon='lucide:circle-slash' label='cancel' onClick=${() => engine.cancel(download.id)} />`}
          ${download.state === 'done' && download.place === 'library' && html`<btn-push icon='lucide:save' label='save' onClick=${() => saveFile(download)} />`}
          <btn-push icon='lucide:copy' label='copy link' onClick=${() => copy(download.url)} />
          <btn-push icon='lucide:trash-2' label='remove' onClick=${() => { engine.remove(download.id); closeDetail(); }} />
        </div>
      </div>
    </app-panel>
  `;
}

export default Detail;
