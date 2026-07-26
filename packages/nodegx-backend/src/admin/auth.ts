/**
 * Credential brute-force resistance (BAK-005).
 *
 * The admin dashboard turns the admin credential into something a human types
 * into a form on a reachable URL, which makes online guessing a real attack for
 * the first time — the spec's "admin surface becomes the attack surface" risk
 * row. The mitigation is not a new auth path: it is a failure budget in front
 * of the ONE credential check `SecurityState.resolvePrincipal` already does.
 *
 * Shape, and why it is this shape:
 *   - Only FAILURES are counted. Successes do not reset the window, so a
 *     valid session running alongside a guessing attack does not launder it.
 *   - The window is fixed and short. This is a speed bump against online
 *     guessing, not an account-lockout system — there is no account to lock,
 *     and a permanent lockout on a single-credential service would be a
 *     self-inflicted denial of service on the operator.
 *   - Keyed by client identity (`clientKey`, the same helper BAK-002's public
 *     mail endpoints use) — one shared limiter here would let any one caller
 *     lock everyone out.
 *   - In-memory and single-process, matching every other limiter and scheduler
 *     in this service (WF-005's documented single-process stance).
 *
 * @module nodegx-backend/admin/auth
 */

interface FailureWindow {
  count: number;
  resetAt: number;
}

export const DEFAULT_MAX_FAILURES = 10;
export const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

export class AuthAttemptLimiter {
  private readonly windows = new Map<string, FailureWindow>();

  constructor(
    private readonly maxFailures: number = DEFAULT_MAX_FAILURES,
    private readonly windowMs: number = DEFAULT_WINDOW_MS
  ) {}

  /** True when `key` has burned its failure budget for the current window. */
  isLockedOut(key: string): boolean {
    const window = this.windows.get(key);
    if (!window) return false;
    if (window.resetAt <= Date.now()) {
      this.windows.delete(key);
      return false;
    }
    return window.count >= this.maxFailures;
  }

  /** Count one rejected credential against `key`. */
  recordFailure(key: string): void {
    const now = Date.now();
    const window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    window.count += 1;
  }

  /** Seconds until `key`'s budget refills (0 when it is not locked out). */
  retryAfterSeconds(key: string): number {
    const window = this.windows.get(key);
    if (!window) return 0;
    return Math.max(0, Math.ceil((window.resetAt - Date.now()) / 1000));
  }

  /** Test/ops helper: forget every tracked failure. */
  reset(): void {
    this.windows.clear();
  }
}
