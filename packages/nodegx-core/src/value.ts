import { propagate, track, type DerivedNode, type SourceNode } from './internal';

/** Anything a component can read and be notified about. */
export interface Readable<T> {
  get(): T;
  subscribe(listener: (value: T) => void): () => void;
}

/**
 * A piece of reactive state.
 *
 * The exported equivalent of a Variable node, and the building block the stores are made of.
 *
 * ```ts
 * const count = value(0);
 * count.subscribe((n) => console.log(n));
 * count.set(1); // logs 1
 * ```
 */
export class Value<T> implements Readable<T>, SourceNode {
  /** @internal */
  dependents: Set<DerivedNode> | null = null;

  private current: T;
  private listeners: Set<(value: T) => void> | null = null;

  constructor(initial: T) {
    this.current = initial;
  }

  get(): T {
    track(this);
    return this.current;
  }

  /**
   * Writes a new value and notifies synchronously.
   *
   * There is deliberately **no equality check**: the interpreted runtime re-runs a port's setter
   * even when the value is unchanged (CONTRACT.md C2), and generated code can depend on that.
   * React absorbs the redundant work through its own `Object.is` bail-out in
   * `useSyncExternalStore`, so faithfulness costs nothing where it would have shown.
   */
  set(next: T): void {
    this.current = next;
    propagate(this, () => this.emitToListeners(next));
  }

  /** `set` in terms of the previous value. Reads without creating a dependency edge. */
  update(fn: (previous: T) => T): void {
    this.set(fn(this.current));
  }

  subscribe(listener: (value: T) => void): () => void {
    if (this.listeners === null) this.listeners = new Set();
    this.listeners.add(listener);
    return () => {
      this.listeners?.delete(listener);
    };
  }

  /** Reads without subscribing and without creating a dependency edge. */
  peek(): T {
    return this.current;
  }

  private emitToListeners(next: T): void {
    const listeners = this.listeners;
    if (listeners === null || listeners.size === 0) return;

    // Copied before iterating: a listener that unsubscribes another listener would otherwise
    // mutate the set mid-iteration, and the runtime's fan-out loop (outputproperty.ts:151) is a
    // fixed-length walk for the same reason.
    for (const listener of Array.from(listeners)) {
      listener(next);
    }
  }
}

/** Creates a {@link Value}. The exported equivalent of a Variable node. */
export function value<T>(initial: T): Value<T> {
  return new Value<T>(initial);
}
