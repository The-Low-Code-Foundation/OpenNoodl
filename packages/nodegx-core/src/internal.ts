/**
 * The reactive graph and the turn scheduler.
 *
 * Nothing in here is exported from the package. It is the mechanism the primitives share, and it
 * exists as one file because the invalidation pass and the scheduler have to agree about what a
 * "turn" is — see CONTRACT.md C5.
 */

/** A thing derived values can read and therefore depend on. */
export interface SourceNode {
  /** Derived values that read this source during their last computation. */
  dependents: Set<DerivedNode> | null;
}

/** A source that is itself computed, and so can go stale. */
export interface DerivedNode extends SourceNode {
  stale: boolean;
  /** Sources read during the last computation, so edges can be cleared before recomputing. */
  sources: Set<SourceNode>;
  /** Called during the notify phase, after every stale mark in the pass is set. */
  notifyStale(): void;
}

// ---------------------------------------------------------------------------
// Dependency tracking
// ---------------------------------------------------------------------------

let currentComputation: DerivedNode | null = null;

/**
 * Records that the computation currently running read `source`.
 *
 * Outside a computation this is a single null check, which is the common case: generated code
 * reads values from event handlers far more often than from inside a `derived`.
 */
export function track(source: SourceNode): void {
  const computation = currentComputation;
  if (computation === null) return;

  if (source.dependents === null) source.dependents = new Set();
  source.dependents.add(computation);
  computation.sources.add(source);
}

/** Runs `compute` with `node` as the tracking target, restoring the previous target afterwards. */
export function withTracking<T>(node: DerivedNode, compute: () => T): T {
  const previous = currentComputation;
  currentComputation = node;
  try {
    return compute();
  } finally {
    currentComputation = previous;
  }
}

/** Runs `fn` with tracking suspended, so reads inside it create no dependency edges. */
export function untracked<T>(fn: () => T): T {
  const previous = currentComputation;
  currentComputation = null;
  try {
    return fn();
  } finally {
    currentComputation = previous;
  }
}

/** Drops every edge into `node`, so a recomputation can record a fresh set. */
export function clearSources(node: DerivedNode): void {
  for (const source of node.sources) {
    source.dependents?.delete(node);
  }
  node.sources.clear();
}

// ---------------------------------------------------------------------------
// Propagation
// ---------------------------------------------------------------------------

/**
 * Two-phase propagation, which is what makes the graph glitch-free (CONTRACT.md C6).
 *
 * Phase one walks the whole dependent subtree and marks it stale. Phase two notifies — the source's
 * own subscribers first, then every derived that was staled. By the time any subscriber runs, every
 * value it could read is already known to be stale, so reading it recomputes from current inputs
 * rather than returning a half-updated cache.
 *
 * `seen` is per-pass and deliberately not the `stale` flag: a derived that is *already* stale from
 * an earlier write must still be collected and notified again, because CONTRACT.md C2 says every
 * write is delivered.
 */
export function propagate(source: SourceNode, notifySource: () => void): void {
  runInTurn(() => {
    const dependents = source.dependents;

    if (dependents === null || dependents.size === 0) {
      notifySource();
      return;
    }

    const staled: DerivedNode[] = [];
    const seen = new Set<DerivedNode>();
    collectStale(source, staled, seen);

    notifySource();

    for (let i = 0; i < staled.length; i++) {
      staled[i].notifyStale();
    }
  });
}

function collectStale(node: SourceNode, out: DerivedNode[], seen: Set<DerivedNode>): void {
  const dependents = node.dependents;
  if (dependents === null) return;

  for (const dependent of dependents) {
    if (seen.has(dependent)) continue;
    seen.add(dependent);
    dependent.stale = true;
    out.push(dependent);
    collectStale(dependent, out, seen);
  }
}

// ---------------------------------------------------------------------------
// The turn
// ---------------------------------------------------------------------------

export class CyclicUpdateError extends Error {
  constructor(depth: number) {
    super(
      `@nodegx/core: update depth of ${depth} exceeded — a subscriber is writing to something it ` +
        'depends on. The interpreted runtime breaks this cycle silently and continues on the next ' +
        'frame; exported code should not contain one. Raise the limit with ' +
        'configureRuntime({ maxTurnDepth }) if this is genuinely intended.'
    );
    this.name = 'CyclicUpdateError';
  }
}

type ScheduleFn = (flush: () => void) => void;

const defaultSchedule: ScheduleFn =
  typeof queueMicrotask === 'function' ? queueMicrotask : (flush) => Promise.resolve().then(flush);

let schedule: ScheduleFn = defaultSchedule;
let maxTurnDepth = 100;

let turnDepth = 0;
let batchDepth = 0;
let flushScheduled = false;
const pendingEffects = new Set<() => void>();

/**
 * Runs `fn` as one nesting level of the current turn, guarded against runaway recursion.
 *
 * The limit is checked *before* incrementing so that the throw leaves the counter balanced: every
 * frame already on the stack still runs its own `finally`, unwinding the depth back to zero. A
 * counter that drifted would make the next unrelated write throw, which is the confusing failure
 * this shape avoids.
 */
export function runInTurn<T>(fn: () => T): T {
  if (turnDepth >= maxTurnDepth) throw new CyclicUpdateError(maxTurnDepth);
  turnDepth++;
  try {
    return fn();
  } finally {
    turnDepth--;
    if (turnDepth === 0 && batchDepth === 0) scheduleFlush();
  }
}

/** Queues an effect to run when the turn settles. Re-queueing before the flush coalesces. */
export function queueEffect(run: () => void): void {
  pendingEffects.add(run);
  if (turnDepth === 0 && batchDepth === 0) scheduleFlush();
}

export function cancelEffect(run: () => void): void {
  pendingEffects.delete(run);
}

function scheduleFlush(): void {
  if (flushScheduled || pendingEffects.size === 0) return;
  flushScheduled = true;
  schedule(flushEffects);
}

function flushEffects(): void {
  flushScheduled = false;
  if (pendingEffects.size === 0) return;

  // Snapshot before running: an effect that writes may queue further effects, and those belong to
  // the next drain rather than to this one. This is the runtime's `callbacksAfterUpdate` swap
  // (nodecontext.ts:380-388).
  const running = Array.from(pendingEffects);
  pendingEffects.clear();

  for (let i = 0; i < running.length; i++) {
    running[i]();
  }

  if (pendingEffects.size > 0) scheduleFlush();
}

/**
 * Coalesces the end-of-turn effect flush across `fn`.
 *
 * It does **not** defer subscriber notification: CONTRACT.md C2 says every write is delivered, and
 * the ordering in EXP-001-TARGET-OUTPUT.md §4 depends on `set` having notified before the next
 * statement runs.
 */
export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0 && turnDepth === 0) scheduleFlush();
  }
}

/** Runs every queued effect immediately. Exported for tests and for the EXP-003 trace harness. */
export function flushSync(): void {
  flushEffects();
}

export interface RuntimeOptions {
  /**
   * How the end-of-turn effect flush is scheduled. Defaults to a microtask; EXP-003's trace harness
   * installs `requestAnimationFrame` to match the interpreter's frame turn exactly.
   */
  schedule?: ScheduleFn;
  /** Update-depth limit before {@link CyclicUpdateError}. Mirrors the runtime's breakers (C9). */
  maxTurnDepth?: number;
}

export function configureRuntime(options: RuntimeOptions): void {
  if (options.schedule !== undefined) schedule = options.schedule;
  if (options.maxTurnDepth !== undefined) maxTurnDepth = options.maxTurnDepth;
}

/** Restores the shipped defaults. Used by tests; harmless in an app. */
export function resetRuntime(): void {
  schedule = defaultSchedule;
  maxTurnDepth = 100;
  turnDepth = 0;
  batchDepth = 0;
  flushScheduled = false;
  pendingEffects.clear();
}
