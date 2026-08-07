import { propagate, track, type DerivedNode, type SourceNode } from './internal';

/**
 * A named object of reactive state.
 *
 * The exported equivalent of a Global Store or an Object node. Reads go through a selector, which
 * is the shape a React developer already knows, and writes are a patch:
 *
 * ```ts
 * export const chat = store('chat', { title: 'Untitled conversation', messages: [] });
 *
 * // in a component
 * const title = useStore(chat, (s) => s.title);
 * // in a handler
 * chat.set({ title: draft });
 * ```
 *
 * Stores are registered by name, so calling `store('chat', …)` twice returns the same instance.
 * That is what "global" meant in the graph, and it also survives a hot reload — the second call
 * keeps the state the first one accumulated rather than resetting the app.
 */
export class Store<T extends object> implements SourceNode {
  /** @internal */
  dependents: Set<DerivedNode> | null = null;

  readonly name: string;

  /**
   * Increments on every write. The React binding uses it to cache a selector's result, so an
   * inline `(s) => s.title` does not have to be referentially stable to be cheap.
   */
  version = 0;

  private state: T;
  private readonly initial: T;
  private listeners: Set<(state: Readonly<T>) => void> | null = null;

  constructor(name: string, initial: T) {
    this.name = name;
    this.initial = { ...initial };
    this.state = { ...initial };
  }

  get(): Readonly<T> {
    track(this);
    return this.state;
  }

  /**
   * Merges a patch into the state and notifies synchronously.
   *
   * As with {@link Value.set}, there is no equality check — see CONTRACT.md C2. A function patch
   * receives the current state and returns the fields to change.
   */
  set(patch: Partial<T> | ((state: Readonly<T>) => Partial<T>)): void {
    const fields = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...fields };
    this.version++;
    propagate(this, () => this.emitToListeners());
  }

  /** Reads one field. Equivalent to a Global Store Subscribe node with a single key. */
  select<K extends keyof T>(key: K): T[K] {
    return this.get()[key];
  }

  subscribe(listener: (state: Readonly<T>) => void): () => void {
    if (this.listeners === null) this.listeners = new Set();
    this.listeners.add(listener);
    return () => {
      this.listeners?.delete(listener);
    };
  }

  /** Reads without subscribing and without creating a dependency edge. */
  peek(): Readonly<T> {
    return this.state;
  }

  /** Restores the state the store was created with. */
  reset(): void {
    this.state = { ...this.initial };
    this.version++;
    propagate(this, () => this.emitToListeners());
  }

  private emitToListeners(): void {
    const listeners = this.listeners;
    if (listeners === null || listeners.size === 0) return;

    for (const listener of Array.from(listeners)) {
      listener(this.state);
    }
  }
}

const registry = new Map<string, Store<never>>();

/**
 * Creates or returns the named {@link Store}.
 *
 * @param name  the store's name, matching the `storeName` the graph used
 * @param initial  the state the store starts with, and what {@link Store.reset} restores
 */
export function store<T extends object>(name: string, initial: T): Store<T> {
  const existing = registry.get(name);
  if (existing !== undefined) return existing as unknown as Store<T>;

  const created = new Store<T>(name, initial);
  registry.set(name, created as unknown as Store<never>);
  return created;
}

/** Forgets every registered store. Used by tests; an app has no reason to call it. */
export function clearStores(): void {
  registry.clear();
}
