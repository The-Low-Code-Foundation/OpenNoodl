/**
 * AIX-010 — the review run: assemble once, draft three documents.
 * BLD-008 — and, in between, **ask**.
 *
 * Holds plain data and writes nothing, for the same structural reason every
 * other session in this phase does: rejecting the drafts must leave the project
 * byte-identical, and the cheapest way to guarantee that is for the code that
 * produces drafts to have no reference through which a write could happen. This
 * class never sees a `ProjectModel`, a `ProjectDocsModel` or the filesystem. Its
 * output is strings, and a separate, explicit call stages them for review.
 *
 * The drafts are sequential rather than concurrent, and each is told the
 * one-line summary of the ones before it. Three parallel turns from one context
 * write the same paragraph three times — the page map ends up in BRIEF.md and
 * ARCHITECTURE.md and, somehow, CONVENTIONS.md — and the user reviews the same
 * claim three times in three diffs. Sequential costs latency and buys a set of
 * documents that behave like a set.
 *
 * ## The run is two calls now, and the gap between them is a person
 *
 * `run()` assembles, asks the interview turn to phrase the questions, and
 * **stops** — `phase: 'interviewing'`, `busy: false`. `draft()` is what the
 * panel calls once the questions are settled.
 *
 * ⚠️ It is deliberately not one call that awaits the answers. A promise that
 * resolves when a human finishes typing is a promise nobody can cancel, reason
 * about or restart, and this interview is explicitly resumable across a panel
 * switch and a process restart. Two calls with the state in the store between
 * them is the shape that survives all three.
 *
 * ⚠️ Q3 (README, open): the interview **blocks** drafting. The alternative —
 * draft immediately and revise as answers arrive — reads as faster and
 * reproduces exactly the confident-guess problem this task exists to remove: the
 * user would be reading a finished-looking document while being asked what it
 * should have said.
 *
 * @module AiAssistant/review/ProjectReviewRun
 */

import { DOC_TEMPLATES, newDocTemplate } from '../../ProjectDocs/templates';
import type { KnownDocKind } from '../../ProjectDocs/docsText';
import type { AiEffort } from '../client/types';
import type { AuthoringChatFn } from '../authoring/AuthoringSession';
import type { ContextBudget } from '../authoring/types';
import type { ExplainGraph } from '../explain/types';
import {
  assembleProjectReview,
  renderCoverageForPrompt,
  renderProjectReviewContext,
  summariseCoverage
} from './assembleProject';
import { InterviewSession } from './InterviewSession';
import { interviewQuestions } from './interviewQuestions';
import { answersBlock } from './interviewPrompts';
import {
  decideProposal,
  emptyInterview,
  insertSkipTodos,
  isInterviewComplete,
  nothingSkipped,
  recordAnswer,
  recordSkip,
  reopen,
  type InterviewState
} from './interviewState';
import { REVIEW_DOC_PATHS } from './prompts';
import { ReviewDocSession } from './ReviewDocSession';
import type { ReviewDocOptions } from './ReviewDocSession';
import {
  REVIEW_DOC_ORDER,
  type ProjectReviewContext,
  type ProjectReviewDraft,
  type ProjectReviewSources,
  type ReviewDocKind
} from './types';

export type ProjectReviewPhase =
  | 'idle'
  | 'assembling'
  /** Questions are on screen and nothing is running. The only idle busy-free phase mid-run. */
  | 'interviewing'
  | 'drafting'
  | 'done'
  | 'cancelled'
  | 'error';

export interface ProjectReviewState {
  phase: ProjectReviewPhase;
  busy: boolean;
  /** Available as soon as assembly finishes — the panel shows coverage first. */
  context?: ProjectReviewContext;
  /**
   * BLD-008 — what was asked and what came back.
   *
   * Present from the moment the questions exist and kept through drafting, so a
   * user reading a draft can still see the answer it was written from.
   */
  interview?: InterviewState;
  /** Why the questions are in their plain phrasing, when they are. */
  interviewNote?: string;
  /** One entry per requested document, in order, updated as each completes. */
  drafts: ProjectReviewDraft[];
  /** The document currently being drafted. */
  current?: ReviewDocKind;
  error?: string;
  costUsd: number | null;
}

export interface ProjectReviewRunOptions extends ReviewDocOptions {
  budget?: Partial<ContextBudget>;
  /** Which seed documents to draft. Defaults to all three, in `REVIEW_DOC_ORDER`. */
  kinds?: readonly KnownDocKind[];
  effort?: AiEffort;
  chat?: AuthoringChatFn;
  /**
   * BLD-008 — ask before drafting. On by default; that inversion is the task.
   *
   * `false` restores the pre-BLD-008 pass — assemble, then draft, guessing and
   * marking the guesses — and is what the drafting-loop specs use so that a
   * mocked `chat` is not handed an interview turn it has no reply for.
   */
  interview?: boolean;
  /**
   * BLD-008 — an interview left unfinished by a quit, read back from disk.
   *
   * Present, it *replaces* the interview turn: the questions and the answers are
   * both already there, so making the call again would bill the user for
   * questions they have half-answered and — worse — could come back phrased
   * differently, leaving their answers sitting under sentences they never read.
   */
  resumeInterview?: InterviewState;
}

interface AssembledContext {
  rendered: string;
  coverage: string;
  coverageLine: string;
}

/** One document this run will draft. */
interface DraftJob {
  kind: ReviewDocKind;
  path: string;
  baseline: string | null;
  template?: string;
  /** `answersBlock` output, or absent when no interview ran. */
  answers?: string;
  /** `insertSkipTodos` bound to this document. See `ReviewDocSession.transform`. */
  transform?: (content: string) => string;
}

export class ProjectReviewRun {
  private state: ProjectReviewState = { phase: 'idle', busy: false, drafts: [], costUsd: 0 };
  private listeners = new Set<(state: ProjectReviewState) => void>();
  private abortController: AbortController | undefined;
  private readonly kinds: readonly KnownDocKind[];
  private readonly interviewEnabled: boolean;

  /** Kept from `run()` so `draft()` does not reassemble — assembly is the expensive read. */
  private assembled: AssembledContext | undefined;

  constructor(
    private readonly graph: ExplainGraph,
    private readonly sources: ProjectReviewSources = {},
    private readonly options: ProjectReviewRunOptions = {}
  ) {
    this.kinds = options.kinds ?? REVIEW_DOC_ORDER;
    this.interviewEnabled = options.interview ?? true;
  }

  getState(): ProjectReviewState {
    return this.state;
  }

  onChange(listener: (state: ProjectReviewState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish(patch: Partial<ProjectReviewState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  cancel(): void {
    this.abortController?.abort();
  }

  dispose(): void {
    this.cancel();
    this.listeners.clear();
  }

  /** The document baseline, as the caller's snapshot has it. `null` = no file. */
  private baseline(kind: KnownDocKind): string | null {
    const body = this.sources.docs?.[kind];
    return body === undefined ? null : body;
  }

  // ── The interview ───────────────────────────────────────────────────────────

  /**
   * Answer, decline or re-open a question.
   *
   * These publish rather than returning, because the interview is read from the
   * store by two surfaces and held in none of them — the same ownership the run
   * state has always had. A caller that mutated a copy would be the second
   * opinion this phase keeps removing.
   */
  answerQuestion(id: string, text: string): void {
    this.updateInterview((interview) => recordAnswer(interview, id, text));
  }

  skipQuestion(id: string): void {
    this.updateInterview((interview) => recordSkip(interview, id));
  }

  reopenQuestion(id: string): void {
    this.updateInterview((interview) => reopen(interview, id));
  }

  decideProposedDoc(accepted: boolean): void {
    this.updateInterview((interview) => decideProposal(interview, accepted));
  }

  /** Put a persisted interview back. See `InterviewSidecar`. */
  restoreInterview(interview: InterviewState): void {
    this.publish({ interview });
  }

  private updateInterview(change: (interview: InterviewState) => InterviewState): void {
    this.publish({ interview: change(this.state.interview ?? emptyInterview()) });
  }

  // ── Assemble, then ask ──────────────────────────────────────────────────────

  async run(): Promise<ProjectReviewState> {
    if (this.state.busy) return this.state;

    const abortController = new AbortController();
    this.abortController = abortController;

    this.publish({
      phase: 'assembling',
      busy: true,
      error: undefined,
      interview: undefined,
      interviewNote: undefined,
      costUsd: 0,
      drafts: this.kinds.map((kind) => ({
        kind,
        path: REVIEW_DOC_PATHS[kind],
        status: 'pending' as const,
        baseline: this.baseline(kind),
        todoCount: 0,
        lintFindings: [],
        costUsd: null,
        turns: 0
      }))
    });

    let context: ProjectReviewContext;
    try {
      context = assembleProjectReview(this.graph, this.sources, { budget: this.options.budget });
    } catch (error) {
      this.publish({
        phase: 'error',
        busy: false,
        error: error instanceof Error ? error.message : String(error)
      });
      return this.state;
    }

    this.assembled = {
      rendered: renderProjectReviewContext(context),
      coverage: renderCoverageForPrompt(context.coverage),
      coverageLine: summariseCoverage(context.coverage)
    };
    this.publish({ context });

    // `runDrafts`, not `draft()` — this run is already busy, by its own hand.
    if (!this.interviewEnabled) return this.runDrafts();

    // A resume: the questions and the answers are on disk already. One publish,
    // no call, straight to the question the user was on.
    const resumed = this.options.resumeInterview;
    if (resumed) {
      this.publish({ phase: 'interviewing', busy: false, interview: resumed });
      return this.state;
    }

    const specs = interviewQuestions().filter((spec) => this.kinds.includes(spec.docKind));
    const session = new InterviewSession(
      {
        context: this.assembled.rendered,
        coverage: this.assembled.coverage,
        specs,
        ...(this.sources.docs ? { existing: this.sources.docs } : {})
      },
      {
        ...(this.options.chat ? { chat: this.options.chat } : {}),
        ...(this.options.effort ? { effort: this.options.effort } : {})
      }
    );

    const outcome = await session.run({ abortController });
    if (abortController.signal.aborted) {
      this.publish({ phase: 'cancelled', busy: false });
      return this.state;
    }

    this.publish({
      phase: 'interviewing',
      busy: false,
      interview: outcome.state,
      ...(outcome.note ? { interviewNote: outcome.note } : {}),
      costUsd: outcome.costUsd
    });
    return this.state;
  }

  /** True once every question is settled — the panel's gate on offering to draft. */
  canDraft(): boolean {
    if (this.state.phase !== 'interviewing') return false;
    return !this.state.interview || isInterviewComplete(this.state.interview);
  }

  // ── Then draft ──────────────────────────────────────────────────────────────

  /**
   * Draft the documents the interview settled.
   *
   * ⚠️ The busy guard is **here and not in `runDrafts`**, and the difference is
   * a regression this task shipped and the suite caught. `run()` publishes
   * `busy: true` before it assembles, then — with the interview disabled —
   * delegates straight to the drafting loop; a guard inside that loop sees its
   * own caller's flag and returns immediately, leaving `phase: 'assembling'` and
   * three pending drafts. Every pre-BLD-008 run spec failed on it, which is
   * exactly what a suite written against the *old* flow is for. The guard
   * belongs on the entry point a user can press twice, not on the work.
   */
  async draft(): Promise<ProjectReviewState> {
    if (this.state.busy) return this.state;
    return this.runDrafts();
  }

  private async runDrafts(): Promise<ProjectReviewState> {
    const assembled = this.assembled;
    if (!assembled) {
      this.publish({ phase: 'error', busy: false, error: 'Nothing was assembled — start the review again.' });
      return this.state;
    }

    const abortController = new AbortController();
    this.abortController = abortController;
    const interview = this.state.interview;

    const jobs = this.draftJobs(interview);
    this.publish({
      phase: 'drafting',
      busy: true,
      error: undefined,
      drafts: jobs.map((job) => ({
        kind: job.kind,
        path: job.path,
        status: 'pending' as const,
        baseline: job.baseline,
        todoCount: 0,
        lintFindings: [],
        costUsd: null,
        turns: 0
      }))
    });

    const siblings: Array<{ path: string; summary: string }> = [];
    let costUsd: number | null = this.state.costUsd;

    for (const job of jobs) {
      if (abortController.signal.aborted) {
        this.publish({ phase: 'cancelled', busy: false, current: undefined });
        return this.state;
      }
      this.publish({ current: job.kind });

      const session = new ReviewDocSession(
        {
          kind: job.kind,
          path: job.path,
          context: assembled.rendered,
          coverage: assembled.coverage,
          coverageLine: assembled.coverageLine,
          baseline: job.baseline,
          template: job.template,
          siblings: [...siblings],
          ...(job.answers ? { answers: job.answers } : {}),
          ...(job.transform ? { transform: job.transform } : {})
        },
        {
          ...this.options,
          // ⚠️ The TODO advisory asks a draft with no TODO lines to add some.
          // On an interview where nothing was declined, "no TODO lines" is the
          // *goal* — acceptance criterion 2's first half — so leaving this on
          // would be a mechanism inside the feature arguing against it.
          ...(interview && nothingSkipped(interview) ? { todoAdvisory: false } : {})
        }
      );

      const outcome = await session.run({ abortController });
      costUsd = costUsd === null || outcome.costUsd === null ? null : costUsd + outcome.costUsd;

      const draft: ProjectReviewDraft = {
        kind: job.kind,
        path: job.path,
        status: outcome.status,
        content: outcome.content,
        baseline: job.baseline,
        summary: outcome.summary,
        note: outcome.note,
        todoCount: outcome.todoCount,
        lintFindings: outcome.lintFindings,
        costUsd: outcome.costUsd,
        turns: outcome.turns
      };

      this.publish({
        drafts: this.state.drafts.map((d) => (d.kind === job.kind ? draft : d)),
        costUsd
      });

      if (outcome.status === 'authored') {
        siblings.push({ path: job.path, summary: outcome.summary ?? `drafted (${outcome.content?.length ?? 0} chars)` });
      }
      if (outcome.status === 'cancelled') {
        this.publish({ phase: 'cancelled', busy: false, current: undefined });
        return this.state;
      }
    }

    this.publish({ phase: 'done', busy: false, current: undefined });
    return this.state;
  }

  /**
   * What this run will draft, in order — the seeds, then the invented one.
   *
   * The proposed document goes **last** so it is told about the three that came
   * before it and can defer to them; the three know nothing about it, which is
   * right, because it exists to hold what would not fit in them.
   */
  private draftJobs(interview: InterviewState | undefined): DraftJob[] {
    const jobs: DraftJob[] = this.kinds.map((kind) => ({
      kind,
      path: REVIEW_DOC_PATHS[kind],
      baseline: this.baseline(kind),
      template: DOC_TEMPLATES[kind],
      ...(interview ? { answers: answersBlock(interview, kind) } : {}),
      ...(interview ? { transform: (content: string) => insertSkipTodos(content, interview, kind) } : {})
    }));

    const proposal = interview?.proposedDoc;
    if (proposal && interview?.proposalAccepted) {
      jobs.push({
        kind: 'proposed',
        path: proposal.path,
        // A new file by construction — the interview proposes a name this
        // project does not have. If one appeared meanwhile, `proposeDocChange`
        // reads the real file at staging time, so the user still decides on a
        // truthful diff rather than a silent overwrite.
        baseline: null,
        template: newDocTemplate({ title: proposal.title, purpose: proposal.purpose, inject: proposal.inject })
      });
    }

    return jobs;
  }
}

/** Drafts that actually produced a file, in run order. */
export function authoredDrafts(state: ProjectReviewState): ProjectReviewDraft[] {
  return state.drafts.filter((d): d is ProjectReviewDraft & { content: string } =>
    d.status === 'authored' && typeof d.content === 'string'
  );
}
