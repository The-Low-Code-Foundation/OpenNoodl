/**
 * AIX-002 — The Authoring Loop: session
 *
 * One session is one attempt to author one component: context → author →
 * validate → repair → present, with bounded turns and bounded submissions.
 * After `run()`, `refine()` continues the same conversation with the user's
 * feedback — each refinement is a fresh round with its own turn and submission
 * budget, and the agent resubmits the FULL component, never a delta.
 *
 * Like ExplainSession, a session holds plain data (`ExplainGraph`), never an
 * editor model — and unlike ExplainSession it produces something: staged
 * `ComponentFiles` in the outcome. It still writes nothing. `stagedFiles`
 * always holds the latest candidate that passed validation, so an exhausted
 * refinement round never loses the last good one. Applying to the live
 * project is `staging.ts`'s job, and only on accept.
 *
 * The panel renders whatever the session publishes: an activity feed
 * (assistant text streamed as it arrives, tool reads and submissions as
 * one-line events) plus a phase. The panel owns none of the conversation.
 *
 * The chat function is injected: the editor binds `AiClient.chatStream`, specs
 * bind a script, and the measurement harness binds a directly-constructed
 * provider. A scripted chat that ignores the callbacks argument still works —
 * streaming is a progressive rendering of the same response.
 *
 * @module AiAssistant/authoring/AuthoringSession
 */

import type { ConnectionV2 } from '../../../schemas';
// Pure ProjectDocs submodules only — the barrel would drag ProjectModel and the
// platform filesystem into the headless measurement bundle.
import { currentImportReport } from '../../../utils/import-engine/legacy/currentReport';
import type { ImportReport } from '../../../utils/import-engine/legacy/types';
import type { ProjectBackendFacts } from '../../../validation';
import type { SchemaCollectionInfo } from './backendSchema';
import { formatDiagnosticLine } from '../../../validation';
import { currentProjectDocs } from '../../ProjectDocs/currentDocs';
import type { ProjectDocsContent } from '../../ProjectDocs/docsText';
import type { StyleVocabulary } from '../../StyleTokensModel/StyleVocabulary';
import type { StyleTokenRecord } from '../../StyleTokensModel/TokenCategories';
import { AiClient } from '../client';
import { asText } from '../client/content';
import type { AiContentBlock } from '../client/content';
import { openingTurnWithMedia } from '../thread/references';
import type { AiRoleRequestFields } from '../client/roles';
import { TURN_STALL_MS, withTurnDeadline } from '../client/turnDeadline';
import type {
  AiChatRequest,
  AiChatResponse,
  AiEffort,
  AiMessage,
  AiRole,
  AiStreamCallbacks,
  AiToolCall,
  AiToolDefinition
} from '../client/types';
import { findComponent } from '../explain/graph';
import type { ExplainGraph } from '../explain/types';
import { buildCandidate, pathToLegacyName } from './candidate';
import { AuthoringContextBuilder } from './ContextBuilder';
import { PartialPayloadScanner } from './partial';
import { dispatchProjectDocTool, GET_PROJECT_DOC, projectDocToolLabel, projectDocTools } from './projectDocsTool';
import {
  initialUserMessage,
  nudgeMessage,
  refineMessage,
  styleAdvisoryMessage,
  systemPrompt,
  updateUserMessage,
  type OpeningTurn,
  type PromptProjectDocs
} from './prompts/authoring';
import { styleLintCandidate } from './styleLint';
import {
  AUTHORING_TOOLS,
  dispatchReadTool,
  GET_COMPONENT,
  GET_NODE_TYPES,
  SUBMIT_COMPONENT,
  toSubmitPayload
} from './tools';
import type {
  AgentSampleData,
  AuthoringMetrics,
  AuthoringMode,
  AuthoringOutcome,
  AuthoringRequest,
  AuthoringStatus,
  ComponentFiles,
  ContextBudget,
  RegisteredLibraryInfo,
  SubmitPayload,
  SubmitRound,
  SubmittedNode,
  TurnUsage
} from './types';
import { validateCandidateComponent } from './validate';

export type AuthoringChatFn = (request: AiChatRequest, callbacks?: AiStreamCallbacks) => Promise<AiChatResponse>;

export interface AuthoringSessionOptions {
  /** Injection seam; defaults to the configured AiClient, streaming. */
  chat?: AuthoringChatFn;
  budget?: Partial<ContextBudget>;
  /** Model round-trips per round (initial run or one refinement) before giving up. */
  maxTurns?: number;
  /** Submission attempts per round before giving up. */
  maxSubmits?: number;
  /**
   * AIX-006: the project's style vocabulary (tokens + variants) to hand the
   * agent and to lint candidates against. Omit for the shipped defaults — the
   * token NAMES the agent emits are stable across projects.
   */
  styleVocabulary?: StyleVocabulary;
  /** Pre-resolved token records (defaults + project overrides) for lint matching. */
  styleTokenRecords?: StyleTokenRecord[];
  /**
   * When false, the style vocabulary is neither injected nor linted — the
   * pre-AIX-006 behaviour. Used by the A/B measurement's control arm. Default true.
   */
  styleGuidance?: boolean;
  /**
   * AIX-007: reasoning depth for this session's requests. Defaults to
   * `AUTHORING_EFFORT`; the measurement harness overrides it to sweep.
   */
  effort?: AiEffort;
  /**
   * LAS-009: which per-role model selection this session runs under. Defaults
   * to the `act` role — authoring *is* acting. Pass `'global'` to opt out and
   * follow the main model, which is what the measurement harness wants when it
   * is sweeping one variable at a time.
   */
  role?: AiRole | 'global';
  /**
   * AIX-009: the project's `docs/` bodies. Defaults to whatever the editor's
   * installed docs provider holds for the open project, so the panel needs no
   * wiring; pass `{}` explicitly to author as if the project had no docs (the
   * A/B control arm, and every headless spec that does not care).
   */
  projectDocs?: ProjectDocsContent;
  /**
   * ERG-002 §2: libraries registered via the Libraries settings section
   * (Settings → Libraries → `registerLibrary`), handed to the agent so "use
   * PocketBase for this" resolves to a global it can actually reference.
   * Unlike `projectDocs`, there is no live default here — reading
   * `noodl_modules` is async (`listRegisteredLibraries`) and this
   * constructor is not, so a caller with an open project passes its own
   * snapshot. Omit for the pre-ERG-002 behaviour (no library block at all).
   */
  libraries?: RegisteredLibraryInfo[];
  /**
   * AIX-011: when this session is one operation of a project-scope plan, the
   * rendered plan (sibling kinds/targets/*intents*, never graphs — see
   * `renderPlanContext`). Charged through the context builder and appended to
   * the opening turn's variable half, after the cache-stable prefix. Absent
   * for standalone sessions, whose behaviour is unchanged byte for byte.
   */
  planContext?: string;
  /**
   * BLD-011: the composer's attachments, rendered by `renderReferenceBlock`.
   *
   * Rides the same route as `planContext` and lands in the same half of the
   * opening turn, which is what keeps Rule 6 true by construction rather than
   * by review: an attachment can never reach the cache-stable prefix, because
   * the only function that places it puts it after every stable byte. Absent
   * for a turn that carried none, whose bytes are unchanged.
   */
  references?: string;
  /**
   * BLD-013/014: the attachments that must stay blocks — a dropped PDF, a
   * pasted mock, a capture of the running app.
   *
   * 🔴 Placed by {@link openingTurnWithMedia}, **after** the cache-stable half,
   * never before it. Read that function before changing anything here: media
   * ahead of the breakpoint re-bills the whole AIX-007 prefix on every send and
   * says nothing on screen about having done so.
   */
  referenceMedia?: AiContentBlock[];
  /**
   * AAQ-001: component names the plan in flight is going to create, which do
   * not exist yet.
   *
   * The navigation check needs them or it reports the plan's own cross-page
   * links as broken: a page authored before its sibling exists links to a
   * component the working graph has never seen, and the agent — told to take a
   * diagnostic literally — would "fix" a correct link. Absent for standalone
   * sessions, where the only components that resolve are the ones that exist.
   */
  plannedComponents?: readonly string[];
  /**
   * LIB-006: the open project's import report, so a session authoring against a
   * legacy import knows what the importer could not convert. Defaults to
   * whatever the installed provider holds (same seam as `projectDocs`), so the
   * panel needs no wiring; pass `null` to author as if the project had never
   * been imported — the control arm, and every headless spec that does not care.
   */
  importReport?: ImportReport | null;
  /**
   * AIB-007: what the project can offer a Cloud Data or User node, and whether
   * a plan operation is about to provision one.
   *
   * ⚠️ **Omitted means "do not check"**, not "there is no backend" — see
   * `ValidateCandidateOptions.backend`. There is deliberately no live default
   * here, unlike `projectDocs`: the true answer depends on whether the *plan*
   * provisions a backend, which a session has no way to know and the panel does.
   */
  backend?: ProjectBackendFacts;
  /**
   * AAQ-002 slice 4 — the collections the agent may write against, already
   * merged from the plan's provision and the project's cached schema.
   *
   * Passed rather than read, for the same reason `backend` is: the true list
   * needs the *plan*, because a wizard-built project has no backend at authoring
   * time — the provision applies at Apply, after every authoring turn. A session
   * has no way to know that and the panel does.
   */
  collections?: SchemaCollectionInfo[];
  /**
   * AIB-009 F11: how long one turn may deliver *nothing* before it is ended.
   * Defaults to {@link TURN_STALL_MS}; `0` disables the deadline. Specs that
   * script an unresponsive provider set it to a few milliseconds.
   */
  stallMs?: number;
  /**
   * BLD-004: the clock the activity stamps and the heartbeat are read from.
   * Injected for the same reason `PlanRun` injects one — a spec that pins "this
   * run took 14s" must not depend on how fast the machine running it is.
   */
  now?: () => number;
}

/**
 * BLD-004 — the fastest the heartbeat pushes a render, in milliseconds.
 *
 * Half a second, against a pulse keyed on two: the published timestamp can be at
 * most this stale, which is well inside the window the UI compares it against,
 * and a streaming turn re-renders twice a second instead of once per token.
 */
const HEARTBEAT_PUBLISH_MS = 500;

const DEFAULT_MAX_TURNS = 12;
const DEFAULT_MAX_SUBMITS = 4;

/**
 * AIX-007 — the authoring loop's reasoning depth, chosen by measurement rather
 * than inherited.
 *
 * Anthropic's default is `high`; the sweep over the 8-prompt corpus is in
 * AIX-007-NOTES.md. `low` was not merely the cheapest level that held validity
 * — it was the only level that reached 8/8, at a fifth of `high`'s cost and a
 * sixth of its latency. Above it the model spends its budget deliberating
 * rather than acting: at `high` the hardest prompt burned 32k reasoning tokens
 * across seven turns and never submitted anything at all.
 *
 * This is not "cheap mode". The validation gate is what makes a first attempt
 * good, and it is unchanged; effort only decides how long the model thinks
 * before reaching for it. Re-run `--effort=` sweeps before changing this.
 */
export const AUTHORING_EFFORT: AiEffort = 'low';

/** Thrown at creation for requests that could never succeed. */
export class AuthoringSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthoringSetupError';
  }
}

/** Thrown when run/refine are called out of order — a caller bug, not a loop outcome. */
export class AuthoringStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthoringStateError';
  }
}

// ── Published state ───────────────────────────────────────────────────────────

/**
 * When an entry was recorded, as `Date.now()` on the session's clock.
 *
 * BLD-004 / BLD-002 C8. Optional, and that is the whole design: an activity a
 * producer did not stamp yields **no duration** rather than a fabricated one,
 * so the failure mode of forgetting to stamp is a summary that says less, never
 * one that says something untrue. `turns.ts` synthesises activities for the
 * plan run and the docs pass out of state that has no per-entry clock, and
 * inventing timestamps there to satisfy a required field is precisely the lie
 * this exists to avoid.
 */
interface Stamped {
  at?: number;
}

/** One entry in the feed the panel renders. */
export type AuthoringActivity =
  /** The user's request or refinement instruction, verbatim. */
  | ({ kind: 'user'; text: string } & Stamped)
  /** Assistant prose; `text` grows while `streaming` is set. */
  | ({ kind: 'assistant'; text: string; streaming?: boolean } & Stamped)
  /**
   * BLD-004 — the model's own reasoning, on its own channel.
   *
   * ⚠️ **Never merged into `assistant`.** The authoring loop parses the
   * assistant text with XML templates, so reasoning reaching that string
   * corrupts authoring output rather than just a panel — see the adapter note
   * in `providers/anthropic.ts`. A separate kind is what makes the two paths
   * impossible to confuse at the type level as well as at the call site.
   */
  | ({
      kind: 'reasoning';
      text: string;
      streaming?: boolean;
      /**
       * When the most recent reasoning delta landed.
       *
       * ⚠️ **Found by driving, not by reasoning about it.** With only `at`, the
       * strip counted from the first delta to *now* for as long as the turn was
       * open — so a provider that thought for one second and then hung showed
       * "Thinking… 3m 2s", a clock outliving the thing it measures, which is the
       * exact failure this task exists to remove reappearing inside the fix for
       * it. `streaming` cannot stand in: a hung turn is neither finished nor
       * cancelled, so nothing clears it until the deadline fires three minutes
       * later.
       */
      lastAt?: number;
    } & Stamped)
  /** A context read, as a one-line event. */
  | ({ kind: 'tool'; label: string } & Stamped)
  /** A submission and the gate's verdict. */
  | ({ kind: 'submit'; ok: boolean; errorLines: string[] } & Stamped)
  /**
   * BLD-002 reserves the shape; **BLD-008 is what produces one.** Nothing pushes
   * a `question` yet, and that is deliberate — the treatment (the loudest thing
   * in the thread) and the collapse rule (a question can never be absorbed into
   * a run) are decided here so that BLD-008 adds an author, not a fifth opinion
   * about how a question should look.
   */
  | ({ kind: 'question'; text: string } & Stamped);

export type AuthoringPhase = 'idle' | 'working' | 'staged' | 'exhausted' | 'error' | 'cancelled';

export interface StagedSummary {
  nodeCount: number;
  connectionCount: number;
}

/**
 * The forming graph, published while `submit_component` is streaming (or all
 * at once when the provider hands arguments over whole). Elements are the
 * agent's own — unvalidated, ids as submitted — and the preview canvas is the
 * only consumer. `submission` increments per attempt, so a repair round reads
 * as a rebuild rather than as edits to the failed one.
 */
export interface BuildingPreview {
  submission: number;
  nodes: SubmittedNode[];
  connections: ConnectionV2[];
  /** True once the submission's arguments have finished streaming. */
  complete: boolean;
}

/** Everything the panel renders, recomputed and published on every change. */
export interface AuthoringSessionState {
  busy: boolean;
  phase: AuthoringPhase;
  activities: AuthoringActivity[];
  legacyName: string;
  /** Whether this session creates a component or revises an existing one. */
  mode: AuthoringMode;
  /** The live picture of the submission being written, for the preview canvas. */
  building?: BuildingPreview;
  /** Present whenever some candidate has passed validation — it survives a failed refinement. */
  staged?: StagedSummary;
  /**
   * AIX-008: increments every time a *different* candidate is staged. The
   * sandbox preview rebuilds its export on this rather than on object identity,
   * so a refinement re-renders and a re-render does not.
   */
  stagedRevision: number;
  /**
   * BLD-004 — when the last event arrived from the provider's stream, including
   * the pings and keepalives that carry nothing a user would see.
   *
   * This is the *only* signal that separates a model thinking hard from a
   * provider that has stopped answering, and `busy` is not it: `busy` stays true
   * for the whole stall window. Undefined while a turn is open means nothing has
   * been heard yet, which is a real answer and not a missing one — see
   * `thread/liveness.ts`, which is the only thing allowed to interpret it.
   */
  lastActivityAt?: number;
  /**
   * The silence window this session's turns are bounded by, republished so the
   * panel can say how long is left before one ends itself. Undefined when the
   * caller disabled the deadline.
   */
  stallMs?: number;
  error?: string;
}

type Listener = (state: AuthoringSessionState) => void;

function readToolLabel(call: AiToolCall): string {
  if (call.name === GET_PROJECT_DOC) {
    // BLD-007: the label names the doc that was actually asked for — with more
    // than one fetchable doc, "Read project doc docs/ARCHITECTURE.md" on every
    // row would be a feed that lies.
    return projectDocToolLabel(call);
  }
  if (call.name === GET_NODE_TYPES) {
    const names = Array.isArray(call.arguments.typeNames) ? call.arguments.typeNames.map(String) : [];
    return names.length > 0 ? `Read node documentation: ${names.join(', ')}` : 'Read node documentation';
  }
  if (call.name === GET_COMPONENT) {
    return typeof call.arguments.name === 'string' ? `Read component ${call.arguments.name}` : 'Read a component';
  }
  return `Called ${call.name}`;
}

interface SubmitResult {
  ok: boolean;
  text: string;
  files?: ComponentFiles;
  /** AIX-008: sample records for the preview sandbox, when the model supplied any. */
  sampleData?: AgentSampleData;
  errorLines: string[];
  /** AIX-006: style-lint findings on an otherwise-valid candidate (empty when clean). */
  styleFindings: string[];
}

export class AuthoringSession {
  private readonly chat: AuthoringChatFn;
  private readonly maxTurns: number;
  private readonly maxSubmits: number;
  private readonly effort: AiEffort;
  /** LAS-009: the resolved role's request fields, decided once at session start. */
  private readonly roleFields: AiRoleRequestFields;
  /** AIX-011: rendered sibling-intent block when part of a plan, else undefined. */
  private readonly planContext?: string;
  /** BLD-011 — the attachment block, or undefined for a turn that carried none. */
  private readonly references?: string;
  /** BLD-013/014 — see `AuthoringSessionOptions.referenceMedia`. */
  private readonly referenceMedia?: AiContentBlock[];
  /** AAQ-001: components the plan will create, so a link to one is not "unresolved". */
  private readonly plannedComponents?: readonly string[];
  /** AIB-007: what the project can offer a Cloud Data or User node. Undefined ⇒ do not check. */
  private readonly backend?: ProjectBackendFacts;
  readonly context: AuthoringContextBuilder;
  readonly legacyName: string;
  /** AIX-009: `get_project_doc`, present only when the project has an ARCHITECTURE.md. */
  private readonly docTools: AiToolDefinition[];

  // Conversation state, cumulative across run() and every refine().
  private readonly messages: AiMessage[] = [];
  private readonly rounds: SubmitRound[] = [];
  private turns = 0;
  private promptTokens = 0;
  private completionTokens = 0;
  private cacheReadTokens = 0;
  private cacheWriteTokens = 0;
  private readonly usageByTurn: TurnUsage[] = [];
  private costUsd: number | null = 0;
  private started = false;
  private inFlight = false;
  private staged?: ComponentFiles;
  /** AIX-008: sample records the model supplied with the staged candidate. */
  private stagedSample?: AgentSampleData;
  private stagedRevision = 0;
  private building?: BuildingPreview;
  private submissionCounter = 0;

  // AIX-006 style lint.
  private readonly styleGuidance: boolean;
  private readonly styleTokenRecords?: StyleTokenRecord[];
  /** The one-shot style-improvement pass has been offered (per session). */
  private styleNudged = false;

  // Published state.
  private readonly activities: AuthoringActivity[] = [];
  private readonly listeners = new Set<Listener>();
  private lastStatus?: AuthoringStatus;
  private lastError?: string;
  private currentAbort?: AbortController;

  // BLD-004 — the heartbeat.
  private readonly now: () => number;
  /** The silence window, republished on state so the panel can name the deadline. */
  private readonly stallMs?: number;
  private lastActivityAt?: number;
  /**
   * When the heartbeat last pushed a render.
   *
   * ⚠️ `onActivity` fires **per stream event**, which on a streaming provider is
   * per token — publishing on each would re-render the whole thread hundreds of
   * times a turn to move one number the UI only reads once a second anyway. The
   * timestamp itself is always current; only the notification is throttled, so
   * the worst a reader sees is a value {@link HEARTBEAT_PUBLISH_MS} stale, which
   * is an order of magnitude inside the two seconds the pulse is keyed on.
   */
  private lastHeartbeatPublish = 0;

  private constructor(
    private readonly graph: ExplainGraph,
    private readonly request: AuthoringRequest,
    options: AuthoringSessionOptions,
    readonly mode: AuthoringMode = 'create',
    private readonly baseFiles?: ComponentFiles
  ) {
    // AIB-009 F11: the deadline wraps whatever chat this session was given —
    // the live client, a spec's script, the measurement harness's provider — so
    // there is no path into the loop that can hang forever.
    this.chat = withTurnDeadline(options.chat ?? ((req, callbacks) => AiClient.chatStream(req, callbacks ?? {})), {
      stallMs: options.stallMs
    });
    this.now = options.now ?? (() => Date.now());
    // `TURN_STALL_MS` is the wrapper's own default, and the panel needs the same
    // number to say when a silent turn ends. Resolved here rather than left
    // undefined so the sentence cannot disagree with the deadline that produces
    // it — BLD-007's one-fact-two-sources trap, at a smaller size.
    this.stallMs = options.stallMs ?? TURN_STALL_MS;
    this.maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    this.maxSubmits = options.maxSubmits ?? DEFAULT_MAX_SUBMITS;
    this.effort = options.effort ?? AUTHORING_EFFORT;
    // LAS-009: resolved once, here, and carried for the life of the session.
    this.roleFields = AiClient.roleRequestFields(options.role ?? 'act');
    this.planContext = options.planContext;
    this.references = options.references;
    this.referenceMedia = options.referenceMedia?.length ? options.referenceMedia : undefined;
    this.plannedComponents = options.plannedComponents;
    this.backend = options.backend;
    this.styleGuidance = options.styleGuidance ?? true;
    this.styleTokenRecords = options.styleTokenRecords;
    const projectDocs = options.projectDocs ?? currentProjectDocs();
    // `null` means "deliberately without"; `undefined` means "use the project's".
    const importReport = options.importReport === null ? undefined : options.importReport ?? currentImportReport();
    this.context = new AuthoringContextBuilder(
      graph,
      options.budget,
      undefined,
      options.styleVocabulary,
      projectDocs,
      options.libraries,
      importReport,
      options.collections
    );
    // BLD-007: one docs snapshot, taken once and held for the session — the
    // context keeps it as `context.docs`, which is what `dispatchProjectDocTool`
    // resolves against. The tool list below is part of the cached prefix, so the
    // set the dispatcher answers from must be the set this definition
    // advertised; sharing the one snapshot is what makes that true by
    // construction rather than by two call sites agreeing. A doc added
    // mid-session is picked up by the next one, deliberately.
    this.docTools = projectDocTools(projectDocs);
    this.legacyName = pathToLegacyName(request.componentPath);
  }

  private static checkRequest(request: AuthoringRequest): void {
    if (!request.description.trim()) {
      throw new AuthoringSetupError('The request has no description — nothing to build.');
    }
    if (!request.componentPath.trim()) {
      throw new AuthoringSetupError('The request has no component path — nowhere to build it.');
    }
  }

  static create(
    graph: ExplainGraph,
    request: AuthoringRequest,
    options: AuthoringSessionOptions = {}
  ): AuthoringSession {
    AuthoringSession.checkRequest(request);
    if (findComponent(graph, request.componentPath)) {
      throw new AuthoringSetupError(
        `Component "${request.componentPath}" already exists. Start an update session to revise it.`
      );
    }
    return new AuthoringSession(graph, request, options);
  }

  /**
   * A session that revises an existing component. `baseFiles` is the component
   * as it exists today (the exporter's v2 serialization) — the source the agent
   * starts from, the identity the candidate keeps, and the base whose
   * inexpressible node fields are carried over. Same loop, same gate, same
   * whole-candidate contract; only the opening turn and the accept path differ.
   */
  static createUpdate(
    graph: ExplainGraph,
    request: AuthoringRequest,
    baseFiles: ComponentFiles,
    options: AuthoringSessionOptions = {}
  ): AuthoringSession {
    AuthoringSession.checkRequest(request);
    if (!findComponent(graph, request.componentPath)) {
      throw new AuthoringSetupError(
        `Component "${request.componentPath}" does not exist — there is nothing to update.`
      );
    }
    return new AuthoringSession(graph, request, options, 'update', baseFiles);
  }

  /** The latest candidate that passed validation, across all rounds. */
  get stagedFiles(): ComponentFiles | undefined {
    return this.staged;
  }

  /** AIX-008: the sample records that came with the staged candidate, if any. */
  get stagedSampleData(): AgentSampleData | undefined {
    return this.stagedSample;
  }

  /**
   * Update mode: the component as it stood when this session opened. Exposed so
   * the accept path can re-validate against the SAME baseline the loop used —
   * a candidate accepted while carrying a pre-existing error would otherwise be
   * refused at apply time by a gate that forgot where the error came from.
   */
  get baseComponentFiles(): ComponentFiles | undefined {
    return this.baseFiles;
  }

  get state(): AuthoringSessionState {
    const phase: AuthoringPhase = this.inFlight
      ? 'working'
      : this.lastStatus === 'authored'
      ? 'staged'
      : this.lastStatus ?? 'idle';
    return {
      busy: this.inFlight,
      phase,
      activities: [...this.activities],
      legacyName: this.legacyName,
      mode: this.mode,
      building: this.building
        ? {
            ...this.building,
            nodes: [...this.building.nodes],
            connections: [...this.building.connections]
          }
        : undefined,
      staged: this.staged
        ? {
            nodeCount: this.staged.nodes.nodes.length,
            connectionCount: this.staged.connections.connections.length
          }
        : undefined,
      stagedRevision: this.stagedRevision,
      lastActivityAt: this.lastActivityAt,
      stallMs: this.stallMs,
      error: this.lastError
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

  /**
   * BLD-004 — append an activity, stamped.
   *
   * Every `activities.push` in this class goes through here, which is the only
   * reason the stamps are reliable: `at` is optional on the type (a producer
   * without a clock must be able to omit it), so a push that bypassed this would
   * compile, render, and silently cost the run its duration. One door.
   */
  private record<T extends AuthoringActivity>(activity: T): T {
    activity.at = this.now();
    this.activities.push(activity);
    return activity;
  }

  /**
   * BLD-004 — the provider's stream said something. See `lastHeartbeatPublish`
   * for why this does not publish every time.
   */
  private touchActivity(): void {
    const at = this.now();
    this.lastActivityAt = at;
    if (at - this.lastHeartbeatPublish < HEARTBEAT_PUBLISH_MS) return;
    this.lastHeartbeatPublish = at;
    this.publish();
  }

  /**
   * AIX-009: the two default-injected docs, charged through the context builder
   * so their cost lands in the same log as every other handout. Called once, at
   * the opening turn — these blocks live in the cache-stable half of the prompt
   * and must not vary within a session.
   */
  private promptDocs(): PromptProjectDocs | undefined {
    const conventions = this.context.projectConventions();
    const brief = this.context.projectBrief();
    // BLD-007: docs the user declared `inject: always` on. A project that
    // declared none gets an empty list and the pre-BLD-007 bytes.
    const always = this.context.projectAlwaysDocs();
    if (!conventions && !brief && always.length === 0) return undefined;
    return {
      ...(conventions ? { conventions } : {}),
      ...(brief ? { brief } : {}),
      ...(always.length > 0 ? { always } : {})
    };
  }

  /** Abort the in-flight round. A previously staged candidate survives. */
  cancel(): void {
    this.currentAbort?.abort();
  }

  dispose(): void {
    this.cancel();
    this.listeners.clear();
  }

  /** Run the loop to an outcome. Never throws for loop-shaped failures. */
  async run(options: { abortController?: AbortController } = {}): Promise<AuthoringOutcome> {
    if (this.started) {
      throw new AuthoringStateError('run() was already called — continue with refine() instead.');
    }
    this.started = true;
    // AIX-011: charge the plan block (sibling intents) through the context
    // builder so a plan's per-operation overhead is logged like any handout.
    const planBlock = this.planContext ? this.context.planContext(this.planContext) : undefined;
    let opening: OpeningTurn;
    if (this.mode === 'update' && this.baseFiles) {
      const source = this.context.currentComponentSource(this.baseFiles);
      if (this.context.log.some((entry) => entry.source === 'current-component' && entry.refused)) {
        // An update that cannot show the agent its own subject cannot work —
        // fail loudly instead of opening with a refusal where the source goes.
        const outcome = this.finish(
          'error',
          undefined,
          'This component is too large to revise within the context budget.'
        );
        this.publish();
        return outcome;
      }
      opening = updateUserMessage(
        this.request,
        source,
        this.context.projectOverview(),
        this.context.catalogOverview(),
        this.styleGuidance ? this.context.styleVocabulary() : undefined,
        this.promptDocs(),
        planBlock,
        this.context.libraryOverview(),
        this.context.importReport(),
        this.context.backendSchema(),
        this.references
      );
    } else {
      opening = initialUserMessage(
        this.request,
        this.context.projectOverview(),
        this.context.catalogOverview(),
        this.styleGuidance ? this.context.styleVocabulary() : undefined,
        this.promptDocs(),
        planBlock,
        this.context.libraryOverview(),
        this.context.importReport(),
        this.context.backendSchema(),
        this.references
      );
    }
    this.messages.push(
      { role: 'system', content: systemPrompt(this.mode) },
      // The boundary rides along so a caching provider can put a breakpoint at
      // the end of the reference blocks. Nothing else reads it.
      //
      // BLD-013/014 — a turn carrying media cannot use a character offset at
      // all (`assertCacheBoundary` throws on the pairing, deliberately), so it
      // expresses the same boundary as a marked block. A turn with no media is
      // byte-identical to before either task existed.
      this.referenceMedia
        ? { role: 'user' as const, content: openingTurnWithMedia(opening.content, opening.cacheBoundary, this.referenceMedia) }
        : { role: 'user' as const, content: opening.content, cacheBoundary: opening.cacheBoundary }
    );
    this.record({ kind: 'user', text: this.request.description });
    return this.round(options);
  }

  /**
   * Continue the conversation with the user's feedback on the staged component.
   * A fresh round: full turn and submission budget, full resubmission required.
   */
  async refine(instruction: string, options: { abortController?: AbortController } = {}): Promise<AuthoringOutcome> {
    if (!this.started) {
      throw new AuthoringStateError('refine() before run() — there is nothing to refine yet.');
    }
    if (!instruction.trim()) {
      throw new AuthoringStateError('The refinement has no instruction — nothing to change.');
    }
    this.messages.push({ role: 'user', content: refineMessage(instruction) });
    this.record({ kind: 'user', text: instruction });
    return this.round(options);
  }

  /** One bounded round of the loop: author → validate → repair until an outcome. */
  private async round(options: { abortController?: AbortController }): Promise<AuthoringOutcome> {
    if (this.inFlight) {
      throw new AuthoringStateError('A round is already in flight — await it before starting another.');
    }
    this.inFlight = true;
    const abortController = options.abortController ?? new AbortController();
    this.currentAbort = abortController;
    this.publish();
    try {
      return await this.loop(abortController);
    } finally {
      this.inFlight = false;
      this.currentAbort = undefined;
      this.publish();
    }
  }

  private async loop(abortController: AbortController): Promise<AuthoringOutcome> {
    let roundTurns = 0;
    let roundSubmits = 0;
    let nudges = 0;
    // AIX-006: a candidate we accepted but held back to offer one style pass. If
    // the style revision then fails or exhausts the budget, we still finish
    // 'authored' on THIS baseline — a style suggestion must never turn a valid
    // authoring into a failure.
    let stylePassBaseline: ComponentFiles | undefined;

    while (roundTurns < this.maxTurns) {
      roundTurns++;
      this.turns++;

      // The assistant's prose for this turn, streamed into the feed as it arrives.
      const prose: AuthoringActivity = { kind: 'assistant', text: '', streaming: true };
      this.record(prose);
      this.publish();

      // Submissions streaming this turn, scanned for complete nodes as the
      // arguments arrive so the preview canvas can render the forming graph.
      const scanners = new Map<number, PartialPayloadScanner>();

      /**
       * BLD-004 — this turn's reasoning, created on the first delta and not
       * before.
       *
       * Lazy, unlike `prose`, because most turns have none: only some models
       * think, and a `reasoning` entry pushed eagerly would put an empty strip
       * above every turn of every Ollama run. It is spliced in *ahead* of the
       * prose, because that is the order the two actually happened in —
       * reasoning precedes the answer it produced, and appending it would show
       * the thinking below the sentence it led to.
       */
      let reasoning: AuthoringActivity | undefined;

      let response: AiChatResponse;
      try {
        response = await this.chat(
          {
            messages: [...this.messages],
            // AIX-009 appends `get_project_doc` only when the project has an
            // ARCHITECTURE.md, so a project without docs sends the exact tool
            // list it sent before — and the tool block, which Anthropic renders
            // ahead of the system prompt, stays inside the cached prefix.
            tools: this.docTools.length > 0 ? [...AUTHORING_TOOLS, ...this.docTools] : AUTHORING_TOOLS,
            toolChoice: 'auto',
            effort: this.effort,
            ...this.roleFields,
            abortController
          },
          {
            onText: (fullText) => {
              prose.text = fullText;
              this.publish();
            },
            // BLD-004. The heartbeat: fires for every event on the wire,
            // including the pings that carry nothing. Throttled inside.
            onActivity: () => this.touchActivity(),
            onReasoning: (fullReasoning) => {
              if (!reasoning) reasoning = this.insertReasoningBefore(prose);
              // ⚠️ `reasoning.text`, and the narrowing is what keeps it honest:
              // assigning to `prose.text` here compiles and would feed the
              // model's private thinking to the XML templates.
              if (reasoning.kind === 'reasoning') {
                reasoning.text = fullReasoning;
                // The clock's upper bound, moved by the deltas themselves.
                reasoning.lastAt = this.now();
              }
              this.publish();
            },
            onToolCallPartial: (partial) => {
              if (partial.name !== SUBMIT_COMPONENT) return;
              let scanner = scanners.get(partial.index);
              if (!scanner) {
                scanner = new PartialPayloadScanner();
                scanners.set(partial.index, scanner);
                this.building = {
                  submission: ++this.submissionCounter,
                  nodes: [],
                  connections: [],
                  complete: false
                };
                this.publish();
              }
              const found = scanner.update(partial.argsText);
              if (found.changed) {
                this.building = {
                  submission: this.building?.submission ?? this.submissionCounter,
                  nodes: found.nodes,
                  connections: found.connections,
                  complete: false
                };
                this.publish();
              }
            }
          }
        );
      } catch (error) {
        // A cancelled turn keeps whatever prose arrived; an empty bubble helps no one.
        prose.streaming = false;
        if (!prose.text.trim()) this.dropActivity(prose);
        // BLD-004: the same rule for the reasoning strip, and it matters more
        // here — a strip left `streaming` on a turn that died keeps a clock
        // running against a stream that has stopped, which is the exact lie
        // this task exists to remove.
        this.settleReasoning(reasoning);
        if (abortController.signal.aborted) return this.finish('cancelled');
        // AIB-009 F11: a stalled turn reaches here, and `signal.aborted` is
        // deliberately false — `withTurnDeadline` aborts its own inner
        // controller, so a provider that stopped answering reads as an error
        // with a reason rather than as the user having pressed Stop.
        //
        // And whatever ended the turn, a candidate that already passed the gate
        // stands: the same rule the exhausted and aborted paths above apply, for
        // the same reason. An optional style pass must never cost a valid one.
        if (stylePassBaseline) return this.finish('authored', stylePassBaseline);
        return this.finish('error', undefined, error instanceof Error ? error.message : String(error));
      }

      this.promptTokens += response.usage.promptTokens;
      this.completionTokens += response.usage.completionTokens;
      this.cacheReadTokens += response.usage.cacheReadTokens;
      this.cacheWriteTokens += response.usage.cacheWriteTokens;
      this.usageByTurn.push({
        turn: this.turns,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        cacheReadTokens: response.usage.cacheReadTokens,
        cacheWriteTokens: response.usage.cacheWriteTokens
      });
      this.costUsd =
        this.costUsd === null || response.usage.costUsd === null ? null : this.costUsd + response.usage.costUsd;

      this.messages.push({
        role: 'assistant',
        content: response.text ?? '',
        ...(response.toolCalls.length > 0 ? { toolCalls: response.toolCalls } : {})
      });

      prose.text = response.text ?? prose.text;
      prose.streaming = false;
      if (!prose.text.trim()) this.dropActivity(prose);
      this.settleReasoning(reasoning);

      // A cancelled turn is not a model that declined to act. Providers that
      // swallow the abort and resolve with a partial response (the Anthropic
      // adapter does, so the caller keeps the text that did arrive) reach here
      // with no tool calls — and without this check that falls into the nudge
      // path below, spends another turn, and finally reports 'exhausted' for
      // what was a cancellation. Found via AIX-007: the measurement harness's
      // per-session timeout made every timed-out session look like the loop
      // giving up, which is a different and much more alarming failure.
      if (response.stopReason === 'aborted') {
        if (stylePassBaseline) return this.finish('authored', stylePassBaseline);
        return this.finish('cancelled');
      }

      if (response.toolCalls.length === 0) {
        // Prose instead of action. Nudge once; a model that keeps talking is done.
        // If we were only waiting on an optional style pass, the good candidate stands.
        if (stylePassBaseline) return this.finish('authored', stylePassBaseline);
        nudges++;
        if (nudges > 1) return this.finish('exhausted');
        this.messages.push({ role: 'user', content: nudgeMessage() });
        continue;
      }

      for (const call of response.toolCalls) {
        if (call.name === SUBMIT_COMPONENT) {
          const result = this.handleSubmit(call);
          this.completeBuilding(toSubmitPayload(call.arguments), scanners.size > 0);
          scanners.clear();
          roundSubmits++;
          this.rounds.push({ attempt: this.rounds.length + 1, ok: result.ok, errorLines: result.errorLines });
          this.record({ kind: 'submit', ok: result.ok, errorLines: result.errorLines });
          if (result.ok) {
            // The candidate passed the gate — keep it staged no matter what
            // happens next, so a failed style-improvement pass never loses it.
            this.staged = result.files;
            // AIX-008: sample data belongs to the candidate it arrived with; a
            // submission without any clears the last one rather than inheriting it.
            this.stagedSample = result.sampleData;
            this.stagedRevision++;
            // AIX-006: one advisory style pass, if the lint found raw values and
            // there is submission budget left. The component is already
            // acceptable; this asks the agent to make it on-system, at most once.
            const wantStylePass =
              result.styleFindings.length > 0 && !this.styleNudged && roundSubmits < this.maxSubmits;
            if (wantStylePass) {
              this.styleNudged = true;
              stylePassBaseline = result.files;
              this.messages.push({
                role: 'tool',
                toolCallId: call.id,
                name: call.name,
                content: styleAdvisoryMessage(result.styleFindings)
              });
              this.publish();
              continue; // back to the model for one on-system revision
            }
            this.messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: result.text });
            return this.finish('authored', result.files);
          }
          this.messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: result.text });
          this.publish();
          if (roundSubmits >= this.maxSubmits) {
            // Fall back to the pre-style-pass candidate rather than failing a
            // valid authoring over a cosmetic suggestion.
            if (stylePassBaseline) return this.finish('authored', stylePassBaseline);
            return this.finish('exhausted');
          }
        } else {
          this.record({ kind: 'tool', label: readToolLabel(call) });
          this.messages.push({
            role: 'tool',
            toolCallId: call.id,
            name: call.name,
            content: dispatchProjectDocTool(call, this.context) ?? dispatchReadTool(call, this.context)
          });
          this.publish();
        }
      }
    }

    if (stylePassBaseline) return this.finish('authored', stylePassBaseline);
    return this.finish('exhausted');
  }

  private dropActivity(activity: AuthoringActivity): void {
    const index = this.activities.indexOf(activity);
    if (index !== -1) this.activities.splice(index, 1);
  }

  /**
   * BLD-004 — put this turn's reasoning strip immediately before its prose.
   *
   * Stamped like everything else, but spliced rather than appended (see the
   * declaration of `reasoning` in the loop for why the position matters). Falls
   * back to appending if the anchor has already been dropped — a cancelled turn
   * removes its empty prose, and losing the reasoning to that race would delete
   * the only record of what the model was doing when it was cancelled.
   */
  /**
   * BLD-004 — the turn is over, so the reasoning strip stops claiming to be
   * live, and an empty one is removed rather than shown as a thing that thought
   * about nothing.
   */
  private settleReasoning(reasoning: AuthoringActivity | undefined): void {
    if (!reasoning || reasoning.kind !== 'reasoning') return;
    reasoning.streaming = false;
    if (!reasoning.text.trim()) this.dropActivity(reasoning);
  }

  private insertReasoningBefore(anchor: AuthoringActivity): AuthoringActivity {
    const at = this.now();
    const entry: AuthoringActivity = { kind: 'reasoning', text: '', streaming: true, at, lastAt: at };
    const index = this.activities.indexOf(anchor);
    if (index === -1) this.activities.push(entry);
    else this.activities.splice(index, 0, entry);
    return entry;
  }

  /**
   * A submission's arguments finished streaming (or arrived whole, for
   * providers without partials): publish the authoritative payload. When
   * partials were streaming this turn the in-flight submission is completed
   * in place; otherwise this is a new attempt the preview never saw forming.
   */
  private completeBuilding(payload: SubmitPayload, sawPartials: boolean): void {
    const current = this.building;
    const submission = sawPartials && current && !current.complete ? current.submission : ++this.submissionCounter;
    this.building = {
      submission,
      nodes: payload.nodes ?? [],
      connections: payload.connections ?? [],
      complete: true
    };
  }

  private finish(status: AuthoringStatus, files?: ComponentFiles, error?: string): AuthoringOutcome {
    this.lastStatus = status;
    this.lastError = error;
    // BLD-012: `.length` on the widened content type is the block *count* when
    // a turn carries blocks, not its character count — and both branches
    // typecheck, so nothing but this comment stops it silently under-reporting
    // a multimodal transcript by three orders of magnitude. `asText` measures
    // what actually went on the wire, image twins included.
    const transcriptChars = this.messages.reduce((sum, m) => sum + asText(m.content).length, 0);
    const metrics: AuthoringMetrics = {
      turns: this.turns,
      usageByTurn: [...this.usageByTurn],
      submits: this.rounds.length,
      contextLog: [...this.context.log],
      totalContextChars: this.context.totalChars(),
      transcriptChars,
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      cacheReadTokens: this.cacheReadTokens,
      cacheWriteTokens: this.cacheWriteTokens,
      costUsd: this.costUsd
    };
    console.debug(
      `[authoring] ${this.legacyName} → ${status} — ${this.turns} turns, ${this.rounds.length} submits, ` +
        `${metrics.totalContextChars} context chars, ${transcriptChars} transcript chars`
    );
    return {
      status,
      files,
      legacyName: this.legacyName,
      rounds: [...this.rounds],
      metrics,
      transcript: [...this.messages],
      error
    };
  }

  private handleSubmit(call: AiToolCall): SubmitResult {
    const payload = toSubmitPayload(call.arguments);
    // `buildCandidate` reports the malformed shapes it knows about, and this
    // catch covers the ones it does not: a submission is untrusted model output,
    // and the loop's contract is that a bad one is *rejected* — repairable, with
    // the reason handed back — never thrown out of the session. Losing a whole
    // authoring run to a `TypeError` costs the user every turn paid for so far.
    let candidate;
    try {
      // FIX-014: the fifth argument feeds the layout pass — gaps filled,
      // collisions separated, model-positioned nodes never moved.
      candidate = buildCandidate(this.request, payload, undefined, this.baseFiles, (t) =>
        this.context.isVisualType(t)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        errorLines: [`The submission could not be read: ${message}`],
        styleFindings: [],
        text: `The submission could not be read: ${message}\nResubmit with the shape submit_component documents.`
      };
    }
    if (!candidate.files) {
      return {
        ok: false,
        errorLines: candidate.errors,
        styleFindings: [],
        text: ['The submission is malformed:', ...candidate.errors.map((e) => `- ${e}`)].join('\n')
      };
    }

    const validation = validateCandidateComponent(this.graph, this.legacyName, candidate.files, {
      // Update mode: whatever the component already fails on is not this
      // submission's fault, and rejecting over it makes the agent "fix" the
      // user's own graph — see `ValidateCandidateOptions.baseline`.
      ...(this.baseFiles ? { baseline: this.baseFiles } : {}),
      ...(this.backend ? { backend: this.backend } : {}),
      // AAQ-001: the pages this plan is about to create resolve too, or the
      // first page authored is told its link to the second is broken.
      ...(this.plannedComponents ? { plannedComponents: this.plannedComponents } : {})
    });
    if (validation.ok) {
      const warnings = validation.diagnostics.filter((d) => d.severity === 'warning');
      // AIX-006: the candidate passed the gate — now lint its styling. Scoped to
      // the candidate's own nodes; findings are advisory (validator errors first,
      // style second), and only when style guidance is enabled for this session.
      const styleFindings = this.styleGuidance
        ? styleLintCandidate(candidate.files, { tokenRecords: this.styleTokenRecords }).findings
        : [];
      return {
        ok: true,
        files: candidate.files,
        sampleData: payload.sampleData,
        errorLines: [],
        styleFindings,
        text: [
          `Component accepted — it validates cleanly (${validation.summary.warnings} warning(s)).`,
          ...warnings.map(formatDiagnosticLine),
          ...(validation.preExisting?.length
            ? [
                `${validation.preExisting.length} problem(s) carried over from the component as it already ` +
                  'was — not yours to fix, and correctly left alone:',
                ...validation.preExisting.map(formatDiagnosticLine)
              ]
            : [])
        ].join('\n')
      };
    }

    const errorLines = [
      ...(validation.structural ?? []).flatMap((f) => f.errors.map((e) => `SCHEMA ${f.file} ${e.path}: ${e.message}`)),
      ...validation.errors.map(formatDiagnosticLine)
    ];
    return {
      ok: false,
      errorLines,
      styleFindings: [],
      text: [
        `Rejected — ${errorLines.length} problem(s). Fix exactly these and resubmit the full component:`,
        ...errorLines
      ].join('\n')
    };
  }
}
