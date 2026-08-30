// shared/js/components/Dropzone.js
//
// wraps <aufbau-upload look='dropzone'>. the element handles the drag/drop and
// the file dialog, we translate its files into the entry shape the apps expect
// and hand them to a signal. the element's own file list stays empty — every
// app renders its own.

import { html, useEffect, useRef } from '@aufbau/kits/preact-htm';

let nextId = 0;

function toEntry (file) {
  return {
    file,
    id         : nextId++,
    status     : 'pending',
    blobUrl    : null,
    outName    : null,
    error      : null,
    previewUrl : URL.createObjectURL(file),
  };
}

function Dropzone ({
  accept   = '*/*',
  multiple = true,
  sig,
  what     = 'files',
  text,
  onFiles,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = event => {
      const files = event.detail?.files ?? [];
      if (!files.length) return;

      const entries = files.map(toEntry);
      if (sig) sig.value = [...sig.value, ...entries];
      onFiles?.(entries);

      // consume — the app owns the list from here on
      el.clear?.();
    };

    el.addEventListener('aufbau-upload', handler);
    return () => el.removeEventListener('aufbau-upload', handler);
  }, [sig, onFiles]);

  return html`
    <aufbau-upload
      ref=${ref}
      class='dropzone'
      look='dropzone'
      accept=${accept}
      multiple=${multiple}
      text=${text ?? `drop ${what} here or click to browse`}
    ></aufbau-upload>`;
}

export       { Dropzone, toEntry };
export default Dropzone;
