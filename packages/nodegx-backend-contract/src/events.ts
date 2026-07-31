/**
 * The adapter event surface.
 *
 * `CloudStore.on`/`off` (`cloudstore.js:46`/`50`) fire `fetch`, `create`, `save`
 * and `delete` after a write of ours completes, and several standard-library
 * nodes depend on them to keep collections in step.
 *
 * **This is not backend realtime.** It fires on our own completed calls and
 * needs nothing from the server — a change another user makes in another
 * browser produces none of these. That is BCN-008's subject and a different
 * capability key. Keeping the two apart in the contract is what stops an
 * adapter author reaching for a WebSocket to satisfy something a callback
 * already satisfies.
 *
 * Because it needs nothing from the backend, it is implemented **once** in a
 * base class rather than per adapter.
 *
 * @module backend-contract/events
 */

import type { AdapterRecord } from './data';

export interface AdapterEvent {
  type: 'fetch' | 'create' | 'save' | 'delete';
  collection: string;
  objectId?: string;
  object?: AdapterRecord;
}

export type AdapterEventHandler = (event: AdapterEvent) => void;

export interface IAdapterEvents {
  on(event: AdapterEvent['type'], handler: AdapterEventHandler, context?: unknown): void;
  off(event: AdapterEvent['type'], handler?: AdapterEventHandler, context?: unknown): void;
}
