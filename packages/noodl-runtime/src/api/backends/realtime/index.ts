/**
 * One `subscribe`, five backends — BCN-008.
 *
 * `IRealtimeAdapter` has a single method because there is a single thing to do; the
 * interesting content is in the lifecycle the returned handle obeys, which is
 * `RealtimeSubscription`. This module is the seam that picks a transport by backend type,
 * and the place a node asks "is this even possible here?" before it draws a port.
 *
 * | backend type | transport | measured live |
 * |---|---|---|
 * | `nodegx`, `nodegx-backend`, `local` | SSE, `NODEGX_SSE` dialect | ✅ |
 * | `directus` | WebSocket with an auth handshake | ✅ |
 * | `pocketbase` | SSE, `POCKETBASE_SSE` dialect | ✅ |
 * | `parse` | a probe, and a reason — LiveQuery was measured **absent** | ✅ (absent) |
 * | `supabase` | none. **Nothing measured; not in the rig at all** | ❌ |
 * | `custom` | none. `declarable`, by design | — |
 *
 * @module api/backends/realtime
 */

import type { BackendHandle, BackendType } from '@noodl/backend-contract';
import type {
  IRealtimeAdapter,
  RealtimeHandle,
  RealtimeTransport
} from '@noodl/backend-contract/realtime';

import { DirectusWebSocketTransport } from './DirectusWebSocketTransport';
import { ParseLiveQueryTransport } from './ParseLiveQueryTransport';
import { RealtimeSubscription, type RealtimeSubscriptionOptions } from './RealtimeSubscription';
import { NODEGX_SSE, POCKETBASE_SSE, SseTransport } from './SseTransport';
import { CUSTOM_REALTIME_REASON, SUPABASE_REALTIME_REASON, UnavailableTransport } from './UnavailableTransport';

export { RealtimeSubscription } from './RealtimeSubscription';
export type { RealtimeSubscriptionOptions } from './RealtimeSubscription';
export { DirectusWebSocketTransport } from './DirectusWebSocketTransport';
export { SseTransport, NODEGX_SSE, POCKETBASE_SSE } from './SseTransport';
export type { SseDialect } from './SseTransport';
export { ParseLiveQueryTransport } from './ParseLiveQueryTransport';
export type { ParseLiveQueryProbeResult } from './ParseLiveQueryTransport';
export { UnavailableTransport, SUPABASE_REALTIME_REASON, CUSTOM_REALTIME_REASON } from './UnavailableTransport';

/**
 * The three type strings that mean our own backend.
 *
 * `nodegx` is what the picker writes and what `resolveBackend.ts` answers for an untyped
 * `cloudservices` endpoint; `nodegx-backend` and `local` are what earlier surfaces wrote,
 * and they are still in saved projects. The shipped `isNodeGXRealtime` had exactly this
 * list and there is no evidence for narrowing it.
 */
const NODEGX_TYPES: readonly string[] = ['nodegx', 'nodegx-backend', 'local'];

export function isNodeGXRealtime(type: string | undefined): boolean {
  return !!type && NODEGX_TYPES.indexOf(type) !== -1;
}

/**
 * Whether a backend can push changes at all, and why not when it cannot.
 *
 * ⚠️ Deliberately answerable **without opening a socket**, so a node can gate a port
 * before anything renders. The one type this cannot settle statically is `parse`, whose
 * answer needs the 20ms probe — it is reported as available-but-conditional here, and the
 * probe is what actually decides.
 */
export interface RealtimeSupport {
  transport: RealtimeTransport;
  /** `supported` · `conditional` (needs a probe) · `unsupported`. */
  state: 'supported' | 'conditional' | 'unsupported';
  /** Present unless `state` is `supported`. */
  reason?: string;
}

export function realtimeSupportFor(type: string | undefined): RealtimeSupport {
  if (isNodeGXRealtime(type)) return { transport: 'sse', state: 'supported' };
  switch (type) {
    case 'directus':
      return { transport: 'websocket', state: 'supported' };
    case 'pocketbase':
      return { transport: 'sse', state: 'supported' };
    case 'parse':
      return {
        transport: 'none',
        state: 'conditional',
        reason:
          'Parse LiveQuery runs as a separate server and most deployments do not start one. NodeGX probes for it ' +
          'and reports what it finds; realtime is off unless one answers.'
      };
    case 'supabase':
      return { transport: 'phoenix-channel', state: 'unsupported', reason: SUPABASE_REALTIME_REASON };
    default:
      return { transport: 'none', state: 'unsupported', reason: CUSTOM_REALTIME_REASON };
  }
}

/**
 * Open one subscription, on whichever transport this backend speaks.
 *
 * Always returns a handle, and the handle always reports — a backend with no realtime
 * reports `CAPABILITY_UNAVAILABLE` with a sentence rather than sitting `connecting`
 * forever, which is the failure `conditional` was invented to make impossible.
 */
export function createRealtimeSubscription(
  handle: BackendHandle,
  options: RealtimeSubscriptionOptions
): RealtimeSubscription {
  const subscription = buildTransport(handle, options);
  subscription.connect();
  return subscription;
}

function buildTransport(handle: BackendHandle, options: RealtimeSubscriptionOptions): RealtimeSubscription {
  const type = handle.type as string | undefined;

  if (isNodeGXRealtime(type)) return new SseTransport(handle, options, NODEGX_SSE);
  if (type === 'directus') return new DirectusWebSocketTransport(handle, options);
  if (type === 'pocketbase') return new SseTransport(handle, options, POCKETBASE_SSE);
  if (type === 'parse') return new ParseLiveQueryTransport(handle, options);
  if (type === 'supabase') {
    return new UnavailableTransport(handle, options, SUPABASE_REALTIME_REASON, 'phoenix-channel');
  }
  return new UnavailableTransport(handle, options, CUSTOM_REALTIME_REASON);
}

/**
 * `IRealtimeAdapter` for one backend type.
 *
 * The interface carries a `transport` field, which only makes sense per backend — one
 * object serving five wires could not answer it. So the adapter is built for a type, and
 * `subscribe` still takes the handle because the *instance* (url, token) is per-call.
 */
export function realtimeAdapterFor(type: BackendType): IRealtimeAdapter {
  const support = realtimeSupportFor(type);
  return {
    transport: support.transport,
    subscribe(handle: BackendHandle, options: RealtimeSubscriptionOptions): RealtimeHandle {
      return createRealtimeSubscription(handle, options);
    }
  };
}
