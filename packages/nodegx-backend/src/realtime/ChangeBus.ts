/**
 * ChangeBus — the single post-commit change tap (BAK-001).
 *
 * `LocalSQLAdapter` emits `create` / `save` / `delete` events after each write,
 * buffered inside a transaction and released only on commit (see the adapter's
 * `_emitChange` / `transaction`). This class subscribes to those raw events
 * ONCE, normalizes them to a stable `{action, collection, record}` shape, and
 * fans them out to any number of listeners.
 *
 * Two consumers ride this one tap:
 *   - the realtime SSE hub (this task), and
 *   - WF-005's DB-change trigger dispatch (not yet built).
 * Keeping the tap here — generic, consumer-agnostic — is deliberate: neither
 * consumer may re-subscribe to the adapter directly, so the "one tap, two
 * consumers" contract in the spec holds and the adapter stays unaware of SSE.
 *
 * @module nodegx-backend/realtime/ChangeBus
 */

export type ChangeAction = 'create' | 'update' | 'delete';

export interface ChangeEvent {
  action: ChangeAction;
  collection: string;
  /** objectId of the affected record. */
  id: string;
  /** The record post-write (create/update) or as it was just before deletion. */
  record: Record<string, unknown>;
}

export type ChangeListener = (event: ChangeEvent) => void;

/** The adapter's raw event payload (LocalSQLAdapter.\_emitChange). */
export interface RawChange {
  type: 'create' | 'save' | 'delete';
  id: string;
  collection: string;
  object?: Record<string, unknown>;
}

const ACTION_BY_TYPE: Record<RawChange['type'], ChangeAction> = {
  create: 'create',
  save: 'update',
  delete: 'delete'
};

/**
 * The whole of what this class needs from an adapter — an `on`/`off` pair over
 * the three raw event names.
 *
 * It was `any` because the adapter is untyped CommonJS from `@noodl/runtime`,
 * but `any` overstated the coupling: the bus never reads a field, calls a query
 * method or knows what a `LocalSQLAdapter` is. Naming the two methods it
 * actually calls is both narrower and checkable, and it lets the specs' stub
 * adapters be verified as adapters instead of passing because everything does.
 * Both members stay optional and both call sites still guard with
 * `typeof === 'function'`: an adapter with no event surface is a supported
 * configuration (the bus simply never attaches), not a type error.
 */
export interface ChangeSource {
  on?(type: RawChange['type'], handler: (payload: RawChange) => void): void;
  off?(type: string, handler: (payload: RawChange) => void): void;
}

export class ChangeBus {
  private readonly adapter: ChangeSource | undefined;
  private readonly listeners = new Set<ChangeListener>();
  private readonly bound: Record<string, (payload: RawChange) => void> = {};
  private attached = false;

  constructor(adapter: ChangeSource | undefined) {
    this.adapter = adapter;
    this.attach();
  }

  private attach(): void {
    if (this.attached || !this.adapter || typeof this.adapter.on !== 'function') return;
    for (const type of ['create', 'save', 'delete'] as RawChange['type'][]) {
      const handler = (payload: RawChange) => this.dispatch(type, payload);
      this.bound[type] = handler;
      this.adapter.on(type, handler);
    }
    this.attached = true;
  }

  private dispatch(type: RawChange['type'], payload: RawChange): void {
    if (this.listeners.size === 0) return;
    const event: ChangeEvent = {
      action: ACTION_BY_TYPE[type],
      collection: payload.collection,
      id: payload.id,
      record: payload.object || { objectId: payload.id }
    };
    // Snapshot listeners so a listener that unsubscribes mid-dispatch is safe.
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(event);
      } catch (e) {
        // A misbehaving consumer must never break the others or the write path.
        // eslint-disable-next-line no-console
        console.error('[nodegx-backend] change listener threw:', e);
      }
    }
  }

  /** Register a listener; returns an unsubscribe function. */
  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Detach from the adapter and drop all listeners (service shutdown). */
  close(): void {
    if (this.attached && this.adapter && typeof this.adapter.off === 'function') {
      for (const type of Object.keys(this.bound)) {
        this.adapter.off(type, this.bound[type]);
      }
    }
    this.listeners.clear();
    this.attached = false;
  }
}
