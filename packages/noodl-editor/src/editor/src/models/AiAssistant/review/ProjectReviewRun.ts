/**
 * AIX-010 — the review run: assemble once, draft three documents.
 *
 * Holds plain data and writes nothing, for the same structural reason every
 * other session in this phase does: rejecting the drafts must leave the project
 * byte-identical, and the cheapest way to guarantee that is for the code that
 * produces drafts to have no reference through which a write could happen. This
 * class never sees a `ProjectModel`, a `ProjectDocsModel` or the filesystem. Its
 * output is three strings, and a separate, explicit call stages them for review.
 *
 * The three drafts are sequential rather than concurrent, and each is told the
 * one-line summary of the ones before it. Three parallel turns from one context
 * write the same paragraph three times — the page map ends up in BRIEF.md and
 * ARCHITECTURE.md and, somehow, CONVENTIONS.md — and the user reviews the same
 * claim three times in three diffs. Sequential costs latency and buys a set of
 * documents that behave like a set.
 *
 * @module AiAssistant/review/ProjectReviewRun
 */

import { DOC_TEMPLATES } from '../../ProjectDocs/templates';
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

export type ProjectReviewPhase = 'idle' | 'assembling' | 'drafting' | 'done' | 'cancelled' | 'error';

export interface ProjectReviewState {
  phase: ProjectReviewPhase;
  busy: boolean;
  /** Available as soon as assembly finishes — the panel shows coverage first. */
  context?: ProjectReviewContext;
  /** One entry per requested document, in order, updated as each completes. */
  drafts: ProjectReviewDraft[];
  /** The document currently being drafted. */
  current?: ReviewDocKind;
  error?: string;
  costUsd: number | null;
}

export interface ProjectReviewRunOptions extends ReviewDocOptions {
  budget?: Partial<ContextBudget>;
  /** Which documents to draft. Defaults to all three, in `REVIEW_DOC_ORDER`. */
  kinds?: readonly ReviewDocKind[];
  effort?: AiEffort;
  chat?: AuthoringChatFn;
}

export class ProjectReviewRun {
  private state: ProjectReviewState = { phase: 'idle', busy: false, drafts: [], costUsd: 0 };
  private listeners = new Set<(state: ProjectReviewState) => void>();
  private abortController: AbortController | undefined;
  private readonly kinds: readonly ReviewDocKind[];

  constructor(
    private readonly graph: ExplainGraph,
    private readonly sources: ProjectReviewSources = {},
    private readonly options: ProjectReviewRunOptions = {}
  ) {
    this.kinds = options.kinds ?? REVIEW_DOC_ORDER;
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
  private baseline(kind: ReviewDocKind): string | null {
    const body = this.sources.docs?.[kind];
    return body === undefined ? null : body;
  }

  async run(): Promise<ProjectReviewState> {
    if (this.state.busy) return this.state;

    const abortController = new AbortController();
    this.abortController = abortController;

    this.publish({
      phase: 'assembling',
      busy: true,
      error: undefined,
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

    const rendered = renderProjectReviewContext(context);
    const coverage = renderCoverageForPrompt(context.coverage);
    const coverageLine = summariseCoverage(context.coverage);
    this.publish({ phase: 'drafting', context });

    const siblings: Array<{ path: string; summary: string }> = [];
    let costUsd: number | null = 0;

    for (const kind of this.kinds) {
      if (abortController.signal.aborted) {
        this.publish({ phase: 'cancelled', busy: false, current: undefined });
        return this.state;
      }
      this.publish({ current: kind });

      const path = REVIEW_DOC_PATHS[kind];
      const baseline = this.baseline(kind);
      const session = new ReviewDocSession(
        {
          kind,
          path,
          context: rendered,
          coverage,
          coverageLine,
          baseline,
          template: DOC_TEMPLATES[kind],
          siblings: [...siblings]
        },
        this.options
      );

      const outcome = await session.run({ abortController });
      costUsd = costUsd === null || outcome.costUsd === null ? null : costUsd + outcome.costUsd;

      const draft: ProjectReviewDraft = {
        kind,
        path,
        status: outcome.status,
        content: outcome.content,
        baseline,
        summary: outcome.summary,
        note: outcome.note,
        todoCount: outcome.todoCount,
        lintFindings: outcome.lintFindings,
        costUsd: outcome.costUsd,
        turns: outcome.turns
      };

      this.publish({
        drafts: this.state.drafts.map((d) => (d.kind === kind ? draft : d)),
        costUsd
      });

      if (outcome.status === 'authored') {
        siblings.push({ path, summary: outcome.summary ?? `drafted (${outcome.content?.length ?? 0} chars)` });
      }
      if (outcome.status === 'cancelled') {
        this.publish({ phase: 'cancelled', busy: false, current: undefined });
        return this.state;
      }
    }

    this.publish({ phase: 'done', busy: false, current: undefined });
    return this.state;
  }
}

/** Drafts that actually produced a file, in run order. */
export function authoredDrafts(state: ProjectReviewState): ProjectReviewDraft[] {
  return state.drafts.filter((d): d is ProjectReviewDraft & { content: string } =>
    d.status === 'authored' && typeof d.content === 'string'
  );
}
