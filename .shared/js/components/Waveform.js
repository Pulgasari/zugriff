// components/Waveform.js
// stays a canvas of its own rather than wrapping <aufbau-waveform>. that element
// now takes precomputed `peaks` too (so the shared decode gap is closed), but it
// paints DOM bars for a single progress value — this view needs a selection
// range and a playhead drawn over the bars, which is a canvas overlay job. so
// the split is the rendering model, not the data: reach for <aufbau-waveform>
// for a plain progress waveform, this for the trim/seek editors.

import { html, useRef, useEffect } from '@aufbau/kits/preact-htm';

function Waveform ({ peaks, start, end, duration, playPos }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;

    const W = canvas.width  = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    if (!W || !H) return;

    const ctx    = canvas.getContext('2d');
    const style  = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--accent').trim() || '#3498db';
    const fg     = style.getPropertyValue('--fg').trim()     || '#ffffff';
    const sx     = (start / duration) * W;
    const ex     = (end   / duration) * W;
    const barW   = Math.max(1.5, W / peaks.length - 0.5);

    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < peaks.length; i++) {
      const x      = (i / peaks.length) * W;
      const inside = x >= sx && x <= ex;
      ctx.fillStyle   = inside ? accent : fg;
      ctx.globalAlpha = inside ? 0.85 : 0.15;
      ctx.fillRect(x, (H - peaks[i] * H * 0.85) / 2, barW, peaks[i] * H * 0.85);
    }
    ctx.globalAlpha = 1;

    if (playPos > 0) {
      ctx.fillStyle   = fg;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(playPos * W - 1, 0, 2, H);
      ctx.globalAlpha = 1;
    }
  }, [peaks, start, end, duration, playPos]);

  if (!peaks) return null;
  return html`<canvas ref=${canvasRef} class="waveform-canvas" />`;
}

export       { Waveform };
export default Waveform;
