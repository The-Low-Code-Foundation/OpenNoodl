/**
 * CWF-005 S1 — the backoff preview says what the executor will actually do.
 *
 * A preview is a promise about behaviour, so the arithmetic is pinned against
 * `RetryStepExecutor`'s own formula, restated here as the spec's expectation
 * rather than imported (the backend is a separate package with its own build,
 * and this suite runs in plain Node — the same reason the editor's step-kind
 * types are structural).
 *
 *   delay before attempt n+1 = min(delayMs * multiplier^(n-1), maxDelayMs)
 *   jitter randomises each delay across [50%, 100%]
 *
 * ⚠️ The fallbacks matter as much as the formula. **A declared `default` in the
 * step-kind catalog never runs a setter** — the repo's most-repeated trap — so a
 * step that omits `delayMs` is given 1000 by the EXECUTOR, not by the catalog. A
 * preview reading the catalog defaults and a preview reading nothing would both
 * describe a step that does not exist.
 */
import { backoffDelays, backoffSummary, humanMs } from '../../src/editor/src/models/workflow/retryBackoff';

describe('CWF-005 backoff preview', () => {
  it('matches the executor on the default policy, which nothing ever set', () => {
    // maxAttempts 3, delayMs 1000, multiplier 2 — two waits, 1s then 2s.
    expect(backoffDelays({})).toEqual([1000, 2000]);
    expect(backoffSummary({})).toBe('3 attempts, waiting 1s, then 2s — up to 3s of delay.');
  });

  it('caps each delay at maxDelayMs, not the total', () => {
    // 1s, 10s, then 60s twice — the ceiling bites on the third and fourth wait,
    // and the total keeps climbing past it. A preview that capped the TOTAL
    // would understate a five-attempt policy by minutes.
    expect(backoffDelays({ maxAttempts: 5, delayMs: 1000, backoffMultiplier: 10, maxDelayMs: 60000 })).toEqual([
      1000, 10000, 60000, 60000
    ]);
  });

  it('a multiplier of 1 is a fixed delay', () => {
    expect(backoffDelays({ maxAttempts: 4, delayMs: 500, backoffMultiplier: 1 })).toEqual([500, 500, 500]);
  });

  it('says 1 means no retry, in those words', () => {
    // The whole point of S1: `1` was accepted in silence and means the opposite
    // of what someone reaching for a Retry step wanted.
    expect(backoffDelays({ maxAttempts: 1 })).toEqual([]);
    expect(backoffSummary({ maxAttempts: 1 })).toMatch(/No retry/);
    expect(backoffSummary({ maxAttempts: 1 })).toMatch(/called once/);
  });

  it('shows jitter as a RANGE, because a single number would never match', () => {
    const summary = backoffSummary({ maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2, jitter: true });
    expect(summary).toContain('500ms–1s');
    expect(summary).toContain('1s–2s');
    expect(summary).toContain('up to 1.5s–3s');
  });

  it('reads durations the way a person would', () => {
    expect(humanMs(250)).toBe('250ms');
    expect(humanMs(1000)).toBe('1s');
    expect(humanMs(1500)).toBe('1.5s');
    expect(humanMs(60000)).toBe('1m');
    expect(humanMs(90000)).toBe('1m 30s');
  });

  it('survives a half-typed number without pretending it is a policy', () => {
    // The row is a text field: mid-edit it can hold NaN or an empty string, and
    // the preview must fall back to the executor's own behaviour rather than
    // render "NaN attempts".
    expect(backoffSummary({ maxAttempts: undefined })).toBe(backoffSummary({}));
    expect(backoffSummary({ maxAttempts: Number.NaN })).toBe(backoffSummary({}));
    expect(backoffSummary({ maxAttempts: 0 })).toMatch(/No retry/);
  });
});
