// Setup the platform before anything else is loading
// This is a problem since we are calling the platform when importing
import '@noodl/platform-electron';

// For the GAT-004 leak instrumentation below. Both modules are loaded by nearly
// every spec anyway; importing them here only pins the wrapping to happen
// before any spec runs.
import Model from '../src/shared/model';
import { EventDispatcher } from '../src/shared/utils/EventDispatcher';

// Progress breadcrumbs: the CI runner kills a silent run after 900s, and
// without per-spec logging there is no way to tell WHERE it stalled. One log
// line per spec makes the last-started spec visible in the runner output.
//
// 🔴 **And WHERE is not WHY.** Three separate sessions have now lost a run to
// the 900s ceiling (2026-08-12 at 2476/~2700, and twice on 2026-08-27 at
// 2812 and 2711 of 2856), and each time the only diagnosis available from the
// log was the name of the last spec to start — which is a red herring, because
// a suite that is merely *slow* stops wherever the clock runs out. Nothing
// recorded the RATE, so "the machine was loaded" and "the suite has outgrown
// its ceiling" were indistinguishable, and `test.js`'s own docstring has been
// carrying that unresolved question since August.
//
// So this also reports elapsed time as it goes, and the slowest specs at the
// end. Two lines of output per hundred specs buys the one thing a timed-out run
// could never say: whether the suite is running at a steady rate or degrading.
declare const jasmine: TSFixme;
// Jasmine's boot.js defines these on window before the bundle loads; no
// @types/jasmine in this compilation, so declare them like `jasmine` above.
declare const beforeEach: TSFixme;
declare const afterEach: TSFixme;
if (typeof jasmine !== 'undefined' && jasmine.getEnv) {
  const PROGRESS_EVERY = 100;
  /** Slowest specs, kept small — this is a diagnosis aid, not a profiler. */
  const slowest: Array<{ name: string; ms: number }> = [];
  const started = Date.now();
  let done = 0;
  let specStart = 0;

  jasmine.getEnv().addReporter({
    specStarted(result: TSFixme) {
      console.log('[spec-start]', result.fullName);
      specStart = Date.now();
    },

    specDone(result: TSFixme) {
      const ms = Date.now() - specStart;
      done++;

      // Keep a bounded top-20 rather than every duration: the array is walked
      // on insert, and a reporter that costs time is a reporter that changes
      // the number it exists to measure.
      if (slowest.length < 20 || ms > slowest[slowest.length - 1].ms) {
        slowest.push({ name: result.fullName, ms });
        slowest.sort((a, b) => b.ms - a.ms);
        if (slowest.length > 20) slowest.pop();
      }

      if (done % PROGRESS_EVERY === 0) {
        const elapsed = (Date.now() - started) / 1000;
        // Rate over the whole run so far. A steady figure means a slow machine;
        // a falling one means the suite degrades as it goes, which is the shape
        // a leaked listener list produces.
        console.log(`[progress] ${done} specs in ${elapsed.toFixed(1)}s (${(done / elapsed).toFixed(2)}/s)`);
      }
    },

    jasmineDone() {
      const elapsed = (Date.now() - started) / 1000;
      console.log(`[progress] FINAL ${done} specs in ${elapsed.toFixed(1)}s`);
      console.log('[slowest] the 20 specs that cost the most:');
      for (const s of slowest) console.log(`[slowest] ${(s.ms / 1000).toFixed(2)}s  ${s.name}`);
    }
  });
}

// GAT-004 §0 — measure the leak before fixing it. The suspected mechanism
// (specs leak group-less listeners onto shared singletons, dispatch is O(n) over
// everything ever registered, so the suite degrades as it runs) fits every
// observation and has never been measured. These wrappers count what dispatch
// actually does, and time it, so the diagnosis is a number instead of a story.
// The [listeners] lines land beside the [progress] rate lines: if the rate falls
// while the arrays grow, that is the correlation; if the rate falls while they
// stay flat, the slowdown is somewhere else and GAT-004 must not "fix" this.
//
// Wrapping happens here, in test code, so the product pays nothing.
if (typeof jasmine !== 'undefined' && jasmine.getEnv && typeof beforeEach === 'function') {
  const stats = {
    modelCalls: 0,
    modelEntriesScanned: 0,
    modelMs: 0,
    dispatcherCalls: 0,
    dispatcherEntriesScanned: 0,
    dispatcherMs: 0
  };
  // Models whose listener array crossed 1000 — the accumulators GAT-004's fix
  // will need by name. Strong refs are fine: anything this big is a singleton.
  const bigModels: Array<{ model: TSFixme; name: string }> = [];

  // GAT-004 §1 — the fix. Measured on 2026-08-27 (seed 00697, quiet machine):
  // 587.6s of a 645.4s run — 91% — was spent inside Model.notifyListeners,
  // 578.5s of it in the EventDispatcher.instance fan-out, scanning a cumulative
  // 1.54e9 listener entries. EventDispatcher.instance ended with 11,338
  // listeners and NodeLibrary with 22,572, because specs register group-less
  // listeners on singletons and nothing ever removes them.
  //
  // The repair is a per-spec rollback, not a blanket removeAllListeners: every
  // listener added to ANY Model (or the EventDispatcher) between a spec's
  // global beforeEach and global afterEach is removed again in that afterEach,
  // by identity. Import-time and beforeAll registrations happen outside the
  // tracked window and are deliberately untouched — product singletons keep
  // their legitimate subscriptions, and a suite's beforeAll listeners survive
  // its own specs exactly as jasmine semantics promise.
  //
  // ⚠️ ALL spec-window registrations are rolled back, grouped or not. The
  // obvious refinement — exempt grouped listeners, since off(group) gives them
  // a removal path — was built and measured (2026-08-27, seed 00697): it
  // reclaimed NOTHING. EventDispatcher.instance ended at 11,338 either way,
  // because the leak is spec-created objects registering with group=this and
  // no lifecycle ever calling off. A removal path nobody calls is not a
  // removal path.
  //
  // ⚠️ The one pattern full rollback breaks: an app-lifetime singleton that
  // lazily registers its subscriptions behind a latch, when the first use is
  // inside a spec. The rollback strips the listeners, the latch stops them
  // coming back, and every later spec in that suite fails while the same specs
  // pass alone. Known instance: TraceSession.instance (`listening`); its spec
  // resets the latch in beforeEach. If a whole suite goes red after this line,
  // look for that shape before blaming the rollback.
  //
  // ⚠️ And a spec that relies on a listener registered by an EARLIER spec now
  // fails. That is a hidden inter-spec dependency and we want it visible.
  let trackingSpecWindow = false;
  let specAdditions: Array<{ target: TSFixme; list: 'listeners' | 'listenersOnce'; entry: TSFixme }> = [];
  const trackLastPush = (target: TSFixme, list: 'listeners' | 'listenersOnce') => {
    if (trackingSpecWindow) {
      specAdditions.push({ target, list, entry: target[list][target[list].length - 1] });
    }
  };

  const origModelOn = Model.prototype.on;
  Model.prototype.on = function (this: TSFixme, event: TSFixme, listener: TSFixme, group: TSFixme) {
    const result = origModelOn.call(this, event, listener, group);
    trackLastPush(this, 'listeners');
    if (this.listeners.length === 1001) {
      bigModels.push({ model: this, name: this.constructor?.name || '(anonymous Model)' });
    }
    return result;
  };

  const origModelOnce = Model.prototype.once;
  Model.prototype.once = function (this: TSFixme, event: TSFixme, listener: TSFixme) {
    const result = origModelOnce.call(this, event, listener);
    trackLastPush(this, 'listenersOnce');
    return result;
  };

  const origDispatcherOn = EventDispatcher.prototype.on;
  EventDispatcher.prototype.on = function (this: TSFixme, event: TSFixme, listener: TSFixme, group: TSFixme) {
    const result = origDispatcherOn.call(this, event, listener, group);
    trackLastPush(this, 'listeners');
    return result;
  };

  beforeEach(() => {
    specAdditions = [];
    trackingSpecWindow = true;
  });

  afterEach(() => {
    trackingSpecWindow = false;
    for (let i = specAdditions.length - 1; i >= 0; i--) {
      const { target, list, entry } = specAdditions[i];
      const arr = target[list];
      if (!arr) continue;
      const idx = arr.indexOf(entry);
      if (idx !== -1) arr.splice(idx, 1);
    }
    specAdditions = [];
  });

  // ⚠️ modelMs INCLUDES dispatcherMs: every Model notify fans out into
  // EventDispatcher.instance.notifyListeners before returning.
  const origModelNotify = Model.prototype.notifyListeners;
  Model.prototype.notifyListeners = function (this: TSFixme, event: TSFixme, args: TSFixme) {
    stats.modelCalls++;
    stats.modelEntriesScanned += this.listeners.length;
    const t0 = performance.now();
    const result = origModelNotify.call(this, event, args);
    stats.modelMs += performance.now() - t0;
    return result;
  };

  const origDispatcherNotify = EventDispatcher.prototype.notifyListeners;
  EventDispatcher.prototype.notifyListeners = function (this: TSFixme, event: string, args?: TSFixme) {
    stats.dispatcherCalls++;
    stats.dispatcherEntriesScanned += this.listeners.length;
    const t0 = performance.now();
    const result = origDispatcherNotify.call(this, event, args);
    stats.dispatcherMs += performance.now() - t0;
    return result;
  };

  let specsDone = 0;
  jasmine.getEnv().addReporter({
    specDone() {
      specsDone++;
      if (specsDone % 100 === 0) {
        const bigSum = bigModels.reduce((sum, entry) => sum + entry.model.listeners.length, 0);
        console.log(
          `[listeners] EventDispatcher.instance=${EventDispatcher.instance.listeners.length} ` +
            `models>1000=${bigModels.length} (${bigSum} entries) ` +
            `modelNotifyMs=${stats.modelMs.toFixed(0)} dispatcherNotifyMs=${stats.dispatcherMs.toFixed(0)}`
        );
      }
    },

    jasmineDone() {
      console.log(
        `[gat004] Model.notifyListeners: ${stats.modelCalls} calls, ` +
          `${stats.modelEntriesScanned} listener entries scanned, ${(stats.modelMs / 1000).toFixed(1)}s inside ` +
          `(includes dispatcher fan-out)`
      );
      console.log(
        `[gat004] EventDispatcher.notifyListeners: ${stats.dispatcherCalls} calls, ` +
          `${stats.dispatcherEntriesScanned} entries scanned, ${(stats.dispatcherMs / 1000).toFixed(1)}s inside`
      );
      console.log(`[gat004] EventDispatcher.instance ended with ${EventDispatcher.instance.listeners.length} listeners`);
      console.log(`[gat004] Models that crossed 1000 listeners: ${bigModels.length}`);
      for (const entry of bigModels) {
        console.log(`[gat004]   ${entry.name}: ${entry.model.listeners.length} listeners at end`);
      }
    }
  });
}

export * from './ai';
export * from './canvas';
export * from './cloud';
export * from './components';
export * from './databrowser';
export * from './git';
export * from './import-engine';
export * from './import-flow';
export * from './launcher';
export * from './lessons';
export * from './models';
export * from './nodegraph';
export * from './nodepicker';
export * from './platform';
export * from './project';
export * from './projectmerger';
export * from './projectpatcher';
export * from './services';
export * from './sidepanel';
export * from './utils';
export * from './schemas';
export * from './io';
export * from './structure';
export * from './validation';
export * from './versioning';
export * from './workflow';
