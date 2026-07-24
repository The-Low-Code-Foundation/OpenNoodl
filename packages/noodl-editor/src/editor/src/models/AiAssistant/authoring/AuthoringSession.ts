/**
 * AIX-002 — The Authoring Loop: session
 *
 * One session is one attempt to author one component: context → author →
 * validate → repair → present, with bounded turns and bounded submissions.
 *
 * Like ExplainSession, a session holds plain data (`ExplainGraph`), never an
 * editor model — and unlike ExplainSession it produces something: staged
 * `ComponentFiles` in the outcome. It still writes nothing. Staging to the
 * live project, accept/refine/reject, and canvas rendering are later slices;
 * the loop is deliberately headless-first so validity, iteration count, and
 * context size can be measured before any UI exists.
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
import { initialUserMessage, nudgeMessage, systemPrompt } from './prompts/authoring';
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
  /** Model round-trips before giving up. */
  maxTurns?: number;
  /** Submission attempts before giving up. */
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

  /** Run the loop to an outcome. Never throws for loop-shaped failures. */
  async run(options: { abortController?: AbortController } = {}): Promise<AuthoringOutcome> {
    const messages: AiMessage[] = [
      { role: 'system', content: systemPrompt() },
      {
        role: 'user',
        content: initialUserMessage(this.request, this.context.projectOverview(), this.context.catalogOverview())
      }
    ];

    const rounds: SubmitRound[] = [];
    let turns = 0;
    let nudges = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let costUsd: number | null = 0;

    const finish = (status: AuthoringStatus, files?: ComponentFiles, error?: string): AuthoringOutcome => {
      const transcriptChars = messages.reduce((sum, m) => sum + m.content.length, 0);
      const metrics: AuthoringMetrics = {
        turns,
        submits: rounds.length,
        contextLog: [...this.context.log],
        totalContextChars: this.context.totalChars(),
        transcriptChars,
        promptTokens,
        completionTokens,
        costUsd
      };
      console.debug(
        `[authoring] ${this.legacyName} → ${status} — ${turns} turns, ${rounds.length} submits, ` +
          `${metrics.totalContextChars} context chars, ${transcriptChars} transcript chars`
      );
      return { status, files, legacyName: this.legacyName, rounds, metrics, transcript: messages, error };
    };

    while (turns < this.maxTurns) {
      turns++;
      let response: AiChatResponse;
      try {
        response = await this.chat({
          messages: [...messages],
          tools: AUTHORING_TOOLS,
          toolChoice: 'auto',
          abortController: options.abortController
        });
      } catch (error) {
        return finish('error', undefined, error instanceof Error ? error.message : String(error));
      }

      promptTokens += response.usage.promptTokens;
      completionTokens += response.usage.completionTokens;
      costUsd = costUsd === null || response.usage.costUsd === null ? null : costUsd + response.usage.costUsd;

      messages.push({
        role: 'assistant',
        content: response.text ?? '',
        ...(response.toolCalls.length > 0 ? { toolCalls: response.toolCalls } : {})
      });

      if (response.toolCalls.length === 0) {
        // Prose instead of action. Nudge once; a model that keeps talking is done.
        nudges++;
        if (nudges > 1) return finish('exhausted');
        messages.push({ role: 'user', content: nudgeMessage() });
        continue;
      }

      for (const call of response.toolCalls) {
        if (call.name === SUBMIT_COMPONENT) {
          const result = this.handleSubmit(call);
          rounds.push({ attempt: rounds.length + 1, ok: result.ok, errorLines: result.errorLines });
          messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: result.text });
          if (result.ok) return finish('authored', result.files);
          if (rounds.length >= this.maxSubmits) return finish('exhausted');
        } else {
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            name: call.name,
            content: dispatchReadTool(call, this.context)
          });
        }
      }
    }

    return finish('exhausted');
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
      ...(validation.structural ?? []).flatMap((f) =>
        f.errors.map((e) => `SCHEMA ${f.file} ${e.path}: ${e.message}`)
      ),
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
