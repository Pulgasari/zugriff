# zugriff

- demo: [zugriff](https://pulgasari.github.io/zugriff/)
- spec: [spec.md](spec.md)

---

- [vfs.js](vfs.js) virtual file sytem
- [worker.js](worker.js)

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

for caching and storage stuff we gonna use [@bunker](https://code.pulgasari.dev/bunker/).

### @domina

for dom manipulation stuff we gonna use [@domina](https://code.pulgasari.dev/domina/).

### utils

- `@pulgasari/is`
- `@pulgasari/str`
