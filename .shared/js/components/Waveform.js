// shared/js/components/Waveform.js
//
// stays a canvas of its own rather than wrapping <aufbau-waveform>: that
// element decodes its own audio from a `src` and paints a plain progress bar,
// while the audio apps here hand in peaks they already computed and need a
// selection range plus a playhead drawn on top.

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
