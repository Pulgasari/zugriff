# concept: tools

an idea, not a plan. built so far: the tools as one app, one view each, as
they were (app.js, tools.js, views/). the families, chains, the shared input
and output and the lab below are not.

the 30 single tools under `tools/` as one app: a shelf of small tools with one
shell around them, and a lab to try out features before an app gets them.

## why

- one install instead of thirty, one apk in capacitor
- the same things written once: input from paste, drop, file or url; output to
  copy, download, a folder or webdav; options; a history
- tools that belong together become one: today there are four json tools,
  four for yaml and toml, three minifiers that only differ in the language

## families

| family   | tools today                                                     | becomes |
|----------|------------------------------------------------------------------|---------|
| data     | json, yaml, toml, csv, xml: converter, formatter, inspector, minifier | one tool per format with modes: convert to, format, minify, inspect (`media-json` / `data-tree`) |
| code     | css, js, html minifier                                            | one minifier, the language from the file |
| encode   | base64 encoder, decoder                                           | encode and decode, later url, hex, hashes |
| generate | uuid, password, svg pixel pattern                                 | as they are |
| image    | converter, batch processor, icon generator, pixel art, colorpicker | as they are, the batch processor takes the converter's options |
| svg      | svg converter                                                     | joins image |
| audio    | converter, cutter, snippets generator                             | as they are |
| pdf      | pdf extractor                                                     | as it is |
| network  | downloader                                                        | moves out to `apps/downloader` |

## a tool

one module, loaded when it is opened:

```js
export default {
  slug    : 'json',
  name    : 'JSON',
  icon    : 'lucide:braces',
  family  : 'data',
  accepts : ['application/json', '.json'],             // what it can open
  options : { indent: { type: 'number', default: 2 } }, // a @aufbau/gui spec

  // text, a Blob or a list of files in, the same out
  run : async (input, options, ctx) => ({ output: format(input, options), type: 'application/json' }),

  // optional: an own view instead of the shell's input and output
  view : null,
};
```

the shell gives every tool:

- **input**: paste, drop, pick a file, a url (through `http.js`), and the output
  of the previous tool
- **output**: preview (`media-file` by type), copy, download, save to a granted
  folder or a webdav place
- **options**: an `app-config` from the spec, remembered per tool
- **history**: the last runs with their input, to redo one

the tool list is `tools.js` in this app, so nothing is listed twice.

## chains

the output of one tool is the input of the next: `csv → json → minify →
base64`. a chain is a list of `{ slug, options }`, can be saved and named. this
is cyberchef's recipe idea, small.

## opening files

the manifest gets `file_handlers` for what the tools accept (as `apps/images`
does), and a `share_target`. a file opened with zugriff tools goes to the tool
that accepts it, several fitting tools are offered.

## the lab

a family of its own, for trying features before an app gets them: a page per
experiment (a new element, a gesture bundle, a widget, a css idea), with its
code next to it. it is where `widget-calculator`, the gestures playground or
the svg filters could be tried on a phone without building a whole app.

## routes

`/tools/` the shelf (families, search, recent), `/tools/<slug>` a tool,
`/tools/chain/<name>` a saved chain, `/tools/lab/<name>` an experiment. the old
`/tools/<slug>/` urls lead to the same tool, so links and installed pwas keep
working while they exist.

## open questions

- the name: `tools`, `kit`, `werkbank`?
- the standalone tools: removed once the app has them, or kept as thin pages
  that load the same module?
- the lab public, or only behind `?dev`?
- chains in the first version, or later?
