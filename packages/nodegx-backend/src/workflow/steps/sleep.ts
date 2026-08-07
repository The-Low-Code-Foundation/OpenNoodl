/**
 * Cancellable sleep — the one place WF-002 waits.
 *
 * WF-001-SEMANTICS §3 makes cancellation prompt by RACING the executor against
 * the run's abort signal, which means a non-cooperative executor leaves orphaned
 * work running in the background. A `setTimeout` that is not cleared is exactly
 * that: a timer holding the event loop (and, in a deployed service, a process)
 * open long after the run it belonged to was cancelled. So every wait in WF-002
 * — the `wait` and `wait-until` kinds and `retry`'s backoff — goes through this
 * helper, which clears its timer and resolves the moment the signal aborts.
 *
 * The timer is `unref`'d for the same reason the engine unrefs its own: a
 * pending wait must never be the reason the service will not shut down.
 *
 * @module nodegx-backend/workflow/steps/sleep
 */

export interface SleepOutcome {
  /** Milliseconds actually spent waiting. */
  waitedMs: number;
  /** True when the abort signal ended the wait early. */
  aborted: boolean;
}

/**
 * Wait `ms`, or until `signal` aborts — whichever comes first. Never rejects;
 * the caller decides what an abort means (the engine's own abort race is what
 * turns a cancelled run into a `cancelled` record).
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<SleepOutcome> {
  const started = Date.now();
  if (ms <= 0) return Promise.resolve({ waitedMs: 0, aborted: false });
  if (signal?.aborted) return Promise.resolve({ waitedMs: 0, aborted: true });

  return new Promise<SleepOutcome>((resolve) => {
    let settled = false;
    const finish = (aborted: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve({ waitedMs: Date.now() - started, aborted });
    };
    const onAbort = (): void => finish(true);

    const timer = setTimeout(() => finish(false), ms);
    if (typeof timer.unref === 'function') timer.unref();
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
