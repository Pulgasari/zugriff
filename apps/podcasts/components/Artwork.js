// artwork, served from the on-device thumbnail cache. while the small copy is
// being generated a placeholder shows; if it can't be made (image unreachable),
// it falls back to the original url for display; if that is broken too, the
// placeholder stays. the original is thus downloaded at most once and never
// shown at full size on the happy path.
function Artwork ({ src, size = 48, className = '' }) {
  // phase: 'pending' | 'ready' (thumb) | 'orig' (fallback to source) | 'none'
  const st = useSignal({ url: null, phase: src ? 'pending' : 'none', broken: false });

  useEffect(() => {
    if (!src) { st.value = { url: null, phase: 'none', broken: false }; return; }
    const cached = thumbs.peek(src);
    if (cached) { st.value = { url: cached, phase: 'ready', broken: false }; return; }

    st.value = { url: null, phase: 'pending', broken: false };
    let alive = true;
    thumbs.request(src).then(u => {
      if (!alive) return;
      st.value = u ? { url: u,   phase: 'ready', broken: false }
                   : { url: src, phase: 'orig',  broken: false };
    });
    return () => { alive = false; };
  }, [src]);

  const s = st.value;
  const showImg = (s.phase === 'ready' || s.phase === 'orig') && !s.broken;

  return showImg
    ? html`<img class=${'art ' + className} src=${s.url} alt="" loading="lazy"
                width=${size} height=${size}
                onError=${() => { st.value = { ...st.value, broken: true }; }} />`
    : html`<span class=${'art art-fallback ' + className} style=${`width:${size}px;height:${size}px`}>
             <${Icon} name="mdi:podcast" />
           </span>`;
}

export default Artwork;
