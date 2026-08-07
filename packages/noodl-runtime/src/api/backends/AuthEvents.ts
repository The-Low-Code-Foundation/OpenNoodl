/**
 * The auth session event surface, implemented once.
 *
 * Same argument as [`AdapterEvents`](./AdapterEvents.ts) and the same shape: the
 * five events in the contract's `AuthEventType` fire on *our own* completed
 * calls and need nothing from the backend, so every adapter would implement them
 * identically. Backend-driven session invalidation is not this — a session
 * revoked in an admin panel is discovered on the next request, not pushed.
 *
 * `emit` takes a `string` rather than `AuthEventType` for one reason:
 * `ParseAuthAdapter` also raises `oauthReturn`, which is BAK-004's provider
 * return leg and is per-backend by nature — four backends have four redirect
 * shapes. Narrowing the emitter would force that one event to grow a second
 * mechanism beside the one that already works.
 *
 * @module api/backends/AuthEvents
 */

import type { AuthEventHandler, AuthEventType, IAuthEvents } from '@noodl/backend-contract';

const EventEmitter = require('../../events');

export class AuthEvents implements IAuthEvents {
  readonly events: {
    on(...args: unknown[]): void;
    off(...args: unknown[]): void;
    emit(event: string, payload?: unknown): void;
    setMaxListeners(n: number): void;
  };

  constructor() {
    this.events = new EventEmitter();
    // `userservice.ts` has always used 100000 rather than `AdapterEvents`'
    // 10000, because every `User`, `Log In` and `Sign Up` node in a project
    // subscribes and a large project has a lot of them. Kept at its own number
    // rather than harmonised — a warning at 10000 listeners would be new
    // behaviour on exactly the projects least able to investigate it.
    this.events.setMaxListeners(100000);
  }

  on(event: AuthEventType, handler: AuthEventHandler, context?: unknown): void {
    this.events.on.apply(this.events, arguments as unknown as unknown[]);
  }

  off(event: AuthEventType, handler?: AuthEventHandler, context?: unknown): void {
    this.events.off.apply(this.events, arguments as unknown as unknown[]);
  }

  emitAuthEvent(event: string, payload?: unknown): void {
    this.events.emit(event, payload);
  }
}
