import { collection } from '../src/collection';
import { derived, untracked } from '../src/derived';
import { effect } from '../src/effect';
import { channel, clearChannels, events } from '../src/events';
import { flushSync, resetRuntime } from '../src/internal';
import { signal } from '../src/signal';
import { clearStores, store } from '../src/store';
import { value } from '../src/value';

afterEach(() => {
  resetRuntime();
  clearStores();
  clearChannels();
});

describe('value', () => {
  it('reads back what was written', () => {
    const count = value(0);
    expect(count.get()).toBe(0);
    count.set(3);
    expect(count.get()).toBe(3);
  });

  it('notifies subscribers with the new value', () => {
    const seen: number[] = [];
    const count = value(0);
    count.subscribe((n) => seen.push(n));

    count.set(1);
    count.set(2);

    expect(seen).toEqual([1, 2]);
  });

  it('stops notifying after unsubscribe', () => {
    const seen: number[] = [];
    const count = value(0);
    const stop = count.subscribe((n) => seen.push(n));

    count.set(1);
    stop();
    count.set(2);

    expect(seen).toEqual([1]);
  });

  it('survives a subscriber that unsubscribes another mid-notification', () => {
    const count = value(0);
    const seen: string[] = [];

    const stopSecond = count.subscribe(() => seen.push('second'));
    count.subscribe(() => {
      seen.push('first');
      stopSecond();
    });

    expect(() => count.set(1)).not.toThrow();
    expect(seen).toContain('first');
  });

  it('update() writes in terms of the previous value', () => {
    const count = value(10);
    count.update((n) => n + 5);
    expect(count.get()).toBe(15);
  });

  it('peek() does not create a dependency edge', () => {
    const source = value(1);
    let runs = 0;
    const computed = derived(() => {
      runs++;
      return source.peek() * 2;
    });

    expect(computed.get()).toBe(2);
    source.set(5);
    expect(computed.get()).toBe(2);
    expect(runs).toBe(1);
  });
});

describe('derived', () => {
  it('computes from its sources and tracks them automatically', () => {
    const first = value('Ada');
    const last = value('Lovelace');
    const full = derived(() => `${first.get()} ${last.get()}`);

    expect(full.get()).toBe('Ada Lovelace');
    last.set('Byron');
    expect(full.get()).toBe('Ada Byron');
  });

  it('memoises — repeated reads compute once', () => {
    let runs = 0;
    const source = value(2);
    const doubled = derived(() => {
      runs++;
      return source.get() * 2;
    });

    doubled.get();
    doubled.get();
    doubled.get();
    expect(runs).toBe(1);

    source.set(3);
    doubled.get();
    expect(runs).toBe(2);
  });

  it('is lazy — it does not compute until read', () => {
    let runs = 0;
    const source = value(1);
    derived(() => {
      runs++;
      return source.get();
    });

    expect(runs).toBe(0);
  });

  it('chains, and a change reaches the far end', () => {
    const source = value(1);
    const doubled = derived(() => source.get() * 2);
    const quadrupled = derived(() => doubled.get() * 2);

    expect(quadrupled.get()).toBe(4);
    source.set(5);
    expect(quadrupled.get()).toBe(20);
  });

  it('re-tracks after a branch change, dropping the edge it no longer reads', () => {
    const useLeft = value(true);
    const left = value('L');
    const right = value('R');
    const picked = derived(() => (useLeft.get() ? left.get() : right.get()));

    expect(picked.get()).toBe('L');

    useLeft.set(false);
    expect(picked.get()).toBe('R');

    let notified = 0;
    picked.subscribe(() => notified++);

    // `left` is no longer read, so writing to it must not notify.
    left.set('L2');
    expect(notified).toBe(0);

    right.set('R2');
    expect(notified).toBe(1);
  });

  it('untracked() reads without depending', () => {
    const tracked = value(1);
    const hidden = value(100);
    let runs = 0;
    const total = derived(() => {
      runs++;
      return tracked.get() + untracked(() => hidden.get());
    });

    expect(total.get()).toBe(101);
    hidden.set(200);
    expect(total.get()).toBe(101);
    expect(runs).toBe(1);
  });

  it('dispose() drops its edges', () => {
    const source = value(1);
    const doubled = derived(() => source.get() * 2);
    let notified = 0;
    doubled.subscribe(() => notified++);

    doubled.get();
    doubled.dispose();
    source.set(2);

    expect(notified).toBe(0);
  });
});

describe('signal', () => {
  it('delivers the payload to every subscriber, in subscription order', () => {
    const order: string[] = [];
    const sent = signal<string>();
    sent.subscribe((p) => order.push(`a:${p}`));
    sent.subscribe((p) => order.push(`b:${p}`));

    sent.emit('go');

    expect(order).toEqual(['a:go', 'b:go']);
  });

  it('reports whether anything is listening', () => {
    const sent = signal();
    expect(sent.hasListeners).toBe(false);
    const stop = sent.subscribe(() => undefined);
    expect(sent.hasListeners).toBe(true);
    stop();
    expect(sent.hasListeners).toBe(false);
  });
});

describe('store', () => {
  it('merges a patch and leaves other fields alone', () => {
    const chat = store('chat', { title: 'Untitled', answer: '' });
    chat.set({ title: 'Renamed' });

    expect(chat.get()).toEqual({ title: 'Renamed', answer: '' });
  });

  it('accepts a function patch', () => {
    const counter = store('counter', { n: 1 });
    counter.set((s) => ({ n: s.n + 1 }));
    expect(counter.get().n).toBe(2);
  });

  it('returns the same instance for the same name', () => {
    const first = store('shared', { n: 1 });
    first.set({ n: 9 });
    const second = store('shared', { n: 1 });

    expect(second).toBe(first);
    expect(second.get().n).toBe(9);
  });

  it('produces a new state object per write, so identity comparison sees the change', () => {
    const chat = store('chat', { title: 'a' });
    const before = chat.get();
    chat.set({ title: 'b' });

    expect(chat.get()).not.toBe(before);
  });

  it('increments version on every write, including an identical one', () => {
    const chat = store('chat', { title: 'a' });
    const start = chat.version;
    chat.set({ title: 'a' });
    chat.set({ title: 'a' });

    expect(chat.version).toBe(start + 2);
  });

  it('reset() restores the initial state', () => {
    const chat = store('chat', { title: 'Untitled' });
    chat.set({ title: 'Renamed' });
    chat.reset();

    expect(chat.get().title).toBe('Untitled');
  });

  it('feeds derived values', () => {
    const chat = store('chat', { title: 'hello world' });
    const words = derived(() => chat.get().title.split(' ').length);

    expect(words.get()).toBe(2);
    chat.set({ title: 'one two three' });
    expect(words.get()).toBe(3);
  });

  it('does not leak state between tests via the registry', () => {
    // clearStores() runs in afterEach; this asserts it actually works, because a leak here would
    // make every other store test order-dependent.
    const fresh = store('chat', { title: 'Untitled' });
    expect(fresh.get().title).toBe('Untitled');
  });
});

describe('collection', () => {
  it('adds, inserts and removes', () => {
    const items = collection<string>(['b']);
    items.add('c');
    items.insert(0, 'a');

    expect(items.get()).toEqual(['a', 'b', 'c']);

    items.remove('b');
    expect(items.get()).toEqual(['a', 'c']);

    items.removeAt(0);
    expect(items.get()).toEqual(['c']);
  });

  it('is copy-on-write — the previous array is not mutated', () => {
    const items = collection<number>([1, 2]);
    const before = items.get();
    items.add(3);

    expect(before).toEqual([1, 2]);
    expect(items.get()).not.toBe(before);
  });

  it('does not notify when a removal matches nothing', () => {
    const items = collection<number>([1]);
    let notified = 0;
    items.subscribe(() => notified++);

    items.remove(99);
    items.removeAt(5);
    expect(notified).toBe(0);

    items.remove(1);
    expect(notified).toBe(1);
  });

  it('clear() on an empty collection does not notify', () => {
    const items = collection<number>([]);
    let notified = 0;
    items.subscribe(() => notified++);
    items.clear();

    expect(notified).toBe(0);
  });

  it('updateWhere() replaces matches and notifies once', () => {
    const items = collection([
      { id: 'a', done: false },
      { id: 'b', done: false }
    ]);
    let notified = 0;
    items.subscribe(() => notified++);

    items.updateWhere(
      (i) => i.id === 'b',
      (i) => ({ ...i, done: true })
    );

    expect(notified).toBe(1);
    expect(items.get()[1].done).toBe(true);
    expect(items.get()[0].done).toBe(false);
  });

  it('updateWhere() with no match does not notify', () => {
    const items = collection([{ id: 'a' }]);
    let notified = 0;
    items.subscribe(() => notified++);

    items.updateWhere(
      (i) => i.id === 'zzz',
      (i) => i
    );
    expect(notified).toBe(0);
  });
});

describe('events', () => {
  it('routes by name', () => {
    const seen: unknown[] = [];
    events.on('cleared', (p) => seen.push(p));
    events.emit('cleared', { why: 'test' });

    expect(seen).toEqual([{ why: 'test' }]);
  });

  it('channel() returns the same signal for the same name', () => {
    const typed = channel<number>('count');
    const seen: number[] = [];
    typed.subscribe((n) => seen.push(n));

    events.emit('count', 7);
    expect(seen).toEqual([7]);
  });

  it('does not deliver across names', () => {
    let called = false;
    events.on('a', () => (called = true));
    events.emit('b');

    expect(called).toBe(false);
  });
});

describe('effect', () => {
  it('runs immediately', () => {
    const source = value(1);
    let seen = 0;
    effect(() => {
      seen = source.get();
    });

    expect(seen).toBe(1);
  });

  it('re-runs when a dependency changes, after the turn settles', () => {
    const source = value(1);
    const seen: number[] = [];
    effect(() => {
      seen.push(source.get());
    });

    source.set(2);
    expect(seen).toEqual([1]); // deferred — the turn has not been flushed

    flushSync();
    expect(seen).toEqual([1, 2]);
  });

  it('runs cleanup before each re-run and on dispose', () => {
    const source = value(1);
    const log: string[] = [];

    const stop = effect(() => {
      const n = source.get();
      log.push(`run:${n}`);
      return () => log.push(`cleanup:${n}`);
    });

    source.set(2);
    flushSync();
    stop();

    expect(log).toEqual(['run:1', 'cleanup:1', 'run:2', 'cleanup:2']);
  });

  it('stops re-running after dispose', () => {
    const source = value(1);
    let runs = 0;
    const stop = effect(() => {
      source.get();
      runs++;
    });

    stop();
    source.set(2);
    flushSync();

    expect(runs).toBe(1);
  });
});
