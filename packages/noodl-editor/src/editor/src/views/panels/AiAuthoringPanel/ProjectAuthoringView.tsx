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
  candidateIsRenderable,
  graphComponentFromFiles,
  materializeSelection,
  pathToLegacyName,
  PlanningSession,
  PlanRun,
  PlanSessionStore,
  PLAN_SESSION_CHANGED,
  planExcludedWith,
  planRequiredWith,
  StagingError,
  validateCandidateComponent,
  type AuthoringPlan,
  type AuthoringSessionState,
  type ComponentFiles,
  type PlanApplyFailure,
  type PlanOperationState,
  type AppliedPlanOperation,
  type PlanProvisionSpec,
  type PlanRunState,
  type PlanSession
} from '@noodl-models/AiAssistant/authoring';
import { fromProjectModel } from '@noodl-models/AiAssistant/explain/graph';
// Imported from the module rather than the `scoping` barrel: the barrel pulls
// `ScopingSession` (the AI client) and `scopeDocs` (the platform filesystem),
// and this seam is a plain-data handover that needs neither.
import { takePendingScopePlan, type PendingScopePlan } from '@noodl-models/AiAssistant/scoping/pendingPlan';
// Same reason as the line above — the pure submodule, never the `scoping`
// barrel, which would drag `ScopingSession` (the AI client) in behind it.
import { recoverScopePlan, type RecoveredScopePlan } from '@noodl-models/AiAssistant/scoping/recoverPlan';
import { AppRegistry } from '@noodl-models/app_registry';
// AIB-007 — the provisioner and the project's current backend pointer.
import { editorBackendProvisioner } from '@noodl-models/BackendServices/provisionBackend';
import { createPlanDocWriter, ProjectDocsModel } from '@noodl-models/ProjectDocs';
import { ProjectModel } from '@noodl-models/projectmodel';
import { getCloudServices } from '@noodl-models/projectmodel.editor';
import { buildEffectiveTokens, buildStyleVocabulary, readStoredTokens } from '@noodl-models/StyleTokensModel';

import { buildComponentV2Files } from '../../../io/ProjectExporter';
import { DiagnosticCode, formatDiagnosticLine, type Diagnostic, type ProjectBackendFacts } from '../../../validation';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextArea } from '@noodl-core-ui/components/inputs/TextArea';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { ScrollArea } from '@noodl-core-ui/components/layout/ScrollArea';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { SandboxPreview } from '../../documents/AuthoringPreviewDocument/SandboxPreview';
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
  // AIB-007: a staged provision has not created anything — it is the one row
  // whose tick would be a lie. The cloud icon says "this is about the backend"
  // without claiming the backend exists.
  if (state.status === 'staged' && state.operation.kind === 'provision') {
    return { icon: IconName.CloudData, variant: FeedbackType.Notice };
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
  // AIB-007. Present tense on purpose: every other staged row describes
  // something that exists in memory, and this one describes something that does
  // not exist at all yet.
  if (state.status === 'staged' && state.stagedProvision) {
    const { collections, needsAuth } = state.stagedProvision;
    const what = [
      collections.length > 0 ? `${collections.length} collection${collections.length === 1 ? '' : 's'}` : undefined,
      needsAuth ? 'user accounts' : undefined
    ]
      .filter(Boolean)
      .join(' and ');
    return `Will be created when you apply${what ? `, with ${what}` : ''}`;
  }
  return undefined;
}

/** "4m 12s", "38s" — a duration read at a glance, not parsed. */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

/**
 * AIB-002 — cost, or the honest absence of one.
 *
 * `costUsd` is null when *any* turn had unknown pricing, and rendering that as
 * `$0.00` would tell a user bringing their own key that the plan was free. In
 * an alpha where the cost of a plan is the only thing standing between a user
 * and a surprise invoice, that is not a rounding error.
 */
export function formatCost(costUsd: number | null): string {
  if (costUsd === null) return 'cost unknown';
  // Sub-cent totals are real during testing; $0.00 reads as "nothing happened".
  return costUsd > 0 && costUsd < 0.01 ? `$${costUsd.toFixed(4)}` : `$${costUsd.toFixed(2)}`;
}

/**
 * AIB-007 — what a Cloud Data or User node can count on, as the *run* sees it.
 *
 * Two inputs, because the honest answer needs both: what the project has now,
 * and what this plan is about to give it. A run that provisions a backend must
 * not warn about the very pages it is provisioning it for — the agent is told to
 * take diagnostics literally, so a spurious warning here is a page that comes
 * back without its Sign Up button.
 *
 * `hasAuth` is deliberately left to default to `hasBackend`. Whether an existing
 * backend has sign-in switched on is not readable from `cloudservices`, and
 * claiming to know would report a problem we cannot see.
 */
function backendFacts(project: ProjectModel, provision: PlanProvisionSpec | undefined): ProjectBackendFacts {
  return {
    hasBackend: Boolean(getCloudServices(project).endpoint),
    ...(provision
      ? { plannedProvision: { collections: provision.collections.map((c) => c.name), needsAuth: provision.needsAuth } }
      : {})
  };
}

/** The provision in a plan, before anything has run. */
function planBackendFacts(project: ProjectModel, plan: AuthoringPlan): ProjectBackendFacts {
  return backendFacts(project, plan.operations.find((op) => op.kind === 'provision')?.provision);
}

/**
 * The same facts at apply time, from the **accepted** set rather than the plan —
 * so an excluded provision correctly makes this the stricter check.
 */
function appliedBackendFacts(project: ProjectModel, operations: readonly AppliedPlanOperation[]): ProjectBackendFacts {
  const provision = operations.find((op) => op.kind === 'provision');
  return backendFacts(project, provision?.kind === 'provision' ? provision.provision : undefined);
}

/**
 * AIB-002 — what an authoring operation is doing *right now*, in one clause.
 *
 * The attempt number is the single most reassuring thing on screen during a
 * long turn: a run that has silently been repairing its third submission for
 * four minutes is indistinguishable, without it, from one that has hung.
 */
function authoringDetail(session: AuthoringSessionState | undefined): string | undefined {
  if (!session) return undefined;
  const building = session.building;
  if (!building) return 'Reading context…';
  const nodes = `${building.nodes.length} node${building.nodes.length === 1 ? '' : 's'}`;
  const attempt = building.submission > 1 ? ` · attempt ${building.submission}` : '';
  return building.complete ? `Validating — ${nodes}${attempt}` : `Writing — ${nodes} so far${attempt}`;
}

/**
 * AIB-002 — a clock that re-renders once a second while the run is working, and
 * only while this panel is actually on screen.
 *
 * Elapsed is always *derived* from the timestamps `PlanRun` publishes, never
 * accumulated here, which is what makes both halves of the WFA-002 trap fall
 * out for free: a hidden panel stops re-rendering (nobody is reading it) and a
 * panel that comes back computes the right number on its first frame instead of
 * restarting from zero.
 */
function useElapsedClock(active: boolean, ref: React.RefObject<HTMLElement>): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      // `offsetParent` is null when this element or an ancestor is
      // `display: none` — which is how the sidebar hides a panel it has not
      // unmounted.
      if (ref.current && ref.current.offsetParent === null) return;
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [active, ref]);
  return now;
}

export interface ProjectAuthoringViewProps {
  isConfigured: boolean;
  hasProject: boolean;
}

export function ProjectAuthoringView({ isConfigured, hasProject }: ProjectAuthoringViewProps) {
  // AIB-003: everything worth more than a re-render lives in `PlanSessionStore`,
  // keyed by project, because the Build panel CONDITIONALLY RENDERS this view —
  // switching the scope toggle unmounts it. It used to hold the plan, the run
  // and every staged candidate in `useState` with a `dispose()` on unmount, so a
  // tab click destroyed three components' worth of authored, validated output.
  //
  // The transaction property is untouched: nothing here reaches a ProjectModel,
  // and `applyAuthoredPlan` is still the only code that does.
  const projectId = ProjectModel.instance?.id;
  const store = PlanSessionStore.instance;

  /**
   * The session, seeded once — and, on the very first mount for a project, the
   * AIX-012 handover taken into it.
   *
   * The take happens **inside the initialiser** rather than in the body or an
   * effect, and both alternatives are worse. In the body it would notify the
   * store's subscribers during render; in an effect the panel would paint its
   * empty state for a frame before the plan appeared, which reads as "the thing
   * I just agreed to was lost" — the exact impression this task exists to
   * remove. An initialiser runs before anything is subscribed, so it can write
   * to the store freely, and it runs at most once per mount.
   *
   * `takePendingScopePlan` is destructive on purpose — a plan that survived
   * consumption would reappear against the wrong project — which is what made
   * the FIRST consumption final in a component that unmounts on a tab click.
   * Landing it in the store fixes that at the root: still taken exactly once,
   * but into something that outlives every mount. The guard is the store's own
   * content, so a remount (or React's double-invoked initialiser) finds the plan
   * already there and does not take again.
   *
   * It arrives as an ordinary proposed plan, not an approved one: every row is
   * prunable and nothing reaches the project until Apply.
   */
  const [session, setSession] = useState<PlanSession>(() => {
    const existing = store.get(projectId);
    if (existing.plan || existing.run || existing.applied) return existing;
    const scopePlan: PendingScopePlan | undefined = takePendingScopePlan(projectId);
    if (!scopePlan) return existing;
    return store.update(projectId, {
      plan: scopePlan.plan,
      // AIB-005: what earns this plan an announcement outside the Build panel.
      origin: 'scoping',
      note: {
        text:
          `From the scoping conversation that created this project — ${scopePlan.plan.operations.length} ` +
          `operation${scopePlan.plan.operations.length === 1 ? '' : 's'}. Nothing has been built yet. Drop ` +
          `anything you have changed your mind about, then author it. The conversation is recorded in ` +
          `${scopePlan.recordPath}.`,
        type: 'notice'
      }
    });
  });

  // Re-read on any change, from any mount of this view. The store notifies
  // rather than the view polling, because a `PlanRun` publishing from a
  // background turn has no idea whether anyone is looking at it.
  useEffect(() => {
    const context = {};
    store.on(PLAN_SESSION_CHANGED, () => setSession({ ...store.get(ProjectModel.instance?.id) }), context);
    return () => {
      store.off(context);
    };
  }, [store]);

  // Write to the store; the subscription above is what puts it on screen. One
  // path in and one path out — a handler that also called `setSession` would
  // give this view a private copy that any other subscriber could disagree with.
  const patch = useCallback(
    (next: Partial<PlanSession>) => {
      store.update(ProjectModel.instance?.id, next);
    },
    [store]
  );

  const { description, plan, excluded, applied, applyFailure } = session;
  // The store spells the three feedback values out rather than importing a view
  // enum; this is the one place they are narrowed back to it.
  const note = session.note as { text: string; type: FeedbackType } | null;
  const setDescription = useCallback((value: string) => patch({ description: value }), [patch]);
  const setPlan = useCallback((value: AuthoringPlan | null) => patch({ plan: value }), [patch]);
  const setNote = useCallback(
    (value: { text: string; type: FeedbackType } | null) => patch({ note: value }),
    [patch]
  );
  const setExcluded = useCallback((value: ReadonlySet<string>) => patch({ excluded: value }), [patch]);
  const setApplied = useCallback(
    (value: { count: number; docs: string[] } | null) => patch({ applied: value }),
    [patch]
  );
  const setApplyFailure = useCallback((value: PlanApplyFailure | null) => patch({ applyFailure: value }), [patch]);

  // Transient by design — a dialog that is open, a button that says
  // "Re-authoring…". Re-derived on mount; keeping them would be one more thing
  // to hold in sync for no benefit.
  const [planBusy, setPlanBusy] = useState(false);
  const [reviewingDoc, setReviewingDoc] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // The run's published state. Seeded from the store's run so a remount shows a
  // finished run exactly as the user left it, rather than an empty panel with
  // the candidates still in memory behind it.
  const [runState, setRunState] = useState<PlanRunState | null>(() => session.run?.state ?? null);
  const runRef = useRef<PlanRun | null>(session.run);
  const planAbortRef = useRef<AbortController | null>(null);

  // Re-attach to whatever run the store holds, on every mount and whenever it
  // changes. The old code disposed the run here; disposal is now the user's
  // explicit Abandon or a successful apply, and nothing else.
  useEffect(() => {
    runRef.current = session.run;
    setRunState(session.run?.state ?? null);
    if (!session.run) return;
    return session.run.onChange(setRunState);
  }, [session.run]);

  // Whether doc operations can be applied at all. Recomputed when a run starts:
  // a project saved for the first time mid-session gains a docs folder.
  const [docsAvailable, setDocsAvailable] = useState<boolean>(() => projectDocs() !== undefined);

  /**
   * AIB-003 slice 3 — the plan is durable on disk, and until now nothing read
   * it back.
   *
   * `takePendingScopePlan` is a one-shot module handover that dies with the
   * window, so opening the project a day later — or simply after the editor
   * restarted — offered nothing, while `docs/decisions/000-initial-scope.md`
   * had held the whole thing the entire time. This is the slow path behind that
   * fast one, and it runs only when the session has nothing: a recovered plan
   * must never overwrite work in progress.
   */
  const [recovered, setRecovered] = useState<RecoveredScopePlan | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  useEffect(() => {
    if (session.plan || session.run || session.applied) return;
    const docs = projectDocs();
    const project = ProjectModel.instance;
    if (!docs || !project) return;
    let cancelled = false;
    void recoverScopePlan({
      readDoc: (relPath) => docs.read(relPath),
      componentExists: (legacyName) => !!project.getComponentWithName(legacyName),
      toLegacyName: pathToLegacyName
    }).then((found) => {
      if (!cancelled) setRecovered(found ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [session.plan, session.run, session.applied]);

  const adoptRecoveredPlan = useCallback(() => {
    if (!recovered) return;
    patch({
      plan: recovered.plan,
      // Same provenance as the fast path — this IS the scoping conversation's
      // plan, read back off disk a day later. Announced as already seen: the
      // user adopted it from this panel, and a canvas strip telling them about
      // the thing they are looking at is noise, not news.
      origin: 'scoping',
      announcementDismissed: true,
      note: {
        text:
          `Recovered from ${recovered.recordPath} — the plan agreed when this project was created, still ` +
          'unbuilt. Drop anything you have changed your mind about, then author it.',
        type: 'notice'
      }
    });
    setRecovered(null);
  }, [recovered, patch]);

  const reset = useCallback(() => {
    // The only two things allowed to destroy authored output: an explicit
    // Abandon, and a successful apply.
    store.discard(ProjectModel.instance?.id);
    runRef.current = null;
    setRunState(null);
    setReviewingDoc(null);
    setSession({ ...store.get(ProjectModel.instance?.id) });
  }, [store]);

  const startPlanning = useCallback(async () => {
    const project = ProjectModel.instance;
    const request = description.trim();
    if (!project || !request) return;
    // `reset` discards the whole session, description included — planning a new
    // request is the user saying they are done with the previous one — so the
    // request is captured above and put back with the result.
    reset();
    patch({ description: request });
    setPlanBusy(true);
    try {
      const session = new PlanningSession(fromProjectModel(project), request);
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
  }, [description, reset, patch]);

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
      session: {
        ...styleOptions,
        // AIB-007 criterion 2 and 5. Bound here rather than defaulted inside the
        // session, because the true answer needs the *plan*: a run that
        // provisions a backend must not warn about the Sign Up nodes it is
        // building for the backend it is about to create. Nothing else in the
        // product knows both halves.
        backend: planBackendFacts(project, plan)
      }
    });
    runRef.current = run;
    // Into the store first: the run must outlive this mount, and the effect that
    // watches `session.run` is what subscribes to it. Doing it here rather than
    // in the effect keeps a single owner for the subscription.
    patch({ run });
    await run.run();
  }, [plan, patch]);

  const excludeOperation = useCallback(
    (id: string) => {
      const run = runRef.current;
      if (!run) return;
      const current = store.get(ProjectModel.instance?.id).excluded;
      setExcluded(planExcludedWith(run.requires(), [...current, id]));
    },
    [setExcluded, store]
  );

  const restoreOperation = useCallback(
    (id: string) => {
      const run = runRef.current;
      if (!run) return;
      const needed = planRequiredWith(run.requires(), [id]);
      const current = store.get(ProjectModel.instance?.id).excluded;
      setExcluded(new Set([...current].filter((entry) => !needed.has(entry))));
    },
    [setExcluded, store]
  );

  const reviewOperation = useCallback((id: string) => {
    const run = runRef.current;
    const project = ProjectModel.instance;
    const files = run?.filesFor(id);
    if (!run || !project || !files) return;
    const operation = run.plan.operations.find((op) => op.id === id);
    const changeSet = buildChangeSet(project, files);
    const componentOps = run.plan.operations.filter((op) => op.kind !== 'doc');
    const position = componentOps.findIndex((op) => op.id === id);
    // AIB-004: the plan's other staged candidates travel with this one. A page
    // that instantiates a component a sibling operation authored renders as a
    // blank frame without them — the project will not hold that component until
    // the whole plan is applied.
    const siblings = run.stagedSiblings(id);
    AppRegistry.instance.openDocument(ChangeReviewDocumentProvider.ID, {
      changeSet,
      title: `Review ${operation?.target ?? id}`,
      // AIB-004: the plan context as a chip rather than a title suffix, so it
      // survives a reader who has scrolled away from the header.
      chip:
        position >= 0
          ? `Operation ${position + 1} of ${componentOps.length} · nothing applied yet`
          : 'Plan operation · nothing applied yet',
      // AIB-004 one vocabulary: every operation-level verb names the plan, and
      // the only button in the product that says "project" is the one that
      // writes. "Keep" alone was the ambiguity Richard hit.
      acceptLabel: 'Keep',
      acceptScope: 'in plan',
      rejectLabel: 'Drop from plan',
      // Dropping an operation is restorable from the panel and changes nothing
      // outside the plan — per the phase-23 law, not red.
      isRejectDangerous: false,
      // AIB-004: preview-first for a component that did not exist five minutes
      // ago. There is no meaningful diff for "25 additions, 1 change", and "is
      // this the login page I asked for" is a question only a render answers.
      // An update has a real before, so it opens on the diff.
      defaultView: operation?.kind === 'create' && candidateIsRenderable(files) ? 'preview' : 'review',
      preview: (
        <SandboxPreview
          files={files}
          siblings={siblings}
          sampleData={run.sampleDataFor(id)}
          revision={0}
          unrenderableHint="Switch to Changes to see what it does."
        />
      ),
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
    setApplyFailure(null);

    // Belt-and-braces: the same gate that validated each candidate during
    // authoring re-validates the final selection against the live project,
    // with earlier accepted operations visible to later ones.
    const graph = fromProjectModel(project);
    let components = [...graph.components];
    const backendWarnings: Diagnostic[] = [];
    for (const op of operations) {
      // AIB-007: a provision is skipped here for the same reason a doc is — it
      // has no graph to re-validate. What it *does* change is whether the
      // components that follow it have a backend, and that is fed into the
      // validation below rather than checked here.
      if (op.kind === 'doc' || op.kind === 'provision') continue;
      const legacyName = pathToLegacyName(op.operation.target);
      // An update re-validates against its own base, exactly as its session did
      // — otherwise a revision that correctly preserved a pre-existing problem
      // passes the loop and is refused here (see `ValidateCandidateOptions`).
      const existing = op.kind === 'update' ? project.getComponentWithName(legacyName) : undefined;
      const validation = validateCandidateComponent({ components }, legacyName, op.files, {
        ...(existing
          ? { baseline: buildComponentV2Files(existing.toJSON(), new Date().toISOString()) as ComponentFiles }
          : {}),
        // AIB-007: the same facts the run authored against. `operations` is the
        // *accepted* set, so an excluded provision correctly makes this the
        // stricter check — dropping the backend and keeping the pages that need
        // it is exactly the combination worth catching here.
        backend: appliedBackendFacts(project, operations)
      });
      if (!validation.ok) {
        // AIB-001: after slice 1 this is where a bad parameter value surfaces if
        // one ever reaches apply — naming the node and the port. Offer the same
        // recovery as a transaction failure: re-author this one operation with
        // the diagnostic as its repair context.
        const lines = validation.errors.slice(0, 3).map(formatDiagnosticLine);
        const reason = `"${op.operation.target}" is no longer valid: ${lines.join(' · ')}`;
        setNote({ text: reason, type: FeedbackType.Danger });
        // `op.kind` is narrowed to create/update here — the loop skips docs
        // above, because a doc has no graph to re-validate.
        setApplyFailure({ id: op.operation.id, target: op.operation.target, reason });
        return;
      }
      // AIB-007: a Cloud Data or User node with nowhere to go is a WARNING, not
      // an error, so `validation.ok` is true and the loop above says nothing.
      // That is the right severity — the graph is valid and the user's decision
      // to drop the provision stands — but silence is not. This is precisely the
      // combination the plan lets you build: keep the Sign Up page, drop the
      // backend it needs.
      for (const diagnostic of validation.diagnostics) {
        if (diagnostic.code === DiagnosticCode.MissingBackend) backendWarnings.push(diagnostic);
      }
      // Extend with the accepted candidate so later operations validate
      // against it (the same working-copy trick as the run itself).
      components = [...components.filter((c) => c.name !== legacyName), graphComponentFromFiles(legacyName, op.files)];
    }

    try {
      const result = await applyAuthoredPlan(project, operations, {
        docWriter,
        // AIB-007. Always passed: the transaction refuses a plan carrying a
        // provision when there is none, and the editor always can.
        provisioner: editorBackendProvisioner({ project })
      });
      // Discard first, then record the outcome: the applied summary is the one
      // thing that must survive the reset, and `reset` now clears the whole
      // session rather than a hand-picked list of fields.
      reset();
      setApplied({
        count: result.components.size,
        docs: result.docs,
        // AIB-007: the provision's own outcome, including collections it could
        // not create. A warning that only reached the console is a warning that
        // did not happen.
        ...(result.backend
          ? {
              backend: {
                name: result.backend.name,
                endpoint: result.backend.endpoint,
                collections: result.backend.collections,
                warnings: result.backend.warnings
              }
            }
          : {}),
        // AIB-007: carried on `applied` rather than raised as a note before the
        // apply, because a successful apply calls `reset()` and `reset` clears
        // the note — the warning would have existed for exactly as long as it
        // took to succeed.
        ...(backendWarnings.length > 0
          ? {
              missingBackend: [
                ...new Set(backendWarnings.map((d) => d.message))
              ]
            }
          : {})
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setNote({ text: message, type: FeedbackType.Danger });
      // The transaction knows which operation it was mutating. When it is a
      // component operation, that is enough to offer the only recovery worth
      // having — re-author that one and leave every other candidate staged.
      const failed = e instanceof StagingError ? e.operation : undefined;
      setApplyFailure(failed && failed.kind !== 'doc' ? { ...failed, reason: message } : null);
    }
  }, [excluded, reset, setApplied, setApplyFailure, setNote]);

  /**
   * Re-author one operation with the reason it went wrong as repair context.
   *
   * AIB-001 slice 4 built this for an **apply** failure. AIB-009 F1 is the same
   * loss one stage earlier: an operation whose *authoring* failed left the user
   * with a red sentence, a dependency closure that quietly invalidated whatever
   * depended on it, and no way forward but Abandon or apply-the-survivors. Same
   * shape, same fix, and `retryOperation` needed nothing added — the panel was
   * simply only ever offering it for one of the two failures.
   */
  const retryOperation = useCallback(
    async (id: string, target: string, reason: string) => {
      const run = runRef.current;
      if (!run) return;
      setRetrying(true);
      setApplyFailure(null);
      setNote({ text: `Re-authoring "${target}"…`, type: FeedbackType.Notice });
      try {
        await run.retryOperation(id, reason);
        setNote({
          text: `"${target}" was authored again. Review it, then apply the plan.`,
          type: FeedbackType.Notice
        });
      } catch (e) {
        setNote({ text: e instanceof Error ? e.message : String(e), type: FeedbackType.Danger });
      } finally {
        setRetrying(false);
      }
    },
    [setApplyFailure, setNote]
  );

  const retryFailedOperation = useCallback(async () => {
    if (!applyFailure) return;
    await retryOperation(applyFailure.id, applyFailure.target, applyFailure.reason);
  }, [applyFailure, retryOperation]);

  const abandon = useCallback(() => {
    // Abandon is the absence of an apply call: drop everything, nothing was written.
    reset();
  }, [reset]);

  const done = runState?.phase === 'done' || runState?.phase === 'cancelled';
  const stagedCount =
    runState?.operations.filter((op) => op.status === 'staged' && op.operation.kind !== 'doc').length ?? 0;
  const failedOps = runState?.operations.filter((op) => op.status === 'failed') ?? [];
  const stagedDocOps = runState?.operations.filter((op) => op.status === 'staged' && op.operation.kind === 'doc') ?? [];
  /** AIB-007 — is a backend among the things Apply would create? */
  const stagedProvision = runState?.operations.some(
    (op) => op.status === 'staged' && op.operation.kind === 'provision' && !excluded.has(op.operation.id)
  );
  const applyCount = done
    ? runRef.current?.acceptedOperations(excluded, { includeDocs: docsAvailable }).operations.length ?? 0
    : 0;
  const totalComponentOps = runState ? runState.operations.filter((op) => op.operation.kind !== 'doc').length : 0;
  const totalOps = runState?.operations.length ?? 0;
  const reviewedDoc = reviewingDoc ? runRef.current?.docFor(reviewingDoc) : undefined;

  // AIB-002 slice 3 — the run header. Ticks only while something is working,
  // and only while this panel is on screen; see `useElapsedClock`.
  const headerRef = useRef<HTMLDivElement>(null);
  const clockNow = useElapsedClock(Boolean(runState?.busy), headerRef);
  const activeIndex = runState?.activeOperationId
    ? runState.operations.findIndex((op) => op.operation.id === runState.activeOperationId)
    : -1;
  const runElapsed =
    runState?.startedAt !== undefined ? (runState.endedAt ?? clockNow) - runState.startedAt : undefined;
  const runHeadline = !runState
    ? undefined
    : [
        runState.busy
          ? `Building ${activeIndex >= 0 ? activeIndex + 1 : 1} of ${totalOps}`
          : `${stagedCount + stagedDocOps.length} of ${totalOps} built`,
        runElapsed !== undefined ? formatDuration(runElapsed) : undefined,
        formatCost(runState.costUsd)
      ]
        .filter(Boolean)
        .join(' · ');

  /**
   * Which finished operations have their activity feed open. Transient by the
   * same rule as `planBusy` — re-derived on mount, and the active operation's
   * feed is open regardless of what is in here.
   */
  const [openFeeds, setOpenFeeds] = useState<ReadonlySet<string>>(new Set());
  const toggleFeed = useCallback((id: string) => {
    setOpenFeeds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
              <VStack UNSAFE_style={{ gap: 6 }}>
                <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                  <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
                  <Text textType={TextType.Secondary}>
                    Applied the plan — {applied.count} component{applied.count === 1 ? '' : 's'} changed
                    {applied.docs.length > 0 ? `, ${applied.docs.join(' and ')} written` : ''}.
                    {/* AIB-007: the undo sentence is qualified when a backend
                        was created, because it is no longer true unqualified —
                        one undo still restores the PROJECT, and the backend is
                        not part of the project. Saying "a single undo reverts
                        all of it" over a database would be the phase's own rule
                        broken in a status line. */}
                    {applied.backend
                      ? ' One undo reverts every change to the project; the backend stays, in Backend Services.'
                      : ' This was one edit: a single undo reverts all of it.'}
                  </Text>
                </HStack>
                {applied.backend && (
                  <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                    <Icon icon={IconName.CloudCheck} variant={FeedbackType.Success} size={IconSize.Small} />
                    <Text textType={TextType.Secondary}>
                      Backend "{applied.backend.name}" is running at {applied.backend.endpoint}
                      {applied.backend.collections.length > 0
                        ? ` with ${applied.backend.collections.join(', ')}`
                        : ''}
                      .
                    </Text>
                  </HStack>
                )}
                {applied.backend?.warnings.map((warning, index) => (
                  <HStack key={index} UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                    <Icon icon={IconName.WarningTriangle} variant={FeedbackType.Notice} size={IconSize.Small} />
                    <Text textType={TextType.Shy}>{warning}</Text>
                  </HStack>
                ))}
                {/*
                  AIB-007 — applied, and pointing at nothing. Reachable by
                  dropping the provision and keeping the pages that needed it,
                  which is a choice the plan deliberately allows.
                */}
                {applied.missingBackend && (
                  <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                    <Icon icon={IconName.WarningTriangle} variant={FeedbackType.Notice} size={IconSize.Small} />
                    <Text textType={TextType.Shy}>
                      {applied.missingBackend.slice(0, 2).join(' ')}
                      {applied.missingBackend.length > 2 ? ` (+${applied.missingBackend.length - 2} more)` : ''} Add a
                      backend in Backend Services and these will start working.
                    </Text>
                  </HStack>
                )}
              </VStack>
            )}

            {/*
              AIB-003 slice 3: a plan agreed in the launcher, recovered from the
              project's own decision record. Offered rather than adopted — it may
              be weeks old and the project may have moved on, so the user decides.
              This is also the answer to "I don't see any conversation history":
              the transcript was written to disk at creation and nothing ever
              showed it.
            */}
            {recovered && !plan && !runState && (
              <VStack UNSAFE_style={{ gap: 8 }}>
                <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                  <Icon icon={IconName.File} variant={FeedbackType.Notice} size={IconSize.Small} />
                  <Text textType={TextType.Secondary}>
                    This project was scoped in a conversation and its plan — {recovered.plan.operations.length}{' '}
                    operation{recovered.plan.operations.length === 1 ? '' : 's'} — has never been built. It is
                    recorded in {recovered.recordPath}.
                  </Text>
                </HStack>
                {recovered.transcript.length > 0 && (
                  <>
                    <PrimaryButton
                      label={
                        showTranscript
                          ? 'Hide the conversation'
                          : `Show the conversation (${recovered.transcript.length} messages)`
                      }
                      variant={PrimaryButtonVariant.Ghost}
                      isGrowing
                      onClick={() => setShowTranscript((shown) => !shown)}
                    />
                    {showTranscript && (
                      <VStack UNSAFE_style={{ gap: 6 }}>
                        {recovered.transcript.map((entry, index) => (
                          <VStack key={index} UNSAFE_style={{ gap: 2 }}>
                            <Text textType={TextType.Proud}>{entry.role === 'user' ? 'You' : 'Assistant'}</Text>
                            <Text textType={TextType.Shy}>{entry.text}</Text>
                          </VStack>
                        ))}
                      </VStack>
                    )}
                  </>
                )}
                <PrimaryButton
                  label="Load this plan"
                  icon={IconName.MagicWand}
                  isGrowing
                  onClick={adoptRecoveredPlan}
                />
              </VStack>
            )}

            {!plan && !runState && !note && !applied && !recovered && (
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
                      {/*
                        AIB-007 — the one operation in a plan with an effect
                        outside the project folder, and the one an undo does not
                        take back. Said here, at the moment the user can still
                        drop it, rather than in a toast after it has happened.
                      */}
                      {op.kind === 'provision' && (
                        <Text textType={TextType.Shy}>
                          Creates a backend on this computer and starts it. Undoing the plan stops using it but does
                          not delete it or its data — remove it in Backend Services.
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
                  {/*
                    AIB-004: not red. Nothing has been authored yet, so this
                    throws away a paragraph of text — per the phase-23 law, red
                    is for danger, and there is none here.
                  */}
                  <PrimaryButton
                    label="Discard plan"
                    variant={PrimaryButtonVariant.Ghost}
                    isGrowing
                    onClick={abandon}
                  />
                </HStack>
              </VStack>
            )}

            {runState && (
              <VStack UNSAFE_style={{ gap: 8 }}>
                {/*
                  AIB-002 slice 3 — position, elapsed and cumulative cost, live.
                  Cost during an alpha where every user brings their own key is
                  not decoration: it is the only feedback loop anyone has on what
                  a plan costs before committing to one.
                */}
                {runHeadline && (
                  <div ref={headerRef}>
                    <Text textType={TextType.Proud}>{runHeadline}</Text>
                  </div>
                )}

                {runState.operations.map((op) => {
                  const { icon, variant } = statusIcon(op);
                  const isExcluded = excluded.has(op.operation.id);
                  const isDoc = op.operation.kind === 'doc';
                  // AIB-007: nothing to open. A provision has no candidate
                  // graph and no proposed file — the row's own detail line IS
                  // the review, which is why it says what it will create rather
                  // than what it did.
                  const isProvision = op.operation.kind === 'provision';
                  const detail = operationDetail(op);
                  const isAuthoring = op.status === 'authoring';
                  // AIB-002 slice 2 — this operation's own elapsed time, live
                  // while it authors and frozen as a duration once it lands.
                  const elapsed =
                    op.startedAt !== undefined ? (op.endedAt ?? clockNow) - op.startedAt : undefined;
                  const activities = op.session?.activities ?? [];
                  const feedOpen = isAuthoring || openFeeds.has(op.operation.id);
                  return (
                    <VStack key={op.operation.id} UNSAFE_style={{ gap: 2, opacity: isExcluded ? 0.5 : 1 }}>
                      <HStack UNSAFE_style={{ alignItems: 'center', gap: 6 }}>
                        <Icon icon={icon} variant={variant} size={IconSize.Small} />
                        <Text textType={TextType.Default} style={{ flex: 1 }}>
                          {op.operation.kind} {op.operation.target}
                          {op.staged
                            ? ` — ${op.staged.nodeCount} node${op.staged.nodeCount === 1 ? '' : 's'}`
                            : ''}
                          {op.stagedProvision && op.stagedProvision.collections.length > 0
                            ? ` — ${op.stagedProvision.collections.join(', ')}`
                            : ''}
                        </Text>
                        {elapsed !== undefined && <Text textType={TextType.Shy}>{formatDuration(elapsed)}</Text>}
                        {/*
                          AIB-002 slice 1 — reviewable the moment it stages, not
                          when the whole run finishes. The candidate has been in
                          `filesFor(id)` all along; the gate was `done &&`, and
                          removing it is most of what Richard asked for. A
                          partial accept taken now IS seen by the operations
                          still to run: `PlanRun.workingGraph` is recomputed from
                          the staged files at the start of each one.
                        */}
                        {op.status === 'staged' && (
                          <>
                            {!isProvision && (
                              <PrimaryButton
                                label="Review"
                                variant={PrimaryButtonVariant.Ghost}
                                onClick={() =>
                                  isDoc ? setReviewingDoc(op.operation.id) : reviewOperation(op.operation.id)
                                }
                              />
                            )}
                            <PrimaryButton
                              label={isExcluded ? 'Restore to plan' : 'Drop from plan'}
                              variant={PrimaryButtonVariant.Ghost}
                              onClick={() =>
                                isExcluded ? restoreOperation(op.operation.id) : excludeOperation(op.operation.id)
                              }
                            />
                          </>
                        )}
                        {/*
                          AIB-009 F1 — the authoring failure gets the same
                          recovery as the apply failure. Docs are excluded
                          because `retryOperation` refuses them: a doc is
                          re-authored by re-running the plan, since its whole
                          value is seeing what the plan built.
                        */}
                        {done && op.status === 'failed' && !isDoc && !isProvision && (
                          <PrimaryButton
                            label={retrying ? 'Re-authoring…' : 'Retry'}
                            variant={PrimaryButtonVariant.Ghost}
                            isDisabled={retrying}
                            onClick={() =>
                              void retryOperation(
                                op.operation.id,
                                op.operation.target,
                                op.error ?? 'The agent could not produce a valid component.'
                              )
                            }
                          />
                        )}
                      </HStack>
                      {isAuthoring && <Text textType={TextType.Shy}>{authoringDetail(op.session)}</Text>}
                      {detail && <Text textType={TextType.Shy}>{detail}</Text>}
                      {isDoc && op.status === 'staged' && done && !docsAvailable && (
                        <Text textType={TextType.Shy}>
                          Not applied — this project has never been saved, so it has no docs folder.
                        </Text>
                      )}

                      {/*
                        AIB-002 slice 2 — each operation's activity feed under
                        its own row. There used to be one global feed showing the
                        ACTIVE session, replaced wholesale when the next
                        operation started, with nothing saying whose rows those
                        were. Finished feeds fold away: three operations' worth
                        expanded is a wall nobody reads.
                      */}
                      {!isAuthoring && activities.length > 0 && (
                        <PrimaryButton
                          label={feedOpen ? 'Hide activity' : `Show activity (${activities.length})`}
                          variant={PrimaryButtonVariant.Ghost}
                          // Live QA: a stretched, outlined button per operation
                          // row reads as three primary actions stacked down the
                          // panel. It is a disclosure toggle; it should hug.
                          isFitContent
                          onClick={() => toggleFeed(op.operation.id)}
                        />
                      )}
                      {feedOpen && activities.length > 0 && (
                        <VStack UNSAFE_style={{ gap: 8, paddingLeft: 20 }}>
                          {activities.map((activity, index) => (
                            <ActivityRow key={index} activity={activity} />
                          ))}
                        </VStack>
                      )}
                    </VStack>
                  );
                })}

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
                        Nothing is in your project yet — not the components, and not the documents.
                        {/*
                          ⚠️ AIB-007, found in live QA. This sentence used to end
                          "Applying is one edit: a single undo reverts the whole
                          plan" unconditionally — and with a provision in the plan
                          that is simply false. It is the same unqualified undo
                          promise already fixed in the *applied* summary, one
                          screen earlier, which is where a user actually decides.
                          A note that has to be true only after the fact is not a
                          note, it is an apology.
                        */}
                        {stagedProvision
                          ? ' Applying is one edit for the project — one undo reverts all of it. The backend is' +
                            ' created on this computer and stays until you remove it in Backend Services.'
                          : ' Applying is one edit: a single undo reverts the whole plan.'}
                      </Text>
                    ) : (
                      <Text textType={TextType.Secondary}>No operation produced anything to apply.</Text>
                    )}
                    {applyFailure && (
                      <Text textType={TextType.Secondary}>
                        Nothing was applied and nothing was lost — every other component is still staged. Re-author
                        “{applyFailure.target}” against what went wrong, then apply again.
                      </Text>
                    )}
                    <HStack UNSAFE_style={{ gap: 8 }}>
                      {applyFailure && (
                        <PrimaryButton
                          label={retrying ? 'Re-authoring…' : `Retry "${applyFailure.target}"`}
                          icon={IconName.MagicWand}
                          isDisabled={retrying}
                          isGrowing
                          onClick={() => void retryFailedOperation()}
                        />
                      )}
                      {/*
                        AIB-004: the ONE button in the product that says
                        "project", because it is the one that writes to it.
                        Everything else — here and in the review document —
                        names the plan.
                      */}
                      {applyCount > 0 && (
                        <PrimaryButton
                          label={
                            applyCount === totalOps && failedOps.length === 0 && excluded.size === 0
                              ? `Apply to project (${applyCount})`
                              : `Apply ${applyCount} of ${totalOps} to project`
                          }
                          icon={IconName.Check}
                          isDisabled={retrying}
                          isGrowing
                          onClick={() => void applyPlan()}
                        />
                      )}
                      {/*
                        Red exactly when there is something to lose. Discarding a
                        run that authored three components destroys an hour of
                        model output irreversibly — which is what this phase
                        calls the expensive artifact, and what the phase-23 law
                        calls danger. Discarding a run that produced nothing is
                        not dangerous and does not get to look like it.
                      */}
                      <PrimaryButton
                        label="Discard plan"
                        variant={
                          stagedCount + stagedDocOps.length > 0
                            ? PrimaryButtonVariant.Danger
                            : PrimaryButtonVariant.Ghost
                        }
                        isGrowing
                        onClick={abandon}
                      />
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
