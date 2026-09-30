# todo

wir fangen jetzt mal an `apps/files` neu zu bauen mit:
- `<app-root>`
- `<app-view>`
- `<aufbau-index>`
- usw.

reicht auch wenn wir erstmal machen:
- "manager/library" view
- settings view
- und generelles app-grundgerüst
- die andern views könne. wir auch ersma nur andeuten
- das app-eigene css wirklich minimalistisch halten

und
- das doppelklick zeug weg (wenigstens an mobile? oder gar einstellbar?)

an den stellen wo da mit dem bestehenden kollidieren machen wir einfach iwas temporäres mit ner `2` hinten dran. also falls wir jetzt iwie `zugriff.app2` brauchen oder sowas.

und generell: wo uns auffällt dass eigemtlich hier oder dort noch iwas an ner component oder element oder sonstwas,können wirdas auch bauen, ggf vorher besprechen

ich hab in auf `aufbau/css` noch angefangen bissl was umzustellen aber hab glaube mittendrin aufgehört. könnten wa gleich mitfixen
- `reset.css` extra
- ich hab rausgefunden durch tests, dass das funktioniert, dass man die type defs quasi re-usen kann bei `attr()` und `@property` (obs bei custom function parametern auch geht, konnte ich vorhin nich mehr testen, aber ich vermute nein)
```js
:root {
  --syntax-density  : "compact | normal | comfortable | touch";
  --syntax-geometry : "sharp | soft | round | pill";
  --syntax-palette  : "<color> | <custom-ident>";
  --syntax-scheme   : "auto | light | dark";
  --syntax-skin     : "monochrome";
}

@property --density  { inherits: true; initial-value: normal;     syntax: var(--syntax-density); }
@property --geometry { inherits: true; initial-value: soft;       syntax: var(--syntax-geometry); }
@property --palette  { inherits: true; initial-value: zombie;     syntax: var(--syntax-palette); }
@property --scheme   { inherits: true; initial-value: auto;       syntax: var(--syntax-scheme); }
@property --skin     { inherits: true; initial-value: monochrome; syntax: var(--syntax-skin); }
```

- und ich war geneell mit der aufteilung net ganz zufrieden weil iwie stellenweise verwirred udn find an umzubauen, aber das is ersma egal
