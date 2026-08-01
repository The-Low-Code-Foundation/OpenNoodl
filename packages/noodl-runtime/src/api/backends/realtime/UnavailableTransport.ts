/**
 * A subscription that reports, immediately and once, that there is nothing to subscribe to.
 *
 * This exists so the answer to "can this backend push changes?" is never `undefined` and
 * never a socket opened in hope. Two backends use it:
 *
 * **Supabase.** ⚠️ **Supabase Realtime has never been in this rig, and nothing about it has
 * been measured.** The container labelled "Supabase" in `uba-e2e/docker-compose.yml` is
 * plain PostgREST: no Realtime, no GoTrue, no Storage. Supabase Realtime is a separate
 * Elixir service speaking Phoenix channels; BCN-008's probe established its absence three
 * ways — `ws://localhost:8056/realtime/v1/websocket` errors in 5ms, the descriptor's own
 * health path is a plain `404` from PostgREST, and ports 4000 and 54321 are silent — and
 * then **stopped**, rather than transcribing the documentation into a measurement. Every
 * Supabase cell in `REALTIME_TRANSPORT_PROFILES` is `measured: false`, including the
 * delete-payload claim, which is exactly the field RUN-003 got wrong on Directus by reading
 * rather than asking. So there is no `phoenix-channel` transport here, deliberately.
 *
 * **`custom`.** A user's own API might push over anything or nothing. The descriptor is
 * `declarable` for precisely this case and inventing a wire would be inventing a wire
 * nobody has seen.
 *
 * The failure is `CAPABILITY_UNAVAILABLE`, which is fatal in `REALTIME_FAILURE_KINDS` — a
 * service that is not running does not start because we reconnected — so this reports once
 * and stops, rather than reporting once every backoff step until the tab closes.
 *
 * @module api/backends/realtime/UnavailableTransport
 */

import type { BackendHandle } from '@noodl/backend-contract';
import type { RealtimeTransport } from '@noodl/backend-contract/realtime';

import { RealtimeSubscription, type RealtimeSubscriptionOptions } from './RealtimeSubscription';

export class UnavailableTransport extends RealtimeSubscription {
  readonly transport: RealtimeTransport;

  private readonly _reason: string;

  constructor(
    handle: BackendHandle,
    options: RealtimeSubscriptionOptions,
    reason: string,
    transport: RealtimeTransport = 'none'
  ) {
    super(handle, options);
    this._reason = reason;
    this.transport = transport;
  }

  protected openTransport(_generation: number): void {
    this.fail('CAPABILITY_UNAVAILABLE', this._reason);
  }

  protected closeTransport(): void {
    /* nothing was ever opened */
  }
}

/** The sentence a Supabase-backed subscription reports, in one place. */
export const SUPABASE_REALTIME_REASON =
  'Realtime is not available for Supabase backends. Supabase Realtime is a separate Phoenix-channel service and ' +
  'NodeGX has never connected to one — every cell in the contract\'s Supabase realtime profile is unmeasured ' +
  '(BCN-008), so no transport was written for it. The capability is conditional, not supported.';

/** The sentence a `custom` backend reports. */
export const CUSTOM_REALTIME_REASON =
  'Realtime is not available for a custom backend. There is no wire to speak: declare a transport for it if the ' +
  'API has one.';
