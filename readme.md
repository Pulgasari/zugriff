# zugriff

- cli: [zugriff](https://pulgasari.github.io/zugriff/cli/)

---

## about

- `/cli` basically is zugriff itself or the main app so to speak.
- `/apps` here a apps we build kinda like multiple sub-projects of zugriff
- `/shared` stuff used by all/multiple apps

## techstack

### @aufbau

the core we use gonna be `@aufbau/kits/preact-htm` containing all the aufbau-packages under one hood, combined with htm and preact (and some preact-extensions).

- `@aufbau/elements`
- `@aufbau/import`

### @bunker

for caching and storage stuff we gonna use [@bunker](https://github.com/pulgasari/bunker/).

### @domina

for dom manipulation stuff we gonna use [@domina](https://github.com/pulgasari/domina/).

### utils

- `@pulgasari/is`
- `@pulgasari/str`
