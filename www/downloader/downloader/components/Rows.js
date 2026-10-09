// downloader :: components/Rows.js
// a download as a row and a package as a card of them. a row swiped left is
// removed, the bytes it had with it.

import { dismissable }       from '@aufbau/gestures';
import { useEffect, useRef } from 'preact/hooks';

import * as engine           from '../modules/engine.js';
import { inspect, selected } from '../modules/frame.js';

const fmt                = zugriff.fmt;

const STATES = {
  cancelled : 'lucide:circle-slash',
  done      : 'lucide:circle-check',
  failed    : 'lucide:circle-alert',
  paused    : 'lucide:circle-pause',
  queued    : 'lucide:clock',
  running   : 'lucide:circle-arrow-down',
};

// 0..1, or null while the size is not known
export function progressOf (download, meter) {
  if (download.state === 'done') return 1;
  if (download.kind === 'hls' && download.segments) return (download.segment ?? 0) / download.segments;
  const received = meter?.received ?? download.received ?? 0;
  const total    = meter?.total ?? download.size;
  return total ? Math.min(1, received / total) : null;
}

export const seconds = value => {
  if (value == null || !isFinite(value)) return '';
  const total = Math.round(value);
  if (total < 60) return `${total} s`;
  if (total < 3600) return `${Math.floor(total / 60)} min ${total % 60} s`;
  return `${Math.floor(total / 3600)} h ${Math.floor(total / 60) % 60} min`;
};

function statusOf (download, meter) {
  if (download.state === 'running' && meter) {
    const received = fmt.bytes(meter.received ?? download.received);
    const total    = meter.total ?? download.size;
    return [total ? `${received} of ${fmt.bytes(total)}` : received, meter.speed ? `${fmt.bytes(meter.speed)}/s` : '', meter.eta ? seconds(meter.eta) : ''].filter(Boolean).join(' · ');
  }
  if (download.state === 'done')   return [fmt.bytes(download.size ?? download.received), download.place].filter(Boolean).join(' · ');
  if (download.error)              return download.error;
  if (download.kind === 'hls' && download.segments) return `${download.segment ?? 0} of ${download.segments} segments`;
  if (download.received)           return `${fmt.bytes(download.received)}${download.size ? ` of ${fmt.bytes(download.size)}` : ''}`;
  return download.state;
}

function Actions ({ download }) {
  const { id, state } = download;
  return html`
    <span class='actions'>
      ${(state === 'running' || state === 'queued') && html`<btn-icon icon='lucide:pause' title='pause' onClick=${() => engine.pause(id)} />`}
      ${state === 'paused'                           && html`<btn-icon icon='lucide:play' title='resume' onClick=${() => engine.resume(id)} />`}
      ${(state === 'failed' || state === 'cancelled') && html`<btn-icon icon='lucide:rotate-cw' title='retry' onClick=${() => engine.retry(id)} />`}
      <btn-icon icon='lucide:x' title='remove' onClick=${() => engine.remove(id)} />
    </span>
  `;
}

export function DownloadRow ({ download }) {
  const ref   = useRef(null);
  const meter = engine.live.value[download.id];
  const done  = progressOf(download, meter);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let moved = false;
    const handle = dismissable(node, { directions: ['left'], onDismiss: () => engine.remove(download.id), onMove: ({ offset }) => { if (Math.abs(offset) > 8) moved = true; } });

    // a pan that moved the row is no click on it
    const down  = () => { moved = false; };
    const click = event => { if (moved) { event.stopPropagation(); moved = false; } };
    node.addEventListener('pointerdown', down, true);
    node.addEventListener('click', click, true);

    return () => {
      handle.destroy();
      node.removeEventListener('pointerdown', down, true);
      node.removeEventListener('click', click, true);
    };
  }, [download.id]);

  return html`
    <div ref=${ref} class='download' data-state=${download.state} aria-current=${selected.value === download.id ? 'true' : null}>
      <svg-icon icon=${STATES[download.state]} />
      <button type='button' class='body' onClick=${() => inspect(download.id)}>
        <span class='name'>${download.name}</span>
        <span class='status'>${statusOf(download, meter)}</span>
        ${download.state !== 'done' && html`<progress max='1' value=${done ?? undefined}></progress>`}
      </button>
      <${Actions} download=${download} />
    </div>
  `;
}

export function PackageCard ({ pack, rows }) {
  const received = rows.reduce((sum, row) => sum + (engine.live.value[row.id]?.received ?? row.received ?? 0), 0);
  const total    = rows.reduce((sum, row) => sum + (row.size ?? 0), 0);
  const done     = rows.filter(row => row.state === 'done').length;
  const running  = rows.some(row => row.state === 'running' || row.state === 'queued');
  const stopped  = rows.some(row => row.state === 'paused' || row.state === 'failed');

  return html`
    <section class='package'>
      <header>
        <svg-icon icon='lucide:package' />
        <span class='name'>${pack?.name ?? 'downloads'}</span>
        <span class='status'>${done}/${rows.length}${total ? ` · ${fmt.bytes(received)} of ${fmt.bytes(total)}` : ''}</span>
        ${pack && html`
          ${running && html`<btn-icon icon='lucide:pause' title='pause all' onClick=${() => engine.pausePackage(pack.id)} />`}
          ${stopped && !running && html`<btn-icon icon='lucide:play' title='resume all' onClick=${() => engine.resumePackage(pack.id)} />`}
          <btn-icon icon='lucide:trash-2' title='remove the package' onClick=${() => engine.removePackage(pack.id)} />
        `}
      </header>
      ${rows.map(row => html`<${DownloadRow} key=${row.id} download=${row} />`)}
    </section>
  `;
}

export default DownloadRow;
