// apps/files/views/sync.js
// the sync view: send files to a device on the local network (modules/sync.js).
// pick a receiver (found, typed or one sent to before), collect files (picked,
// or sent here from the library), send. the transfer runs as a task, its
// progress and its history are the task area's. auto sync keeps a folder sent
// in the background. outside the android app the view says why it is empty.
//
// the frame's parts (Bar, IconButton, Action, Actions) come in as props, the
// view is a part of app.js and not an app of its own.

import { signal } from '@aufbau/signals';

import Icon from '/.shared/js/components/Icon.js';
import fmt  from '/.shared/js/modules/fmt.js';

const app  = zugriff.app;
const sync = await app.module('sync');

const chosen   = signal(null);     // the receiver the files go to
const address  = signal('');       // what was typed instead
const protocol = signal('https');
const pin      = signal('');
const ssid     = signal('');

const keyOf  = target => `${target.host}:${target.port}`;
const target = () => chosen.value ?? sync.parseTarget(address.value, protocol.value);

function choose (device) {
  chosen.value  = { alias: device.alias, fingerprint: device.fingerprint ?? '', host: device.ip ?? device.host, port: device.port ?? 53317, protocol: device.protocol ?? 'https' };
  address.value = '';
}

function Receiver ({ IconButton }) {
  const current = target();
  const found   = sync.devices.value;
  const before  = sync.targets.value.filter(other => !found.some(device => keyOf({ host: device.ip, port: device.port }) === keyOf(other)));

  const row = (device, { icon, removable }) => {
    const host     = device.ip ?? device.host;
    const selected = current && keyOf(current) === keyOf({ host, port: device.port ?? 53317 });
    return html`
      <li class=${selected ? 'row selected' : 'row'} key=${host + ':' + device.port}>
        <button class='entry' type='button' aria-pressed=${String(Boolean(selected))} onClick=${() => choose(device)}>
          <span class='thumb'><${Icon} name=${icon} /></span>
          <span class='text'>
            <span class='name'>${device.alias ?? host}</span>
            <small>${host}:${device.port ?? 53317} · ${device.protocol ?? 'https'}</small>
          </span>
        </button>
        ${removable && html`<${IconButton} icon='lucide:x' label=${`forget ${device.alias ?? host}`} onClick=${() => sync.forget(device)} />`}
      </li>
    `;
  };

  return html`
    <section>
      <div-x class='section-head'>
        <h2>Send to</h2>
        <${IconButton} icon='lucide:radar' label='search again' onClick=${sync.start} />
      </div-x>
      ${found.length || before.length
        ? html`<ul class='rows'>
            ${found.map(device => row(device, { icon: device.deviceType === 'mobile' ? 'lucide:smartphone' : 'lucide:monitor' }))}
            ${before.map(device => row(device, { icon: 'lucide:history', removable: true }))}
          </ul>`
        : html`<p class='hint'>Looking for devices on this network. A LocalSend app on the other side is enough.</p>`}

      <div class='address'>
        <input-text placeholder='address, ip:port or filesync://…' value=${address.value}
                    oninput=${event => { address.value = event.target.value ?? ''; chosen.value = null; }}></input-text>
        <input-value look='segments' value=${current?.protocol ?? protocol.value}
                       onchange=${event => { protocol.value = event.target.value; if (chosen.value) chosen.value = { ...chosen.value, protocol: event.target.value }; }}>
          ${sync.PROTOCOLS.map(name => html`<input-option value=${name}>${name}</input-option>`)}
        </input-value>
        <input-password placeholder='pin, if the receiver wants one' value=${pin.value} oninput=${event => { pin.value = event.target.value ?? ''; }}></input-password>
      </div>
    </section>
  `;
}

function Outbox ({ Action, Actions, IconButton }) {
  const files = sync.outbox.value;
  const size  = files.reduce((sum, file) => sum + Math.max(0, file.size), 0);

  return html`
    <section>
      <h2>Files</h2>
      ${files.length
        ? html`<ul class='rows'>
            ${files.map(file => html`
              <li class='row' key=${file.uri}>
                <span class='entry'>
                  <span class='thumb'><${Icon} name='lucide:file' /></span>
                  <span class='text'><span class='name'>${file.name}</span><small>${file.size >= 0 ? fmt.bytes(file.size) : ''}</small></span>
                </span>
                <${IconButton} icon='lucide:x' label=${`remove ${file.name}`} onClick=${() => sync.remove(file.uri)} />
              </li>
            `)}
          </ul>`
        : html`<p class='hint'>Pick files, or send them from the library: their details have a "send" button.</p>`}
      <${Actions}>
        <${Action} icon='lucide:file-plus' label='pick files' onClick=${() => sync.pickFiles().catch(err => app.toast.error(err))} />
        <button class='action primary' type='button' disabled=${!files.length || !target()}
                onClick=${() => sync.send(target(), files, pin.value).catch(err => app.toast.error(err))}>
          <${Icon} name='lucide:send' /> send${files.length ? ` ${files.length} · ${fmt.bytes(size)}` : ''}
        </button>
      </${Actions}>
    </section>
  `;
}

function AutoSync ({ Action, Actions }) {
  const state = sync.autoSync.value ?? {};
  const on    = Boolean(state.enabled);
  const run   = work => work().catch(err => app.toast.error(err));

  return html`
    <section>
      <h2>Auto sync</h2>
      <p class='hint'>A folder of this device goes to the receiver above on its own, whenever new files show up and the phone is on wi-fi. Subfolders included.</p>
      <dl class='facts'>
        <dt>folder</dt><dd>${state.name || (state.tree ? 'chosen' : 'none yet')}</dd>
        <dt>state</dt><dd>${on ? `on${state.lastSync ? ` · last ${fmt.date(state.lastSync)}` : ''}` : 'off'}</dd>
        ${on && html`<dt>to</dt><dd>${state.host}:${state.port}</dd>`}
      </dl>
      ${!on && html`<input-text placeholder='only on this wi-fi (ssid), optional' value=${ssid.value} oninput=${event => { ssid.value = event.target.value ?? ''; }}></input-text>`}
      <${Actions}>
        <${Action} icon='lucide:folder-search' label='folder' onClick=${() => run(sync.pickSyncFolder)} />
        ${on
          ? html`
            <${Action} icon='lucide:refresh-cw' label='now' onClick=${() => run(sync.syncNow)} />
            <${Action} icon='lucide:pause' label='turn off' onClick=${() => run(sync.stopAutoSync)} />`
          : html`<${Action} icon='lucide:play' label='turn on' disabled=${!state.tree || !target()}
                            onClick=${() => run(() => sync.startAutoSync(target(), { pin: pin.value, ssid: ssid.value }))} />`}
      </${Actions}>
    </section>
  `;
}

export default function SyncView (props) {
  const { Bar } = props;

  if (!sync.available()) return html`
    <${Bar} title='Send' />
    <div class='scroll'>
      <div-y class='hero'>
        <${Icon} name='lucide:send' />
        <h2>Only in the android app</h2>
        <p>Sending to devices on your network needs the app: a web page may not search the network or talk to a device by its address.</p>
      </div-y>
    </div>
  `;

  return html`
    <${Bar} title='Send'>
      ${sync.identity.value && html`<small class='identity'>${sync.identity.value.alias}</small>`}
    </${Bar}>
    <div class='scroll'>
      <${Receiver} ...${props} />
      <${Outbox} ...${props} />
      <${AutoSync} ...${props} />
    </div>
  `;
}

export { sync };
