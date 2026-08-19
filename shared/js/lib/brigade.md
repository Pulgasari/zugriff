# brigade — parallel work, two primitives

Reusable concurrency for zugriff apps, collected here so each app doesn't
re-grow its own. Interim home; a candidate to lift into its own package once it
has earned its shape across a few apps.

| file         | what it bounds                 | runs on                    |
| ------------ | ------------------------------ | -------------------------- |
| `pool.js`    | how many **promises** in flight | the calling thread          |
| `brigade.js` | how many **workers** busy       | a pool of Web Workers       |

They answer two different bottlenecks. Reach for `pool.js` when the work is
already off the main thread (network, disk, a library that has its own worker —
like pdf.js) and you only want to cap the fan-out. Reach for `brigade.js` when
the work itself is CPU-bound JavaScript that would jank the UI — parsing,
hashing, image decode/encode — and you want it on other threads.

## pool.js — a bounded concurrency gate

```javascript
import { createPool } from './pool.js';

const gate = createPool(3);                 // at most 3 at once
const cover = await gate(() => extract(file));
const all   = await gate.all(files, f => extract(f));   // whole batch, 3 at a time
```

`gate.active()`, `gate.pending()`, `gate.size()`, `gate.idle()` report the
counts. That's the whole surface — it schedules, it does no I/O of its own.

In use: the ebooks library scan (`apps/ebooks/db.js`) runs cover/metadata
extraction through one of these, three books at a time. The pdf.js worker, disk
reads and epub unzips overlap; the cap keeps a big folder from opening a flood
of parallel parses.

## brigade.js — a Web Worker pool

Both ends of the protocol live in the one file. The main thread stands up a
crew from a worker-module URL; the worker module answers jobs with `serve`.

```javascript
// main thread
import { createBrigade } from './brigade.js';

const crew  = createBrigade(new URL('./cover.worker.js', import.meta.url), { size: 4 });
const cover = await crew.run(bytes, [bytes]);            // 2nd arg: transferables (moved, not copied)
const many  = await crew.map(files, f => ({ payload: f.bytes, transfer: [f.bytes] }));
await crew.drain();                                       // all jobs settled
crew.terminate();
```

```javascript
// cover.worker.js
import { serve } from './brigade.js';

serve(async bytes => ({ result: await render(bytes) }));  // throw to reject that job
```

Defaults: `size` is `cores - 1`, clamped to `[2, 4]` — workers each hold their
own copy of the bytes they're handed, so the default stays memory-modest. The
wire format (`{ id, payload }` out, `{ id, ok, result }` back) is private;
`serve` speaks it so a worker author writes only the handler.

### Why ebooks uses `pool.js`, not `brigade.js` (yet)

The obvious next step for the ebooks scan is to move extraction into a brigade.
Two things make that a *measure-first*, not a *do-now*:

- **PDF is already off-thread.** pdf.js runs its parse/render in its own worker,
  so a brigade would nest a worker inside a worker for PDFs — little to gain
  beyond the canvas encode.
- **epub.js may not run in a worker unverified.** It reaches for `document` in
  places; cover extraction there also needs `OffscreenCanvas` instead of a DOM
  canvas. That has to be confirmed in a real browser before shipping it, which
  is why the live app takes the safe `pool.js` win today.

When those are settled, the worker side is a thin `serve(...)` around
`extractMeta`, dispatched through `crew.map` — the brigade is ready for it.
