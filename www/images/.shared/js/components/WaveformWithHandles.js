// shared/js/components/WaveformWithHandles.js

import { html, useRef } from './../vendors.js';
import Waveform from './Waveform.js';

const fmtT = s => Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0');

function WaveformWithHandles ({ peaks, start, end, duration, playPos, onChange }) {
  const wrapRef = useRef(null);

  const xToTime = clientX => {
    if (!wrapRef.current) return 0;
    const r = wrapRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration));
  };

  // the parent owns the clamping (min gap between the handles etc.), we only
  // report the raw time the pointer is over
  const startDrag = which => event => {
    event.preventDefault();
    const move = ev => onChange(which, xToTime(ev.clientX));
    const up   = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  if (!peaks) return null;

  return html`
    <div class="waveform-wrap" ref=${wrapRef}>

      <${Waveform} ...${{ duration, end, start, peaks, playPos }} />

      <div class="handle handle-s" style=${'left:' + (start / duration * 100).toFixed(3) + '%'}
           onMouseDown=${startDrag('start')}>
        <div class="handle-label">${fmtT(start)}</div>
      </div>

      <div class="handle handle-e" style=${'left:' + (end / duration * 100).toFixed(3) + '%'}
           onMouseDown=${startDrag('end')}>
        <div class="handle-label">${fmtT(end)}</div>
      </div>

    </div>`;
}

export       { WaveformWithHandles };
export default WaveformWithHandles;
