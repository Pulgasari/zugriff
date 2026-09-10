# todo

## `apps/code`

- [ ] geteilter editor-panel um mehrere files nebeneinander einzusehen/bearbeiten
- [ ] files in der fileList sticky machen können
- [ ] editor-settings je filetype/ext setzbar

```
// the iconify svg api serves one file per `prefix:name`, and a given name is effectively
// immutable. cache each icon hard (long ttl, no network within it) so the public api is hit
// once and then not again — uncached, every <aufbau-icon> re-requests it on each render until
// the api answers 429, and a 429 carries no access-control-allow-origin, which is what makes a
// mask-image (loaded cross-origin in cors mode) fail its cors check in the console.
```
