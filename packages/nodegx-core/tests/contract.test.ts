/**
 * One test per clause of CONTRACT.md, named by the clause.
 *
 * The point of naming them is that when EXP-003's trace harness reports a divergence between an
 * interpreted graph and its exported equivalent, the divergence should land on a clause — and
 * either this suite is wrong about the library, or the contract is wrong about the runtime. Both
 * are findable. "The exported app behaves differently" is not.
 *
 * The clauses the library deliberately does **not** implement (C3, C7, C8, C10) are asserted here
 * too, as the behaviour the contract says they have. A divergence that is written down and tested
 * is a decision; one that is only written down is a hope.
 */
import { collection } from '../src/collection';
import { derived } from '../src/derived';
import { effect } from '../src/effect';
import { batch, configureRuntime, CyclicUpdateError, flushSync, resetRuntime } from '../src/internal';
import { signal } from '../src/signal';
import { clearStores, store } from '../src/store';
import { value } from '../src/value';

afterEach(() => {
  resetRuntime();
  clearStores();
});

describe('C1 — ports push notification and pull value', () => {
  it('a derived value stores nothing until read, mirroring OutputProperty.value calling its getter', () => {
    let computations = 0;
    const source = value(1);
    const doubled = derived(() => {
      computations++;
      return source.get() * 2;
    });

    source.set(2);
    source.set(3);
    expect(computations).toBe(0); // nothing has read it

    expect(doubled.get()).toBe(6); // computed from the current source, not replayed
    expect(computations).toBe(1);
  });
});

describe('C2 — every write is delivered, and nothing is coalesced or skipped', () => {
  it('does not short-circuit an identical write', () => {
    const seen: number[] = [];
    const count = value(5);
    count.subscribe((n) => seen.push(n));

    count.set(5);
    count.set(5);

    expect(seen).toEqual([5, 5]);
  });

  it('delivers every intermediate value in order, not just the newest', () => {
    const seen: number[] = [];
    const count = value(0);
    count.subscribe((n) => seen.push(n));

    count.set(1);
    count.set(2);
    count.set(3);

    expect(seen).toEqual([1, 2, 3]);
  });

  it('notifies a derived value once per write, even when the computed result is unchanged', () => {
    const source = value(1);
    const clamped = derived(() => Math.min(source.get(), 10));
    const seen: number[] = [];
    clamped.subscribe((n) => seen.push(n));
    clamped.get();

    source.set(50);
    source.set(60);

    expect(seen).toEqual([10, 10]);
  });

  it('batch() coalesces the effect flush but never subscriber notification', () => {
    const source = value(0);
    const sync: number[] = [];
    const deferred: number[] = [];

    source.subscribe((n) => sync.push(n));
    effect(() => {
      deferred.push(source.get());
    });

    batch(() => {
      source.set(1);
      source.set(2);
    });

    expect(sync).toEqual([1, 2]); // every write delivered — C2
    flushSync();
    expect(deferred).toEqual([0, 2]); // one re-run for the batch — C5
  });
});

describe('C3 — `undefined` is never sent (deliberately NOT reproduced)', () => {
  it('a Value holds undefined like any other value, because the rule belongs at the port boundary', () => {
    const seen: (string | undefined)[] = [];
    const text = value<string | undefined>('hello');
    text.subscribe((v) => seen.push(v));

    text.set(undefined);

    expect(text.get()).toBeUndefined();
    expect(seen).toEqual([undefined]);
  });
});

describe('C4 — a signal is an edge-triggered pulse, and every pulse fires', () => {
  it('fires once per emit — two pulses in one turn are not merged', () => {
    let fired = 0;
    const done = signal();
    done.subscribe(() => fired++);

    done.emit();
    done.emit();

    expect(fired).toBe(2);
  });

  it('fires inside a batch as well, since batching defers effects and not signals', () => {
    let fired = 0;
    const done = signal();
    done.subscribe(() => fired++);

    batch(() => {
      done.emit();
      done.emit();
    });

    expect(fired).toBe(2);
  });

  it('preserves value-before-signal ordering, which generated code depends on', () => {
    // EXP-001-TARGET-OUTPUT.md §4: the example project's author documented relying on a value
    // output landing before the signal that follows it. Statement order only preserves that if
    // `set` notifies synchronously.
    const order: string[] = [];
    const chat = store('chat', { messages: [] as string[] });
    const done = signal();

    chat.subscribe((s) => order.push(`value:${s.messages.length}`));
    done.subscribe(() => order.push('signal'));

    chat.set({ messages: ['a'] });
    done.emit();

    expect(order).toEqual(['value:1', 'signal']);
  });
});

describe('C5 — dirty flagging is idempotent, and the drain is deferred', () => {
  it('ten writes in one turn produce one effect run', () => {
    const source = value(0);
    let runs = 0;
    effect(() => {
      source.get();
      runs++;
    });

    for (let i = 1; i <= 10; i++) source.set(i);
    expect(runs).toBe(1); // still only the immediate first run

    flushSync();
    expect(runs).toBe(2);
  });

  it('an effect queued by another effect runs in the next drain, not this one', () => {
    const first = value(0);
    const second = value(0);
    const order: string[] = [];

    effect(() => {
      first.get();
      order.push('first');
    });
    effect(() => {
      second.get();
      order.push('second');
    });

    order.length = 0;

    // Writing to `second` from inside the first effect's re-run must not extend this drain.
    const stop = effect(() => {
      if (first.get() > 0) second.set(second.peek() + 1);
    });

    first.set(1);
    flushSync();
    expect(order).toEqual(['first']); // the write happened during this drain, so it waits

    flushSync();
    expect(order).toEqual(['first', 'second']);
    stop();
  });

  it('the scheduler is pluggable, so EXP-003 can install a frame turn', async () => {
    const scheduled: (() => void)[] = [];
    configureRuntime({ schedule: (flush) => scheduled.push(flush) });

    const source = value(0);
    const seen: number[] = [];
    effect(() => {
      seen.push(source.get());
    });

    source.set(1);
    expect(seen).toEqual([0]);
    expect(scheduled.length).toBe(1);

    scheduled[0]();
    expect(seen).toEqual([0, 1]);
  });
});

describe('C6 — upstream is pulled before use, so the graph is never observed half-updated', () => {
  it('a diamond never exposes a mixed state', () => {
    const source = value(1);
    const doubled = derived(() => source.get() * 2);
    const offset = derived(() => source.get() + 10);
    const combined = derived(() => `${doubled.get()}/${offset.get()}`);

    const seen: string[] = [];
    combined.subscribe((v) => seen.push(v));
    expect(combined.get()).toBe('2/11');

    source.set(5);

    // '10/15', not '10/11' or '2/15'.
    expect(seen).toEqual(['10/15']);
  });

  it('notifies a shared dependent once per write, not once per path', () => {
    const source = value(1);
    const left = derived(() => source.get() * 2);
    const right = derived(() => source.get() * 3);
    const both = derived(() => left.get() + right.get());

    let notifications = 0;
    both.subscribe(() => notifications++);
    both.get();

    source.set(2);

    expect(notifications).toBe(1);
    expect(both.get()).toBe(10);
  });
});

describe('C7 — lockstep across ports (per-port queues deliberately NOT reproduced)', () => {
  it('holds for the ordinary case: values written together are observed together', () => {
    const source = store('lockstep', { a: 0, b: 0 });
    const seen: string[] = [];
    source.subscribe((s) => seen.push(`${s.a}/${s.b}`));

    source.set({ a: 1, b: 1 });
    source.set({ a: 2, b: 2 });

    expect(seen).toEqual(['1/1', '2/2']);
  });

  it('diverges where the contract says it does: two writes to one source are two observations', () => {
    // The interpreter would queue both and drain them in lockstep with a sibling port. Here they
    // are two synchronous notifications. This is the documented, bounded gap EXP-003 measures —
    // asserted so a future change to the propagation model cannot make it quietly worse.
    const source = value(0);
    const seen: number[] = [];
    source.subscribe((n) => seen.push(n));

    source.set(1);
    source.set(2);

    expect(seen).toEqual([1, 2]);
  });
});

describe('C9 — runaway work is broken, loudly rather than silently', () => {
  it('throws CyclicUpdateError instead of yielding the frame', () => {
    configureRuntime({ maxTurnDepth: 8 });

    const ping = value(0);
    const pong = value(0);
    ping.subscribe((n) => pong.set(n + 1));
    pong.subscribe((n) => ping.set(n + 1));

    expect(() => ping.set(1)).toThrow(CyclicUpdateError);
  });

  it('leaves the depth counter balanced, so the next unrelated write still works', () => {
    configureRuntime({ maxTurnDepth: 8 });

    const ping = value(0);
    const pong = value(0);
    ping.subscribe((n) => pong.set(n + 1));
    pong.subscribe((n) => ping.set(n + 1));
    expect(() => ping.set(1)).toThrow(CyclicUpdateError);

    const unrelated = value('fine');
    expect(() => unrelated.set('still fine')).not.toThrow();
  });

  it('breaks a signal loop too', () => {
    configureRuntime({ maxTurnDepth: 8 });

    const a = signal();
    const b = signal();
    a.subscribe(() => b.emit());
    b.subscribe(() => a.emit());

    expect(() => a.emit()).toThrow(CyclicUpdateError);
  });
});

describe('C11 — a subscriber joining late is not starved', () => {
  it('subscribe() does not fire, and get() returns the current value', () => {
    const source = value('initial');
    source.set('current');

    let fired = false;
    source.subscribe(() => (fired = true));

    expect(fired).toBe(false);
    expect(source.get()).toBe('current');
  });

  it('holds for stores and collections as well', () => {
    const chat = store('late', { title: 'a' });
    chat.set({ title: 'b' });
    expect(chat.get().title).toBe('b');

    const items = collection<number>([]);
    items.add(1);
    expect(items.get()).toEqual([1]);
  });
});
