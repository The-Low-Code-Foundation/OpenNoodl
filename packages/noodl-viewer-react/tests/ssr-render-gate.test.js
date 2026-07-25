/**
 * Unit tests for the SSR render gate (RUN-002 — busy-loop replacement).
 *
 * settle() decides when the server-side runtime is quiescent enough to
 * renderToString; createPageReadyGate() implements the SSR_PageLoading /
 * SSR_PageReady handshake for pages that gate the render explicitly.
 */
const EventEmitter = require('events');
const { settle, createPageReadyGate } = require('../static/ssr/render-gate');

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
