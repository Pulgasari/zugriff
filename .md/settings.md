## settings

`shared/js/lib/settings.js` describes a setting well enough for the panel to render it without knowing what it means, so a new one is a single schema entry:

```javascript
export const launcher = defineSettings('zugriff:launcher', {
  'filter-position' : { type: 'enum', values: ['top', 'bottom'], default: 'bottom' },
  'filter-sticky'   : { type: 'boolean', default: true },
});
```

three types so far — `boolean`, `enum`, `color`. 

- an enum with more than four options renders as a `<aufbau-picker look='combobox'>`, fewer as segments;
- an entry can override that with its own `look`.
- keys are shown verbatim in the ui, no label mapping.
- every setting is a persisted signal, so it survives a reload and syncs across tabs.
- the panel lives between the header and the app's body;
- `Shell` puts the button in every tool-app's header,
- and an app that has no settings of its own still gets the theme group.
- per-app settings would use the slug as their namespace ...
- ... the theme group deliberately does not — picking an accent in one app picks it in all of them.

### themes

- a preset is only three colours (`bg`, `fg`, `accent`) in `shared/js/data/themes.js`.
- everything else in the palette is derived from those in `shared/css/theme.css`, so the panel writes three custom properties
onto `:root` and the whole thing repaints.
- editing a colour by hand switches the preset to `custom`.
