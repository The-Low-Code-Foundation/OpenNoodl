/**
 * An id-keyed table that does not retain its entries — the "anonymous tier" of the Model and
 * Collection registries.
 *
 * ## Why this exists (DEBT-014)
 *
 * `Model._models` and `Collection._collections` are process-global and were, until DEBT-014,
 * append-only: nothing ever removed an entry. That is correct for records whose id is a
 * *name* — `Model.get('--ndl--global-variables')`, a backend `objectId`,
 * `'componentState' + instanceId`, an author-typed Object-node Id — because the whole point
 * of those tables is that two unrelated parts of a graph which spell the same id reach the
 * same live object. The table must own those.
 *
 * It is pure leak for the other kind: ids minted *inside* `Model.get()` / `Model.create()` /
 * `Collection.create()` as a random 10-character guid. Nobody can spell one a priori, so the
 * table adds no reachability the holder of the reference does not already have. Every plain
 * object handed to `collection.set()` mints one — i.e. every Repeater item — and a Repeater
 * over a growing list therefore grew the registry monotonically for the life of the page.
 *
 * So: named entries stay in the strong table, anonymous entries live here.
 *
 * ## The contract
 *
 * An entry is visible for exactly as long as something *else* holds the value. This registry
 * never keeps a value alive, and `get` never resurrects one. Callers must therefore treat a
 * miss as "not present", which is already how both registries behave for an unknown id
 * (`Model.get` is create-on-read, so a miss produces a fresh empty record rather than an
 * error).
 *
 * ## Degradation
 *
 * `WeakRef`/`FinalizationRegistry` are ES2021 (Chrome 84+, Safari 14.1+, Firefox 79+, Node
 * 14.6+). Where they are missing this class silently becomes a second strong table, which is
 * exactly the pre-DEBT-014 behaviour — a leak, not a correctness change. That is the right
 * way round: a host too old to collect weakly is a host that keeps working.
 *
 * @module noodl-runtime
 */

/** Whether the host can actually hold values weakly. */
const SUPPORTS_WEAKREF = typeof WeakRef === 'function';

class WeakRegistry<T extends object> {
  private readonly refs = new Map<string, WeakRef<T>>();
  /** Only populated when `WeakRef` is absent; then this is a plain strong table. */
  private readonly strongFallback = new Map<string, T>();
  private readonly finalizer?: FinalizationRegistry<string>;

  constructor() {
    if (SUPPORTS_WEAKREF && typeof FinalizationRegistry === 'function') {
      // Without this the Map would still grow — with dead `WeakRef` husks instead of live
      // values. The callback holds only the id string; holding the value would defeat the
      // entire point of the class.
      this.finalizer = new FinalizationRegistry<string>((id) => {
        const ref = this.refs.get(id);
        // The id may have been re-registered, or promoted into the strong table, between
        // collection and this callback. Only drop a key that is still dead.
        if (ref !== undefined && ref.deref() === undefined) this.refs.delete(id);
      });
    }
  }

  add(id: string, value: T): void {
    if (!SUPPORTS_WEAKREF) {
      this.strongFallback.set(id, value);
      return;
    }
    this.refs.set(id, new WeakRef(value));
    this.finalizer?.register(value, id);
  }

  /** The live value for `id`, or `undefined`. Sweeps the key if the value has gone. */
  peek(id: string): T | undefined {
    if (!SUPPORTS_WEAKREF) return this.strongFallback.get(id);
    const ref = this.refs.get(id);
    if (ref === undefined) return undefined;
    const value = ref.deref();
    if (value === undefined) {
      // Opportunistic sweep: the finalizer may not have run yet, and on a host without
      // `FinalizationRegistry` it never will.
      this.refs.delete(id);
      return undefined;
    }
    return value;
  }

  /**
   * Remove and return the live value — used when an anonymous id is spelled explicitly and
   * so becomes a name, at which point the strong table takes ownership.
   */
  take(id: string): T | undefined {
    const value = this.peek(id);
    if (value === undefined) return undefined;
    this.refs.delete(id);
    this.strongFallback.delete(id);
    if (this.finalizer !== undefined) this.finalizer.unregister(value);
    return value;
  }

  /**
   * Count of entries whose value is still reachable. Diagnostic — the DEBT-014 success
   * criterion is stated in terms of registry size, so it has to be observable. Sweeps dead
   * keys as a side effect.
   */
  size(): number {
    if (!SUPPORTS_WEAKREF) return this.strongFallback.size;
    // `Array.from` rather than a spread: the viewer's ts-jest target is pre-ES2015, where a
    // raw spread of a Map iterator does not downlevel. Also required because `peek` deletes
    // from the Map we are walking.
    for (const id of Array.from(this.refs.keys())) this.peek(id);
    return this.refs.size;
  }

  clear(): void {
    this.refs.clear();
    this.strongFallback.clear();
  }
}

export = WeakRegistry;
