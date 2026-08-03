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
 * Doc operations author too (AIX-011 criterion 7). They run in a SECOND pass,
 * after every component operation, through `DocSession` — the doc turn's whole
 * value is seeing what the plan actually built, including what it failed to
 * build. The result is a proposed file body held here as plain data, reviewed
 * as a diff in the plan, and written by the transaction's `PlanDocWriter`
 * inside the plan's single undo group. Nothing here reads or writes a file:
 * the current content arrives through the injected `docBaselineFor`.
 *
 * @module AiAssistant/authoring/PlanRun
 */

import type { ExplainGraph } from '../explain/types';
import type { AuthoringSessionOptions, AuthoringSessionState } from './AuthoringSession';
import { AuthoringSession, AuthoringSetupError } from './AuthoringSession';
import { pathToLegacyName } from './candidate';
import type { DocSessionOptions } from './DocSession';
import { DocSession } from './DocSession';
import type { AuthoringPlan, PlanOperation, PlanOutcomeEntry } from './plan';
import { graphComponentFromFiles, planExcludedWith, planOperationRequires, renderPlanContext } from './plan';
import type { AppliedPlanOperation } from './planStaging';
import type { AuthoringMode, ComponentFiles } from './types';

export type PlanOperationStatus =
  /** Not reached yet. */
  | 'pending'
  /** Its session is running now. */
  | 'authoring'
  /** Passed the gate; files (or, for a doc, a proposed body) staged in memory. */
  | 'staged'
  /** The gate (or the session) gave up; see `error`. */
  | 'failed'
  /** Cancelled before it started, or — for a doc — the agent declined to write. */
  | 'skipped';

/** A doc operation's authored body, held in memory until apply. */
export interface StagedDoc {
  /** Project-relative doc path. */
  path: string;
  /** The whole proposed file. */
  proposed: string;
  /** The file as it stood when the turn read it; `null` when it did not exist. */
  baseline: string | null;
  /** The model's one-line description of its change, for the review header. */
  summary?: string;
  /** Advisory graph-restatement findings that survived the one rewrite pass. */
  lintFindings: string[];
}

export interface PlanOperationState {
  operation: PlanOperation;
  status: PlanOperationStatus;
  /** create/update, for component operations. */
  mode?: AuthoringMode;
  error?: string;
  staged?: { nodeCount: number; connectionCount: number };
  /** Doc operations: the authored body's size and headline, for the plan list. */
  stagedDoc?: { chars: number; summary?: string; created: boolean; lintFindings: string[] };
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
  /**
   * The current content of a project doc, for the doc-authoring turn and for
   * the write path's drift check. Injected for the same reason `baseFilesFor`
   * is: this class holds an `ExplainGraph`, never a `ProjectModel` and never a
   * filesystem. Returning `undefined` means the file does not exist yet.
   * Omitting the callback entirely makes every doc operation fail loudly rather
   * than author a document against an imagined baseline.
   */
  docBaselineFor?: (relPath: string) => string | undefined | Promise<string | undefined>;
  /** Per-doc-session options: chat seam, budget, effort, lint. */
  doc?: DocSessionOptions;
}

type Listener = (state: PlanRunState) => void;

export class PlanRun {
  private readonly states: PlanOperationState[];
  private readonly filesById = new Map<string, ComponentFiles>();
  private readonly docsById = new Map<string, StagedDoc>();
  private readonly listeners = new Set<Listener>();
  private phase: PlanRunState['phase'] = 'idle';
  private activeSession?: AuthoringSession;
  /** The in-flight doc turn's abort handle — `DocSession` publishes no state. */
  private docAbort?: AbortController;
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
      status: 'pending' as const,
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
    this.docAbort?.abort();
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

  /** The authored doc body for one doc operation (the diff review reads this). */
  docFor(operationId: string): StagedDoc | undefined {
    return this.docsById.get(operationId);
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
   * The accepted set for `applyAuthoredPlan`: every staged operation, minus
   * `excluded` closed over the dependency edges — dropping "create Checkout"
   * drops the operations whose candidates instantiate it, so an invalid partial
   * apply is unrepresentable here for the same reason it is inside one
   * component's change set. Returns the operations in plan order and the
   * exclusion closure applied.
   *
   * `includeDocs` defaults to true now that doc operations author a body. It
   * stays as an option for the one case that is not a user choice: a project
   * with no folder on disk has nowhere to put a `docs/`, so the panel has no
   * writer to offer and must leave doc operations out rather than let the
   * transaction refuse the whole plan.
   */
  acceptedOperations(
    excluded: Iterable<string> = [],
    options: { includeDocs?: boolean } = {}
  ): { operations: AppliedPlanOperation[]; excluded: Set<string> } {
    const includeDocs = options.includeDocs ?? true;
    const requires = this.requires();
    const failed = this.states.filter((s) => s.status === 'failed' || s.status === 'skipped').map((s) => s.operation.id);
    const closure = planExcludedWith(requires, [...excluded, ...failed]);
    const operations: AppliedPlanOperation[] = [];
    for (const s of this.states) {
      if (closure.has(s.operation.id)) continue;
      if (s.status !== 'staged') continue;
      if (s.operation.kind === 'doc') {
        const doc = this.docsById.get(s.operation.id);
        if (!doc || !includeDocs) continue;
        operations.push({
          kind: 'doc',
          operation: s.operation,
          proposed: doc.proposed,
          baseline: doc.baseline,
          summary: doc.summary
        });
      } else {
        const files = this.filesById.get(s.operation.id);
        if (!files) continue;
        operations.push({ kind: s.operation.kind as 'create' | 'update', operation: s.operation, files });
      }
    }
    return { operations, excluded: closure };
  }

  /**
   * AIB-001 slice 4 — re-author ONE operation, leaving every other staged
   * candidate alone.
   *
   * The recovery path for a failed apply. `applyAuthoredPlan` is all-or-nothing
   * by construction and stays that way: this does not apply anything, it
   * replaces one operation's staged candidate with a freshly authored one and
   * leaves the user back at the same Apply button. The transaction property is
   * untouched; what becomes incremental is the *repair*.
   *
   * `repairContext` is the failure the user just saw, handed to the session as
   * part of its task so the model is fixing a named defect rather than
   * re-rolling the dice. After AIB-001's gate that failure will usually be a
   * parameter-value diagnostic naming the node and the port — which is the
   * difference between a retry and a retry that works.
   *
   * The graph it authors against includes every OTHER staged candidate, exactly
   * as the original run did, so an operation that instantiates a sibling
   * component still sees it.
   */
  async retryOperation(operationId: string, repairContext?: string): Promise<PlanRunState> {
    const state = this.states.find((s) => s.operation.id === operationId);
    if (!state) throw new AuthoringSetupError(`No operation "${operationId}" in this plan.`);
    if (state.operation.kind === 'doc') {
      throw new AuthoringSetupError('A doc operation is re-authored by re-running the plan, not retried alone.');
    }
    if (this.phase === 'running') {
      throw new AuthoringSetupError('The plan is still running — wait for it to finish before retrying an operation.');
    }

    // A retry is a fresh attempt, not a continuation of a cancelled run.
    this.cancelled = false;
    this.phase = 'running';
    const previousFiles = this.filesById.get(operationId);
    this.filesById.delete(operationId);
    await this.authorOperation(state, this.workingGraph(operationId), repairContext);
    // A failed retry must not silently destroy what the user already had: the
    // previous candidate was rejected by the *project*, not by the gate, and it
    // is still the best thing anyone has.
    if (state.status !== 'staged' && previousFiles) {
      this.filesById.set(operationId, previousFiles);
    }
    this.activeOperationId = undefined;
    this.phase = this.cancelled ? 'cancelled' : 'done';
    this.publish();
    return this.state;
  }

  /**
   * The graph an operation authors against: the project plus every OTHER
   * operation's staged candidate. Recomputed rather than remembered, so a retry
   * sees the plan as it stands now — including candidates the user has since
   * edited in review.
   */
  private workingGraph(excludeOperationId?: string): ExplainGraph {
    let components = [...this.graph.components];
    for (const state of this.states) {
      if (state.operation.kind === 'doc' || state.operation.id === excludeOperationId) continue;
      const files = this.filesById.get(state.operation.id);
      if (!files) continue;
      const legacyName = pathToLegacyName(state.operation.target);
      components = [
        ...components.filter((c) => c.name !== legacyName),
        graphComponentFromFiles(legacyName, files)
      ];
    }
    return { components };
  }

  /**
   * Author every operation: components first, in plan order, then the docs
   * that record them. Never throws for loop-shaped failures.
   */
  async run(): Promise<PlanRunState> {
    if (this.started) throw new AuthoringSetupError('run() was already called on this plan.');
    this.started = true;
    this.phase = 'running';
    this.publish();

    for (const state of this.states) {
      if (state.operation.kind === 'doc') continue; // second pass — see below
      if (this.cancelled) {
        state.status = 'skipped';
        continue;
      }
      // The working copy later sessions see — the project plus every candidate
      // staged so far; the caller's graph stays pristine. Derived from
      // `filesById` rather than threaded through the loop so that a retry, which
      // runs outside this loop entirely, cannot see a different project.
      await this.authorOperation(state, this.workingGraph(state.operation.id));
    }

    // ── Second pass: the docs that record what the first pass built. ──────────
    // Deliberately not interleaved. `orderPlanOperations` already puts docs
    // last, but relying on that would make a doc turn's context depend on how
    // the caller happened to sort the plan; running them in their own pass
    // makes "the doc sees the finished work" true by construction.
    for (const state of this.states) {
      if (state.operation.kind !== 'doc') continue;
      if (this.cancelled) {
        state.status = 'skipped';
        continue;
      }
      await this.runDocOperation(state);
    }

    this.activeOperationId = undefined;
    this.phase = this.cancelled ? 'cancelled' : 'done';
    this.publish();
    return this.state;
  }

  /**
   * One component operation, authored through the unchanged single-component
   * loop and staged in memory. Never throws for loop-shaped failures — the
   * outcome lands on `state`.
   *
   * Shared by `run()` and `retryOperation()` so a retry is provably the same
   * authoring path as the original attempt, differing only in the repair
   * context it carries.
   */
  private async authorOperation(
    state: PlanOperationState,
    workingGraph: ExplainGraph,
    repairContext?: string
  ): Promise<void> {
    const operation = state.operation;
    const legacyName = pathToLegacyName(operation.target);
    state.status = 'authoring';
    state.error = undefined;
    this.activeOperationId = operation.id;
    this.publish();

    let session: AuthoringSession;
    try {
      const request = {
        description: repairContext
          ? `${operation.intent}\n\nA previous attempt at this was rejected when the plan was applied:\n` +
            `${repairContext}\n\nAuthor it again, fixing exactly what that names.`
          : operation.intent,
        componentPath: operation.target
      };
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
      return;
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
      // Later operations see this candidate — staged, never applied.
      this.filesById.set(operation.id, outcome.files);
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

  /** What the fan-out achieved, as the doc turn is told it. */
  private outcomeEntries(): PlanOutcomeEntry[] {
    return this.states
      .filter((s) => s.operation.kind !== 'doc')
      .map((s) => ({
        operation: s.operation,
        built: s.status === 'staged',
        nodeCount: s.staged?.nodeCount,
        note: s.status === 'staged' ? undefined : s.error ?? s.status
      }));
  }

  /** One doc operation: read the current file, author a body, stage it. */
  private async runDocOperation(state: PlanOperationState): Promise<void> {
    const operation = state.operation;
    state.status = 'authoring';
    this.activeOperationId = operation.id;
    this.publish();

    if (!this.options.docBaselineFor) {
      state.status = 'failed';
      state.error =
        'This plan run has no project-docs reader, so the current contents of ' +
        `${operation.target} are unknown — a document cannot be rewritten from a guess.`;
      this.publish();
      return;
    }

    let baseline: string | null;
    try {
      baseline = (await this.options.docBaselineFor(operation.target)) ?? null;
    } catch (error) {
      state.status = 'failed';
      state.error = `Could not read ${operation.target}: ${error instanceof Error ? error.message : String(error)}`;
      this.publish();
      return;
    }

    let outcome;
    try {
      const session = new DocSession(
        this.graph,
        {
          path: operation.target,
          intent: operation.intent,
          request: this.plan.request,
          outcome: this.outcomeEntries(),
          baseline
        },
        this.options.doc ?? {}
      );
      this.docAbort = new AbortController();
      outcome = await session.run({ abortController: this.docAbort });
      this.costUsd = this.costUsd === null || outcome.costUsd === null ? null : this.costUsd + outcome.costUsd;
    } catch (error) {
      state.status = 'failed';
      state.error = error instanceof Error ? error.message : String(error);
      this.publish();
      return;
    }

    if (outcome.status === 'authored' && outcome.content !== undefined) {
      this.docsById.set(operation.id, {
        path: operation.target,
        proposed: outcome.content,
        baseline,
        summary: outcome.summary,
        lintFindings: outcome.lintFindings
      });
      state.status = 'staged';
      state.stagedDoc = {
        chars: outcome.content.length,
        summary: outcome.summary,
        created: baseline === null,
        lintFindings: outcome.lintFindings
      };
    } else if (outcome.status === 'declined') {
      // Not a failure: "the doc already says this" is the right answer often
      // enough that treating it as one would teach users to ignore the row.
      state.status = 'skipped';
      state.error = outcome.note ?? 'The agent found nothing worth recording here.';
    } else if (outcome.status === 'cancelled') {
      state.status = 'skipped';
      this.cancelled = true;
    } else {
      state.status = 'failed';
      state.error =
        outcome.note ??
        (outcome.status === 'exhausted' ? 'The agent could not produce a usable document.' : outcome.status);
    }
    this.docAbort = undefined;
    this.publish();
  }
}
