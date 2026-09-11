/**
 * AIX-010 — one drafted document.
 *
 * Shaped like AIX-011's `DocSession`, and it reuses that turn's *tool* verbatim
 * (`DOC_TOOLS` / `SUBMIT_DOC`, the whole-file contract) and its repair and
 * graph-restatement advisory messages. What it does not reuse is the loop
 * itself, and the reason is honest rather than lazy: `DocSession`'s entire
 * prompt is built around "a plan whose components have already been built and
 * are about to be applied", and it requires a `PlanOutcomeEntry[]` describing
 * what a fan-out achieved. A retrofit has no plan and no outcome. Passing it a
 * synthetic empty plan to reuse the loop would have made one function that lies
 * about half its callers — the exact thing the spec warned against when it said
 * to add a sibling assembler if the prompt shapes diverge.
 *
 * Two advisory passes, at most one each, both non-blocking:
 *
 *  - **Graph restatement** (`docLint`, AIX-011): the mechanical half of "docs
 *    never describe the graph".
 *  - **Missing TODOs** (criterion 3): a draft written from a partial read that
 *    is certain about everything has smoothed its guesses into facts.
 *
 * Neither can turn a usable document into a failure — the AIX-006 style-advisory
 * rule. The submission that triggered the advisory is kept, and stands if the
 * rewrite never arrives.
 *
 * Writes nothing. The outcome is a string; the only code that touches disk is
 * AIX-009's proposal accept path.
 *
 * @module AiAssistant/review/ReviewDocSession
 */

import { AiClient } from '../client';
import type { AiEffort, AiMessage, AiToolCall } from '../client/types';
import type { AuthoringChatFn } from '../authoring/AuthoringSession';
import { AUTHORING_EFFORT, AuthoringSetupError } from '../authoring/AuthoringSession';
import { docLint } from '../authoring/docLint';
import { DOC_TOOLS, docAdvisoryMessage, docRepairMessage, SUBMIT_DOC } from '../authoring/prompts/docAuthoring';
import { countTodoMarkers, reviewSystemPrompt, reviewUserMessage, todoAdvisoryMessage } from './prompts';
import type { ReviewDocKind, ReviewDraftStatus } from './types';

const DEFAULT_MAX_TURNS = 8;
const DEFAULT_MAX_SUBMITS = 3;

/** Largest document this loop will produce. Well above any real doc. */
export const MAX_REVIEW_DOC_CHARS = 60_000;

export interface ReviewDocRequest {
  kind: ReviewDocKind;
  path: string;
  /** Reference material — `renderProjectReviewContext`. */
  context: string;
  /** What was and was not read — `renderCoverageForPrompt`. */
  coverage: string;
  /** One line of the same, for the TODO advisory. */
  coverageLine: string;
  /** The file as it stands; `null` when it does not exist yet. */
  baseline: string | null;
  template?: string;
  siblings?: Array<{ path: string; summary: string }>;
  /**
   * BLD-008 — the owner's answers, already rendered (`answersBlock`).
   *
   * A string rather than the interview state, so this session keeps knowing
   * nothing about interviews: it is handed prose to put in a prompt, exactly as
   * it is handed `context` and `coverage`.
   */
  answers?: string;
  /**
   * BLD-008 — rewrite the submitted file before it is returned.
   *
   * The one hook the interview needs: `insertSkipTodos` puts one `> TODO:` line
   * per declined question under its heading, and it must run on the content that
   * is *kept* — including the standing submission an advisory pass left behind —
   * which is one place, here, rather than at each of the four `authored` exits.
   */
  transform?: (content: string) => string;
}

export interface ReviewDocOptions {
  chat?: AuthoringChatFn;
  maxTurns?: number;
  maxSubmits?: number;
  effort?: AiEffort;
  /** When false, the graph-restatement advisory is neither run nor offered. */
  docLint?: boolean;
  /** When false, the missing-TODO advisory is not offered. */
  todoAdvisory?: boolean;
}

export interface ReviewDocOutcome {
  status: ReviewDraftStatus;
  content?: string;
  summary?: string;
  note?: string;
  todoCount: number;
  lintFindings: string[];
  costUsd: number | null;
  turns: number;
}

interface Submission {
  content: string;
  summary?: string;
  lintFindings: string[];
  todoCount: number;
}

/** Narrow a `submit_doc` call. Anything unusable is an error line, not a throw. */
function toSubmission(args: Record<string, unknown>): { content?: string; summary?: string; errors: string[] } {
  const raw = args.content;
  if (typeof raw !== 'string' || !raw.trim()) {
    return { errors: [`${SUBMIT_DOC} needs the complete file in "content" — it was empty or not a string.`] };
  }
  if (raw.length > MAX_REVIEW_DOC_CHARS) {
    return {
      errors: [
        `The submitted document is ${raw.length} characters; the limit is ${MAX_REVIEW_DOC_CHARS}. ` +
          'A project doc this long is not being read by anyone — cut it down.'
      ]
    };
  }
  return {
    content: raw,
    summary: typeof args.summary === 'string' && args.summary.trim() ? args.summary.trim() : undefined,
    errors: []
  };
}

export class ReviewDocSession {
  private readonly chat: AuthoringChatFn;
  private readonly maxTurns: number;
  private readonly maxSubmits: number;
  private readonly effort: AiEffort;
  private readonly lintEnabled: boolean;
  private readonly todoEnabled: boolean;

  constructor(
    private readonly request: ReviewDocRequest,
    options: ReviewDocOptions = {}
  ) {
    if (!request.path.trim()) throw new AuthoringSetupError('A review draft needs a target document path.');
    if (!request.context.trim()) {
      throw new AuthoringSetupError(`Nothing was assembled for ${request.path} — there is nothing to draft from.`);
    }
    this.chat = options.chat ?? ((req, callbacks) => AiClient.chatStream(req, callbacks ?? {}));
    this.maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    this.maxSubmits = options.maxSubmits ?? DEFAULT_MAX_SUBMITS;
    this.effort = options.effort ?? AUTHORING_EFFORT;
    this.lintEnabled = options.docLint ?? true;
    this.todoEnabled = options.todoAdvisory ?? true;
  }

  async run(options: { abortController?: AbortController } = {}): Promise<ReviewDocOutcome> {
    const abortController = options.abortController ?? new AbortController();

    const messages: AiMessage[] = [
      { role: 'system', content: reviewSystemPrompt(this.request.kind) },
      {
        role: 'user',
        content: reviewUserMessage({
          kind: this.request.kind,
          path: this.request.path,
          context: this.request.context,
          coverage: this.request.coverage,
          current: this.request.baseline ?? undefined,
          template: this.request.template,
          siblings: this.request.siblings,
          answers: this.request.answers
        })
      }
    ];

    let turns = 0;
    let submits = 0;
    let costUsd: number | null = 0;
    let lastProse = '';
    let lintAdvised = false;
    let todoAdvised = false;
    /**
     * A submission that is already usable and is waiting on one advisory pass.
     * If the revision never lands, THIS stands — an advisory must never turn a
     * usable document into a failure.
     */
    let standing: Submission | undefined;

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
          return standing ? this.authored(standing, costUsd, turns) : this.stop('cancelled', costUsd, turns);
        }
        return this.stop('error', costUsd, turns, error instanceof Error ? error.message : String(error));
      }

      costUsd = costUsd === null || response.usage.costUsd === null ? null : costUsd + response.usage.costUsd;
      messages.push({
        role: 'assistant',
        content: response.text ?? '',
        ...(response.toolCalls.length > 0 ? { toolCalls: response.toolCalls } : {})
      });
      if (response.text?.trim()) lastProse = response.text.trim();

      if (response.stopReason === 'aborted') {
        return standing ? this.authored(standing, costUsd, turns) : this.stop('cancelled', costUsd, turns);
      }

      const submitCall = response.toolCalls.find((call: AiToolCall) => call.name === SUBMIT_DOC);
      if (!submitCall) {
        if (standing) return this.authored(standing, costUsd, turns);
        if (response.toolCalls.length === 0) {
          // Prose with no submission is the model declining — "this project has
          // no conventions worth writing down" is a real, useful answer.
          return this.stop('declined', costUsd, turns, lastProse || undefined);
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
          return standing ? this.authored(standing, costUsd, turns) : this.stop('exhausted', costUsd, turns, errors.join(' · '));
        }
        messages.push({
          role: 'tool',
          toolCallId: submitCall.id,
          name: submitCall.name,
          content: docRepairMessage(errors)
        });
        continue;
      }

      // A byte-identical resubmission of an existing file is a decline dressed
      // as a submission: it would put an empty diff in front of the user.
      if (this.request.baseline !== null && content === this.request.baseline) {
        return this.stop(
          'declined',
          costUsd,
          turns,
          lastProse || `${this.request.path} already says this — the submitted file is unchanged.`
        );
      }

      const lint = this.lintEnabled ? docLint(content, { baseline: this.request.baseline }) : { lines: [] };
      const submission: Submission = {
        content,
        summary,
        lintFindings: lint.lines,
        todoCount: countTodoMarkers(content)
      };

      const canAdviseAgain = submits < this.maxSubmits;

      if (lint.lines.length > 0 && !lintAdvised && canAdviseAgain) {
        lintAdvised = true;
        standing = submission;
        messages.push({
          role: 'tool',
          toolCallId: submitCall.id,
          name: submitCall.name,
          content: docAdvisoryMessage(lint.lines)
        });
        continue;
      }

      if (this.todoEnabled && submission.todoCount === 0 && !todoAdvised && canAdviseAgain) {
        todoAdvised = true;
        standing = submission;
        messages.push({
          role: 'tool',
          toolCallId: submitCall.id,
          name: submitCall.name,
          content: todoAdvisoryMessage(this.request.coverageLine)
        });
        continue;
      }

      return this.authored(submission, costUsd, turns);
    }

    return standing ? this.authored(standing, costUsd, turns) : this.stop('exhausted', costUsd, turns);
  }

  /**
   * The one exit that returns a file, and where the interview's TODOs are added.
   *
   * ⚠️ `todoCount` is recounted **after** the transform rather than carried from
   * the submission. It is the number the panel displays and acceptance criterion
   * 2 is stated in it — a count taken before the lines were inserted would read
   * zero on a draft that carries three, which is the panel telling the user the
   * opposite of what happened.
   */
  private authored(submission: Submission, costUsd: number | null, turns: number): ReviewDocOutcome {
    const content = this.request.transform ? this.request.transform(submission.content) : submission.content;
    return {
      status: 'authored',
      content,
      summary: submission.summary,
      todoCount: content === submission.content ? submission.todoCount : countTodoMarkers(content),
      lintFindings: submission.lintFindings,
      costUsd,
      turns
    };
  }

  private stop(
    status: ReviewDraftStatus,
    costUsd: number | null,
    turns: number,
    note?: string
  ): ReviewDocOutcome {
    return { status, note, todoCount: 0, lintFindings: [], costUsd, turns };
  }
}
