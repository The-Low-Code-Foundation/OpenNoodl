import { propagate, track, type DerivedNode, type SourceNode } from './internal';
import type { Readable } from './value';

/**
 * A reactive list.
 *
 * The exported equivalent of an Array / Collection node — the thing a `For Each` iterates.
 *
 * ```ts
 * const messages = collection<Message>([]);
 * messages.add({ id: '1', text: 'hello' });
 * ```
 *
 * **This is copy-on-write, and the interpreted runtime's Collection is not.** There, a Collection
 * is a Proxy over a real array whose mutating methods notify in place
 * (`packages/noodl-runtime/src/collection.ts`), so the array's identity never changes. Here, every
 * mutation produces a new array.
 *
 * The difference is deliberate and it is the one a React developer needs: `useMemo`, `React.memo`
 * and `useSyncExternalStore` all compare by identity, and a list that mutates in place is invisible
 * to every one of them. The cost is that code holding a reference to the previous array sees the
 * old contents — which is what a React developer expects, and what the graph's author could not
 * have relied on either way.
 */
export class Collection<T> implements Readable<readonly T[]>, SourceNode {
  /** @internal */
  dependents: Set<DerivedNode> | null = null;

  private items: readonly T[];
  private listeners: Set<(items: readonly T[]) => void> | null = null;

  constructor(initial: readonly T[] = []) {
    this.items = initial.slice();
  }

  get(): readonly T[] {
    track(this);
    return this.items;
  }

  get size(): number {
    return this.get().length;
  }

  at(index: number): T | undefined {
    return this.get()[index];
  }

  /** Replaces the whole list. */
  set(items: readonly T[]): void {
    this.items = items.slice();
    this.notify();
  }

  add(item: T): void {
    this.set([...this.items, item]);
  }

  insert(index: number, item: T): void {
    const next = this.items.slice();
    next.splice(index, 0, item);
    this.set(next);
  }

  /** Removes the first item strictly equal to `item`. Does nothing, and does not notify, if absent. */
  remove(item: T): void {
    const index = this.items.indexOf(item);
    if (index === -1) return;
    this.removeAt(index);
  }

  removeAt(index: number): void {
    if (index < 0 || index >= this.items.length) return;
    const next = this.items.slice();
    next.splice(index, 1);
    this.set(next);
  }

  clear(): void {
    if (this.items.length === 0) return;
    this.set([]);
  }

  /** Replaces every item for which `match` holds, using `update` to produce the replacement. */
  updateWhere(match: (item: T) => boolean, update: (item: T) => T): void {
    let changed = false;
    const next = this.items.map((item) => {
      if (!match(item)) return item;
      changed = true;
      return update(item);
    });
    if (changed) this.set(next);
  }

  subscribe(listener: (items: readonly T[]) => void): () => void {
    if (this.listeners === null) this.listeners = new Set();
    this.listeners.add(listener);
    return () => {
      this.listeners?.delete(listener);
    };
  }

  /** Reads without subscribing and without creating a dependency edge. */
  peek(): readonly T[] {
    return this.items;
  }

  private notify(): void {
    propagate(this, () => {
      const listeners = this.listeners;
      if (listeners === null || listeners.size === 0) return;
      for (const listener of Array.from(listeners)) {
        listener(this.items);
      }
    });
  }
}

/** Creates a {@link Collection}. The exported equivalent of an Array / Collection node. */
export function collection<T>(initial: readonly T[] = []): Collection<T> {
  return new Collection<T>(initial);
}
