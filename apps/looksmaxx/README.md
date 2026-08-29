# looksmaxx

Try on **hair colours** and **hairstyles** on a still photo — entirely on device,
no camera stream, no server, no upload.

Load a portrait, and:

- **Recolour the hair.** [MediaPipe](https://ai.google.dev/edge/mediapipe)
  `ImageSegmenter` (the `hair_segmenter` model) produces a per-pixel hair mask;
  [`recolor.js`](./recolor.js) swaps the hue+saturation inside that mask while
  keeping each pixel's own lightness, so highlights and shadows survive and it
  reads as dyed hair, not paint. Pick a swatch or a custom colour, dial the
  intensity.
- **Put a hairstyle on.** MediaPipe `FaceLandmarker` finds the eyes and forehead;
  [`overlay.js`](./overlay.js) scales, rotates and anchors a transparent hairstyle
  image over the head (the fast, client-side "2D sticker" approach). Adjust size
  and height, or load your own cut-out PNG.

Then download the result as a PNG.

## how it's wired

| file | does |
|---|---|
| [`vision.js`](./vision.js)   | lazy MediaPipe singletons — hair segmenter + face landmarker, both IMAGE mode |
| [`recolor.js`](./recolor.js) | luminance-preserving hair recolour + the swatch palette |
| [`overlay.js`](./overlay.js) | places a 2D hairstyle image from the face landmarks |
| [`app.js`](./app.js)         | the UI, the compositing canvas and the download |
| [`hairstyles/`](./hairstyles/) | the built-in overlays + their registry |

The MediaPipe JS comes through the shared import map (`@mediapipe/tasks-vision`);
its WASM and the `.tflite`/`.task` models are fetched at runtime from a pinned
CDN version, so nothing large is vendored into the repo.

## status / limitations

- **Hair colour** is the solid part — it works on any clear photo.
- **Hairstyles** ship as simple SVG **silhouettes** (`hairstyles/*.svg`) — enough
  to exercise the overlay engine, not photoreal. Drop in real cut-out PNGs (or
  use the *Your PNG* button) for realistic try-ons. Generative AI inpainting
  (the photoreal route) needs a paid image API and is intentionally out of scope.
- Static photos only — the camera/realtime pipeline was deliberately not built.
