// podcasts :: components/Artwork.js

import { useSignal } from '@aufbau/signals';
import { useEffect } from 'preact/hooks';
import Icon from '/.shared/js/components/Icon.js';

const app = zugriff.app;
const { thumbs } = app;

export default function Artwork ({ src, size = 48, className = '', onClick }) {
  // phase: 'pending' | 'ready' (thumb) | 'orig' (fallback to source) | 'none'
  let state = useSignal({ url: null, phase: src ? 'pending' : 'none', broken: false });

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

  const tag = onClick ? 'button' : 'div';
  if (onClick) className += ' not-a-button';

  const onError = () => state = { broken: true };
  
  const pic = onClick
    ? html`<img loading='lazy' src=${state.url} onError=${onError} />`     
    : html`<${Icon} name='mdi:podcast' />`;

  return onClick
    ? html`<button class=${'art ' + className}>${pic}</button>`          
    : html`<div    class=${'art ' + className}>${pic}</div>`
}
