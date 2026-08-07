/**
 * The service's ONE rate limiter (BAK-009).
 *
 * Before this there were three improvisations: BAK-002's fixed windows on the
 * two mail endpoints, BAK-005's failure budget in front of the admin
 * credential, and nothing at all everywhere else. This module is the general
 * one; the failure budget stays (it counts *failed credentials*, which is a
 * different question from *request rate*, and answering both with one bucket
 * would mean a valid client's traffic could shield a guessing attack).
 *
 * **Token bucket, not fixed window.** A fixed window lets a caller spend the
 * whole allowance in the last millisecond of one window and again in the first
 * of the next — double the intended burst, at the worst moment. A bucket
 * refills continuously: `ratePerMinute` is the sustained rate, `burst` is how
 * much of a spike is absorbed.
 *
 * **Per route class, not one global bucket.** A backend serving a list view
 * makes many more data calls than login attempts, so one number cannot be both
 * generous enough for the app and tight enough for a credential-guessing loop.
 * The classes are derived from the route table (see `classifyRoute`), so a new
 * route is classified the moment it is added rather than when someone
 * remembers to annotate it — and `tests/ops-rate-limit.test.ts` walks the live
 * route table and asserts every route's class, so the derivation is reviewed as
 * data rather than trusted as code.
 *
 * **Keyed by principal, falling back to address.** An authenticated client gets
 * its own bucket, so one busy user behind a shared NAT cannot exhaust the
 * office's allowance. The key is derived AFTER the credential is resolved:
 * deriving it from the raw header instead would let an attacker mint a fresh
 * bucket per request by sending random garbage tokens.
 *
 * In-memory and single-process, like every other limiter and scheduler here
 * (WF-005's documented stance). Behind two replicas each gets its own budget;
 * that is a documented consequence, not an accident.
 *
 * @module nodegx-backend/ops/rate-limit
 */

import type { RateLimitConfig, RateLimitPolicy, RouteClass } from './model';

export interface RateDecision {
  allowed: boolean;
  /** Seconds until one token is available again (0 when allowed). */
  retryAfterSeconds: number;
  /** Whole tokens left in the bucket after this call. */
  remaining: number;
  policy: RateLimitPolicy;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
  /** The policy this bucket was last filled under — what the sweep refills against. */
  ratePerMinute: number;
  burst: number;
}

/** Buckets idle this long with a full allowance are forgotten (memory bound). */
const SWEEP_INTERVAL_MS = 60_000;

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  /** Config is read through a getter so an ops.json edit applies without a restart. */
  constructor(private readonly getConfig: () => RateLimitConfig) {}

  /**
   * Spend one token from `class`'s bucket for `key`.
   *
   * `burst: 0` means the class is unlimited — used for `realtime`, where one
   * SSE stream is a single very long request and counting requests would
   * measure nothing while breaking reconnect storms. That class is bounded by
   * connection COUNT in RealtimeHub instead (spec risk row).
   */
  check(routeClass: RouteClass, key: string, now: number = Date.now()): RateDecision {
    const policy = this.getConfig().policies[routeClass];
    return this.checkPolicy(routeClass, key, policy, now);
  }

  /**
   * Spend one token from an explicitly-policed bucket.
   *
   * This is how BAK-002's bespoke mail limits migrated onto the one limiter:
   * their budgets are deliberately stricter than the `auth` class (sending mail
   * to an address you named is not the same act as logging in), but they no
   * longer carry their own fixed-window implementation, their own key
   * derivation, or their own refusal shape.
   */
  checkPolicy(bucketName: string, key: string, policy: RateLimitPolicy | undefined, now: number = Date.now()): RateDecision {
    const config = this.getConfig();
    if (!config.enabled || !policy || policy.burst <= 0 || policy.ratePerMinute <= 0) {
      return {
        allowed: true,
        retryAfterSeconds: 0,
        remaining: policy ? policy.burst : 0,
        policy: policy || { ratePerMinute: 0, burst: 0 }
      };
    }

    this.maybeSweep(now);

    const id = `${bucketName}:${key}`;
    const perMs = policy.ratePerMinute / 60_000;
    const existing = this.buckets.get(id);
    const bucket: Bucket = existing || { tokens: policy.burst, updatedAt: now, ...policy };
    if (existing) {
      bucket.ratePerMinute = policy.ratePerMinute;
      bucket.burst = policy.burst;
      // Refill for the time that has passed, capped at the bucket size. A
      // shrunken policy takes effect immediately rather than after the old,
      // larger allowance drains.
      bucket.tokens = Math.min(policy.burst, bucket.tokens + (now - bucket.updatedAt) * perMs);
      bucket.updatedAt = now;
    }

    if (bucket.tokens < 1) {
      this.buckets.set(id, bucket);
      const secondsToOneToken = (1 - bucket.tokens) / (perMs * 1000);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(secondsToOneToken)),
        remaining: 0,
        policy
      };
    }

    bucket.tokens -= 1;
    this.buckets.set(id, bucket);
    return { allowed: true, retryAfterSeconds: 0, remaining: Math.floor(bucket.tokens), policy };
  }

  /**
   * Drop buckets that have fully refilled — they are indistinguishable from a
   * caller that has never been seen, so keeping them only grows the map. Without
   * this, a service facing the open internet accumulates one entry per source
   * address forever, which is a slow memory leak an attacker controls.
   */
  private maybeSweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    for (const [id, bucket] of this.buckets) {
      const refilled = bucket.tokens + (now - bucket.updatedAt) * (bucket.ratePerMinute / 60_000);
      if (refilled >= bucket.burst) this.buckets.delete(id);
    }
  }

  /** Live bucket count — the metrics endpoint and tests read this. */
  get size(): number {
    return this.buckets.size;
  }

  /** Test/ops helper: forget every bucket. */
  reset(): void {
    this.buckets.clear();
    this.lastSweep = 0;
  }
}

/**
 * Which class a route belongs to.
 *
 * Derived from the route's own `access` declaration wherever that already says
 * what the route is, with an explicit list for the session/account endpoints —
 * they are `session`/`signup`/`public` in access terms (they ARE the auth
 * system, so they enforce themselves), but for rate limiting they are exactly
 * the endpoints that need the tightest budget.
 */
export function classifyRoute(pattern: string, accessKind: string): RouteClass {
  if (AUTH_PATTERNS.has(pattern)) return 'auth';

  switch (accessKind) {
    case 'admin':
      return 'admin';
    case 'data':
    case 'data-perOp':
      return 'data';
    case 'function':
      return 'functions';
    case 'files':
      return 'files';
    case 'webhook':
      return 'hooks';
    case 'session':
      // Session routes NOT in the list above (`users/me`, `logout`, self-update)
      // are ordinary authenticated app traffic — an app reads `users/me` on
      // every load — so they get the data budget. Only the routes where a
      // credential is PRESENTED are 'auth'.
      return 'data';
    case 'signup':
      return 'auth';
    default:
      return pattern === 'realtime' || pattern.startsWith('realtime/') ? 'realtime' : 'public';
  }
}

/**
 * Public routes that are really authentication surface. Kept explicit because
 * the alternative — inferring from the path — would silently reclassify the day
 * someone renames one, and these are the routes where getting the class wrong
 * means an unlimited password-reset firehose.
 */
const AUTH_PATTERNS = new Set([
  'login',
  'users', // POST = signup
  // The dashboard login page. `_admin/whoami` is deliberately NOT here: it is
  // admin-credentialed and the dashboard polls it, so it belongs to the admin
  // budget. The login DOCUMENT is the guessable surface.
  '_admin',
  'requestPasswordReset',
  'verificationEmailRequest',
  'apps/:appId/request_password_reset',
  'apps/:appId/verify_email',
  // BAK-004. Every one of these is a step in obtaining a session, so they get
  // the auth budget rather than the public one — and each also carries its own
  // stricter per-flow bucket inside the handler (see server/oauth-routes),
  // because starting a sign-in costs an outbound provider request and asking
  // for a magic link sends mail to an address the caller merely named.
  'auth/providers',
  'auth/signed-in',
  'auth/magic-link',
  'auth/magic-link/callback',
  'oauth/:provider/start',
  'oauth/:provider/callback',
  'oauth/exchange'
]);
