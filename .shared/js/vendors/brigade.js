// shared/js/lib/brigade.js
//
// a small web-worker pool — a "brigade" of identical workers that chew through
// a queue of like jobs in parallel. you give it a worker module url; it spins
// up a handful of them, hands each free worker the next job, and resolves your
// promise when that worker answers. the point is cpu-bound work that would
// otherwise jank the main thread: parsing, hashing, image decode / encode.
//
// both ends of the protocol live here on purpose:
//
//   // main thread
//   import { createBrigade } from './brigade.js';
//   const crew  = createBrigade(new URL('./cover.worker.js', import.meta.url), { size: 4 });
//   const cover = await crew.run(bytes, [bytes]);              // 2nd arg: transferables
//   const many  = await crew.map(files, f => ({ payload: f.bytes, transfer: [f.bytes] }));
//   crew.terminate();
//
//   // cover.worker.js
//   import { serve } from './brigade.js';
//   serve(async bytes => ({ result: await render(bytes) }));
//
// the wire format is fixed and private to this file: the pool posts
// { id, payload } and a worker must answer { id, ok, result } or
// { id, ok:false, error }. `serve` speaks it for you, so a worker author only
// writes the handler.
//
// sizing: workers cost memory — each holds its own copy of the bytes it is
// handed — so the default stays modest: one per core, less one for the ui,
// clamped to [2, 4]. raise `size` for light jobs, drop it for heavy ones. the
// bound is the same lesson lib/thumbs.js and the ebooks scan already learned:
// parallel, but not unbounded.

const defaultSize = () => {
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  return Math.max(2, Math.min(4, cores - 1));
};

/**
 * create a worker pool over `url` (a module worker by default).
 *
 * @param {string|URL} url                the worker module
 * @param {object}   [opts]
 * @param {number}   [opts.size]          worker count (default: cores-1, clamped to [2,4])
 * @param {string}   [opts.type='module'] worker type
 * @param {()=>object} [opts.spawn]       factory for one worker; defaults to `new Worker(url,{type})`.
 *                                        injectable so the pool can be driven with a fake in tests.
 */
export function createBrigade (url, { size = defaultSize(), type = 'module', spawn } = {}) {
  const make    = spawn || (() => new Worker(url, { type }));
  const count   = Math.max(1, size | 0);
  const idle    = [];      // workers ready for a job
  const waiting = [];      // queued jobs with no free worker: { payload, transfer, resolve, reject }
  const jobs    = new Map; // id -> { resolve, reject, worker }
  const drains  = [];      // resolvers waiting for the pool to go quiet
  let workers   = null;    // spawned lazily on first run
  let seq       = 0;
  let dead      = false;

  const boot = () => {
    workers = Array.from({ length: count }, () => {
      const w = make();
      w.onmessage = ({ data }) => {
        const job = jobs.get(data?.id);
        if (!job) return;                                  // stale reply (job already failed / terminated)
        jobs.delete(data.id);
        if (data.ok) job.resolve(data.result);
        else         job.reject(new Error(data.error || 'worker job failed'));
        release(w);
      };
      // an error outside a job (bad import, syntax) surfaces here; drop the worker and fail its job
      w.onerror = e => { e?.preventDefault?.(); failWorker(w, e?.message || 'worker error'); };
      idle.push(w);
      return w;
    });
  };

  const assign = (w, job) => {
    const { payload, reject, resolve } = job;
    const id = ++seq;
    jobs.set(id, { reject, resolve, worker: w });
    try       { w.postMessage({ id, payload }, job.transfer || []); }
    catch (e) { jobs.delete(id); job.reject(e); release(w); }
  };

  const release = w => {
    if (dead) return;
    const next = waiting.shift();
    if (next) assign(w, next);
    else { idle.push(w); settleDrains(); }
  };

  // a worker died; the job it was holding loses and the worker is not re-used
  const failWorker = (w, msg) => {
    for (const [id, job] of jobs) {
      if (job.worker !== w) continue;
      jobs.delete(id);
      job.reject(new Error(msg));
    }
    const i = idle.indexOf(w);
    if (i >= 0) idle.splice(i, 1);
    if (!idle.length && jobs.size === 0) { while (waiting.length) waiting.shift().reject(new Error(msg)); }
    settleDrains();
  };

  const quiet        = () => waiting.length === 0 && jobs.size === 0;
  const settleDrains = () => { if (quiet()) { while (drains.length) drains.shift()(); } };

  return {
    /** run one job; resolves with the worker's result. `transfer` moves buffers instead of copying them. */
    run (payload, transfer) {
      if (dead) return Promise.reject(new Error('brigade terminated'));
      if (!workers) boot();
      return new Promise((resolve, reject) => {
        const job = { payload, transfer, resolve, reject };
        const w = idle.pop();
        if (w) assign(w, job);
        else waiting.push(job);
      });
    },

    /** run a job per item; `spec(item,i)` returns the payload, or { payload, transfer }. results keep input order. */
    map (items, spec = x => x) {
      return Promise.all(Array.from(items, (item, i) => {
        const s = spec(item, i);
        const { payload, transfer } = (s && typeof s === 'object' && 'payload' in s) ? s : { payload: s };
        return this.run(payload, transfer);
      }));
    },

    drain   : () => quiet() ? Promise.resolve() : new Promise(drains.push), // resolve once every queued and in-flight job has settled (resolved or rejected)   
    size    : () => count,
    active  : () => jobs.size,      // jobs on a worker right now
    pending : () => waiting.length, // jobs queued for a free worker

    /** stop every worker and reject anything still outstanding. */
    terminate () {
      dead = true;
      for (const job of waiting)  job.reject(new Error('brigade terminated'));
      for (const [, job] of jobs) job.reject(new Error('brigade terminated'));
      waiting.length = 0;
      jobs.clear();
      workers?.forEach(w => { try { w.terminate(); } catch { /* already gone */ } });
      workers = null;
      idle.length = 0;
      settleDrains();
    },
  };
}

/**
 * worker side: answer the pool's jobs. `handler(payload)` returns the result,
 * or `{ result, transfer }` to move buffers back instead of copying them.
 * throwing (or rejecting) reports the failure, which rejects that job's promise
 * on the main thread — the worker stays up for the next job.
 *
 * @param {(payload:any)=>any} handler
 * @param {object} [opts]
 * @param {object} [opts.scope]  the worker global; defaults to `self`. injectable for tests.
 */
export function serve (handler, { scope = (typeof self !== 'undefined' ? self : null) } = {}) {
  if (!scope) throw new Error('serve() must run inside a worker (no self)');
  scope.onmessage = async ({ data }) => {
    const { id, payload } = data || {};
    try {
      const out = await handler(payload);
      const { result, transfer } = (out && typeof out === 'object' && 'result' in out) ? out : { result: out };
      scope.postMessage({ id, ok: true, result }, transfer || []);
    } catch (err) {
      scope.postMessage({ id, ok: false, error: err?.message || String(err) });
    }
  };
}

export default createBrigade;
