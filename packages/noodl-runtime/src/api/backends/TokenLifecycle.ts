/// <reference path="../../globals.d.ts" />
//
// Same rule as `ParseWireAdapter`, and the same reason: this file is compiled by
// every consumer's program, `_noodl_cloud_runtime_version` is declared only in
// this package's `src/globals.d.ts`, and the identifier must stay **bare** —
// webpack's DefinePlugin substitutes identifiers, and `globalThis.…` is not a
// substitution site. See PLAT-003 slice 13 and BCN-002 `37d23adb`.
/**
 * `TokenLifecycleController` — refresh scheduling, single-flight, the request
 * gate, the failure policy and the cross-tab lock, built once.
 *
 * The design this implements is
 * [BCN-006-LIFECYCLE-DESIGN.md](../../../../../dev-docs/tasks/phase-34-one-backend-contract/BCN-006-LIFECYCLE-DESIGN.md);
 * read that for *why*. This file is the *what*, and the section numbers below
 * point back at it.
 *
 * ## The seam
 *
 * The controller never speaks a wire. An adapter hands it `performRefresh` — a
 * function that knows how to ask *its* backend for a new token — and gets
 * scheduling, single-flight, queueing, retry, logout and cross-tab coordination
 * for free. That is the only reason the whole lifecycle is unit-testable against
 * injected timers with no network anywhere, which is the `byob-realtime.ts`
 * precedent this copies.
 *
 * It is also what keeps BCN-004 cheap: adding Directus is a `performRefresh` and
 * a descriptor row, not a lifecycle.
 *
 * ## The one detail everything rests on
 *
 * {@link TokenLifecycleController.withSession} calls back **synchronously** when
 * there is nothing to wait for. Not a style preference — `ParseWireAdapter` and
 * `ParseAuthAdapter` build their requests synchronously today, and on an
 * `eternal` backend the gate has to be a pass-through with no observable change
 * in ordering. A promise would push every existing request onto a microtask and
 * reorder the callbacks twenty-five nodes see.
 *
 * ## What is live today
 *
 * ⚠️ **This section was "nothing refreshes" until step 4, and no longer is.**
 * `RestAuthAdapter` supplies a `performRefresh` for Directus and PocketBase, both
 * measured against the live rig, so every path below now runs in the product and
 * not only in the suite. Parse and the built-in backend remain `eternal` — the
 * controller they hold arms no timer, subscribes to nothing, and its gate is the
 * synchronous pass-through — which is what keeps this task's footprint on
 * existing projects at zero.
 *
 * Two things the design assumed and a real backend contradicted, both now
 * options/guards below rather than assumptions: PocketBase issues **no refresh
 * token** ({@link TokenLifecycleControllerOptions.refreshTokenRequired}), and a
 * refresh is not guaranteed to move the deadline ({@link MIN_REFRESH_SPACING_MS}).
 *
 * @module api/backends/TokenLifecycle
 */

import type { TokenLifecycle } from '@noodl/backend-contract';

import type { SessionStore, StoredSession } from './SessionStore';

/**
 * `setTimeout` cannot express a delay above this: a larger one overflows to a
 * 32-bit signed int and fires **immediately**, silently. PocketBase's fourteen
 * day default fits; a custom backend declaring sixty days does not, and the
 * symptom would be a refresh storm rather than an error.
 */
const MAX_TIMEOUT_MS = 2147483647;

/** Backoff for a refresh that could not be *delivered*. See §4. */
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30000;
const RETRY_LIMIT = 5;

/**
 * A **successful** refresh may not be followed by another sooner than this.
 *
 * ⚠️ Added in step 4 against a measured hazard, not a hypothetical one. The
 * scheduler's contract with itself is "arm from `expiresAt`", and it assumes a
 * refresh moves `expiresAt` forward. If a backend answers a refresh with a token
 * whose expiry has *not* moved — and PocketBase 0.30.0 hands back a
 * byte-identical token for two refreshes inside the same second, because its
 * claims carry `exp` and no `iat` — then `arm` computes a delay of zero, fires
 * immediately, refreshes again, and the app hammers the backend in a tight loop
 * for as long as it is open. No error is raised anywhere and the app keeps
 * working, which is the failure mode this phase keeps finding.
 *
 * Five seconds is chosen to be far below any real token lifetime (so it never
 * delays a legitimate refresh) and far above any plausible request time (so a
 * pathological backend costs twelve requests a minute rather than thousands).
 *
 * Inert until the first successful refresh, so nothing that predates it moves.
 */
const MIN_REFRESH_SPACING_MS = 5000;

/**
 * What a rejected `performRefresh` may carry so the controller can tell a
 * rejection from a failed delivery.
 *
 * `fatal` is the explicit answer and always wins. `status` is the fallback, and
 * the classification is in {@link classifyRefreshFailure}.
 */
export interface RefreshFailure {
  message?: string;
  error?: string;
  status?: number;
  fatal?: boolean;
}

export type RefreshOutcome = 'rejected' | 'undelivered';

/**
 * Was the session **rejected**, or did the request merely fail to arrive?
 *
 * The whole failure policy turns on this one distinction (§4): *only the backend
 * can end a session; the network cannot.* A user in a lift has a perfectly valid
 * access token in hand, and throwing their session away because a background
 * request timed out is the worst possible use of a margin that exists to absorb
 * exactly that.
 *
 * - `408` and `429` are 4xx that mean "ask again", not "you are not who you say".
 * - Everything else in 4xx is the backend refusing the refresh token.
 * - 5xx, a status of 0, and no status at all are failures of delivery.
 */
export function classifyRefreshFailure(err: unknown): RefreshOutcome {
  const failure = (err || {}) as RefreshFailure;
  if (failure.fatal === true) return 'rejected';
  if (failure.fatal === false) return 'undelivered';

  const status = failure.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    if (status === 408 || status === 429) return 'undelivered';
    return 'rejected';
  }
  return 'undelivered';
}

export function refreshFailureMessage(err: unknown): string | undefined {
  const failure = (err || {}) as RefreshFailure;
  return failure.error || failure.message || undefined;
}

/**
 * Why a declared lifecycle was refused. `undefined` means it is usable.
 *
 * A descriptor lifecycle was written against a backend somebody probed; a
 * *declared* one (Richard's `custom`-is-declared answer) was typed into a form,
 * so it is checked before it is armed. §7.
 */
export function validateTokenLifecycle(lifecycle: TokenLifecycle | undefined): string | undefined {
  if (!lifecycle) return 'No token lifecycle was declared.';
  if (lifecycle.kind === 'eternal') return undefined;
  if (lifecycle.kind !== 'refresh') return `Unknown token lifecycle "${(lifecycle as { kind: string }).kind}".`;

  const ttl = lifecycle.accessTtlSeconds;
  if (typeof ttl !== 'number' || !isFinite(ttl) || ttl <= 0)
    return 'The access token lifetime must be a number of seconds greater than zero.';

  const margin = lifecycle.refreshBeforeExpirySeconds;
  if (typeof margin !== 'number' || !isFinite(margin) || margin < 0)
    return 'The refresh margin must be a number of seconds, and cannot be negative.';
  if (margin >= ttl) return 'The refresh margin has to be shorter than the access token lifetime.';

  if (typeof lifecycle.refreshEndpoint !== 'string' || lifecycle.refreshEndpoint.length === 0)
    return 'A refreshing backend needs the address to send the refresh to.';

  return undefined;
}

/**
 * Is there a browser tab that outlives a request?
 *
 * The design doc's §6 rule, and it needed a sharper test than "is there
 * storage". **RUN-002's SSR harness installs a `localStorage` mock**
 * (`static/ssr/runtime-globals.js`) so the runtime's bracket-access reads work
 * during a server render — which means an absent-storage check would have
 * concluded "browser" and armed a fifteen-minute timer holding a refresh token,
 * once per render, in a long-lived Node process.
 *
 * It installs no `window`, which is the honest signal. The cloud runtime is
 * excluded separately: each request there has its own scope and its session
 * arrives *with* the request, already validated, so there is nothing to schedule
 * for and the next request brings its own token.
 *
 * Neither branch changes anything today — Parse is `eternal` and arms nothing —
 * but BCN-004's Directus adapter would have leaked a timer per server render,
 * and that is a defect nobody would look for.
 */
export function isBrowserTab(): boolean {
  if (typeof window === 'undefined' || !window) return false;
  if (typeof _noodl_cloud_runtime_version !== 'undefined') return false;
  return true;
}

export type SessionCallback = (session: StoredSession | undefined, error?: string) => void;

export interface TokenLifecycleControllerOptions {
  /** From the capability descriptor, or declared in the Backend Services panel. */
  lifecycle: TokenLifecycle;
  store: SessionStore;
  /**
   * Ask the backend for a new token. **The only thing the adapter supplies.**
   *
   * Reject with a {@link RefreshFailure} so the controller can tell a rejected
   * session from a request that never arrived.
   */
  performRefresh?: (session: StoredSession) => Promise<StoredSession>;
  /**
   * Does a refresh need a **separate** `refreshToken` on the session?
   *
   * ⚠️ **Added in step 4, because a real backend said no.** The design assumed
   * every refreshing backend issues an access token *with a refresh token beside
   * it* — three of them do, and PocketBase does not. Measured against PocketBase
   * 0.30.0: the auth response is `{record, token}` with no second token, and
   * `POST /api/collections/{c}/auth-refresh` carrying only
   * `Authorization: Bearer <access token>` answers 200 and a new token.
   *
   * Without this the guard below would take the `failFatally` branch at the
   * first scheduled refresh and sign **every PocketBase user out** — a
   * fifteen-minute-later logout that no unit test on Parse could ever have
   * shown, because Parse never schedules a refresh at all.
   *
   * Defaults to `true`, so nothing that existed before this option behaves
   * differently.
   */
  refreshTokenRequired?: boolean;
  /** A silent refresh landed. Bookkeeping — see §4 for why no node hears it. */
  onSessionRefreshed?: (session: StoredSession) => void;
  /**
   * The session is over. Surfaces through the `User` node's existing
   * `sessionLost` output; there is no new port and no new concept.
   */
  onSessionLost?: (reason: string) => void;
  /** Another tab signed out. Separate from a lost session — the user meant it. */
  onSessionClearedElsewhere?: () => void;
  /** A declared lifecycle did not validate. Reported once, then ignored. */
  onInvalidLifecycle?: (reason: string) => void;

  now?: () => number;
  setTimeoutImpl?: (fn: () => void, delay: number) => unknown;
  clearTimeoutImpl?: (handle: unknown) => void;
  /** Overridable for tests. Defaults to {@link isBrowserTab}. */
  isBrowserTab?: () => boolean;
}

export class TokenLifecycleController {
  /** The lifecycle actually in force — `eternal` when a declaration failed. */
  readonly lifecycle: TokenLifecycle;
  /** Why the declared lifecycle was refused, when it was. */
  readonly lifecycleError?: string;

  private readonly store: SessionStore;
  private readonly performRefresh?: (session: StoredSession) => Promise<StoredSession>;
  private readonly refreshTokenRequired: boolean;
  private readonly onSessionRefreshed?: (session: StoredSession) => void;
  private readonly onSessionLost?: (reason: string) => void;
  private readonly onSessionClearedElsewhere?: () => void;

  private readonly now: () => number;
  private readonly setTimeoutImpl: (fn: () => void, delay: number) => unknown;
  private readonly clearTimeoutImpl: (handle: unknown) => void;
  private readonly isBrowserTab: () => boolean;

  private timer: unknown;
  private unsubscribe?: () => void;
  private started = false;
  private refreshing = false;
  private holdsLock = false;
  private retries = 0;
  private queue: SessionCallback[] = [];
  /** 0 until the first successful refresh, which keeps the spacing floor inert. */
  private lastRefreshAt = 0;

  constructor(options: TokenLifecycleControllerOptions) {
    const invalid = validateTokenLifecycle(options.lifecycle);
    if (invalid) {
      // Degrade, never refuse. §7: a typo in an optional field must not break a
      // backend that works perfectly well without any refresh at all.
      this.lifecycle = { kind: 'eternal' };
      this.lifecycleError = invalid;
      if (options.onInvalidLifecycle) options.onInvalidLifecycle(invalid);
    } else {
      this.lifecycle = options.lifecycle;
    }

    this.store = options.store;
    this.performRefresh = options.performRefresh;
    this.refreshTokenRequired = options.refreshTokenRequired !== false;
    this.onSessionRefreshed = options.onSessionRefreshed;
    this.onSessionLost = options.onSessionLost;
    this.onSessionClearedElsewhere = options.onSessionClearedElsewhere;

    this.now = options.now || Date.now;
    this.setTimeoutImpl = options.setTimeoutImpl || ((fn, delay) => setTimeout(fn, delay));
    this.clearTimeoutImpl = options.clearTimeoutImpl || ((handle) => clearTimeout(handle as number));
    this.isBrowserTab = options.isBrowserTab || isBrowserTab;
  }

  /** True when this controller has anything at all to do. */
  get isRefreshing(): boolean {
    return this.lifecycle.kind === 'refresh';
  }

  /** Test/inspection seam: how many callers are waiting on the refresh. */
  get queuedCount(): number {
    return this.queue.length;
  }

  // ── Lifetime ─────────────────────────────────────────────────────────────

  /**
   * Arm, and start listening for other tabs.
   *
   * An `eternal` lifecycle arms nothing and subscribes to nothing. That is not
   * an optimisation — it is what keeps this task's observable footprint on Parse
   * at exactly zero. Cross-tab logout propagation on an eternal backend would be
   * a genuine improvement and a genuine *change*, and BCN-002's rule is that a
   * behaviour change smuggled into a no-behaviour-change move destroys the only
   * signal the move produces.
   */
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.lifecycle.kind === 'eternal') return;
    // §6. Not "is there storage": a server render HAS storage — a mock RUN-002
    // installs so the runtime's reads work — and would otherwise arm a timer per
    // render in a long-lived process.
    if (!this.isBrowserTab()) return;
    if (!this.store.available) return;

    this.unsubscribe = this.store.onExternalChange((session) => this.adoptFromOtherTab(session));
    this.sessionChanged();
  }

  stop(): void {
    this.started = false;
    this.clearTimer();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    if (this.holdsLock) {
      this.store.releaseRefreshLock();
      this.holdsLock = false;
    }
    this.queue = [];
    this.refreshing = false;
    this.retries = 0;
  }

  /**
   * The stored session changed under us — a login, a logout, a `become`.
   *
   * Stamps an expiry when the backend did not state one, then re-arms. The stamp
   * is *persisted* rather than computed per read: a moving deadline recomputed
   * from `now` on every check would never actually arrive.
   */
  sessionChanged(): void {
    if (this.lifecycle.kind === 'eternal') return;
    this.retries = 0;
    this.clearTimer();

    const session = this.store.read();
    if (!session || !session.sessionToken) return;

    if (typeof session.expiresAt !== 'number' || !isFinite(session.expiresAt)) {
      session.expiresAt = this.now() + this.lifecycle.accessTtlSeconds * 1000;
      this.store.write(session);
    }

    this.arm(session);
  }

  // ── The request gate ─────────────────────────────────────────────────────

  /**
   * Hand a caller the session it should use, now or as soon as there is one.
   *
   * **Synchronous whenever it can be** — see the module note. Deferred only when
   * the token has genuinely expired and a refresh has to land first.
   */
  withSession(callback: SessionCallback): void {
    const session = this.store.read();

    if (this.lifecycle.kind === 'eternal' || !session || !session.sessionToken) {
      callback(session);
      return;
    }

    const expiresAt = typeof session.expiresAt === 'number' ? session.expiresAt : undefined;
    const now = this.now();

    if (expiresAt === undefined || now < expiresAt) {
      // Still usable. Kick off the refresh if we are inside the margin, but do
      // not make this caller wait for it — §3. Only the refresh token rotates;
      // the access token in hand is good until `expiresAt`.
      if (expiresAt !== undefined && now >= this.refreshAt(expiresAt)) this.beginRefresh();
      callback(session);
      return;
    }

    // Expired. This is the only case that queues, and on a correctly scheduled
    // lifecycle it should never be reached.
    this.queue.push(callback);
    this.beginRefresh();
  }

  // ── Scheduling ───────────────────────────────────────────────────────────

  private refreshAt(expiresAt: number): number {
    if (this.lifecycle.kind !== 'refresh') return expiresAt;
    return expiresAt - this.lifecycle.refreshBeforeExpirySeconds * 1000;
  }

  private arm(session: StoredSession): void {
    const expiresAt = session.expiresAt as number;
    // The later of "when the token says" and "not sooner than the spacing floor
    // allows". `lastRefreshAt` is 0 until a refresh has actually landed, so the
    // second term cannot win on a first arm.
    const delay = Math.max(this.refreshAt(expiresAt), this.lastRefreshAt + MIN_REFRESH_SPACING_MS) - this.now();

    if (delay <= 0) {
      // Already due. Still goes through the timer rather than recursing, so a
      // caller inside `sessionChanged` never re-enters the refresh path.
      this.timer = this.setTimeoutImpl(() => {
        this.timer = undefined;
        this.beginRefresh();
      }, 0);
      return;
    }

    if (delay > MAX_TIMEOUT_MS) {
      this.timer = this.setTimeoutImpl(() => {
        this.timer = undefined;
        // Re-read rather than trusting the closure: the session may have been
        // replaced by another tab in the twenty-four days since.
        this.sessionChanged();
      }, MAX_TIMEOUT_MS);
      return;
    }

    this.timer = this.setTimeoutImpl(() => {
      this.timer = undefined;
      // The timer is a hint, not a fact. A sleeping laptop fires late, a clock
      // change fires early, so the decision is always made against the clock.
      const current = this.store.read();
      if (!current || !current.sessionToken) return;
      if (typeof current.expiresAt === 'number' && this.now() < this.refreshAt(current.expiresAt)) {
        this.arm(current);
        return;
      }
      this.beginRefresh();
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer !== undefined) {
      this.clearTimeoutImpl(this.timer);
      this.timer = undefined;
    }
  }

  // ── Single-flight refresh ────────────────────────────────────────────────

  private beginRefresh(): void {
    if (this.lifecycle.kind !== 'refresh') return;
    if (this.refreshing) return; // Single-flight. §3.
    if (!this.isBrowserTab()) return;
    if (!this.store.available) return;

    const session = this.store.read();
    if (!session || !session.sessionToken) return;

    if (!this.performRefresh) {
      // No transport yet. Not a logout — an adapter that declared a refreshing
      // lifecycle and supplied no way to refresh is our bug, and signing the
      // user out would report it as theirs.
      return;
    }

    // Only when this backend actually issues one — see `refreshTokenRequired`.
    // PocketBase presents its access token instead, and a session with no
    // refresh token is normal there rather than unrenewable.
    if (this.refreshTokenRequired && !session.refreshToken) {
      this.failFatally('This sign-in cannot be renewed. Please sign in again.');
      return;
    }

    if (!this.store.tryAcquireRefreshLock()) {
      // Another tab is refreshing. Wait for it to write the new session rather
      // than spending the same rotating refresh token a second time — §5.
      this.waitForOtherTab();
      return;
    }

    this.holdsLock = true;
    this.refreshing = true;
    this.clearTimer();

    this.performRefresh(session).then(
      (refreshed) => this.onRefreshSucceeded(session, refreshed),
      (err) => this.onRefreshFailed(err)
    );
  }

  private onRefreshSucceeded(previous: StoredSession, refreshed: StoredSession): void {
    this.refreshing = false;
    this.releaseLock();
    this.retries = 0;
    this.lastRefreshAt = this.now();

    if (this.lifecycle.kind !== 'refresh') return;

    // The backend's own expiry wins; the declared TTL is the fallback. §2.
    const session: StoredSession = Object.assign({}, previous, refreshed);
    if (typeof refreshed.expiresAt !== 'number' || !isFinite(refreshed.expiresAt)) {
      session.expiresAt = this.now() + this.lifecycle.accessTtlSeconds * 1000;
    }

    this.store.write(session);
    this.flush(session);
    this.arm(session);
    if (this.onSessionRefreshed) this.onSessionRefreshed(session);
  }

  private onRefreshFailed(err: unknown): void {
    this.refreshing = false;
    this.releaseLock();

    const message = refreshFailureMessage(err);

    if (classifyRefreshFailure(err) === 'rejected') {
      this.failFatally(message || 'Your session has ended. Please sign in again.');
      return;
    }

    // Undelivered. Not a logout while the token is still good — §4.
    const session = this.store.read();
    const expiresAt = session && typeof session.expiresAt === 'number' ? session.expiresAt : undefined;
    const stillValid = expiresAt !== undefined && this.now() < expiresAt;

    if (stillValid && this.retries < RETRY_LIMIT) {
      // Anyone waiting can go out with the token they already have.
      if (session) this.flush(session);
      const delay = Math.min(RETRY_BASE_MS * Math.pow(2, this.retries), RETRY_MAX_MS);
      this.retries++;
      this.clearTimer();
      this.timer = this.setTimeoutImpl(() => {
        this.timer = undefined;
        this.beginRefresh();
      }, delay);
      return;
    }

    // The token has run out and we still cannot reach the backend. The session
    // is unusable — but the reason says so, rather than claiming a rejection.
    this.failFatally(
      message
        ? 'Your session could not be renewed: ' + message
        : 'Your session could not be renewed because the backend could not be reached.'
    );
  }

  private failFatally(reason: string): void {
    this.clearTimer();
    this.retries = 0;
    this.store.clear();
    this.flush(undefined, reason);
    if (this.onSessionLost) this.onSessionLost(reason);
  }

  private releaseLock(): void {
    if (!this.holdsLock) return;
    this.store.releaseRefreshLock();
    this.holdsLock = false;
  }

  private flush(session: StoredSession | undefined, error?: string): void {
    const waiting = this.queue;
    this.queue = [];
    for (const callback of waiting) callback(session, error);
  }

  // ── Cross-tab ────────────────────────────────────────────────────────────

  /**
   * The leader tab may have been closed mid-refresh, so a follower does not wait
   * forever. When the lock's lifetime is up and no new session has arrived, it
   * tries again — and by then the stale lock is takeable.
   */
  private waitForOtherTab(): void {
    this.clearTimer();
    this.timer = this.setTimeoutImpl(() => {
      this.timer = undefined;
      this.beginRefresh();
    }, this.store.lockTtlMs);
  }

  private adoptFromOtherTab(session: StoredSession | undefined): void {
    if (!session || !session.sessionToken) {
      // Another tab signed out. §5 rule 4: cross-tab logout propagation, free.
      this.clearTimer();
      this.flush(undefined, 'Signed out in another tab.');
      if (this.onSessionClearedElsewhere) this.onSessionClearedElsewhere();
      return;
    }

    this.flush(session);
    // Through `sessionChanged` rather than straight to `arm`: the other tab may
    // have written a session with no `expiresAt` on it, and arming against an
    // absent deadline is a timer that fires immediately, forever.
    this.sessionChanged();
  }
}
