/**
 * Unit tests for the SSR render gate (RUN-002 — busy-loop replacement).
 *
 * settle() decides when the server-side runtime is quiescent enough to
 * renderToString; createPageReadyGate() implements the SSR_PageLoading /
 * SSR_PageReady handshake for pages that gate the render explicitly.
 */
const EventEmitter = require('events');
const { settle, createPageReadyGate, createFetchTracker, createXhrTracker } = require('../static/ssr/render-gate');

// Instant tick so tests don't wait on real timers.
const tick = () => Promise.resolve();

function makeRuntime() {
  return {
    updateScheduled: false,
    rootComponent: {
      triggerDidMount: jest.fn()
    }
  };
}

describe('settle', () => {
  it('settles once the runtime stays quiet for quietTurns turns', async () => {
    const runtime = makeRuntime();
    const result = await settle(runtime, { tick, quietTurns: 5 });
    expect(result).toEqual({ settled: true, turns: 5 });
  });

  it('re-triggers didMount every turn (newly loaded components must mount)', async () => {
    const runtime = makeRuntime();
    await settle(runtime, { tick, quietTurns: 3 });
    expect(runtime.rootComponent.triggerDidMount).toHaveBeenCalledTimes(3);
  });

  it('resets the quiet counter while updates are scheduled', async () => {
    const runtime = makeRuntime();
    // Busy for the first 4 turns, then quiet.
    let turn = 0;
    Object.defineProperty(runtime, 'updateScheduled', { get: () => ++turn <= 4 });
    const result = await settle(runtime, { tick, quietTurns: 3 });
    expect(result.settled).toBe(true);
    expect(result.turns).toBe(7); // 4 busy + 3 quiet
  });

  it('holds the render while fetches are in flight (isIdle)', async () => {
    const runtime = makeRuntime();
    let inFlightTurns = 2;
    const isIdle = jest.fn(() => (inFlightTurns > 0 ? (inFlightTurns--, false) : true));
    const result = await settle(runtime, { tick, quietTurns: 3, isIdle });
    expect(result.settled).toBe(true);
    // 2 non-idle turns + 3 quiet turns
    expect(result.turns).toBe(5);
  });

  it('gives up at maxTurns when the runtime never goes quiet', async () => {
    const runtime = makeRuntime();
    Object.defineProperty(runtime, 'updateScheduled', { get: () => true });
    const result = await settle(runtime, { tick, quietTurns: 3, maxTurns: 10 });
    expect(result).toEqual({ settled: false, turns: 10 });
  });

  it('tolerates a runtime without a root component yet', async () => {
    const result = await settle({ updateScheduled: false }, { tick, quietTurns: 2 });
    expect(result.settled).toBe(true);
  });
});

describe('createPageReadyGate', () => {
  it('resolves immediately when no page announced loading', async () => {
    const gate = createPageReadyGate(new EventEmitter());
    expect(gate.hasPendingPages()).toBe(false);
    await expect(gate.whenReady(50)).resolves.toBe(true);
  });

  it('tracks SSR_PageLoading and releases on the matching SSR_PageReady', async () => {
    const emitter = new EventEmitter();
    const gate = createPageReadyGate(emitter);

    emitter.emit('SSR_PageLoading', 'page-1');
    expect(gate.hasPendingPages()).toBe(true);
    expect(gate.pendingPageIds()).toEqual(['page-1']);

    const ready = gate.whenReady(1000);
    emitter.emit('SSR_PageReady', 'page-1');
    await expect(ready).resolves.toBe(true);
    expect(gate.hasPendingPages()).toBe(false);
  });

  it('waits for ALL announced pages, not just the first', async () => {
    const emitter = new EventEmitter();
    const gate = createPageReadyGate(emitter);

    emitter.emit('SSR_PageLoading', 'a');
    emitter.emit('SSR_PageLoading', 'b');

    let resolved = false;
    const ready = gate.whenReady(1000).then((ok) => {
      resolved = true;
      return ok;
    });

    emitter.emit('SSR_PageReady', 'a');
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(gate.pendingPageIds()).toEqual(['b']);

    emitter.emit('SSR_PageReady', 'b');
    await expect(ready).resolves.toBe(true);
  });

  it('resolves true immediately when the page was already ready before whenReady', async () => {
    const emitter = new EventEmitter();
    const gate = createPageReadyGate(emitter);
    emitter.emit('SSR_PageLoading', 'p');
    emitter.emit('SSR_PageReady', 'p');
    await expect(gate.whenReady(50)).resolves.toBe(true);
  });

  it('times out with false when a page never signals ready', async () => {
    const emitter = new EventEmitter();
    const gate = createPageReadyGate(emitter);
    emitter.emit('SSR_PageLoading', 'stuck');
    await expect(gate.whenReady(20)).resolves.toBe(false);
    // Still listed so the server can name the culprit in its warning.
    expect(gate.pendingPageIds()).toEqual(['stuck']);
  });

  it('a ready signal for an unknown id is harmless', async () => {
    const emitter = new EventEmitter();
    const gate = createPageReadyGate(emitter);
    emitter.emit('SSR_PageReady', 'never-announced');
    expect(gate.hasPendingPages()).toBe(false);
    await expect(gate.whenReady(20)).resolves.toBe(true);
  });
});

describe('createFetchTracker', () => {
  it('is idle before any fetch and busy while one is in flight', async () => {
    let release;
    const tracker = createFetchTracker(() => new Promise((resolve) => (release = resolve)));

    expect(tracker.isIdle()).toBe(true);

    const pending = tracker.fetch('/noodl_bundles/a.json');
    expect(tracker.isIdle()).toBe(false);
    expect(tracker.inFlight()).toBe(1);

    release('response');
    await expect(pending).resolves.toBe('response');
    expect(tracker.isIdle()).toBe(true);
  });

  it('counts overlapping fetches independently', async () => {
    const releases = [];
    const tracker = createFetchTracker(() => new Promise((resolve) => releases.push(resolve)));

    const a = tracker.fetch('a');
    const b = tracker.fetch('b');
    expect(tracker.inFlight()).toBe(2);

    releases[0]();
    await a;
    expect(tracker.inFlight()).toBe(1);

    releases[1]();
    await b;
    expect(tracker.isIdle()).toBe(true);
  });

  it('returns to idle when a fetch rejects, and propagates the error', async () => {
    const tracker = createFetchTracker(() => Promise.reject(new Error('network down')));
    await expect(tracker.fetch('x')).rejects.toThrow('network down');
    expect(tracker.isIdle()).toBe(true);
  });

  it('returns to idle when the fetch implementation throws synchronously', () => {
    const tracker = createFetchTracker(() => {
      throw new Error('bad url');
    });
    expect(() => tracker.fetch('x')).toThrow('bad url');
    expect(tracker.isIdle()).toBe(true);
  });

  it('passes arguments through to the wrapped fetch', async () => {
    const impl = jest.fn(() => Promise.resolve('ok'));
    const tracker = createFetchTracker(impl);
    await tracker.fetch('/url', { method: 'POST' });
    expect(impl).toHaveBeenCalledWith('/url', { method: 'POST' });
  });
});

describe('createXhrTracker', () => {
  /**
   * Minimal XHR double mirroring the contract both the browser and the
   * `xmlhttprequest` node polyfill honour: readystatechange fires with
   * readyState 4 on success, error AND abort.
   */
  class FakeXHR {
    constructor() {
      this.readyState = 0;
      this._listeners = {};
      FakeXHR.instances.push(this);
    }
    addEventListener(event, cb) {
      (this._listeners[event] = this._listeners[event] || []).push(cb);
    }
    open() {
      this.readyState = 1;
    }
    send() {
      this.sent = true;
    }
    _complete() {
      this.readyState = 4;
      (this._listeners['readystatechange'] || []).forEach((cb) => cb());
    }
  }
  FakeXHR.instances = [];
  beforeEach(() => {
    FakeXHR.instances = [];
  });

  it('is idle before send and busy from send until readyState 4', () => {
    const tracker = createXhrTracker(FakeXHR);
    const xhr = new tracker.XMLHttpRequest();
    xhr.open('GET', '/classes/things');
    expect(tracker.isIdle()).toBe(true);

    xhr.send();
    expect(tracker.isIdle()).toBe(false);
    expect(tracker.inFlight()).toBe(1);

    FakeXHR.instances[0]._complete();
    expect(tracker.isIdle()).toBe(true);
  });

  it('counts overlapping requests independently', () => {
    const tracker = createXhrTracker(FakeXHR);
    const a = new tracker.XMLHttpRequest();
    const b = new tracker.XMLHttpRequest();
    a.send();
    b.send();
    expect(tracker.inFlight()).toBe(2);

    FakeXHR.instances[0]._complete();
    expect(tracker.inFlight()).toBe(1);
    FakeXHR.instances[1]._complete();
    expect(tracker.isIdle()).toBe(true);
  });

  it('does not double-decrement when readystatechange 4 fires twice', () => {
    const tracker = createXhrTracker(FakeXHR);
    const a = new tracker.XMLHttpRequest();
    const b = new tracker.XMLHttpRequest();
    a.send();
    b.send();

    FakeXHR.instances[0]._complete();
    FakeXHR.instances[0]._complete(); // e.g. abort after DONE re-fires listeners
    expect(tracker.inFlight()).toBe(1); // b still pending — not driven to 0
  });

  it('returns to idle when send throws synchronously, and rethrows', () => {
    class ThrowingXHR extends FakeXHR {
      send() {
        throw new Error('bad request');
      }
    }
    const tracker = createXhrTracker(ThrowingXHR);
    const xhr = new tracker.XMLHttpRequest();
    expect(() => xhr.send()).toThrow('bad request');
    expect(tracker.isIdle()).toBe(true);
  });

  it('handles completion during send (synchronous XHR)', () => {
    class SyncXHR extends FakeXHR {
      send() {
        this._complete();
      }
    }
    const tracker = createXhrTracker(SyncXHR);
    const xhr = new tracker.XMLHttpRequest();
    xhr.send();
    expect(tracker.isIdle()).toBe(true);
  });

  it('passes send arguments through to the wrapped implementation', () => {
    const sendSpy = jest.fn();
    class SpyXHR extends FakeXHR {
      send(...args) {
        sendSpy(...args);
      }
    }
    const tracker = createXhrTracker(SpyXHR);
    const xhr = new tracker.XMLHttpRequest();
    xhr.send('{"where":{}}');
    expect(sendSpy).toHaveBeenCalledWith('{"where":{}}');
  });
});
