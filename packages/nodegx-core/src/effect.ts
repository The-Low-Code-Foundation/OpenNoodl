import { cancelEffect, clearSources, queueEffect, withTracking, type DerivedNode, type SourceNode } from './internal';

/**
 * Runs a function now, and again when anything it read has changed.
 *
 * This is the exported equivalent of a node that reacts rather than computes — writing to
 * `document.title`, persisting to local storage, opening a socket. Dependencies are discovered the
 * same way `derived` discovers them: whatever the function reads, it depends on.
 *
 * Re-runs are **deferred to the end of the turn and coalesced**, which is where the interpreted
 * runtime's frame drain lives (CONTRACT.md C5). Ten writes to the same value inside one handler
 * produce one re-run. The immediate first run is not deferred.
 *
 * Returning a function from the effect registers cleanup, run before each re-run and on dispose —
 * the same contract as React's `useEffect`, deliberately, because that is the one every reader
 * already knows.
 *
 * ```ts
 * const stop = effect(() => {
 *   document.title = chat.get().title;
 * });
 * ```
 *
 * @returns a function that stops the effect and runs its cleanup
 */
export function effect(fn: () => void | (() => void)): () => void {
  const node = new EffectNode(fn);
  node.execute();
  return () => node.dispose();
}

class EffectNode implements DerivedNode {
  dependents: Set<DerivedNode> | null = null;
  stale = false;
  sources = new Set<SourceNode>();

  private readonly fn: () => void | (() => void);
  private cleanup: (() => void) | void = undefined;
  private disposed = false;

  /** Bound once so `queueEffect`'s Set can coalesce repeat schedules of the same effect. */
  private readonly run = (): void => {
    if (this.disposed) return;
    this.execute();
  };

  constructor(fn: () => void | (() => void)) {
    this.fn = fn;
  }

  execute(): void {
    if (this.cleanup !== undefined) {
      const cleanup = this.cleanup;
      this.cleanup = undefined;
      cleanup();
    }
    clearSources(this);
    this.stale = false;
    this.cleanup = withTracking(this, this.fn);
  }

  notifyStale(): void {
    if (this.disposed) return;
    queueEffect(this.run);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelEffect(this.run);
    clearSources(this);
    if (this.cleanup !== undefined) {
      const cleanup = this.cleanup;
      this.cleanup = undefined;
      cleanup();
    }
  }
}
