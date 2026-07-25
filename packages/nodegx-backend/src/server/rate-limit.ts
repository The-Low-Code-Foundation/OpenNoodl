/**
 * A minimal fixed-window rate limiter (BAK-002 scope: "simple fixed-window
 * here; BAK-009 generalizes"). In-memory, single-process — matches this
 * service's single-process semantics everywhere else (WF-005's documented
 * stance on schedulers/queues).
 *
 * @module nodegx-backend/server/rate-limit
 */

interface Window {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** True if `key` is still within its limit for the current window (and counts this call toward it). */
  allow(key: string): boolean {
    const now = Date.now();
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (existing.count >= this.limit) return false;
    existing.count += 1;
    return true;
  }

  /** Test/ops helper: drop all tracked windows. */
  reset(): void {
    this.windows.clear();
  }
}

/** The request's best-effort client identity for rate-limit keying (not auth — just a bucket key). */
export function clientKey(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}
