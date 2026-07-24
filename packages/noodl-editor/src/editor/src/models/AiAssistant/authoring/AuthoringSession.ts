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
 * The chat function is injected: the editor binds `AiClient.chat`, specs bind
 * a script, and the measurement harness binds a directly-constructed provider.
 *
 * @module AiAssistant/authoring/AuthoringSession
 */

import { formatDiagnosticLine } from '../../../validation';
import { AiClient } from '../client';
import type { AiChatRequest, AiChatResponse, AiMessage, AiToolCall } from '../client/types';
import { findComponent } from '../explain/graph';
import type { ExplainGraph } from '../explain/types';
import { buildCandidate, pathToLegacyName } from './candidate';
import { AuthoringContextBuilder } from './ContextBuilder';
import { initialUserMessage, nudgeMessage, refineMessage, systemPrompt } from './prompts/authoring';
import { AUTHORING_TOOLS, dispatchReadTool, SUBMIT_COMPONENT, toSubmitPayload } from './tools';
import type {
  AuthoringMetrics,
  AuthoringOutcome,
  AuthoringRequest,
  AuthoringStatus,
  ComponentFiles,
  ContextBudget,
  SubmitRound
} from './types';
import { validateCandidateComponent } from './validate';

export type AuthoringChatFn = (request: AiChatRequest) => Promise<AiChatResponse>;

export interface AuthoringSessionOptions {
  /** Injection seam; defaults to the configured AiClient. */
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

  private constructor(
    private readonly graph: ExplainGraph,
    private readonly request: AuthoringRequest,
    options: AuthoringSessionOptions
  ) {
    this.chat = options.chat ?? ((req) => AiClient.chat(req));
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
    return this.round(options);
  }

  /** One bounded round of the loop: author → validate → repair until an outcome. */
  private async round(options: { abortController?: AbortController }): Promise<AuthoringOutcome> {
    if (this.inFlight) {
      throw new AuthoringStateError('A round is already in flight — await it before starting another.');
    }
    this.inFlight = true;
    try {
      return await this.loop(options);
    } finally {
      this.inFlight = false;
    }
  }

  private async loop(options: { abortController?: AbortController }): Promise<AuthoringOutcome> {
    let roundTurns = 0;
    let roundSubmits = 0;
    let nudges = 0;

    while (roundTurns < this.maxTurns) {
      roundTurns++;
      this.turns++;
      let response: AiChatResponse;
      try {
        response = await this.chat({
          messages: [...this.messages],
          tools: AUTHORING_TOOLS,
          toolChoice: 'auto',
          abortController: options.abortController
        });
      } catch (error) {
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
          roundSubmits++;
          this.rounds.push({ attempt: this.rounds.length + 1, ok: result.ok, errorLines: result.errorLines });
          this.messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: result.text });
          if (result.ok) {
            this.staged = result.files;
            return this.finish('authored', result.files);
          }
          if (roundSubmits >= this.maxSubmits) return this.finish('exhausted');
        } else {
          this.messages.push({
            role: 'tool',
            toolCallId: call.id,
            name: call.name,
            content: dispatchReadTool(call, this.context)
          });
        }
      }
    }

    return this.finish('exhausted');
  }

  private finish(status: AuthoringStatus, files?: ComponentFiles, error?: string): AuthoringOutcome {
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
