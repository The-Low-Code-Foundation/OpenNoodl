/**
 * AIX-011 criterion 7 — the doc-authoring turn.
 *
 * One bounded conversation that turns a `doc` plan operation into a proposed
 * document body. Deliberately tiny next to `AuthoringSession`, and shaped like
 * `PlanningSession`: a couple of turns, one tool, one gate.
 *
 * This is the piece the first AIX-011 pass did not have. A `doc` operation
 * carries `{target, intent}` and nothing else, so wiring the write seam to
 * AIX-009's `docs.write(path, proposed)` was impossible — there was no
 * `proposed`. This session produces it, and it runs during the fan-out (after
 * the components, so it can see what was actually built) rather than at apply,
 * because the whole point is that the result is *reviewed as a diff* before it
 * is written.
 *
 * It writes nothing. Like every other session in this phase it holds plain data
 * — the outcome is a string — and the only code that touches disk is the plan
 * transaction's injected `PlanDocWriter`.
 *
 * @module AiAssistant/authoring/DocSession
 */

import { AiClient } from '../client';
import type { AiEffort, AiMessage, AiToolCall } from '../client/types';
import type { ExplainGraph } from '../explain/types';
// Pure ProjectDocs submodules only — the barrel drags ProjectModel and the
// platform filesystem into the headless bundle (the AuthoringSession rule).
import { DOC_CAPS, KNOWN_DOCS, renderDocForPrompt } from '../../ProjectDocs/docsText';
import { DOC_TEMPLATES } from '../../ProjectDocs/templates';
import type { AuthoringChatFn } from './AuthoringSession';
import { AUTHORING_EFFORT, AuthoringSetupError } from './AuthoringSession';
import { AuthoringContextBuilder } from './ContextBuilder';
import { docLint } from './docLint';
import type { PlanOutcomeEntry } from './plan';
import { renderPlanOutcome } from './plan';
import {
  DOC_TOOLS,
  docAdvisoryMessage,
  docRepairMessage,
  docSystemPrompt,
  docUserMessage,
  SUBMIT_DOC
} from './prompts/docAuthoring';
import type { ContextBudget } from './types';

const DEFAULT_MAX_TURNS = 6;
const DEFAULT_MAX_SUBMITS = 3;

/** Largest document this loop will produce. Well above any real doc. */
export const MAX_DOC_CHARS = 60_000;

/** Cap for an unknown doc path (the three known docs use their own caps). */
const OTHER_DOC_CAP = 8_000;

export interface DocSessionRequest {
  /** Project-relative doc path, e.g. `docs/ARCHITECTURE.md`. */
  path: string;
  /** The operation's intent, verbatim from the plan. */
  intent: string;
  /** The plan's originating request. */
  request: string;
  /** What the fan-out achieved, per component operation. */
  outcome: readonly PlanOutcomeEntry[];
  /** The file as it stands; `null`/`undefined` when it does not exist yet. */
  baseline?: string | null;
}

export interface DocSessionOptions {
  chat?: AuthoringChatFn;
  budget?: Partial<ContextBudget>;
  maxTurns?: number;
  maxSubmits?: number;
  effort?: AiEffort;
  /**
   * When false, the graph-restatement lint is neither run nor offered. The
   * advisory is a quality pass, not a gate — this exists for measurement arms
   * and for specs that are testing something else.
   */
  docLint?: boolean;
}

export type DocSessionStatus = 'authored' | 'declined' | 'exhausted' | 'cancelled' | 'error';

export interface DocSessionOutcome {
  status: DocSessionStatus;
  /** The whole proposed file. Present only when status is 'authored'. */
  content?: string;
  /** The model's one-sentence description of its change, for the review header. */
  summary?: string;
  /** The model's prose when it declined, or the error message. */
  note?: string;
  /** Advisory lint findings on the submitted content (empty when clean). */
  lintFindings: string[];
  costUsd: number | null;
  turns: number;
}

/** Narrow a `submit_doc` call. Anything unusable is an error line, not a throw. */
function toSubmission(args: Record<string, unknown>): { content?: string; summary?: string; errors: string[] } {
  const errors: string[] = [];
  const raw = args.content;
  if (typeof raw !== 'string' || !raw.trim()) {
    errors.push(`${SUBMIT_DOC} needs the complete file in "content" — it was empty or not a string.`);
    return { errors };
  }
  if (raw.length > MAX_DOC_CHARS) {
    errors.push(
      `The submitted document is ${raw.length} characters; the limit is ${MAX_DOC_CHARS}. ` +
        'A project doc this long is not being read by anyone — cut it down.'
    );
    return { errors };
  }
  return {
    content: raw,
    summary: typeof args.summary === 'string' && args.summary.trim() ? args.summary.trim() : undefined,
    errors
  };
}

export class DocSession {
  private readonly chat: AuthoringChatFn;
  private readonly maxTurns: number;
  private readonly maxSubmits: number;
  private readonly effort: AiEffort;
  private readonly lintEnabled: boolean;
  readonly context: AuthoringContextBuilder;

  constructor(
    graph: ExplainGraph,
    private readonly request: DocSessionRequest,
    options: DocSessionOptions = {}
  ) {
    if (!request.path.trim()) throw new AuthoringSetupError('The doc operation has no target path.');
    if (!request.intent.trim()) {
      throw new AuthoringSetupError(`Doc operation "${request.path}" has no intent — nothing to record.`);
    }
    this.chat = options.chat ?? ((req, callbacks) => AiClient.chatStream(req, callbacks ?? {}));
    this.maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    this.maxSubmits = options.maxSubmits ?? DEFAULT_MAX_SUBMITS;
    this.effort = options.effort ?? AUTHORING_EFFORT;
    this.lintEnabled = options.docLint ?? true;
    this.context = new AuthoringContextBuilder(graph, options.budget);
  }

  /** The existing file, capped at its known cap and charged like any handout. */
  private currentDoc(): string | undefined {
    const baseline = this.request.baseline;
    if (baseline === undefined || baseline === null || !baseline.trim()) return undefined;
    const known = KNOWN_DOCS.find((d) => d.path === this.request.path);
    const rendered = known
      ? renderDocForPrompt(known, baseline, DOC_CAPS[known.kind])
      : renderDocForPrompt(
          { kind: 'architecture', path: this.request.path, title: '', audience: '', purpose: '', injection: 'pull' },
          baseline,
          OTHER_DOC_CAP
        );
    return this.context.docSource(this.request.path, rendered);
  }

  async run(options: { abortController?: AbortController } = {}): Promise<DocSessionOutcome> {
    const abortController = options.abortController ?? new AbortController();
    const known = KNOWN_DOCS.find((d) => d.path === this.request.path);
    const current = this.currentDoc();

    const messages: AiMessage[] = [
      { role: 'system', content: docSystemPrompt() },
      {
        role: 'user',
        content: docUserMessage({
          path: this.request.path,
          current,
          template: known ? DOC_TEMPLATES[known.kind] : undefined,
          intent: this.request.intent,
          request: this.request.request,
          outcome: renderPlanOutcome(this.request.outcome),
          projectOverview: this.context.projectOverview()
        })
      }
    ];

    let turns = 0;
    let submits = 0;
    let costUsd: number | null = 0;
    let lastProse = '';
    let advised = false;
    // A submission that passed the gate but is waiting on one advisory pass. If
    // the revision never lands, THIS still stands — an advisory must never turn
    // a usable document into a failure (the AIX-006 style-pass rule).
    let advisoryBaseline: { content: string; summary?: string; lintFindings: string[] } | undefined;

    while (turns < this.maxTurns) {
      turns++;
      let response;
      try {
        response = await this.chat({
          messages: [...messages],
          tools: DOC_TOOLS,
          toolChoice: 'auto',
          effort: this.effort,
          abortController
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          if (advisoryBaseline) return this.authored(advisoryBaseline, costUsd, turns);
          return { status: 'cancelled', lintFindings: [], costUsd, turns };
        }
        return {
          status: 'error',
          note: error instanceof Error ? error.message : String(error),
          lintFindings: [],
          costUsd,
          turns
        };
      }

      costUsd = costUsd === null || response.usage.costUsd === null ? null : costUsd + response.usage.costUsd;
      messages.push({
        role: 'assistant',
        content: response.text ?? '',
        ...(response.toolCalls.length > 0 ? { toolCalls: response.toolCalls } : {})
      });
      if (response.text?.trim()) lastProse = response.text.trim();

      if (response.stopReason === 'aborted') {
        if (advisoryBaseline) return this.authored(advisoryBaseline, costUsd, turns);
        return { status: 'cancelled', lintFindings: [], costUsd, turns };
      }

      const submitCall = response.toolCalls.find((call: AiToolCall) => call.name === SUBMIT_DOC);
      if (!submitCall) {
        if (advisoryBaseline) return this.authored(advisoryBaseline, costUsd, turns);
        if (response.toolCalls.length === 0) {
          // Prose without a submission is the model declining — "the doc already
          // says this", "nothing here is worth recording". A real outcome.
          return { status: 'declined', note: lastProse || undefined, lintFindings: [], costUsd, turns };
        }
        for (const call of response.toolCalls) {
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            name: call.name,
            content: `Unknown tool "${call.name}". The only tool here is ${SUBMIT_DOC}.`
          });
        }
        continue;
      }

      submits++;
      const { content, summary, errors } = toSubmission(submitCall.arguments);
      if (!content) {
        if (submits >= this.maxSubmits) {
          if (advisoryBaseline) return this.authored(advisoryBaseline, costUsd, turns);
          return { status: 'exhausted', note: errors.join(' · '), lintFindings: [], costUsd, turns };
        }
        messages.push({
          role: 'tool',
          toolCallId: submitCall.id,
          name: submitCall.name,
          content: docRepairMessage(errors)
        });
        continue;
      }

      // An unchanged file is a decline dressed as a submission: writing it would
      // put an empty diff in front of the user and a no-op in the undo group.
      if (this.request.baseline != null && content === this.request.baseline) {
        return {
          status: 'declined',
          note: lastProse || `${this.request.path} already records this — the submitted file is unchanged.`,
          lintFindings: [],
          costUsd,
          turns
        };
      }

      const lint = this.lintEnabled ? docLint(content, { baseline: this.request.baseline }) : { lines: [] };
      const submission = { content, summary, lintFindings: lint.lines };

      if (lint.lines.length > 0 && !advised && submits < this.maxSubmits) {
        advised = true;
        advisoryBaseline = submission;
        messages.push({
          role: 'tool',
          toolCallId: submitCall.id,
          name: submitCall.name,
          content: docAdvisoryMessage(lint.lines)
        });
        continue; // back to the model for one rewrite
      }

      return this.authored(submission, costUsd, turns);
    }

    if (advisoryBaseline) return this.authored(advisoryBaseline, costUsd, turns);
    return { status: 'exhausted', lintFindings: [], costUsd, turns };
  }

  private authored(
    submission: { content: string; summary?: string; lintFindings: string[] },
    costUsd: number | null,
    turns: number
  ): DocSessionOutcome {
    return {
      status: 'authored',
      content: submission.content,
      summary: submission.summary,
      lintFindings: submission.lintFindings,
      costUsd,
      turns
    };
  }
}
