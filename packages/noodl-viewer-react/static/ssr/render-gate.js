'use strict';

/**
 * SSR render gating — decides when the server-side runtime is ready to
 * renderToString. Replaces the original template's fixed 1000-iteration
 * `triggerDidMount`/`_doUpdate` busy loop with two real signals:
 *
 * 1. `settle()` — drain the event loop until the runtime is quiescent: no
 *    update scheduled (`runtime.updateScheduled`, cleared by `_doUpdate`) and
 *    no tracked async work in flight (`isIdle`, wired by the server to its
 *    fetch shim so bundle loads and data fetches hold the render), for N
 *    consecutive turns. Server-side `platform.requestUpdate` is `setImmediate`,
 *    so scheduled updates fire on their own while we yield — settle only has to
 *    observe, plus re-run `triggerDidMount` so components that arrive from
 *    async bundle fetches get mounted (it is idempotent per node).
 *
 * 2. `createPageReadyGate()` — the SSR_PageLoading / SSR_PageReady handshake.
 *    A Page whose `onPageReady` signal input is connected announces itself with
 *    SSR_PageLoading during initialize; the server then holds the render until
 *    the graph fires the signal (SSR_PageReady) or a timeout passes. Pages that
 *    never announce don't gate anything.
 *
 * CommonJS on purpose: consumed both by the esbuild-bundled server and by Jest
 * (tests/ssr-render-gate.test.js) with no transform step. webpack copies the
 * whole static/ssr directory into the deploy runtime, so this travels with the
 * server template.
 */

/** One full event-loop turn. setTimeout (not setImmediate) so a "quiet turn"
 * costs real wall-clock time — an in-flight promise chain or I/O gap that
 * schedules nothing for a few microtask hops cannot exhaust the quiet budget
 * in under a millisecond the way a tight setImmediate spin could. */
function defaultTick() {
  return new Promise((resolve) => setTimeout(resolve, 1));
}

/**
 * Waits until the runtime looks quiescent.
 *
 * @param {object} runtime  NoodlRuntime — reads `updateScheduled` and calls
 *   `rootComponent.triggerDidMount()` each turn.
 * @param {object} [opts]
 * @param {() => boolean} [opts.isIdle]  Extra predicate; return false while
 *   async work the runtime cannot see (fetches) is in flight.
 * @param {number} [opts.quietTurns]  Consecutive quiet turns required.
 * @param {number} [opts.maxTurns]  Hard cap — a runtime that animates forever
 *   (e.g. a looping Animation node) never goes quiet; render what we have.
 * @param {() => Promise<void>} [opts.tick]  Injectable for tests.
 * @returns {Promise<{settled: boolean, turns: number}>}  `settled` is false
 *   only when the cap was hit.
 */
async function settle(runtime, opts) {
  const { isIdle = () => true, quietTurns = 10, maxTurns = 3000, tick = defaultTick } = opts || {};

  let quiet = 0;
  let turns = 0;
  while (quiet < quietTurns) {
    if (turns >= maxTurns) {
      return { settled: false, turns };
    }
    await tick();
    turns++;

    if (runtime.rootComponent && runtime.rootComponent.triggerDidMount) {
      runtime.rootComponent.triggerDidMount();
    }

    if (runtime.updateScheduled || !isIdle()) {
      quiet = 0;
    } else {
      quiet++;
    }
  }
  return { settled: true, turns };
}

/**
 * Tracks the SSR_PageLoading / SSR_PageReady handshake on a runtime's event
 * emitter. Subscribe BEFORE the runtime mounts (page initialize fires
 * SSR_PageLoading), then after settling call `whenReady()`.
 *
 * @param {{on: Function}} eventEmitter  The runtime's context event emitter.
 * @returns {{
 *   hasPendingPages: () => boolean,
 *   pendingPageIds: () => string[],
 *   whenReady: (timeoutMs?: number) => Promise<boolean>
 * }}  `whenReady` resolves true when every announced page signalled ready,
 *   false on timeout (render proceeds either way — degraded, not broken).
 */
function createPageReadyGate(eventEmitter) {
  const pending = new Set();
  const waiters = [];

  function check() {
    if (pending.size === 0) {
      while (waiters.length > 0) {
        waiters.pop()(true);
      }
    }
  }

  eventEmitter.on('SSR_PageLoading', (id) => {
    pending.add(id);
  });

  eventEmitter.on('SSR_PageReady', (id) => {
    pending.delete(id);
    check();
  });

  return {
    hasPendingPages() {
      return pending.size > 0;
    },
    pendingPageIds() {
      return Array.from(pending);
    },
    whenReady(timeoutMs) {
      if (pending.size === 0) return Promise.resolve(true);
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          const i = waiters.indexOf(onReady);
          if (i !== -1) waiters.splice(i, 1);
          resolve(false);
        }, timeoutMs === undefined ? 10000 : timeoutMs);
        // Some test emitters keep firing after resolution; make resolve one-shot.
        function onReady(ok) {
          clearTimeout(timer);
          resolve(ok);
        }
        waiters.push(onReady);
      });
    }
  };
}

/**
 * Wraps a fetch implementation with an in-flight counter, so `settle`'s
 * `isIdle` can hold the render while bundle loads and data fetches the
 * runtime's scheduler cannot see are still pending. Used by the SSR server
 * (around its node fetch shim) and by the client hydration path (around
 * `window.fetch` for the pre-hydration settle).
 *
 * @param {Function} fetchImpl  The fetch to delegate to.
 * @returns {{fetch: Function, isIdle: () => boolean, inFlight: () => number}}
 */
function createFetchTracker(fetchImpl) {
  let inFlight = 0;
  return {
    fetch: function () {
      inFlight++;
      let result;
      try {
        result = fetchImpl.apply(this, arguments);
      } catch (e) {
        inFlight--;
        throw e;
      }
      return Promise.resolve(result).then(
        (value) => {
          inFlight--;
          return value;
        },
        (error) => {
          inFlight--;
          throw error;
        }
      );
    },
    isIdle: () => inFlight === 0,
    inFlight: () => inFlight
  };
}

/**
 * Wraps an XMLHttpRequest constructor with the same in-flight counting as
 * `createFetchTracker`. The Parse-backed cloud data nodes (cloudstore.js), the
 * config service and cloud functions all use bare `XMLHttpRequest` — never
 * fetch — in the browser/SSR branch, and the query nodes auto-fetch on graph
 * load. Without this, those requests are invisible to `settle` and the server
 * renders before the data arrives.
 *
 * Completion hook: `readystatechange` with `readyState === DONE (4)`. Both the
 * browser and the `xmlhttprequest` node polyfill fire it on success, error
 * AND abort (the polyfill's handleError/abort call setState(DONE); the spec's
 * "request error steps" do the same), so one listener covers every outcome.
 *
 * @param {Function} XHRImpl  The XMLHttpRequest constructor to delegate to.
 * @returns {{
 *   XMLHttpRequest: Function,
 *   isIdle: () => boolean,
 *   inFlight: () => number
 * }}
 */
function createXhrTracker(XHRImpl) {
  let inFlight = 0;

  function TrackedXMLHttpRequest() {
    const xhr = new XHRImpl();
    let pending = false;

    function done() {
      if (pending) {
        pending = false;
        inFlight--;
      }
    }

    xhr.addEventListener('readystatechange', function () {
      if (xhr.readyState === 4) done();
    });

    const originalSend = xhr.send;
    xhr.send = function () {
      if (!pending) {
        pending = true;
        inFlight++;
      }
      try {
        return originalSend.apply(xhr, arguments);
      } catch (e) {
        done();
        throw e;
      }
    };

    return xhr;
  }

  return {
    XMLHttpRequest: TrackedXMLHttpRequest,
    isIdle: () => inFlight === 0,
    inFlight: () => inFlight
  };
}

module.exports = { settle, createPageReadyGate, createFetchTracker, createXhrTracker, defaultTick };
