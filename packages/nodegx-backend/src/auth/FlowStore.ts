/**
 * In-flight sign-in state and the one-time handoff codes (BAK-004).
 *
 * Two short-lived stores, both in memory:
 *
 *   - **Pending flows.** Between `/oauth/:provider/start` and its callback we
 *     must remember the PKCE verifier, the nonce, where to send the browser
 *     afterwards, and the flow-binding secret. Keyed by `state`.
 *   - **Handoff codes.** The callback cannot hand a session token to the app by
 *     redirect without putting it in a URL, so it mints a single-use code
 *     instead and the app exchanges it over a POST. Keyed by the code.
 *
 * **Why in memory.** The same reason WF-005's scheduler, BAK-009's rate-limit
 * buckets and WF-001's run state are: one process serves one backend, and the
 * honest single-node stance is the product decision (see the phase README's
 * parked list). The consequence, stated rather than discovered: a restart
 * mid-sign-in loses the flow and the user sees "this sign-in expired, try
 * again" — a 5-second cost on an event that already involves a round trip to
 * another website. Behind two replicas without sticky sessions, OAuth would not
 * work at all; that is documented in BACKEND-AUTH.md alongside every other
 * single-node consequence.
 *
 * **Why bounded.** `/oauth/:provider/start` is reachable by anyone and each
 * call allocates. Without a cap, a loop against it is a memory-exhaustion
 * attack with no credential required. The map is capped and evicts oldest-first,
 * which degrades to "the earliest in-flight sign-ins fail" rather than "the
 * process dies".
 *
 * @module nodegx-backend/auth/FlowStore
 */

import { randomToken } from './oidc';

/** A sign-in has to survive one round trip to a provider, not a coffee break. */
const FLOW_TTL_MS = 10 * 60 * 1000;

/**
 * A handoff code lives only long enough for a browser redirect and one POST.
 * Two minutes tolerates a slow page load and a clock that is a little off; it
 * does not tolerate a code sitting in someone's shell history being useful.
 */
const HANDOFF_TTL_MS = 2 * 60 * 1000;

/** Enough for any realistic concurrent load, small enough to be irrelevant to RSS. */
const MAX_PENDING_FLOWS = 5000;
const MAX_PENDING_HANDOFFS = 5000;

export interface PendingFlow {
  providerId: string;
  /** PKCE verifier. Empty for GitHub, which does not implement PKCE. */
  codeVerifier: string;
  /** OIDC nonce. Empty for GitHub, which has no ID token to bind it to. */
  nonce: string;
  /** Absolute, already-authorised redirect target (see ./redirect). */
  redirectUrl: string;
  /**
   * The value that must come back in the flow-binding cookie. Without this,
   * `state` alone is not tied to a browser and an attacker can complete a flow
   * in someone else's browser — logging the victim in as the attacker.
   */
  binding: string;
  createdAt: number;
}

export interface PendingHandoff {
  userId: string;
  sessionToken: string;
  /** What the linking rule did, so the app can explain rule-5 credential revocation. */
  outcome: string;
  notice: string | null;
  createdAt: number;
}

function pruneAndCap<T extends { createdAt: number }>(map: Map<string, T>, ttlMs: number, cap: number, now: number): void {
  for (const [key, value] of map) {
    if (now - value.createdAt > ttlMs) map.delete(key);
  }
  // Insertion order is age order (entries are never re-inserted), so the
  // iterator yields oldest-first and the overflow eviction is free.
  if (map.size <= cap) return;
  const excess = map.size - cap;
  let removed = 0;
  for (const key of map.keys()) {
    map.delete(key);
    if (++removed >= excess) break;
  }
}

export class FlowStore {
  private readonly flows = new Map<string, PendingFlow>();
  private readonly handoffs = new Map<string, PendingHandoff>();

  /** Start a flow; returns the `state` value to send to the provider. */
  begin(flow: Omit<PendingFlow, 'createdAt'>, now = Date.now()): string {
    pruneAndCap(this.flows, FLOW_TTL_MS, MAX_PENDING_FLOWS - 1, now);
    const state = randomToken();
    this.flows.set(state, { ...flow, createdAt: now });
    return state;
  }

  /**
   * Consume a flow by state. SINGLE USE: a state that has been redeemed is gone,
   * so a replayed callback (the user hitting back, or an attacker resubmitting
   * a captured URL) finds nothing and is refused.
   */
  take(state: string, now = Date.now()): PendingFlow | null {
    const flow = this.flows.get(state);
    if (!flow) return null;
    this.flows.delete(state);
    if (now - flow.createdAt > FLOW_TTL_MS) return null;
    return flow;
  }

  /** Mint a one-time handoff code for a completed sign-in. */
  issueHandoff(handoff: Omit<PendingHandoff, 'createdAt'>, now = Date.now()): string {
    pruneAndCap(this.handoffs, HANDOFF_TTL_MS, MAX_PENDING_HANDOFFS - 1, now);
    const code = randomToken();
    this.handoffs.set(code, { ...handoff, createdAt: now });
    return code;
  }

  /** Redeem a handoff code. Single use, like the flow. */
  redeemHandoff(code: string, now = Date.now()): PendingHandoff | null {
    const handoff = this.handoffs.get(code);
    if (!handoff) return null;
    this.handoffs.delete(code);
    if (now - handoff.createdAt > HANDOFF_TTL_MS) return null;
    return handoff;
  }

  /** Live sizes — the metrics gauge and tests read these. */
  get pendingFlows(): number {
    return this.flows.size;
  }
  get pendingHandoffs(): number {
    return this.handoffs.size;
  }

  clear(): void {
    this.flows.clear();
    this.handoffs.clear();
  }
}
