/**
 * The retry backoff policy, read the way the executor reads it (CWF-005).
 *
 * Pure, and in this folder rather than beside the control, for the reason
 * `workflowPorts.ts` is: a preview is a *promise about server behaviour*, and a
 * promise has to be testable without a renderer. This module imports nothing at
 * all — keep it that way.
 *
 * The formula is `RetryStepExecutor`'s, restated:
 *
 *     delay before attempt n+1 = min(delayMs * multiplier^(n-1), maxDelayMs)
 *     jitter randomises each delay across [50%, 100%]
 *
 * ⚠️ **The fallbacks are load-bearing and are NOT the catalog's defaults.** A
 * declared `default` in the step-kind catalog never runs a setter — the repo's
 * most-repeated trap — so a step whose params omit `delayMs` is given 1000 by the
 * executor's own `numberParam(p.delayMs, 1000)` at run time, and by nothing at
 * author time. A preview that read the catalog would describe a policy nobody
 * set; one that read only the stored params would describe a step that waits 0ms.
 * These numbers must track the executor, not the catalog.
 *
 * @module models/workflow/retryBackoff
 */

export interface BackoffPolicy {
  maxAttempts?: unknown;
  delayMs?: unknown;
  backoffMultiplier?: unknown;
  maxDelayMs?: unknown;
  jitter?: unknown;
}

const FALLBACK = { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2, maxDelayMs: 60000 };

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Human duration: 250ms, 1.5s, 2s, 1m 30s. */
export function humanMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${Number.isInteger(s) ? s : s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s - m * 60);
  return rest ? `${m}m ${rest}s` : `${m}m`;
}

/** The waits between attempts — one fewer than the number of attempts. */
export function backoffDelays(policy: BackoffPolicy): number[] {
  const attempts = Math.max(1, Math.floor(num(policy.maxAttempts, FALLBACK.maxAttempts)));
  const base = Math.max(0, num(policy.delayMs, FALLBACK.delayMs));
  const multiplier = Math.max(1, num(policy.backoffMultiplier, FALLBACK.backoffMultiplier));
  const ceiling = Math.max(0, num(policy.maxDelayMs, FALLBACK.maxDelayMs));

  const delays: number[] = [];
  for (let attempt = 1; attempt < attempts; attempt++) {
    delays.push(Math.min(base * Math.pow(multiplier, attempt - 1), ceiling));
  }
  return delays;
}

/**
 * The sentence the five number fields cannot say between them.
 *
 * Jitter shows as a RANGE, because the executor randomises each delay across
 * [50%, 100%] — a single number would be a preview that never matches what you
 * observe, which is worse than no preview.
 */
export function backoffSummary(policy: BackoffPolicy): string {
  const attempts = Math.max(1, Math.floor(num(policy.maxAttempts, FALLBACK.maxAttempts)));
  if (attempts <= 1) return 'No retry: the function is called once, and a failure fails the step.';

  const delays = backoffDelays(policy);
  const jitter = policy.jitter === true;
  const parts = delays.map((d) => (jitter ? `${humanMs(d / 2)}–${humanMs(d)}` : humanMs(d)));
  const total = delays.reduce((a, b) => a + b, 0);
  const totalText = jitter ? `${humanMs(total / 2)}–${humanMs(total)}` : humanMs(total);

  return `${attempts} attempts, waiting ${parts.join(', then ')} — up to ${totalText} of delay.`;
}
