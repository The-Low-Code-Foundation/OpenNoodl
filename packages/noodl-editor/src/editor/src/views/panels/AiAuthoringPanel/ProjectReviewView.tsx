/**
 * AIX-010 — running the retrofit, and showing what it was worth.
 *
 * Three things happen here, and only the first is the obvious one:
 *
 *  1. The review runs — assemble, then draft BRIEF, ARCHITECTURE and CONVENTIONS
 *     in turn. Nothing is written; the run produces strings.
 *  2. **The coverage is shown, before anything can be accepted.** Criterion 4.
 *     A user looking at three confident-looking documents should be able to see
 *     that they were written from 8 of their 55 components, not assume the
 *     assistant read the lot. That summary is not a footnote — it is what tells
 *     them how hard to read the drafts.
 *  3. The drafts are staged as AIX-009 doc proposals, which is where the review
 *     actually happens: each file is a diff in the Docs panel, accepted or
 *     rejected independently. Rejecting all three is the absence of an accept
 *     call, so it leaves the project byte-identical.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/ProjectReviewView
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  PROJECT_REVIEW_CHANGED,
  ProjectReviewSetupError,
  ProjectReviewStore,
  stageReviewDrafts,
  startProjectReview,
  summariseCoverage,
  type ProjectReviewCoverage,
  type ProjectReviewDraft,
  type ProjectReviewState
} from '@noodl-models/AiAssistant/review';
import type { ProjectReviewRun } from '@noodl-models/AiAssistant/review';
import { acceptLabel, DISCARD_LABEL, REVIEW_LABEL } from '@noodl-models/AiAssistant/thread';
import { ProjectModel } from '@noodl-models/projectmodel';

import {
  currentProjectDocsModel,
  DOC_PROPOSALS_CHANGED,
  DocProposalStore,
  type DocProposal
} from '../../../models/ProjectDocs';
import { openDocsPanelAt } from '../DocsPanel/docsPanelRoute';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './ProjectReviewBanner.module.scss';
import { ThreadBody } from './thread/ThreadBody';

// No module-level group constant here: a shared string is the bug
// `ProjectReviewBanner.subscribeReviewVisibility` documents — `Model.off(group)`
// splices every listener with that group out of one registry, so two mounts of
// the same component unsubscribe each other. This view has one mount site
// today, which makes a second one a silent regression rather than a loud one.
// Each subscription binds with its own context token instead.

/**
 * What the review read and what it did not — criterion 4's user-facing half.
 *
 * Shown in both panels, from the same `ProjectReviewCoverage` the prompt was
 * rendered from, so the model and the human are never told different stories
 * about how complete the draft is.
 */
export function ReviewCoverageSummary({ coverage }: { coverage: ProjectReviewCoverage }) {
  const [expanded, setExpanded] = useState(false);
  const notRead = coverage.notRead;

  return (
    <div className={css['Coverage']}>
      <Text textType={TextType.Secondary}>{summariseCoverage(coverage)}</Text>
      {notRead.length > 0 && (
        <Text textType={TextType.Shy}>
          {notRead.length} component{notRead.length === 1 ? ' was' : 's were'} not read — anything the drafts say
          about {notRead.length === 1 ? 'it' : 'them'} is inference.
        </Text>
      )}
      <PrimaryButton
        label={expanded ? 'Hide what was read' : 'Show what was read'}
        size={PrimaryButtonSize.Small}
        variant={PrimaryButtonVariant.Ghost}
        isFitContent
        onClick={() => setExpanded(!expanded)}
      />
      {expanded && (
        <ul className={css['CoverageList']}>
          {coverage.read.map((entry) => (
            <li key={entry.name}>
              <Text textType={TextType.Shy}>
                Read {entry.name} — {entry.reason}
              </Text>
            </li>
          ))}
          {notRead.map((entry) => (
            <li key={entry.name}>
              <Text textType={TextType.Shy}>
                Not read: {entry.name} — {entry.reason}
              </Text>
            </li>
          ))}
          {coverage.sources.map((source) => (
            <li key={source.name}>
              <Text textType={TextType.Shy}>
                {source.name}: {source.status}
                {source.detail ? ` — ${source.detail}` : ''}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function draftIcon(draft: ProjectReviewDraft): { icon: IconName; variant?: FeedbackType } {
  switch (draft.status) {
    case 'authored':
      return { icon: IconName.Check, variant: FeedbackType.Success };
    case 'declined':
      // "ARCHITECTURE.md already says this" is often the right answer. Flagging
      // it red would teach people to ignore the row — the AIX-011 rule.
      return { icon: IconName.Close };
    case 'error':
      return { icon: IconName.WarningCircleFilled, variant: FeedbackType.Danger };
    case 'pending':
      return { icon: IconName.CaretRight };
    default:
      return { icon: IconName.WarningTriangle, variant: FeedbackType.Notice };
  }
}

function draftDetail(draft: ProjectReviewDraft): string | undefined {
  if (draft.status === 'authored') {
    const size = `${draft.baseline === null ? 'New file' : 'Edited'}, ${draft.content?.length ?? 0} characters`;
    const todos = `${draft.todoCount} TODO${draft.todoCount === 1 ? '' : 's'} for you to confirm`;
    return draft.summary ? `${size} · ${todos} — ${draft.summary}` : `${size} · ${todos}`;
  }
  return draft.note;
}

export interface ProjectReviewViewProps {
  isConfigured: boolean;
  hasProject: boolean;
  /**
   * BLD-001 removed the only caller.
   *
   * It meant "the user arrived by clicking the recommendation banner, so their
   * click *is* the start". With no scope tabs there is no mount to trigger on,
   * and the banner now prefills the composer instead — the request is visible
   * before it runs, which is strictly more of what the flag was protecting
   * ("no path to a review a person did not ask for"). Kept because the
   * behaviour is still correct and BLD-009's second host may want it; the day
   * nothing plausibly wants it, delete it rather than leaving it inert.
   */
  startImmediately?: boolean;
  /**
   * BLD-001 — rendered as an outcome card in the thread rather than as the
   * panel. The thread owns the scrolling and the request; the run, the
   * coverage summary and the per-file staging are unchanged.
   */
  isEmbedded?: boolean;
}

export function ProjectReviewView({
  isConfigured,
  hasProject,
  startImmediately,
  isEmbedded
}: ProjectReviewViewProps) {
  const [state, setState] = useState<ProjectReviewState | null>(() => ProjectReviewStore.instance.getState());
  const [note, setNote] = useState<{ text: string; type: FeedbackType } | null>(null);
  const runRef = useRef<ProjectReviewRun | null>(null);

  // ── BLD-003 D8: the drafts are decided here, not handed to another panel ────
  //
  // What was here was a button reading "Review 3 drafts in the Docs panel" and,
  // after it, the sentence "3 documents are waiting in the Docs panel". Both
  // are the same instruction: go somewhere else to decide something you are
  // already looking at. The drafts are now staged as soon as the run finishes
  // and each one carries its own Accept / Review changes / Discard.
  const [proposals, setProposals] = useState<readonly DocProposal[]>(() => DocProposalStore.instance.list());
  /** What the user did with each path, since an answered proposal leaves the store. */
  const [decided, setDecided] = useState<Record<string, 'accepted' | 'discarded'>>({});
  const stagingRef = useRef(false);

  useEffect(() => {
    const store = ProjectReviewStore.instance;
    const context = {};
    store.on(PROJECT_REVIEW_CHANGED, () => setState(store.getState()), context);
    return () => {
      store.off(context);
    };
  }, []);

  useEffect(() => () => runRef.current?.dispose(), []);

  useEffect(() => {
    const store = DocProposalStore.instance;
    const context = {};
    store.on(DOC_PROPOSALS_CHANGED, () => setProposals([...store.list()]), context);
    return () => {
      store.off(context);
    };
  }, []);

  const start = useCallback(async () => {
    const project = ProjectModel.instance;
    if (!project) return;
    setNote(null);
    setDecided({});
    stagingRef.current = false;
    try {
      const { run } = await startProjectReview(project);
      runRef.current = run;
    } catch (error) {
      setNote({
        text:
          error instanceof ProjectReviewSetupError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error),
        type: FeedbackType.Danger
      });
    }
  }, []);

  // The banner's click, honoured once. Guarded on there being no run already:
  // remounting the view (a scope toggle, an HMR reload) must not start a second.
  const started = useRef(false);
  useEffect(() => {
    if (!startImmediately || started.current) return;
    if (!hasProject || !isConfigured) return;
    if (ProjectReviewStore.instance.getState()?.busy) return;
    started.current = true;
    void start();
  }, [startImmediately, hasProject, isConfigured, start]);

  const busy = Boolean(state?.busy);
  const authored = state?.drafts.filter((d) => d.status === 'authored') ?? [];
  const finished = state?.phase === 'done' || state?.phase === 'cancelled';

  /**
   * Stage the drafts the moment the run finishes, rather than behind a button.
   *
   * ⚠️ Staging writes nothing. `proposeDocChange` reads the file to get a
   * truthful baseline and holds the proposal in memory — the AIX-009 guarantee
   * is that *reject leaves the file byte-identical*, and it holds because
   * nothing on this path touches disk. So there is no decision to gate behind a
   * click here, which is why the click could go: it was asking permission to
   * prepare a diff.
   *
   * The ref guard is not belt-and-braces. This effect depends on `state`, which
   * changes identity on every store notification, and `proposeDocChange`
   * replaces the pending proposal for a path — so an unguarded second pass
   * would silently swap the proposal the user is mid-decision on for a fresh
   * one with a new id.
   */
  useEffect(() => {
    if (!finished || !state || authored.length === 0 || stagingRef.current) return;
    stagingRef.current = true;
    void (async () => {
      try {
        await stageReviewDrafts(state);
      } catch (error) {
        setNote({ text: error instanceof Error ? error.message : String(error), type: FeedbackType.Danger });
      }
    })();
  }, [finished, state, authored.length]);

  const proposalFor = useCallback(
    (path: string) => proposals.find((proposal) => proposal.path === path),
    [proposals]
  );

  const acceptDraft = useCallback(async (proposal: DocProposal) => {
    const docs = currentProjectDocsModel();
    if (!docs) {
      setNote({ text: 'There is no docs folder to write to.', type: FeedbackType.Danger });
      return;
    }
    try {
      await DocProposalStore.instance.accept(proposal.id, docs);
      setDecided((previous) => ({ ...previous, [proposal.path]: 'accepted' }));
    } catch (error) {
      // A `DocsConflictError` means the file moved under the proposal. It stays
      // pending and the file is untouched, so the honest thing is to say so and
      // leave the buttons where they are.
      setNote({ text: error instanceof Error ? error.message : String(error), type: FeedbackType.Danger });
    }
  }, []);

  const discardDraft = useCallback((proposal: DocProposal) => {
    DocProposalStore.instance.reject(proposal.id);
    setDecided((previous) => ({ ...previous, [proposal.path]: 'discarded' }));
  }, []);

  return (
    <>
      <Section variant={SectionVariant.PanelShy} hasGutter>
        <VStack UNSAFE_style={{ gap: 8 }}>
          {!isConfigured && (
            <HStack UNSAFE_style={{ alignItems: 'center', gap: 6 }}>
              <Icon icon={IconName.WarningTriangle} variant={FeedbackType.Notice} size={IconSize.Small} />
              <Text textType={TextType.Secondary}>
                No AI provider is configured. Open Editor Settings to set one up.
              </Text>
            </HStack>
          )}
          {!hasProject && <Text textType={TextType.Secondary}>Open a project to review it.</Text>}

          {/* BLD-001: "Review this project" is the thread's composer now —
              asking for the docs is a request like any other, and a start
              button that only appears in one of three modes was D1. */}
          {!isEmbedded && !busy && (
            <PrimaryButton
              label={state ? 'Review again' : 'Review this project'}
              icon={IconName.MagicWand}
              isDisabled={!hasProject || !isConfigured}
              isGrowing
              onClick={() => void start()}
            />
          )}
          {busy && (
            <PrimaryButton
              label="Stop"
              variant={PrimaryButtonVariant.Ghost}
              isGrowing
              onClick={() => runRef.current?.cancel()}
            />
          )}
        </VStack>
      </Section>

      <ThreadBody isEmbedded={isEmbedded}>
          <VStack UNSAFE_style={{ gap: 12 }}>
            {!state && !note && (
              <Text textType={TextType.Shy}>
                The assistant reads your project — its pages, its data model, and the components that carry the
                most of it — and drafts the three context documents for you to correct. It reads what it can
                afford and tells you what it skipped. Nothing is written until you accept each file.
              </Text>
            )}

            {state?.phase === 'assembling' && <Text textType={TextType.Secondary}>Reading the project…</Text>}

            {state?.context && <ReviewCoverageSummary coverage={state.context.coverage} />}

            {state && state.drafts.length > 0 && (
              <VStack UNSAFE_style={{ gap: 8 }}>
                {state.drafts.map((draft) => {
                  const { icon, variant } = draftIcon(draft);
                  const detail = draftDetail(draft);
                  const isCurrent = state.current === draft.kind && state.busy;
                  const proposal = draft.status === 'authored' ? proposalFor(draft.path) : undefined;
                  const outcome = decided[draft.path];
                  return (
                    <VStack key={draft.kind} UNSAFE_style={{ gap: 2 }}>
                      <HStack UNSAFE_style={{ alignItems: 'center', gap: 6 }}>
                        <Icon icon={isCurrent ? IconName.MagicWand : icon} variant={variant} size={IconSize.Small} />
                        <Text textType={TextType.Secondary}>
                          {draft.path}
                          {isCurrent ? ' — drafting…' : ''}
                        </Text>
                      </HStack>
                      {detail && <Text textType={TextType.Shy}>{detail}</Text>}
                      {draft.lintFindings.length > 0 && (
                        <Text textType={TextType.Shy}>
                          {draft.lintFindings.length} line
                          {draft.lintFindings.length === 1 ? '' : 's'} still describe the graph — worth checking in
                          the diff.
                        </Text>
                      )}

                      {/* BLD-003 — the decision on this draft, on this draft.
                          `proposal` is the subject: while one is pending the
                          file is untouched and both answers are still open, so
                          the controls belong here and nowhere else. */}
                      {proposal && (
                        <HStack UNSAFE_style={{ gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                          <PrimaryButton
                            label={acceptLabel(proposal.baseline === null ? 'create' : 'update')}
                            size={PrimaryButtonSize.Small}
                            icon={IconName.Check}
                            isFitContent
                            onClick={() => void acceptDraft(proposal)}
                          />
                          <PrimaryButton
                            label={REVIEW_LABEL}
                            size={PrimaryButtonSize.Small}
                            variant={PrimaryButtonVariant.Ghost}
                            isFitContent
                            onClick={() => openDocsPanelAt(proposal.path)}
                          />
                          <PrimaryButton
                            label={DISCARD_LABEL}
                            size={PrimaryButtonSize.Small}
                            variant={PrimaryButtonVariant.Ghost}
                            isFitContent
                            onClick={() => discardDraft(proposal)}
                          />
                        </HStack>
                      )}
                      {!proposal && outcome === 'accepted' && (
                        <HStack UNSAFE_style={{ alignItems: 'center', gap: 6 }}>
                          <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
                          <Text textType={TextType.Shy}>Written — one undo puts the previous version back.</Text>
                        </HStack>
                      )}
                      {!proposal && outcome === 'discarded' && (
                        <Text textType={TextType.Shy}>Discarded — the file is untouched.</Text>
                      )}
                    </VStack>
                  );
                })}
              </VStack>
            )}

            {state?.phase === 'error' && (
              <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                <Icon icon={IconName.WarningCircleFilled} variant={FeedbackType.Danger} size={IconSize.Small} />
                <Text textType={TextType.Secondary}>{state.error}</Text>
              </HStack>
            )}

            {/* The hand-off's remaining half: the advice, without the errand.
                It sits above the drafts' own controls rather than replacing
                them, because it is about how to read them, not where to go. */}
            {finished && authored.length > 0 && (
              <Text textType={TextType.Shy}>
                Read the coverage above before you read the drafts — every TODO line is a question the graph
                could not answer. Nothing is written until you accept each file.
              </Text>
            )}

            {finished && authored.length === 0 && (
              <Text textType={TextType.Secondary}>
                The review produced no drafts. That is a real outcome — there may be too little here to write
                down yet.
              </Text>
            )}

            {note && (
              <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                <Icon
                  icon={note.type === FeedbackType.Danger ? IconName.WarningCircleFilled : IconName.Check}
                  variant={note.type}
                  size={IconSize.Small}
                />
                <Text textType={TextType.Secondary}>{note.text}</Text>
              </HStack>
            )}
          </VStack>
      </ThreadBody>
    </>
  );
}
