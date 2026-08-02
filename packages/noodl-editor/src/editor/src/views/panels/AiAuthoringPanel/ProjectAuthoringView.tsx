/**
 * AIX-011 — Project scope in the Build panel
 *
 * Describe a change that spans components; approve (and prune) the plan the
 * agent proposes; watch each operation author through the unchanged
 * single-component loop; review per component; then apply everything as ONE
 * undoable step — or abandon and leave zero trace.
 *
 * The view owns presentation only. The plan comes from `PlanningSession`,
 * execution from `PlanRun` (both plain-data, project-untouching), and the
 * single write is `applyAuthoredPlan`, called exactly once with the complete
 * accepted set. Partial application exists only as the explicit "Apply N of
 * M" the user reads before clicking (criterion 5).
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/ProjectAuthoringView
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  applyAuthoredPlan,
  buildChangeSet,
  graphComponentFromFiles,
  materializeSelection,
  pathToLegacyName,
  PlanningSession,
  PlanRun,
  planExcludedWith,
  planRequiredWith,
  StagingError,
  validateCandidateComponent,
  type AuthoringPlan,
  type ComponentFiles,
  type PlanOperationState,
  type PlanRunState
} from '@noodl-models/AiAssistant/authoring';
import { fromProjectModel } from '@noodl-models/AiAssistant/explain/graph';
// Imported from the module rather than the `scoping` barrel: the barrel pulls
// `ScopingSession` (the AI client) and `scopeDocs` (the platform filesystem),
// and this seam is a plain-data handover that needs neither.
import { takePendingScopePlan, type PendingScopePlan } from '@noodl-models/AiAssistant/scoping/pendingPlan';
import { AppRegistry } from '@noodl-models/app_registry';
import { createPlanDocWriter, ProjectDocsModel } from '@noodl-models/ProjectDocs';
import { ProjectModel } from '@noodl-models/projectmodel';
import { buildEffectiveTokens, buildStyleVocabulary, readStoredTokens } from '@noodl-models/StyleTokensModel';

import { buildComponentV2Files } from '../../../io/ProjectExporter';
import { formatDiagnosticLine } from '../../../validation';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextArea } from '@noodl-core-ui/components/inputs/TextArea';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { ScrollArea } from '@noodl-core-ui/components/layout/ScrollArea';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { ChangeReviewDocumentProvider } from '../../documents/ChangeReviewDocument';
import { ActivityRow } from './AiAuthoringPanel';
import { PlanDocReviewDialog } from './PlanDocReviewDialog';

/**
 * The docs of the open project, or `undefined` when it has never been saved —
 * an unsaved project has no folder to put a `docs/` in, which is the one case
 * where doc operations genuinely cannot be applied.
 */
function projectDocs(): ProjectDocsModel | undefined {
  return ProjectDocsModel.forProject(ProjectModel.instance);
}

function statusIcon(state: PlanOperationState): { icon: IconName; variant?: FeedbackType } {
  if (state.status === 'staged' && state.operation.kind === 'doc') {
    return { icon: IconName.File, variant: FeedbackType.Success };
  }
  switch (state.status) {
    case 'staged':
      return { icon: IconName.Check, variant: FeedbackType.Success };
    case 'failed':
      return { icon: IconName.WarningTriangle, variant: FeedbackType.Danger };
    case 'authoring':
      return { icon: IconName.MagicWand };
    case 'skipped':
      return { icon: IconName.Close };
    default:
      return { icon: IconName.CaretRight };
  }
}

/** One line describing a staged/failed operation, under its row. */
function operationDetail(state: PlanOperationState): string | undefined {
  if (state.status === 'failed' || state.status === 'skipped') return state.error;
  if (state.status === 'staged' && state.stagedDoc) {
    const { chars, created, summary } = state.stagedDoc;
    const size = `${created ? 'New file' : 'Rewritten'}, ${chars} characters`;
    return summary ? `${size} — ${summary}` : size;
  }
  return undefined;
}

export interface ProjectAuthoringViewProps {
  isConfigured: boolean;
  hasProject: boolean;
}

export function ProjectAuthoringView({ isConfigured, hasProject }: ProjectAuthoringViewProps) {
  // AIX-012 handover: a plan agreed in the launcher's scoping conversation,
  // which created this project minutes ago and deliberately did not build it.
  //
  // Consumed here rather than in the panel because the plan state lives here,
  // and taken once at first render — the same one-shot ref the AIX-010 banner
  // request uses, for the same reason: two consumers of a destructive `take`
  // would race, and the loser would silently show no plan.
  //
  // It arrives as an ordinary proposed plan, not an approved one. Every row is
  // still prunable and nothing reaches the project until Apply, so a plan
  // agreed in a conversation gets exactly the same gate as one typed here.
  const arrivedWithPlan = useRef<PendingScopePlan | undefined | 'unread'>('unread');
  if (arrivedWithPlan.current === 'unread') {
    arrivedWithPlan.current = takePendingScopePlan(ProjectModel.instance?.id);
  }
  const scopePlan = arrivedWithPlan.current;

  const [description, setDescription] = useState('');
  const [planBusy, setPlanBusy] = useState(false);
  const [plan, setPlan] = useState<AuthoringPlan | null>(scopePlan?.plan ?? null);
  const [note, setNote] = useState<{ text: string; type: FeedbackType } | null>(
    scopePlan
      ? {
          text:
            `From the scoping conversation that created this project — ${scopePlan.plan.operations.length} ` +
            `operation${scopePlan.plan.operations.length === 1 ? '' : 's'}. Nothing has been built yet. Drop ` +
            `anything you have changed your mind about, then author it. The conversation is recorded in ` +
            `${scopePlan.recordPath}.`,
          type: FeedbackType.Notice
        }
      : null
  );
  const [runState, setRunState] = useState<PlanRunState | null>(null);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [applied, setApplied] = useState<{ count: number; docs: string[] } | null>(null);
  const [reviewingDoc, setReviewingDoc] = useState<string | null>(null);

  const runRef = useRef<PlanRun | null>(null);
  const planAbortRef = useRef<AbortController | null>(null);

  // Whether doc operations can be applied at all. Recomputed when a run starts:
  // a project saved for the first time mid-session gains a docs folder.
  const [docsAvailable, setDocsAvailable] = useState<boolean>(() => projectDocs() !== undefined);

  useEffect(() => () => runRef.current?.dispose(), []);

  const reset = useCallback(() => {
    runRef.current?.dispose();
    runRef.current = null;
    setPlan(null);
    setRunState(null);
    setExcluded(new Set());
    setReviewingDoc(null);
    setNote(null);
  }, []);

  const startPlanning = useCallback(async () => {
    const project = ProjectModel.instance;
    if (!project || !description.trim()) return;
    reset();
    setApplied(null);
    setPlanBusy(true);
    try {
      const session = new PlanningSession(fromProjectModel(project), description.trim());
      planAbortRef.current = new AbortController();
      const outcome = await session.run({ abortController: planAbortRef.current });
      if (outcome.status === 'planned' && outcome.plan) {
        setPlan(outcome.plan);
      } else if (outcome.status === 'declined') {
        setNote({ text: outcome.note ?? 'The agent declined to plan this request.', type: FeedbackType.Notice });
      } else if (outcome.status === 'cancelled') {
        setNote({ text: 'Planning cancelled. Nothing happened.', type: FeedbackType.Notice });
      } else {
        setNote({ text: outcome.note ?? 'Could not produce a plan for this request.', type: FeedbackType.Danger });
      }
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : String(e), type: FeedbackType.Danger });
    } finally {
      planAbortRef.current = null;
      setPlanBusy(false);
    }
  }, [description, reset]);

  const dropOperation = useCallback(
    (id: string) => {
      if (!plan) return;
      const operations = plan.operations.filter((op) => op.id !== id);
      if (operations.length === 0) setPlan(null);
      else setPlan({ ...plan, operations });
    },
    [plan]
  );

  const authorPlan = useCallback(async () => {
    const project = ProjectModel.instance;
    if (!project || !plan) return;
    const styleOptions = {
      styleVocabulary: buildStyleVocabulary(project),
      styleTokenRecords: Array.from(buildEffectiveTokens(readStoredTokens(project)).values())
    };
    const docs = projectDocs();
    setDocsAvailable(docs !== undefined);
    const run = new PlanRun(fromProjectModel(project), plan, {
      baseFilesFor: (legacyName) => {
        const existing = project.getComponentWithName(legacyName);
        return existing
          ? (buildComponentV2Files(existing.toJSON(), new Date().toISOString()) as ComponentFiles)
          : undefined;
      },
      // The doc turn reads the file it is about to rewrite; the same bytes
      // become the write path's drift baseline. `PlanRun` never touches a
      // filesystem itself — this is the only seam through which it sees one.
      docBaselineFor: docs ? (relPath: string) => docs.read(relPath) : undefined,
      session: styleOptions
    });
    runRef.current = run;
    run.onChange(setRunState);
    setRunState(run.state);
    await run.run();
  }, [plan]);

  const excludeOperation = useCallback((id: string) => {
    const run = runRef.current;
    if (!run) return;
    setExcluded((current) => planExcludedWith(run.requires(), [...current, id]));
  }, []);

  const restoreOperation = useCallback((id: string) => {
    const run = runRef.current;
    if (!run) return;
    const needed = planRequiredWith(run.requires(), [id]);
    setExcluded((current) => new Set([...current].filter((entry) => !needed.has(entry))));
  }, []);

  const reviewOperation = useCallback((id: string) => {
    const run = runRef.current;
    const project = ProjectModel.instance;
    const files = run?.filesFor(id);
    if (!run || !project || !files) return;
    const operation = run.plan.operations.find((op) => op.id === id);
    const changeSet = buildChangeSet(project, files);
    AppRegistry.instance.openDocument(ChangeReviewDocumentProvider.ID, {
      changeSet,
      title: `Review ${operation?.target ?? id} — plan operation`,
      acceptLabel: 'Keep',
      contextNote:
        'This is one operation of a plan. Keeping a selection updates the plan — nothing reaches your project ' +
        'until you apply the whole plan.',
      // Plan mode: accepting a (possibly partial) selection re-stages it on the
      // operation. NOTHING reaches the project until the plan is applied.
      //
      // WFA-007 moved materialisation out of the review document — it is the
      // COMPONENT materializer, and a document that renders a diff should not
      // know that a component is three JSON files. Behaviour is unchanged.
      onAccept: (rejected: ReadonlySet<string>) => {
        run.setOperationFiles(id, materializeSelection(changeSet, files, rejected).files);
        return null;
      },
      onReject: () => excludeOperation(id)
    });
  }, [excludeOperation]);

  const applyPlan = useCallback(async () => {
    const run = runRef.current;
    const project = ProjectModel.instance;
    if (!run || !project) return;
    const docWriter = createPlanDocWriter(projectDocs());
    const { operations } = run.acceptedOperations(excluded, { includeDocs: docWriter !== undefined });
    if (operations.length === 0) return;

    // Belt-and-braces: the same gate that validated each candidate during
    // authoring re-validates the final selection against the live project,
    // with earlier accepted operations visible to later ones.
    const graph = fromProjectModel(project);
    let components = [...graph.components];
    for (const op of operations) {
      if (op.kind === 'doc') continue;
      const legacyName = pathToLegacyName(op.operation.target);
      const validation = validateCandidateComponent({ components }, legacyName, op.files);
      if (!validation.ok) {
        const lines = validation.errors.slice(0, 3).map(formatDiagnosticLine);
        setNote({
          text: `"${op.operation.target}" is no longer valid: ${lines.join(' · ')}`,
          type: FeedbackType.Danger
        });
        return;
      }
      // Extend with the accepted candidate so later operations validate
      // against it (the same working-copy trick as the run itself).
      components = [...components.filter((c) => c.name !== legacyName), graphComponentFromFiles(legacyName, op.files)];
    }

    try {
      const result = await applyAuthoredPlan(project, operations, { docWriter });
      setApplied({ count: result.components.size, docs: result.docs });
      reset();
      setDescription('');
    } catch (e) {
      setNote({
        text: e instanceof StagingError ? e.message : e instanceof Error ? e.message : String(e),
        type: FeedbackType.Danger
      });
    }
  }, [excluded, reset]);

  const abandon = useCallback(() => {
    // Abandon is the absence of an apply call: drop everything, nothing was written.
    reset();
  }, [reset]);

  const done = runState?.phase === 'done' || runState?.phase === 'cancelled';
  const stagedCount =
    runState?.operations.filter((op) => op.status === 'staged' && op.operation.kind !== 'doc').length ?? 0;
  const failedOps = runState?.operations.filter((op) => op.status === 'failed') ?? [];
  const stagedDocOps = runState?.operations.filter((op) => op.status === 'staged' && op.operation.kind === 'doc') ?? [];
  const applyCount = done
    ? runRef.current?.acceptedOperations(excluded, { includeDocs: docsAvailable }).operations.length ?? 0
    : 0;
  const totalComponentOps = runState ? runState.operations.filter((op) => op.operation.kind !== 'doc').length : 0;
  const totalOps = runState?.operations.length ?? 0;
  const reviewedDoc = reviewingDoc ? runRef.current?.docFor(reviewingDoc) : undefined;

  return (
    <>
      <Section variant={SectionVariant.PanelShy} hasGutter>
        <VStack UNSAFE_style={{ gap: 8 }}>
          {!plan && !runState && (
            <>
              <TextArea
                value={description}
                label="What should change?"
                placeholder="Wire the Checkout page into the app — link it from Cart and register its route…"
                onChange={(event) => setDescription(event.target.value)}
              />
              <PrimaryButton
                label={planBusy ? 'Planning…' : 'Plan it'}
                icon={IconName.MagicWand}
                isDisabled={!hasProject || !isConfigured || !description.trim() || planBusy}
                isGrowing
                onClick={startPlanning}
              />
              {planBusy && (
                <PrimaryButton
                  label="Stop"
                  variant={PrimaryButtonVariant.Ghost}
                  isGrowing
                  onClick={() => planAbortRef.current?.abort()}
                />
              )}
            </>
          )}
          {runState?.busy && (
            <PrimaryButton
              label="Stop"
              variant={PrimaryButtonVariant.Ghost}
              isGrowing
              onClick={() => runRef.current?.cancel()}
            />
          )}
        </VStack>
      </Section>

      <ScrollArea>
        <Box hasXSpacing hasYSpacing UNSAFE_style={{ width: '100%' }}>
          <VStack UNSAFE_style={{ gap: 10 }}>
            {note && (
              <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                <Icon
                  icon={note.type === FeedbackType.Danger ? IconName.WarningCircleFilled : IconName.WarningTriangle}
                  variant={note.type}
                  size={IconSize.Small}
                />
                <Text textType={TextType.Secondary}>{note.text}</Text>
              </HStack>
            )}

            {applied && (
              <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
                <Text textType={TextType.Secondary}>
                  Applied the plan — {applied.count} component{applied.count === 1 ? '' : 's'} changed
                  {applied.docs.length > 0 ? `, ${applied.docs.join(' and ')} written` : ''}. This was one edit: a
                  single undo reverts all of it.
                </Text>
              </HStack>
            )}

            {!plan && !runState && !note && !applied && (
              <Text textType={TextType.Shy}>
                Describe a change that spans components — the agent proposes a plan first, you approve or prune it,
                and nothing is authored until you do. Deleting components cannot be planned. After authoring, the
                whole plan applies as one undoable step.
              </Text>
            )}

            {plan && !runState && (
              <VStack UNSAFE_style={{ gap: 8 }}>
                <Text textType={TextType.Secondary}>
                  The plan — {plan.operations.length} operation{plan.operations.length === 1 ? '' : 's'}. Drop what
                  you don’t want; nothing has been authored yet.
                </Text>
                {plan.operations.map((op) => (
                  <HStack key={op.id} UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                    <Text textType={TextType.Proud} style={{ minWidth: 44 }}>
                      {op.kind}
                    </Text>
                    <VStack UNSAFE_style={{ gap: 2, flex: 1 }}>
                      <Text textType={TextType.Default}>{op.target}</Text>
                      <Text textType={TextType.Shy}>{op.intent}</Text>
                      {op.kind === 'doc' && !docsAvailable && (
                        <Text textType={TextType.Shy}>
                          This project has never been saved, so it has no docs folder — this operation will not be
                          applied.
                        </Text>
                      )}
                    </VStack>
                    <PrimaryButton
                      label="Drop"
                      variant={PrimaryButtonVariant.Ghost}
                      onClick={() => dropOperation(op.id)}
                    />
                  </HStack>
                ))}
                <HStack UNSAFE_style={{ gap: 8 }}>
                  <PrimaryButton
                    label={`Author plan (${plan.operations.length})`}
                    icon={IconName.MagicWand}
                    isGrowing
                    onClick={authorPlan}
                  />
                  <PrimaryButton label="Reject" variant={PrimaryButtonVariant.Danger} isGrowing onClick={abandon} />
                </HStack>
              </VStack>
            )}

            {runState && (
              <VStack UNSAFE_style={{ gap: 8 }}>
                {runState.operations.map((op) => {
                  const { icon, variant } = statusIcon(op);
                  const isExcluded = excluded.has(op.operation.id);
                  const isDoc = op.operation.kind === 'doc';
                  const detail = operationDetail(op);
                  return (
                    <VStack key={op.operation.id} UNSAFE_style={{ gap: 2, opacity: isExcluded ? 0.5 : 1 }}>
                      <HStack UNSAFE_style={{ alignItems: 'center', gap: 6 }}>
                        <Icon icon={icon} variant={variant} size={IconSize.Small} />
                        <Text textType={TextType.Default} style={{ flex: 1 }}>
                          {op.operation.kind} {op.operation.target}
                          {op.staged
                            ? ` — ${op.staged.nodeCount} node${op.staged.nodeCount === 1 ? '' : 's'}`
                            : ''}
                        </Text>
                        {done && op.status === 'staged' && (
                          <>
                            <PrimaryButton
                              label="Review"
                              variant={PrimaryButtonVariant.Ghost}
                              onClick={() =>
                                isDoc ? setReviewingDoc(op.operation.id) : reviewOperation(op.operation.id)
                              }
                            />
                            <PrimaryButton
                              label={isExcluded ? 'Restore' : 'Exclude'}
                              variant={PrimaryButtonVariant.Ghost}
                              onClick={() =>
                                isExcluded ? restoreOperation(op.operation.id) : excludeOperation(op.operation.id)
                              }
                            />
                          </>
                        )}
                      </HStack>
                      {detail && <Text textType={TextType.Shy}>{detail}</Text>}
                      {isDoc && op.status === 'staged' && done && !docsAvailable && (
                        <Text textType={TextType.Shy}>
                          Not applied — this project has never been saved, so it has no docs folder.
                        </Text>
                      )}
                    </VStack>
                  );
                })}

                {runState.busy && runState.session && (
                  <VStack UNSAFE_style={{ gap: 8 }}>
                    {runState.session.activities.map((activity, index) => (
                      <ActivityRow key={index} activity={activity} />
                    ))}
                  </VStack>
                )}

                {done && (
                  <VStack UNSAFE_style={{ gap: 8 }}>
                    {failedOps.length > 0 && (
                      <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                        <Icon icon={IconName.WarningTriangle} variant={FeedbackType.Notice} size={IconSize.Small} />
                        <Text textType={TextType.Secondary}>
                          {failedOps.length} of {totalComponentOps} operation{totalComponentOps === 1 ? '' : 's'}{' '}
                          failed. Nothing has touched your project — apply the rest explicitly, or abandon.
                        </Text>
                      </HStack>
                    )}
                    {stagedDocOps.length > 0 && !docsAvailable && (
                      <Text textType={TextType.Shy}>
                        {stagedDocOps.length} doc operation{stagedDocOps.length === 1 ? '' : 's'} will not be applied
                        — this project has never been saved, so it has no docs folder.
                      </Text>
                    )}
                    {stagedCount > 0 || stagedDocOps.length > 0 ? (
                      <Text textType={TextType.Secondary}>
                        Nothing is in your project yet — not the components, and not the documents. Applying is one
                        edit: a single undo reverts the whole plan.
                      </Text>
                    ) : (
                      <Text textType={TextType.Secondary}>No operation produced anything to apply.</Text>
                    )}
                    <HStack UNSAFE_style={{ gap: 8 }}>
                      {applyCount > 0 && (
                        <PrimaryButton
                          label={
                            applyCount === totalOps && failedOps.length === 0 && excluded.size === 0
                              ? `Apply plan (${applyCount})`
                              : `Apply ${applyCount} of ${totalOps}`
                          }
                          icon={IconName.Check}
                          isGrowing
                          onClick={() => void applyPlan()}
                        />
                      )}
                      <PrimaryButton label="Abandon" variant={PrimaryButtonVariant.Danger} isGrowing onClick={abandon} />
                    </HStack>
                  </VStack>
                )}
              </VStack>
            )}
          </VStack>
        </Box>
      </ScrollArea>

      {reviewedDoc && reviewingDoc && (
        <PlanDocReviewDialog
          doc={reviewedDoc}
          onKeep={() => setReviewingDoc(null)}
          onExclude={() => {
            excludeOperation(reviewingDoc);
            setReviewingDoc(null);
          }}
          onClose={() => setReviewingDoc(null)}
        />
      )}
    </>
  );
}
