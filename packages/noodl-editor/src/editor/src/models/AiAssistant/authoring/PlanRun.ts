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
import type { AuthoringPlan, PlanOperation, PlanOutcomeEntry, PlanProvisionSpec } from './plan';
import { graphComponentFromFiles, planExcludedWith, planOperationRequires, renderPlanContext } from './plan';
import type { PlanRunSnapshot } from './planSessionSnapshot';
import { restoreOperations } from './planSessionSnapshot';
import type { AppliedPlanOperation } from './planStaging';
import type { AgentSampleData, AuthoringMode, ComponentFiles } from './types';

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
  /**
   * AIB-009 F4 — this operation is `skipped` because the run was stopped, not
   * because anything decided it should be.
   *
   * The distinction is the whole of F4. A doc operation ends `skipped` for two
   * unrelated reasons: the agent read the finished work and found nothing worth
   * recording (a real answer, and re-running it buys another model call and the
   * same answer), or the user pressed Stop before the doc pass reached it (not
   * an answer at all). Only the second is worth offering to run again, and from
   * the outside they were indistinguishable.
   */
  skippedByCancel?: boolean;
  /**
   * AIB-007 — a provision operation's staged summary.
   *
   * "Staged" here means what it means everywhere else in this class: computed,
   * held in memory, and nothing has happened. The difference is that computing
   * it costs no model call, so a provision goes from `pending` to `staged` in
   * one synchronous step — see {@link PlanRun.stageProvisionOperation}.
   */
  stagedProvision?: { name: string; collections: string[]; needsAuth: boolean };
  /**
   * AIB-002 — when this operation's session started and finished, in wall-clock
   * milliseconds. A row can then say *how long* it has been authoring rather
   * than only that it is, which is half the answer to "wtf is it doing"; the
   * other half is `session`, below. `startedAt` survives into the finished
   * state so the row keeps showing a duration.
   */
  startedAt?: number;
  endedAt?: number;
  /**
   * AIB-002 — this operation's own published session state, kept after it
   * finishes.
   *
   * `PlanRunState.session` used to be the only copy and it held the *active*
   * session, so operation 1's feed was replaced wholesale the moment operation 2
   * started, and while it was on screen nothing said which operation the rows
   * belonged to. Holding it per operation is what lets each feed live under the
   * row it describes.
   */
  session?: AuthoringSessionState;
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
  /**
   * AIB-002 — the whole run's wall-clock bounds, for the header line. Frozen
   * when the run finishes: a later `retryOperation` has its own per-operation
   * clock and must not make the header count the minutes the user spent
   * reviewing.
   */
  startedAt?: number;
  endedAt?: number;
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
  /**
   * AIB-002 — the clock the durations are read from. Injected for the same
   * reason everything else here is: a spec that pins "operation 1 took 4
   * minutes" must not depend on how fast the machine running it happens to be.
   */
  now?: () => number;
}

type Listener = (state: PlanRunState) => void;

export class PlanRun {
  private readonly states: PlanOperationState[];
  private readonly filesById = new Map<string, ComponentFiles>();
  /**
   * AIB-004 — the sample records the authoring model supplied with each
   * candidate. `AuthoringOutcome` does not carry them (the session exposes them
   * separately), and without them a plan operation's rendered preview runs on an
   * inferred dataset where the single-component loop runs on the model's own.
   */
  private readonly sampleDataById = new Map<string, AgentSampleData>();
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
  private runStartedAt?: number;
  private runEndedAt?: number;
  private readonly now: () => number;

  constructor(
    private readonly graph: ExplainGraph,
    readonly plan: AuthoringPlan,
    private readonly options: PlanRunOptions = {}
  ) {
    this.now = options.now ?? (() => Date.now());
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
      costUsd: this.costUsd,
      startedAt: this.runStartedAt,
      endedAt: this.runEndedAt
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

  /**
   * AIB-003 slice 4 — everything this run holds that is worth more than the
   * process, as JSON.
   *
   * The live `AuthoringSession` is deliberately absent: it owns an abort
   * controller and a model conversation, neither of which means anything after a
   * restart. Its last *published state* travels (it is data, and it is the feed
   * under each row), the object does not.
   */
  snapshot(): PlanRunSnapshot {
    return {
      operations: this.states.map((s) => ({ ...s })),
      files: Object.fromEntries(this.filesById),
      sampleData: Object.fromEntries(this.sampleDataById),
      docs: Object.fromEntries(this.docsById),
      costUsd: this.costUsd,
      ...(this.runStartedAt !== undefined ? { startedAt: this.runStartedAt } : {}),
      ...(this.runEndedAt !== undefined ? { endedAt: this.runEndedAt } : {})
    };
  }

  /**
   * AIB-003 slice 4 — a run read back off disk, in the state a Stop leaves.
   *
   * See `planSessionSnapshot` for why that is the right state and not a resumed
   * one. What matters here is that this is the *only* way to build a `PlanRun`
   * that is already finished, and it goes through `restoreOperations` rather
   * than trusting the file: an operation that was mid-flight when the window
   * closed comes back `failed` (with a Retry) or `skippedByCancel` (with a doc
   * pass), never `authoring`, because there is nothing authoring it.
   *
   * `started` is set so `run()` refuses. The plan already ran; what is on offer
   * now is repair, and re-running the whole thing would re-author every
   * candidate the user just got back.
   */
  static restore(
    graph: ExplainGraph,
    plan: AuthoringPlan,
    snapshot: PlanRunSnapshot,
    options: PlanRunOptions = {}
  ): PlanRun {
    const run = new PlanRun(graph, plan, options);
    const { operations, interrupted } = restoreOperations(snapshot);

    run.states.length = 0;
    run.states.push(...operations);
    for (const [id, files] of Object.entries(snapshot.files)) run.filesById.set(id, files);
    for (const [id, sample] of Object.entries(snapshot.sampleData)) run.sampleDataById.set(id, sample);
    for (const [id, doc] of Object.entries(snapshot.docs)) run.docsById.set(id, doc);

    run.costUsd = snapshot.costUsd;
    run.runStartedAt = snapshot.startedAt;
    run.runEndedAt = snapshot.endedAt;
    run.started = true;
    // `cancelled` stays false: it is the flag the authoring loop reads to decide
    // whether to keep going, and `retryOperation` resets it anyway. Setting it
    // here would only mean a retry had to clear a state nothing was in.
    run.phase = interrupted > 0 ? 'cancelled' : 'done';
    return run;
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
   * AIB-004 — the sample records the model supplied with this operation's
   * candidate, so its rendered preview shows the data the model meant it to.
   */
  sampleDataFor(operationId: string): AgentSampleData | undefined {
    return this.sampleDataById.get(operationId);
  }

  /**
   * AIB-004 — every OTHER operation's staged candidate.
   *
   * A rendered preview of one operation needs these spliced in beside it: a page
   * that instantiates a component a sibling operation authored has nothing to
   * render without it, because the project will not hold that component until
   * the whole plan is applied. Same working-copy trick as `workingGraph`, one
   * layer down — the graph version is what the *gate* sees, this is what the
   * *runtime* sees.
   */
  stagedSiblings(operationId: string): ComponentFiles[] {
    const siblings: ComponentFiles[] = [];
    for (const state of this.states) {
      if (state.operation.id === operationId || state.operation.kind === 'doc') continue;
      const files = this.filesById.get(state.operation.id);
      if (files) siblings.push(files);
    }
    return siblings;
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
      if (s.operation.kind === 'provision') {
        // AIB-007. No `includeDocs`-style escape hatch: a provision has no
        // precondition the panel could fail to satisfy (the doc case exists
        // because an unsaved project has no folder), and one that silently
        // dropped out would leave the plan's Cloud Data nodes pointing at
        // nothing with nobody having said so.
        if (!s.operation.provision) continue;
        operations.push({ kind: 'provision', operation: s.operation, provision: s.operation.provision });
      } else if (s.operation.kind === 'doc') {
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
    if (state.operation.kind === 'provision') {
      // AIB-007. Retry means "author it again"; a provision authors nothing, so
      // there is nothing a retry could produce differently. An apply that failed
      // on the provision failed against the machine, and is repaired by fixing
      // that (a port, a disk) and applying again.
      throw new AuthoringSetupError(
        'A backend provision has nothing to re-author — fix what the failure named and apply the plan again.'
      );
    }
    if (this.phase === 'running') {
      throw new AuthoringSetupError('The plan is still running — wait for it to finish before retrying an operation.');
    }

    // A retry is a fresh attempt, not a continuation of a cancelled run.
    this.cancelled = false;
    this.phase = 'running';
    const previousFiles = this.filesById.get(operationId);
    const previousSampleData = this.sampleDataById.get(operationId);
    this.filesById.delete(operationId);
    await this.authorOperation(state, this.workingGraph(operationId), repairContext);
    // A failed retry must not silently destroy what the user already had: the
    // previous candidate was rejected by the *project*, not by the gate, and it
    // is still the best thing anyone has.
    if (state.status !== 'staged' && previousFiles) {
      this.filesById.set(operationId, previousFiles);
      // The sample data belongs to the candidate; restoring one without the
      // other would preview the old graph against nothing.
      if (previousSampleData) this.sampleDataById.set(operationId, previousSampleData);
    }
    this.activeOperationId = undefined;
    this.phase = this.cancelled ? 'cancelled' : 'done';
    this.publish();
    return this.state;
  }

  /**
   * AIB-009 F4 — run the doc pass on its own, against what is staged now.
   *
   * Stopping a run keeps the components it built, which is right, and skips the
   * documents that would have recorded them, which is also right — the doc turn's
   * whole value is seeing the finished work, and there was no finished work yet.
   * What was wrong is that the two together left the plan permanently
   * half-documented with no way back: `run()` refuses a second call, and
   * `retryOperation` refuses a doc.
   *
   * Only the operations the *cancel* skipped are re-run. A doc the agent read the
   * work and declined has already answered the question, and re-asking it costs a
   * model call to be told the same thing (see `skippedByCancel`). A doc that
   * failed keeps its error: what failed there was a precondition — no docs
   * reader, an unreadable file — and repeating the turn cannot fix it.
   */
  async runDocPass(): Promise<PlanRunState> {
    if (this.phase === 'running') {
      throw new AuthoringSetupError('The plan is still running — wait for it to finish before writing the docs.');
    }
    const pending = this.docsAwaitingCancelledPass();
    if (pending.length === 0) {
      throw new AuthoringSetupError('There is no document in this plan waiting to be written.');
    }

    // A doc pass is a fresh attempt, not a continuation of the cancelled run —
    // the same reset `retryOperation` makes, for the same reason.
    this.cancelled = false;
    this.phase = 'running';
    this.publish();
    for (const state of pending) {
      if (this.cancelled) {
        state.status = 'skipped';
        state.skippedByCancel = true;
        continue;
      }
      state.skippedByCancel = undefined;
      await this.runDocOperation(state);
    }
    this.activeOperationId = undefined;
    this.phase = this.cancelled ? 'cancelled' : 'done';
    // `runStartedAt`/`runEndedAt` are deliberately untouched: the header's
    // duration is the run's, and a doc pass started ten minutes later must not
    // make it count the minutes the user spent reading.
    this.publish();
    return this.state;
  }

  /** AIB-009 F4 — doc operations a stop left unwritten, which a doc pass would write. */
  docsAwaitingCancelledPass(): PlanOperationState[] {
    return this.states.filter((s) => s.operation.kind === 'doc' && Boolean(s.skippedByCancel));
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
    this.runStartedAt = this.now();
    this.publish();

    // ── AIB-007: the provision, first and free. ───────────────────────────────
    // Ahead of the component pass rather than inside it, because every
    // authoring turn's plan context says whether a backend is coming, and
    // `renderPlanContext` reads the *operation*, not this state — so the order
    // is about what the user sees, not about a dependency. It stages
    // synchronously: there is no model call, which also means there is no turn
    // for AIB-009 F11's "a turn that never returns" to happen in.
    for (const state of this.states) {
      if (state.operation.kind !== 'provision') continue;
      if (this.cancelled) {
        state.status = 'skipped';
        continue;
      }
      this.stageProvisionOperation(state);
    }

    for (const state of this.states) {
      if (state.operation.kind === 'doc' || state.operation.kind === 'provision') continue; // passes above and below
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
        // AIB-009 F4: stopped, not declined. `runDocPass` reads this.
        state.skippedByCancel = true;
        continue;
      }
      await this.runDocOperation(state);
    }

    this.activeOperationId = undefined;
    this.phase = this.cancelled ? 'cancelled' : 'done';
    this.runEndedAt = this.now();
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
    state.startedAt = this.now();
    state.endedAt = undefined;
    state.session = undefined;
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
      state.endedAt = this.now();
      this.publish();
      return;
    }

    this.activeSession = session;
    const unsubscribe = session.onChange((sessionState) => {
      // Both: `session` is the live feed the header watches, `state.session` is
      // the copy that stays under this row after the next operation starts.
      this.activeSessionState = sessionState;
      state.session = sessionState;
      this.publish();
    });
    this.activeSessionState = session.state;
    state.session = session.state;
    this.publish();

    const outcome = await session.run();
    unsubscribe();
    state.endedAt = this.now();
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
      // AIB-004: the model's own sample records, read off the session because
      // the outcome does not carry them. A retry that produces no sample data
      // must not leave the previous attempt's behind.
      const sampleData = session.stagedSampleData;
      if (sampleData) this.sampleDataById.set(operation.id, sampleData);
      else this.sampleDataById.delete(operation.id);
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

  /**
   * AIB-007 — a provision operation, staged.
   *
   * Synchronous and infallible on purpose. Everything that can go wrong with a
   * provision goes wrong at *apply*, against a real machine: a port in use, a
   * native SQLite engine that will not load, a collection the schema manager
   * refuses. None of that is knowable from here, and pretending otherwise would
   * mean either a spurious failure or a check that has to be run twice. What
   * this stage is for is the same thing every other staged operation is for —
   * something reviewable that has changed nothing.
   */
  private stageProvisionOperation(state: PlanOperationState): void {
    const spec = state.operation.provision;
    state.startedAt = this.now();
    if (!spec) {
      // `validatePlan` rejects this at plan time, so reaching it means a plan
      // was built by hand. Failing loudly beats provisioning a default.
      state.status = 'failed';
      state.error = 'This operation provisions a backend but says nothing about what it would create.';
      state.endedAt = this.now();
      this.publish();
      return;
    }
    state.status = 'staged';
    state.stagedProvision = {
      name: spec.name,
      collections: spec.collections.map((c) => c.name),
      needsAuth: spec.needsAuth
    };
    state.endedAt = this.now();
    this.publish();
  }

  /** AIB-007 — the backend this plan would create, if any operation would. */
  provisionSpec(): PlanProvisionSpec | undefined {
    return this.states.find((s) => s.operation.kind === 'provision' && s.status === 'staged')?.operation.provision;
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
    state.startedAt = this.now();
    state.endedAt = undefined;
    this.activeOperationId = operation.id;
    this.publish();

    if (!this.options.docBaselineFor) {
      state.status = 'failed';
      state.error =
        'This plan run has no project-docs reader, so the current contents of ' +
        `${operation.target} are unknown — a document cannot be rewritten from a guess.`;
      state.endedAt = this.now();
      this.publish();
      return;
    }

    let baseline: string | null;
    try {
      baseline = (await this.options.docBaselineFor(operation.target)) ?? null;
    } catch (error) {
      state.status = 'failed';
      state.error = `Could not read ${operation.target}: ${error instanceof Error ? error.message : String(error)}`;
      state.endedAt = this.now();
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
      state.endedAt = this.now();
      this.publish();
      return;
    }
    state.endedAt = this.now();

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
      state.skippedByCancel = true;
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
