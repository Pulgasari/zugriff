# techstack

## rat

the apps are written in [rat](https://github.com/pulgasari/rat): `.rat.html` components, `.rat.js` modules,
`config.rat.js` per app. signals, types, router, commands, hotkeys, persistence (`@rat/bunker`) and the
drivers for web, capacitor and deno come from `@rat/*`.

## @aufbau

- `@aufbau/elements`: custom html elements (webcomponents)
- `@aufbau/gestures`

## @gestalt

look of the apps: palettes, density, geometry, webfonts, filters, patterns. its postcss plugin runs in a build.

## @domina

dom helpers, where an app needs them directly (`@domina/dom`, `@domina/verbs`).

## android

capacitor, through `rat build --target android`. native plugins live in `rat/packages/app/native/android`.
