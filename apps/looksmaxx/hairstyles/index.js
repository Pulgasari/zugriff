// apps/looksmaxx/hairstyles/index.js
//
// the built-in hairstyle overlays. each is a transparent image authored to sit
// over a head, with a face-shaped hole (fill-rule evenodd) so the face shows
// through. these starters are simple SVG silhouettes — placeholders that
// exercise the 2D-overlay engine (overlay.js); swap in real cut-out PNGs (or add
// more entries) for photoreal try-ons. the "Your PNG" button in the UI loads any
// image the user supplies without touching this list.

export const HAIRSTYLES = [
  { id: 'bob',   name: 'Bob',        src: './hairstyles/bob.svg'   },
  { id: 'long',  name: 'Long',       src: './hairstyles/long.svg'  },
  { id: 'curly', name: 'Curly',      src: './hairstyles/curly.svg' },
  { id: 'buzz',  name: 'Short',      src: './hairstyles/buzz.svg'  },
];
