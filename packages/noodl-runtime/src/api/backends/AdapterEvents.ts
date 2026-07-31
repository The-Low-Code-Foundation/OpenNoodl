/**
 * The adapter event surface, implemented once.
 *
 * BCN-001's `events.ts` makes the case for why this is not per-adapter: these
 * four events fire on *our own* completed calls and need nothing from the
 * server, so an adapter reaching for a WebSocket to satisfy them would be
 * solving a problem that does not exist. Backend realtime is BCN-008's subject
 * and a different capability key.
 *
 * The implementation is the emitter `CloudStore` has always used, with the same
 * `setMaxListeners(10000)`: the Query Records node subscribes three listeners
 * per live collection and the default ceiling of ten is reached by any real
 * project.
 *
 * @module api/backends/AdapterEvents
 */

import type { AdapterEvent, AdapterEventHandler, IAdapterEvents } from '@noodl/backend-contract';

const EventEmitter = require('../../events');

export class AdapterEvents implements IAdapterEvents {
  /**
   * Public because `cloudstore.js` forwarded `on`/`off` through
   * `this.events.on.apply(this.events, arguments)` and at least one node reads
   * the emitter's listener bookkeeping in a test. Kept as a field rather than
   * made private so that forwarding stays literally the same call.
   */
  readonly events: {
    on(...args: unknown[]): void;
    off(...args: unknown[]): void;
    emit(event: string, payload: AdapterEvent): void;
    setMaxListeners(n: number): void;
  };

  constructor() {
    this.events = new EventEmitter();
    this.events.setMaxListeners(10000);
  }

  on(event: AdapterEvent['type'], handler: AdapterEventHandler, context?: unknown): void {
    this.events.on.apply(this.events, arguments as unknown as unknown[]);
  }

  off(event: AdapterEvent['type'], handler?: AdapterEventHandler, context?: unknown): void {
    this.events.off.apply(this.events, arguments as unknown as unknown[]);
  }

  /**
   * Adapters call this after a write of theirs completes.
   *
   * Deliberately not `protected`: `cloudstore.js` is still JavaScript and the
   * BCN-002 shim forwards through it, which `protected` would only make
   * dishonest rather than impossible.
   */
  emitAdapterEvent(event: AdapterEvent): void {
    this.events.emit(event.type, event);
  }
}
