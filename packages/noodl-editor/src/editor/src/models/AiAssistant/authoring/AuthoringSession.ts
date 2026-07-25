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
import { formatDiagnosticLine } from '../../../validation';
import { AiClient } from '../client';
import type { AiChatRequest, AiChatResponse, AiMessage, AiStreamCallbacks, AiToolCall } from '../client/types';
import { findComponent } from '../explain/graph';
import type { ExplainGraph } from '../explain/types';
import { buildCandidate, pathToLegacyName } from './candidate';
import { AuthoringContextBuilder } from './ContextBuilder';
import { PartialPayloadScanner } from './partial';
import { initialUserMessage, nudgeMessage, refineMessage, systemPrompt } from './prompts/authoring';
import {
  AUTHORING_TOOLS,
  dispatchReadTool,
  GET_COMPONENT,
  GET_NODE_TYPES,
  SUBMIT_COMPONENT,
  toSubmitPayload
} from './tools';
import type {
  AuthoringMetrics,
  AuthoringOutcome,
  AuthoringRequest,
  AuthoringStatus,
  ComponentFiles,
  ContextBudget,
  SubmitPayload,
  SubmitRound,
  SubmittedNode
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
}

const DEFAULT_MAX_TURNS = 12;
const DEFAULT_MAX_SUBMITS = 4;

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

/** One entry in the feed the panel renders. */
export type AuthoringActivity =
  /** The user's request or refinement instruction, verbatim. */
  | { kind: 'user'; text: string }
  /** Assistant prose; `text` grows while `streaming` is set. */
  | { kind: 'assistant'; text: string; streaming?: boolean }
  /** A context read, as a one-line event. */
  | { kind: 'tool'; label: string }
  /** A submission and the gate's verdict. */
  | { kind: 'submit'; ok: boolean; errorLines: string[] };

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
  /** The live picture of the submission being written, for the preview canvas. */
  building?: BuildingPreview;
  /** Present whenever some candidate has passed validation — it survives a failed refinement. */
  staged?: StagedSummary;
  error?: string;
}

type Listener = (state: AuthoringSessionState) => void;

function readToolLabel(call: AiToolCall): string {
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
  errorLines: string[];
}

export class AuthoringSession {
  private readonly chat: AuthoringChatFn;
  private readonly maxTurns: number;
  private readonly maxSubmits: number;
  readonly context: AuthoringContextBuilder;
  readonly legacyName: string;

  // Conversation state, cumulative across run() and every refine().
  private readonly messages: AiMessage[] = [];
  private readonly rounds: SubmitRound[] = [];
  private turns = 0;
  private promptTokens = 0;
  private completionTokens = 0;
  private costUsd: number | null = 0;
  private started = false;
  private inFlight = false;
  private staged?: ComponentFiles;
  private building?: BuildingPreview;
  private submissionCounter = 0;

  // Published state.
  private readonly activities: AuthoringActivity[] = [];
  private readonly listeners = new Set<Listener>();
  private lastStatus?: AuthoringStatus;
  private lastError?: string;
  private currentAbort?: AbortController;

  private constructor(
    private readonly graph: ExplainGraph,
    private readonly request: AuthoringRequest,
    options: AuthoringSessionOptions
  ) {
    this.chat = options.chat ?? ((req, callbacks) => AiClient.chatStream(req, callbacks ?? {}));
    this.maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    this.maxSubmits = options.maxSubmits ?? DEFAULT_MAX_SUBMITS;
    this.context = new AuthoringContextBuilder(graph, options.budget);
    this.legacyName = pathToLegacyName(request.componentPath);
  }

  static create(
    graph: ExplainGraph,
    request: AuthoringRequest,
    options: AuthoringSessionOptions = {}
  ): AuthoringSession {
    if (!request.description.trim()) {
      throw new AuthoringSetupError('The request has no description — nothing to build.');
    }
    if (!request.componentPath.trim()) {
      throw new AuthoringSetupError('The request has no component path — nowhere to build it.');
    }
    if (findComponent(graph, request.componentPath)) {
      throw new AuthoringSetupError(
        `Component "${request.componentPath}" already exists. Authoring only creates new components.`
      );
    }
    return new AuthoringSession(graph, request, options);
  }

  /** The latest candidate that passed validation, across all rounds. */
  get stagedFiles(): ComponentFiles | undefined {
    return this.staged;
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
    this.messages.push(
      { role: 'system', content: systemPrompt() },
      {
        role: 'user',
        content: initialUserMessage(this.request, this.context.projectOverview(), this.context.catalogOverview())
      }
    );
    this.activities.push({ kind: 'user', text: this.request.description });
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
    this.activities.push({ kind: 'user', text: instruction });
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

    while (roundTurns < this.maxTurns) {
      roundTurns++;
      this.turns++;

      // The assistant's prose for this turn, streamed into the feed as it arrives.
      const prose: AuthoringActivity = { kind: 'assistant', text: '', streaming: true };
      this.activities.push(prose);
      this.publish();

      // Submissions streaming this turn, scanned for complete nodes as the
      // arguments arrive so the preview canvas can render the forming graph.
      const scanners = new Map<number, PartialPayloadScanner>();

      let response: AiChatResponse;
      try {
        response = await this.chat(
          {
            messages: [...this.messages],
            tools: AUTHORING_TOOLS,
            toolChoice: 'auto',
            abortController
          },
          {
            onText: (fullText) => {
              prose.text = fullText;
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
        if (abortController.signal.aborted) return this.finish('cancelled');
        return this.finish('error', undefined, error instanceof Error ? error.message : String(error));
      }

      this.promptTokens += response.usage.promptTokens;
      this.completionTokens += response.usage.completionTokens;
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

      if (response.toolCalls.length === 0) {
        // Prose instead of action. Nudge once; a model that keeps talking is done.
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
          this.activities.push({ kind: 'submit', ok: result.ok, errorLines: result.errorLines });
          this.messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: result.text });
          if (result.ok) {
            this.staged = result.files;
            return this.finish('authored', result.files);
          }
          this.publish();
          if (roundSubmits >= this.maxSubmits) return this.finish('exhausted');
        } else {
          this.activities.push({ kind: 'tool', label: readToolLabel(call) });
          this.messages.push({
            role: 'tool',
            toolCallId: call.id,
            name: call.name,
            content: dispatchReadTool(call, this.context)
          });
          this.publish();
        }
      }
    }

    return this.finish('exhausted');
  }

  private dropActivity(activity: AuthoringActivity): void {
    const index = this.activities.indexOf(activity);
    if (index !== -1) this.activities.splice(index, 1);
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
    const transcriptChars = this.messages.reduce((sum, m) => sum + m.content.length, 0);
    const metrics: AuthoringMetrics = {
      turns: this.turns,
      submits: this.rounds.length,
      contextLog: [...this.context.log],
      totalContextChars: this.context.totalChars(),
      transcriptChars,
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
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
    const candidate = buildCandidate(this.request, payload);
    if (!candidate.files) {
      return {
        ok: false,
        errorLines: candidate.errors,
        text: ['The submission is malformed:', ...candidate.errors.map((e) => `- ${e}`)].join('\n')
      };
    }

    const validation = validateCandidateComponent(this.graph, this.legacyName, candidate.files);
    if (validation.ok) {
      const warnings = validation.diagnostics.filter((d) => d.severity === 'warning');
      return {
        ok: true,
        files: candidate.files,
        errorLines: [],
        text: [
          `Component accepted — it validates cleanly (${validation.summary.warnings} warning(s)).`,
          ...warnings.map(formatDiagnosticLine)
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
      text: [
        `Rejected — ${errorLines.length} problem(s). Fix exactly these and resubmit the full component:`,
        ...errorLines
      ].join('\n')
    };
  }
}
