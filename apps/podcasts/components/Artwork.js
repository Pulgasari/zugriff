// apps/podcasts/components/Artwork.js

import { useSignal } from '@aufbau/signals';
import { useEffect } from 'preact/hooks';
import Icon from '/.shared/js/components/Icon.js';

const app = zugriff.app;
const { thumbs } = app;

export default function Artwork ({ src, size = 48, className = '' }) {
  // phase: 'pending' | 'ready' (thumb) | 'orig' (fallback to source) | 'none'
  const state = useSignal({ url: null, phase: src ? 'pending' : 'none', broken: false });

  useEffect(() => {
    if (!src) { state = { url: null, phase: 'none', broken: false }; return; }
    const cached = thumbs.peek(src);
    if (cached) { state = { url: cached, phase: 'ready', broken: false }; return; }

    state = { url: null, phase: 'pending', broken: false };
    let alive = true;
    thumbs.request(src).then(url => {
      if (!alive) return;
      state = url ? { url: url, phase: 'ready', broken: false }
                  : { url: src, phase: 'orig',  broken: false };
    });
    return () => { alive = false; };
  }, [src]);

  const showImg = (state.phase === 'ready' || state.phase === 'orig') && !state.broken;

  return showImg
    ? html`<img 
              class=${'art ' + className}
              src=${state.url}
              alt="" 
              loading="lazy"
              width=${size} height=${size}
              onError=${() => state = { broken: true }} 
              />`
    : html`<span 
            class=${'art art-fallback ' + className}
            style=${`width:${size}px;height:${size}px`}>
             <${Icon} name="mdi:podcast" />
           </span>`;
}
