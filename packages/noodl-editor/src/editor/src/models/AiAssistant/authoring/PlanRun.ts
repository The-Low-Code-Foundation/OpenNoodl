/**
 * AIX-011 — Project-scope authoring: the plan orchestrator
 *
 * Fans an approved plan out through the EXISTING single-component loop — one
 * `AuthoringSession` per component operation, unchanged prompts, unchanged
 * validation gate, unchanged repair loop. This class adds sequencing and
 * bookkeeping, not a second authoring implementation.
 *
 * What it holds is plain data and detached sessions; it never imports staging
 * and cannot touch a `ProjectModel`. When the run finishes, the panel asks
 * for `acceptedOperations(...)` — the complete staged set, dependency-closed
 * — and hands that to `applyAuthoredPlan` in one call. Everything before
 * that call is rejectable by dropping this object (criteria 2 and 5 are
 * structural).
 *
 * Cross-operation visibility without cross-operation application: after each
 * authored operation, a *working copy* of the `ExplainGraph` gains (or swaps
 * in) the staged component, so later sessions can instantiate — and the gate
 * can validate against — what earlier operations produced, while the project
 * itself stays untouched until apply.
 *
 * @module AiAssistant/authoring/PlanRun
 */

import type { ExplainGraph } from '../explain/types';
import type { AuthoringSessionOptions, AuthoringSessionState } from './AuthoringSession';
import { AuthoringSession, AuthoringSetupError } from './AuthoringSession';
import { pathToLegacyName } from './candidate';
import type { AuthoringPlan, PlanOperation } from './plan';
import { graphComponentFromFiles, planExcludedWith, planOperationRequires, renderPlanContext } from './plan';
import type { AppliedPlanOperation } from './planStaging';
import type { AuthoringMode, ComponentFiles } from './types';

export type PlanOperationStatus =
  /** Not reached yet. */
  | 'pending'
  /** Its session is running now. */
  | 'authoring'
  /** Passed the gate; files staged in memory. */
  | 'staged'
  /** The gate (or the session) gave up; see `error`. */
  | 'failed'
  /** A doc operation — no authoring session; written at apply via the AIX-009 seam. */
  | 'doc'
  /** The run was cancelled before this operation started. */
  | 'skipped';

export interface PlanOperationState {
  operation: PlanOperation;
  status: PlanOperationStatus;
  /** create/update, for component operations. */
  mode?: AuthoringMode;
  error?: string;
  staged?: { nodeCount: number; connectionCount: number };
}

export interface PlanRunState {
  busy: boolean;
  phase: 'idle' | 'running' | 'done' | 'cancelled';
  operations: PlanOperationState[];
  activeOperationId?: string;
  /** The active (or most recent) session's published state — the live feed. */
  session?: AuthoringSessionState;
  /** Cumulative across all sessions; null when any turn had unknown pricing. */
  costUsd: number | null;
}

export interface PlanRunOptions {
  /**
   * The current component's exporter-shaped v2 files, for update operations —
   * injected because this class holds an `ExplainGraph`, never a
   * `ProjectModel`. The panel binds `buildComponentV2Files`; specs bind
   * fixtures.
   */
  baseFilesFor?: (legacyName: string) => ComponentFiles | undefined;
  /** Per-session options: chat seam, budget, style vocabulary, effort… */
  session?: AuthoringSessionOptions;
}

type Listener = (state: PlanRunState) => void;

export class PlanRun {
  private readonly states: PlanOperationState[];
  private readonly filesById = new Map<string, ComponentFiles>();
  private readonly listeners = new Set<Listener>();
  private phase: PlanRunState['phase'] = 'idle';
  private activeSession?: AuthoringSession;
  private activeSessionState?: AuthoringSessionState;
  private activeOperationId?: string;
  private costUsd: number | null = 0;
  private cancelled = false;
  private started = false;

  constructor(
    private readonly graph: ExplainGraph,
    readonly plan: AuthoringPlan,
    private readonly options: PlanRunOptions = {}
  ) {
    this.states = plan.operations.map((operation) => ({
      operation,
      status: operation.kind === 'doc' ? ('doc' as const) : ('pending' as const),
      ...(operation.kind !== 'doc' ? { mode: operation.kind as AuthoringMode } : {})
    }));
  }

  get state(): PlanRunState {
    return {
      busy: this.phase === 'running',
      phase: this.phase,
      operations: this.states.map((s) => ({ ...s })),
      activeOperationId: this.activeOperationId,
      session: this.activeSessionState,
      costUsd: this.costUsd
    };
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish(): void {
    const state = this.state;
    for (const listener of this.listeners) listener(state);
  }

  /** Abort the active session and skip the rest. Staged operations survive. */
  cancel(): void {
    this.cancelled = true;
    this.activeSession?.cancel();
  }

  dispose(): void {
    this.cancel();
    this.activeSession?.dispose();
    this.listeners.clear();
  }

  /** The staged candidate for one operation (review reads this). */
  filesFor(operationId: string): ComponentFiles | undefined {
    return this.filesById.get(operationId);
  }

  /**
   * Replace one staged operation's files with a reviewed (possibly partial)
   * selection — the per-component review document's accept lands here, never
   * in the project.
   */
  setOperationFiles(operationId: string, files: ComponentFiles): void {
    const state = this.states.find((s) => s.operation.id === operationId);
    if (!state || state.status !== 'staged') {
      throw new AuthoringSetupError(`Operation "${operationId}" has no staged candidate to replace.`);
    }
    this.filesById.set(operationId, files);
    state.staged = { nodeCount: files.nodes.nodes.length, connectionCount: files.connections.connections.length };
    this.publish();
  }

  /** Operation-level dependency edges over the *staged* candidates. */
  requires(): Map<string, string[]> {
    return planOperationRequires(
      this.states.map((s) => ({ operation: s.operation, files: this.filesById.get(s.operation.id) }))
    );
  }

  /**
   * The accepted set for `applyAuthoredPlan`: every staged operation (plus doc
   * operations when `includeDocs`), minus `excluded` closed over the
   * dependency edges — dropping "create Checkout" drops the operations whose
   * candidates instantiate it, so an invalid partial apply is unrepresentable
   * here for the same reason it is inside one component's change set.
   * Returns the operations in plan order and the exclusion closure applied.
   */
  acceptedOperations(
    excluded: Iterable<string> = [],
    options: { includeDocs?: boolean } = {}
  ): { operations: AppliedPlanOperation[]; excluded: Set<string> } {
    const requires = this.requires();
    const failed = this.states.filter((s) => s.status === 'failed' || s.status === 'skipped').map((s) => s.operation.id);
    const closure = planExcludedWith(requires, [...excluded, ...failed]);
    const operations: AppliedPlanOperation[] = [];
    for (const s of this.states) {
      if (closure.has(s.operation.id)) continue;
      if (s.status === 'staged') {
        const files = this.filesById.get(s.operation.id);
        if (!files) continue;
        operations.push({ kind: s.operation.kind as 'create' | 'update', operation: s.operation, files });
      } else if (s.status === 'doc' && options.includeDocs) {
        operations.push({ kind: 'doc', operation: s.operation });
      }
    }
    return { operations, excluded: closure };
  }

  /** Author every component operation, in plan order. Never throws for loop-shaped failures. */
  async run(): Promise<PlanRunState> {
    if (this.started) throw new AuthoringSetupError('run() was already called on this plan.');
    this.started = true;
    this.phase = 'running';
    this.publish();

    // The working copy later sessions see; the caller's graph stays pristine.
    let workingGraph: ExplainGraph = { components: [...this.graph.components] };

    for (const state of this.states) {
      if (state.operation.kind === 'doc') continue; // written at apply, via the seam
      if (this.cancelled) {
        state.status = 'skipped';
        continue;
      }

      const operation = state.operation;
      const legacyName = pathToLegacyName(operation.target);
      state.status = 'authoring';
      this.activeOperationId = operation.id;
      this.publish();

      let session: AuthoringSession;
      try {
        const request = { description: operation.intent, componentPath: operation.target };
        const sessionOptions: AuthoringSessionOptions = {
          ...this.options.session,
          planContext: renderPlanContext(this.plan, operation.id)
        };
        if (operation.kind === 'update') {
          const base = this.options.baseFilesFor?.(legacyName);
          if (!base) {
            throw new AuthoringSetupError(`No current source for "${operation.target}" — cannot author an update.`);
          }
          session = AuthoringSession.createUpdate(workingGraph, request, base, sessionOptions);
        } else {
          session = AuthoringSession.create(workingGraph, request, sessionOptions);
        }
      } catch (error) {
        state.status = 'failed';
        state.error = error instanceof Error ? error.message : String(error);
        this.publish();
        continue;
      }

      this.activeSession = session;
      const unsubscribe = session.onChange((sessionState) => {
        this.activeSessionState = sessionState;
        this.publish();
      });
      this.activeSessionState = session.state;
      this.publish();

      const outcome = await session.run();
      unsubscribe();
      this.costUsd =
        this.costUsd === null || outcome.metrics.costUsd === null ? null : this.costUsd + outcome.metrics.costUsd;

      if (outcome.status === 'authored' && outcome.files) {
        state.status = 'staged';
        state.staged = {
          nodeCount: outcome.files.nodes.nodes.length,
          connectionCount: outcome.files.connections.connections.length
        };
        this.filesById.set(operation.id, outcome.files);
        // Later operations see this candidate — staged, never applied.
        const authored = graphComponentFromFiles(legacyName, outcome.files);
        const components = workingGraph.components.filter((c) => c.name !== legacyName);
        workingGraph = { components: [...components, authored] };
      } else if (outcome.status === 'cancelled') {
        state.status = 'skipped';
        this.cancelled = true;
      } else {
        state.status = 'failed';
        state.error =
          outcome.error ??
          (outcome.status === 'exhausted'
            ? 'The agent could not produce a valid component within its budget.'
            : outcome.status);
      }
      this.activeSession = undefined;
      this.publish();
    }

    this.activeOperationId = undefined;
    this.phase = this.cancelled ? 'cancelled' : 'done';
    this.publish();
    return this.state;
  }
}
