import { clearSources, track, withTracking, type DerivedNode, type SourceNode } from './internal';
import type { Readable } from './value';

/**
 * A value computed from other values, recomputed on read when one of them has changed.
 *
 * This is the exported equivalent of an Expression node or a computed output port, and it is
 * modelled directly on how the interpreted runtime's output ports work: a port stores nothing and
 * calls its owner's getter on every read (CONTRACT.md C1). The only addition here is memoisation,
 * so reading a derived value ten times in one render computes it once.
 *
 * Dependencies are discovered automatically — whatever the compute function reads, it depends on.
 *
 * ```ts
 * const first = value('Ada');
 * const last = value('Lovelace');
 * const full = derived(() => `${first.get()} ${last.get()}`);
 * full.get(); // 'Ada Lovelace'
 * ```
 */
export class Derived<T> implements Readable<T>, DerivedNode {
  /** @internal */
  dependents: Set<DerivedNode> | null = null;
  /** @internal */
  stale = true;
  /** @internal */
  sources = new Set<SourceNode>();

  private compute: () => T;
  private current!: T;
  private computed = false;
  private listeners: Set<(value: T) => void> | null = null;

  constructor(compute: () => T) {
    this.compute = compute;
  }

  get(): T {
    track(this);
    if (this.stale || !this.computed) this.recompute();
    return this.current;
  }

  subscribe(listener: (value: T) => void): () => void {
    if (this.listeners === null) this.listeners = new Set();
    this.listeners.add(listener);
    return () => {
      this.listeners?.delete(listener);
    };
  }

  /** Reads without subscribing and without creating a dependency edge in an enclosing computation. */
  peek(): T {
    if (this.stale || !this.computed) this.recompute();
    return this.current;
  }

  /**
   * Drops this value's dependency edges.
   *
   * Sources hold references to the derived values that read them, so a long-lived store keeps a
   * short-lived derived alive until this is called. Components created by the generator dispose in
   * their cleanup; the React hooks do it for you.
   */
  dispose(): void {
    clearSources(this);
    this.listeners = null;
    this.dependents = null;
  }

  /** @internal — called during propagation's notify phase, after every stale mark is set. */
  notifyStale(): void {
    const listeners = this.listeners;
    if (listeners === null || listeners.size === 0) return;

    // The value is read here rather than passed in, which is the whole point of the two-phase
    // pass: by now everything downstream of the write is marked stale, so this recomputation sees
    // a consistent graph rather than a mixture of fresh and cached inputs (CONTRACT.md C6).
    const next = this.get();
    for (const listener of Array.from(listeners)) {
      listener(next);
    }
  }

  private recompute(): void {
    clearSources(this);
    this.current = withTracking(this, this.compute);
    this.stale = false;
    this.computed = true;
  }
}

/** Creates a {@link Derived}. The exported equivalent of an Expression node. */
export function derived<T>(compute: () => T): Derived<T> {
  return new Derived<T>(compute);
}

/** Re-exported so a `derived` can read something without depending on it. */
export { untracked } from './internal';
