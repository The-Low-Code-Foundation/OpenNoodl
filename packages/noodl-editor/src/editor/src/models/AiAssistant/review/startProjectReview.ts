/**
 * AIX-010 — starting a review from the editor, and staging what it produced.
 *
 * The two calls the panels make. Kept apart from `ProjectReviewRun` on purpose:
 * the run produces strings and can be exercised end to end with no project on
 * disk, and *this* module is the only place a review turns into something a user
 * could accept. Criterion 7 — rejecting all three drafts leaves the project
 * byte-identical — is then a property of the code, not of the prompt: producing
 * drafts and staging them are different calls, and staging a proposal still
 * writes nothing (AIX-009's `DocProposalStore` holds them in memory until an
 * explicit accept).
 *
 * @module AiAssistant/review/startProjectReview
 */

import { currentProjectDocsModel, proposeDocChange, ProjectDocsModel } from '../../ProjectDocs';
import type { ProjectModel } from '../../projectmodel';
import { fromProjectModel } from '../explain/graph';
import { collectProjectReviewSources } from './collectSources';
import { ProjectReviewRun } from './ProjectReviewRun';
import type { ProjectReviewRunOptions, ProjectReviewState } from './ProjectReviewRun';
import { authoredDrafts } from './ProjectReviewRun';
import { PROJECT_REVIEW_CHANGED, ProjectReviewStore, REVIEW_SOURCE } from './ProjectReviewStore';
import type { ProjectReviewDraft } from './types';

export { PROJECT_REVIEW_CHANGED, ProjectReviewStore, REVIEW_SOURCE };

/** Thrown for the reasons a review cannot start at all. */
export class ProjectReviewSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectReviewSetupError';
  }
}

export interface StartProjectReviewOptions extends ProjectReviewRunOptions {
  /** Override the docs model. Defaults to the boot-installed one for the project. */
  docs?: ProjectDocsModel;
}

/**
 * Assemble, draft, and publish progress to `ProjectReviewStore` as it goes.
 *
 * Returns the run so a panel can cancel it. Nothing is staged here — see
 * `stageReviewDrafts`, which the panel calls when the run finishes and the user
 * asks to review the results.
 */
export async function startProjectReview(
  project: ProjectModel,
  options: StartProjectReviewOptions = {}
): Promise<{ run: ProjectReviewRun; state: ProjectReviewState }> {
  const docsModel = options.docs ?? currentProjectDocsModel() ?? ProjectDocsModel.forProject(project);
  if (!docsModel) {
    throw new ProjectReviewSetupError(
      'This project has never been saved to disk, so it has nowhere to put a docs folder. Save it first.'
    );
  }

  // The docs as they stand *now* — the drafts are diffs against these, and a
  // re-run on a documented project must edit rather than replace.
  const docs = await docsModel.content();
  const sources = await collectProjectReviewSources(project, docs);
  const run = new ProjectReviewRun(fromProjectModel(project), sources, options);

  const store = ProjectReviewStore.instance;
  run.onChange((state) => store.setState(state));
  store.setState(run.getState());

  const state = await run.run();
  store.setState(state);
  return { run, state };
}

export interface StagedReviewDraft {
  draft: ProjectReviewDraft;
  proposalId: string;
}

/**
 * Stage the authored drafts as AIX-009 doc proposals — the existing review path,
 * with its existing diff view, accept and undo.
 *
 * Still writes nothing: `proposeDocChange` reads the file to get a truthful
 * baseline and holds the proposal in memory. The user accepts each file
 * independently in the Docs panel, and rejecting all three is the absence of any
 * accept call.
 */
export async function stageReviewDrafts(
  state: ProjectReviewState,
  docsModel?: ProjectDocsModel
): Promise<StagedReviewDraft[]> {
  const docs = docsModel ?? currentProjectDocsModel();
  if (!docs) {
    throw new ProjectReviewSetupError('There is no docs folder to propose changes against.');
  }

  const staged: StagedReviewDraft[] = [];
  for (const draft of authoredDrafts(state)) {
    const proposal = await proposeDocChange(docs, {
      path: draft.path,
      proposed: draft.content,
      source: REVIEW_SOURCE
    });
    staged.push({ draft, proposalId: proposal.id });
  }
  return staged;
}
