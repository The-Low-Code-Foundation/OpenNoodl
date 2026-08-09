/**
 * BLD-008 — one turn that asks instead of drafting.
 *
 * Sits between `assembleProjectReview` and the three `ReviewDocSession`s. It is
 * the cheapest turn in the pass — one call, one tool, no repair loop worth the
 * name — and it is the one that decides whether the three expensive ones write
 * facts or guesses.
 *
 * ## Why a model turn at all, rather than rendering the specs directly
 *
 * `interviewQuestions()` already knows *what* to ask. What it cannot know is how
 * to ask it about **this** project, and the difference is the whole value:
 * "who uses this app?" is a form field, while "the graph shows a sign-in page
 * and a Staff collection — are these shoppers or the people who run the shop?"
 * is a question a person answers in eight seconds because it has already done
 * the work of looking. The same turn produces the pre-filled guess, which is
 * what makes answering a correction rather than a composition.
 *
 * ## Degrading, rather than failing
 *
 * ⚠️ A failed interview must never mean a failed docs pass. If the call errors,
 * returns no tool call, or returns entries for ids that do not exist, this
 * returns the specs with the model's contribution missing rather than throwing —
 * the questions are still asked, in their generic phrasing, with no guess. A
 * person can still answer them, which is the property the task is actually
 * about; losing the phrasing costs politeness, and losing the pass costs the
 * user their run.
 *
 * Writes nothing, like every other session in this phase.
 *
 * @module AiAssistant/review/InterviewSession
 */

import { AiClient } from '../client';
import type { AiRole, AiRoleRequestFields } from '../client/roles';
import type { AiEffort, AiMessage, AiToolCall } from '../client/types';
import type { AuthoringChatFn } from '../authoring/AuthoringSession';
import { AUTHORING_EFFORT } from '../authoring/AuthoringSession';
import type { InterviewQuestionSpec } from './interviewQuestions';
import { interviewQuestions } from './interviewQuestions';
import { interviewFrom, type InterviewQuestion, type InterviewState, type ProposedDoc } from './interviewState';
import {
  INTERVIEW_TOOLS,
  interviewSystemPrompt,
  interviewUserMessage,
  SUBMIT_INTERVIEW,
  type InterviewTurnInput
} from './interviewPrompts';
import { DOCS_DIR } from '../../ProjectDocs/docsText';

/** How long a rewritten question or guess may be. Well above any sensible one. */
const MAX_FIELD_CHARS = 2_000;

export interface InterviewSessionOptions {
  chat?: AuthoringChatFn;
  effort?: AiEffort;
  /** When false, no call is made and the generic phrasings are used. */
  enabled?: boolean;
  /**
   * LAS-009 — defaults to `design`.
   *
   * Deciding what to ask a person about their own product, and writing the
   * sentence they will correct, is the same act scoping performs before a
   * project exists — and it sets the ceiling on all three documents, because a
   * question that misses costs a document no amount of drafting effort
   * recovers. The drafting turns that follow stay on the global pair. See
   * `AI_ROLE_SESSIONS`.
   */
  role?: AiRole | 'global';
}

export interface InterviewOutcome {
  state: InterviewState;
  costUsd: number | null;
  /** Set when the model contributed nothing and the generic phrasings stand. */
  note?: string;
}

function text(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > MAX_FIELD_CHARS ? trimmed.slice(0, MAX_FIELD_CHARS) : trimmed;
}

/**
 * The generic question, for a spec the model said nothing usable about.
 *
 * The guess is deliberately empty rather than invented here: an empty box is a
 * worse interface than a pre-filled one, but a *fabricated* guess presented in
 * the agent's voice is worse than either.
 */
function fallbackQuestion(spec: InterviewQuestionSpec): InterviewQuestion {
  return {
    id: spec.id,
    docKind: spec.docKind,
    heading: spec.heading,
    question: spec.question,
    why: 'Nothing in a node graph records this — it has to come from you.',
    guess: ''
  };
}

/** A file name the user did not choose, made safe. Never escapes `docs/`. */
export function proposedDocPath(filename: unknown): string | undefined {
  if (typeof filename !== 'string') return undefined;
  const base = filename
    .trim()
    .toLowerCase()
    .replace(/\.md$/, '')
    // Everything that is not a word character becomes a hyphen — which disposes
    // of `../`, of absolute paths and of nested folders in one rule rather than
    // three that can each be got wrong.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!base) return undefined;
  return `${DOCS_DIR}/${base.slice(0, 60)}.md`;
}

function toProposedDoc(raw: unknown): ProposedDoc | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const path = proposedDocPath(value.filename);
  if (!path) return undefined;
  const title = text(value.title, '');
  const purpose = text(value.purpose, '');
  if (!title || !purpose) return undefined;
  return {
    path,
    title,
    purpose,
    // `pull` is the safe default and the one BLD-007 made the default for a
    // reason: `always` is a real per-turn cost on every build in this project,
    // and a proposal is not the moment to opt someone into it by accident.
    inject: value.inject === 'always' ? 'always' : 'pull',
    why: text(value.why, 'It looked like knowledge this project keeps needing.')
  };
}

export class InterviewSession {
  private readonly chat: AuthoringChatFn;
  private readonly effort: AiEffort;
  private readonly enabled: boolean;
  /** LAS-009: the resolved role's request fields, decided once at session start. */
  private readonly roleFields: AiRoleRequestFields;

  constructor(
    private readonly request: InterviewTurnInput,
    options: InterviewSessionOptions = {}
  ) {
    this.chat = options.chat ?? ((req, callbacks) => AiClient.chatStream(req, callbacks ?? {}));
    this.effort = options.effort ?? AUTHORING_EFFORT;
    this.enabled = options.enabled ?? true;
    this.roleFields = AiClient.roleRequestFields(options.role ?? 'design');
  }

  async run(options: { abortController?: AbortController } = {}): Promise<InterviewOutcome> {
    const specs = this.request.specs;
    if (!this.enabled || specs.length === 0) {
      return { state: interviewFrom(specs.map(fallbackQuestion)), costUsd: 0 };
    }

    const abortController = options.abortController ?? new AbortController();
    const messages: AiMessage[] = [
      { role: 'system', content: interviewSystemPrompt() },
      { role: 'user', content: interviewUserMessage(this.request) }
    ];

    let response;
    try {
      response = await this.chat({
        ...this.roleFields,
        messages,
        tools: INTERVIEW_TOOLS,
        // `required`, not `auto`: the turn has exactly one job and prose is not
        // an outcome of it. Declining is a legitimate answer for a *draft* — the
        // model may have nothing to say about CONVENTIONS.md — but there is no
        // such thing as a project with no questions worth asking.
        toolChoice: 'required',
        effort: this.effort,
        abortController
      });
    } catch (error) {
      return {
        state: interviewFrom(specs.map(fallbackQuestion)),
        costUsd: null,
        note: abortController.signal.aborted
          ? 'The interview was stopped — the questions below are the plain versions.'
          : `The agent could not phrase the questions (${error instanceof Error ? error.message : String(error)}), so these are the plain versions.`
      };
    }

    const costUsd = response.usage.costUsd;
    const call = response.toolCalls.find((entry: AiToolCall) => entry.name === SUBMIT_INTERVIEW);
    if (!call) {
      return {
        state: interviewFrom(specs.map(fallbackQuestion)),
        costUsd,
        note: 'The agent did not phrase the questions, so these are the plain versions.'
      };
    }

    const raw = Array.isArray(call.arguments.questions) ? (call.arguments.questions as unknown[]) : [];
    // ⚠️ Indexed by id, and the spec list drives the loop rather than the
    // response. A model that returns four entries for six questions, or invents
    // a seventh, must not be able to add or drop a question — the set is the
    // templates' and the model only phrases it.
    const byId = new Map<string, Record<string, unknown>>();
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const value = entry as Record<string, unknown>;
      if (typeof value.id === 'string') byId.set(value.id, value);
    }

    const questions = specs.map((spec) => {
      const value = byId.get(spec.id);
      if (!value) return fallbackQuestion(spec);
      return {
        id: spec.id,
        docKind: spec.docKind,
        heading: spec.heading,
        question: text(value.question, spec.question),
        why: text(value.why, 'Nothing in a node graph records this — it has to come from you.'),
        guess: text(value.guess, '')
      };
    });

    return { state: interviewFrom(questions, toProposedDoc(call.arguments.proposedDoc)), costUsd };
  }
}

/** The specs this project's templates produce. Re-exported for the run. */
export { interviewQuestions };
