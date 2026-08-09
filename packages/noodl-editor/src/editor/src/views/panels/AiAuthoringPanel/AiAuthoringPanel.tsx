/**
 * BLD-001 — the Build panel is one thread.
 *
 * It used to be three applications wearing one panel. `AuthoringScope` was a
 * three-value union picked by a segmented control, and a three-way ternary
 * switched whole subtrees — each branch with its own start button, its own stop
 * button, its own state and its own result treatment. Nothing told a user that
 * *"add a basket popup"* was one branch and *"wire checkout into the app"* was
 * another, and **the choice was demanded before they had typed a word**, which
 * is the moment they know least.
 *
 * This panel has one composer, one thread, and no modes. What the request *is*
 * gets decided after it is written, by the thing that has the information.
 *
 * ## The planning turn is the classifier
 *
 * Every send starts a `PlanningSession`. Its plan decides the path — one
 * component operation is a component build, anything that fans out or creates a
 * backend is a plan, all-documents is the docs pass — and `decideIntent` turns
 * that into the agent's first sentence with a one-click override. See
 * `AiAssistant/thread/intent` for why this is reused rather than a separate
 * classification call, and for the second reason that matters more than cost:
 * **a single composer needs a target from somewhere**, and the old component
 * scope got it from a text field the user typed a component path into by hand.
 *
 * ## Who owns what, unchanged
 *
 * `acceptAuthoredComponent` / `updateAuthoredComponent` / `applyAuthoredPlan`
 * remain the only code that touches a `ProjectModel`. `PlanSessionStore` and
 * `ProjectReviewStore` keep their durability guarantees — the thread is a
 * *view* of them and did not become their owner. No authoring logic moved; the
 * three sessions became turn producers, not three views.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/AiAuthoringPanel
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  acceptAuthoredComponent,
  AuthoringSession,
  AuthoringSetupError,
  buildChangeSet,
  materializeSelection,
  pathToLegacyName,
  PlanningSession,
  PlanSessionStore,
  PLAN_SESSION_CHANGED,
  StagingError,
  updateAuthoredComponent,
  validateCandidateComponent,
  type AuthoringPlan,
  type AuthoringSessionState,
  type ComponentFiles,
  type PlanRunState,
  type PlanSession
} from '@noodl-models/AiAssistant/authoring';
import { AiClient } from '@noodl-models/AiAssistant/client';
import { fromProjectModel } from '@noodl-models/AiAssistant/explain/graph';
import {
  PROJECT_REVIEW_CHANGED,
  ProjectReviewStore,
  startProjectReview,
  type ProjectReviewRun,
  type ProjectReviewState
} from '@noodl-models/AiAssistant/review';
import { authoringTelemetry } from '@noodl-models/AiAssistant/telemetry';
import {
  acceptedTurn,
  acceptLabel,
  componentTurns,
  composeThread,
  decideIntent,
  decisionOwner,
  DISCARD_LABEL,
  freezeTurns,
  liveTurns,
  ON_CANVAS_NOTE,
  ON_REVIEW_NOTE,
  retireLive,
  REVIEW_LABEL,
  type BuildIntent,
  type IntentDecision,
  type LiveSources,
  type Turn
} from '@noodl-models/AiAssistant/thread';
import { AppRegistry } from '@noodl-models/app_registry';
import { ProjectModel } from '@noodl-models/projectmodel';
import { buildEffectiveTokens, buildStyleVocabulary, readStoredTokens } from '@noodl-models/StyleTokensModel';

import { useModel } from '../../../hooks/useModel';
import { buildComponentV2Files } from '../../../io/ProjectExporter';
import { formatDiagnosticLine } from '../../../validation';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { ExperimentalFlag } from '@noodl-core-ui/components/sidebar/ExperimentalFlag';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { AuthoringPreviewDocumentProvider } from '../../documents/AuthoringPreviewDocument';
import { ChangeReviewDocumentProvider } from '../../documents/ChangeReviewDocument';
import { EditorDocumentProvider } from '../../documents/EditorDocument';
import { adoptScopePlan } from './adoptScopePlan';
import { ProjectAuthoringView } from './ProjectAuthoringView';
import { ProjectReviewBanner } from './ProjectReviewBanner';
import { ProjectReviewView } from './ProjectReviewView';
import { BuildThread, type ThreadWidth } from './thread/BuildThread';
import { Heartbeat } from './thread/Heartbeat';
import { RunHeader } from './thread/RunHeader';

export const AiAuthoringPanel_ID = 'ai-authoring';

/**
 * The turn that exists while the planning call is in flight.
 *
 * It carries the user's words and nothing else, which is the honest thing to
 * show: the request has been sent and the agent has not yet said what it is.
 * Rule 5 — never claim progress you cannot evidence.
 */
function pendingTurn(request: string): Turn {
  return { id: 'pending', request, activities: [], busy: true };
}

function noteTurn(id: string, request: string, text: string, tone: 'notice' | 'danger'): Turn {
  return { id, request, activities: [], outcome: { kind: 'note', text, tone } };
}

/**
 * What the docs suggestion puts in the composer.
 *
 * One constant, because it arrives from two places — the empty state's chip and
 * the Docs panel's banner — and the whole point of the request being ordinary
 * text is that both take the same path through `send`. Two near-identical
 * strings would classify differently on some model, some day.
 */
const DOCS_SUGGESTION = "Write this project's documents — read the app and draft them for me to correct.";

export interface AiAuthoringPanelProps {
  /** BLD-009 renders the same thread as a document. One implementation, two hosts. */
  width?: ThreadWidth;
}

export function AiAuthoringPanel({ width = 'panel' }: AiAuthoringPanelProps = {}) {
  // ── The thread ─────────────────────────────────────────────────────────────
  //
  // D5: accepting used to call `setState(null)` and `session.dispose()` — what
  // you asked, what it read and what it repaired, gone at the moment it became
  // part of your project. Finished turns move here instead. Surviving a restart
  // is BLD-006; surviving an accept is this.
  const [history, setHistory] = useState<Turn[]>([]);
  /**
   * The one input, seeded from the Docs panel's banner when that is how the
   * user arrived.
   *
   * ⚠️ It **prefills rather than runs**. AIX-010's banner used to set a one-shot
   * request that a second piece of state consumed to pick the opening tab, and
   * the review then started on mount — the click was the start. With no tabs
   * there is nothing to open, and starting a build from a panel switch is
   * exactly the "acts before it says what it will do" this task removes. The
   * user sees the request, in the composer, and presses Send.
   *
   * Consumed in the initialiser so the two `useState`s cannot disagree — the
   * same reason the old code consumed it in a `useRef` guard.
   */
  const [composer, setComposer] = useState(() =>
    ProjectReviewStore.instance.consumeReviewRequest() ? DOCS_SUGGESTION : ''
  );

  /** What the current live work is, and what the agent said it was. */
  const [route, setRoute] = useState<BuildIntent | null>(null);
  const [decision, setDecision] = useState<IntentDecision | null>(null);
  /** The plan the decision was made from — the override needs it. */
  const lastPlanRef = useRef<AuthoringPlan | null>(null);

  const [planningRequest, setPlanningRequest] = useState<string | null>(null);
  const planAbortRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<AuthoringSessionState | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [refineText, setRefineText] = useState('');
  const sessionRef = useRef<AuthoringSession | null>(null);

  const [reviewState, setReviewState] = useState<ProjectReviewState | null>(() =>
    ProjectReviewStore.instance.getState()
  );
  const reviewRunRef = useRef<ProjectReviewRun | null>(null);

  // Stable identities for the preview document's buttons — the document is
  // mounted once per build, the handlers re-bind every render.
  const handlersRef = useRef({ accept: () => {}, discard: () => {}, openReview: () => {} });

  const isConfigured = AiClient.isConfigured();
  const hasProject = Boolean(ProjectModel.instance);

  // ── The plan session, read from the store ──────────────────────────────────
  //
  // AIB-003's store is the owner and stays the owner. The panel subscribes for
  // the same reason `ProjectAuthoringView` does: a `PlanRun` publishing from a
  // background turn has no idea whether anyone is looking at it.
  //
  // ⚠️ The initialiser **takes** the AIX-012 launcher handover rather than
  // peeking at it, and that is not an optimisation. This view mounts
  // `ProjectAuthoringView` as the outcome card of a *plan turn*; a plan turn
  // exists only when the store holds a plan; and until BLD-001 the only thing
  // that put a launcher plan in the store was `ProjectAuthoringView`'s own
  // initialiser. A project created from a scoping conversation would have
  // opened to an empty thread and the agreed plan would have been consumed by
  // nobody — silently. `adoptScopePlan` is the one implementation, and the
  // guard is the store's own content, so the view's fallback call is a no-op.
  const store = PlanSessionStore.instance;
  const [planSession, setPlanSession] = useState<PlanSession>(() => adoptScopePlan(ProjectModel.instance?.id));
  useEffect(() => {
    const context = {};
    store.on(PLAN_SESSION_CHANGED, () => setPlanSession({ ...store.get(ProjectModel.instance?.id) }), context);
    return () => {
      store.off(context);
    };
  }, [store]);

  const [runState, setRunState] = useState<PlanRunState | null>(planSession.run?.state ?? null);
  useEffect(() => {
    setRunState(planSession.run?.state ?? null);
    if (!planSession.run) return;
    return planSession.run.onChange(setRunState);
  }, [planSession.run]);

  useEffect(() => {
    const context = {};
    const reviewStore = ProjectReviewStore.instance;
    reviewStore.on(PROJECT_REVIEW_CHANGED, () => setReviewState(reviewStore.getState()), context);
    return () => {
      reviewStore.off(context);
    };
  }, []);

  useEffect(() => () => sessionRef.current?.dispose(), []);

  /**
   * What the three producers are holding, in one value.
   *
   * Read twice — once to render the thread, once to retire it — and the whole
   * point of it being one value is that those two readings cannot disagree.
   * Declared here rather than beside the thread because `send` retires before
   * it plans, and a `useCallback` dependency cannot reference a `useMemo`
   * declared further down.
   */
  const liveSources = useMemo<LiveSources>(
    () => ({ route, session: state, planSession, runState, reviewState, decision }),
    [route, state, planSession, runState, reviewState, decision]
  );

  // ── Sending ────────────────────────────────────────────────────────────────

  /**
   * B9 — a new request retires the previous one instead of erasing it.
   *
   * Freeze the record, then release what produced it. Both halves are required:
   * `retireLive` re-prefixes the ids so no live control mounts on a historical
   * turn, and dropping the sources is what stops the frozen copy and the live
   * derivation being on screen together.
   *
   * ⚠️ `store.discard` and `ProjectReviewStore.clear` destroy authored output,
   * which AIB-003's rule allows only when the user says so. **Sending a new
   * request is the user saying so** — it is the contract the pre-BLD-001 panel
   * already had (`startPlanning` opened with `reset()`), and the difference now
   * is that the conversation survives it. Nothing here can run mid-flight:
   * `canSend` is false while anything is busy, so what is being released has
   * always finished.
   */
  const retire = useCallback(() => {
    const hadLive = liveTurns(liveSources).length > 0;
    setHistory((turns) => retireLive(turns, liveSources));

    sessionRef.current?.dispose();
    sessionRef.current = null;
    setState(null);
    setRoute(null);
    setDecision(null);
    if (AppRegistry.instance.CurrentDocumentId === AuthoringPreviewDocumentProvider.ID) {
      AppRegistry.instance.openDocument(EditorDocumentProvider.ID);
    }

    // ⚠️ Guarded on there having *been* something, and that guard is not an
    // optimisation: `discard` removes the AIB-003 sidecar, and a saved build
    // from a previous launch is restored asynchronously. Releasing sources that
    // hold nothing would delete a build that had not finished coming back yet.
    if (!hadLive) return;
    reviewRunRef.current = null;
    ProjectReviewStore.instance.clear();
    store.discard(ProjectModel.instance?.id);
  }, [liveSources, store]);

  /**
   * Hand a plan to the path it belongs to.
   *
   * The `plan` branch writes to the store and nothing else: the plan is
   * proposed, prunable, and nothing is built until the user approves it. That
   * is the pre-existing AIX-011 contract, reached now by describing the work
   * rather than by picking a tab first.
   */
  const routePlan = useCallback(
    async (intent: BuildIntent, plan: AuthoringPlan, request: string) => {
      const project = ProjectModel.instance;
      if (!project) return;
      setRoute(intent);

      if (intent === 'plan') {
        store.update(project.id, {
          description: request,
          plan,
          note: null,
          excluded: new Set(),
          applied: null,
          applyFailure: null,
          run: null
        });
        return;
      }

      if (intent === 'docs') {
        try {
          const { run } = await startProjectReview(project);
          reviewRunRef.current = run;
        } catch (e) {
          setSetupError(e instanceof Error ? e.message : String(e));
        }
        return;
      }

      // component — the fast path, with the plan's target rather than a path the
      // user had to type correctly.
      const operation = plan.operations[0];
      sessionRef.current?.dispose();
      setSetupError(null);
      try {
        const styleOptions = {
          styleVocabulary: buildStyleVocabulary(project),
          styleTokenRecords: Array.from(buildEffectiveTokens(readStoredTokens(project)).values())
        };
        const existing = project.getComponentWithName(pathToLegacyName(operation.target));
        const authoringRequest = { description: request, componentPath: operation.target };
        // An existing component is revised, not recreated: the session gets the
        // exporter's own serialization of it as the base.
        const session = existing
          ? AuthoringSession.createUpdate(
              fromProjectModel(project),
              authoringRequest,
              buildComponentV2Files(existing.toJSON(), new Date().toISOString()),
              styleOptions
            )
          : AuthoringSession.create(fromProjectModel(project), authoringRequest, styleOptions);
        sessionRef.current = session;
        session.onChange(setState);
        setState(session.state);

        // The payoff moment is watching the graph form — put the preview canvas
        // up before the first token arrives.
        AppRegistry.instance.openDocument(AuthoringPreviewDocumentProvider.ID, {
          session,
          onAccept: () => handlersRef.current.accept(),
          onDiscard: () => handlersRef.current.discard(),
          onOpenReview: () => handlersRef.current.openReview()
        });

        const startedAt = Date.now();
        const outcome = await session.run();
        authoringTelemetry().record({
          event: 'authoring-round',
          mode: session.mode,
          kind: 'initial',
          status: outcome.status,
          turnsTotal: outcome.metrics.turns,
          submitsTotal: outcome.metrics.submits,
          costUsdTotal: outcome.metrics.costUsd,
          durationMs: Date.now() - startedAt
        });
      } catch (e) {
        sessionRef.current = null;
        setState(null);
        setSetupError(e instanceof AuthoringSetupError ? e.message : e instanceof Error ? e.message : String(e));
      }
    },
    [store]
  );

  const send = useCallback(async () => {
    const project = ProjectModel.instance;
    const request = composer.trim();
    if (!project || !request) return;

    setComposer('');
    // Before anything is awaited, so the thread's order is an invariant rather
    // than a race: history is always older than the pending turn, which is
    // always older than whatever is live.
    retire();
    setSetupError(null);
    setPlanningRequest(request);
    try {
      const session = new PlanningSession(fromProjectModel(project), request);
      planAbortRef.current = new AbortController();
      const outcome = await session.run({ abortController: planAbortRef.current });

      if (outcome.status === 'planned' && outcome.plan) {
        lastPlanRef.current = outcome.plan;
        const next = decideIntent(outcome.plan);
        setDecision(next);
        await routePlan(next.intent, outcome.plan, request);
        return;
      }

      // Nothing was planned, so nothing is live — the request becomes a turn in
      // history with the agent's reason on it, rather than vanishing.
      const text =
        outcome.status === 'declined'
          ? outcome.note ?? 'The agent declined to plan this request.'
          : outcome.status === 'cancelled'
            ? 'Cancelled. Nothing happened.'
            : outcome.note ?? 'Could not produce a plan for this request.';
      setHistory((turns) => [
        ...turns,
        noteTurn(`declined-${turns.length}`, request, text, outcome.status === 'declined' ? 'notice' : 'danger')
      ]);
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setHistory((turns) => [...turns, noteTurn(`failed-${turns.length}`, request, text, 'danger')]);
    } finally {
      planAbortRef.current = null;
      setPlanningRequest(null);
    }
  }, [composer, retire, routePlan]);

  /**
   * The one-click override on the agent's own sentence.
   *
   * Only ever component → plan: the plan path already shows its work, so there
   * is nothing to override there, and offering the reverse would let one click
   * discard operations the user has not read. The typed request is not lost —
   * it is the plan's `request`, and the plan is what the store receives.
   */
  const applyOverride = useCallback(() => {
    const plan = lastPlanRef.current;
    if (!plan || !decision?.override) return;
    sessionRef.current?.dispose();
    sessionRef.current = null;
    setState(null);
    if (AppRegistry.instance.CurrentDocumentId === AuthoringPreviewDocumentProvider.ID) {
      AppRegistry.instance.openDocument(EditorDocumentProvider.ID);
    }
    setDecision({ ...decision, intent: decision.override.intent, override: null });
    void routePlan(decision.override.intent, plan, plan.request);
  }, [decision, routePlan]);

  const refine = useCallback(async () => {
    const session = sessionRef.current;
    const text = refineText.trim();
    if (!session || !text || state?.busy) return;
    setRefineText('');
    const startedAt = Date.now();
    const outcome = await session.refine(text);
    authoringTelemetry().record({
      event: 'authoring-round',
      mode: session.mode,
      kind: 'refine',
      status: outcome.status,
      turnsTotal: outcome.metrics.turns,
      submitsTotal: outcome.metrics.submits,
      costUsdTotal: outcome.metrics.costUsd,
      durationMs: Date.now() - startedAt
    });
  }, [refineText, state?.busy]);

  // ── Decisions on the component candidate ───────────────────────────────────

  /**
   * Stage the given files into the project. The whole-candidate path was
   * validated by the session's gate already; a partial selection from the
   * review document is re-validated through the same gate here. Returns an
   * error message, or null on success.
   */
  const acceptFiles = useCallback((files: ComponentFiles, selection?: { rejectedCount: number }): string | null => {
    const session = sessionRef.current;
    const project = ProjectModel.instance;
    if (!session || !project) return 'The authoring session is no longer available.';

    // Same baseline the loop validated against, so an error the component
    // already had cannot block the accept of a revision that correctly left it
    // alone (see `ValidateCandidateOptions.baseline`).
    const validation = validateCandidateComponent(fromProjectModel(project), session.legacyName, files, {
      ...(session.baseComponentFiles ? { baseline: session.baseComponentFiles } : {})
    });
    if (!validation.ok) {
      const lines = validation.errors.slice(0, 3).map(formatDiagnosticLine);
      return `The selected subset is not a valid component: ${lines.join(' · ')}`;
    }

    try {
      // The mode is the session's, decided at creation — never re-inferred here,
      // so a component created meanwhile still fails create-accept loudly.
      const component =
        session.mode === 'update' ? updateAuthoredComponent(project, files) : acceptAuthoredComponent(project, files);
      if (AppRegistry.instance.CurrentDocumentId === AuthoringPreviewDocumentProvider.ID) {
        AppRegistry.instance.openDocument(EditorDocumentProvider.ID);
      }
      NodeGraphContextTmp.switchToComponent?.(component, { pushHistory: true });
      authoringTelemetry().record({
        event: 'authoring-accept',
        mode: session.mode,
        partial: (selection?.rejectedCount ?? 0) > 0,
        nodeCount: files.nodes.nodes.length,
        connectionCount: files.connections.connections.length
      });

      // D5's fix: the conversation becomes history and the accept appends a
      // receipt. The session is still disposed — it holds a candidate, and the
      // candidate is in the project now — but the record of it outlives it.
      const live = componentTurns(session.state, {
        idPrefix: `history-${history.length}-component`,
        ...(decision ? { sentence: decision.sentence, intent: decision.intent } : {})
      });
      setHistory((turns) => [
        ...turns,
        ...freezeTurns(live),
        acceptedTurn(session.legacyName, session.mode, `accepted-${turns.length}`)
      ]);
      session.dispose();
      sessionRef.current = null;
      setState(null);
      setRoute(null);
      setDecision(null);
      return null;
    } catch (e) {
      const message = e instanceof StagingError ? e.message : e instanceof Error ? e.message : String(e);
      setSetupError(message);
      return message;
    }
  }, [decision, history.length]);

  const accept = useCallback(() => {
    const files = sessionRef.current?.stagedFiles;
    if (files) acceptFiles(files);
  }, [acceptFiles]);

  const discard = useCallback(() => {
    // Discard is the absence of an accept call: drop the session, nothing was
    // written. The turns still become history — what you asked and what it did
    // are worth keeping whether or not you took the result.
    const session = sessionRef.current;
    if (session?.stagedFiles) {
      authoringTelemetry().record({ event: 'authoring-reject', mode: session.mode });
    }
    if (session) {
      const live = componentTurns(session.state, {
        idPrefix: `history-${history.length}-component`,
        ...(decision ? { sentence: decision.sentence, intent: decision.intent } : {})
      });
      setHistory((turns) => [...turns, ...freezeTurns(live)]);
    }
    session?.dispose();
    sessionRef.current = null;
    setState(null);
    setRoute(null);
    setDecision(null);
    if (AppRegistry.instance.CurrentDocumentId === AuthoringPreviewDocumentProvider.ID) {
      AppRegistry.instance.openDocument(EditorDocumentProvider.ID);
    }
  }, [decision, history.length]);

  const openReview = useCallback(() => {
    const session = sessionRef.current;
    const project = ProjectModel.instance;
    const files = session?.stagedFiles;
    if (!session || !project || !files) return;

    // WFA-007 moved materialisation out of the review document: it is the
    // COMPONENT materializer. Behaviour here is unchanged.
    const changeSet = buildChangeSet(project, files);
    AppRegistry.instance.openDocument(ChangeReviewDocumentProvider.ID, {
      changeSet,
      title: `Review ${session.legacyName}`,
      // BLD-003 D3 — the third surface in this flow, and the one the acceptance
      // grep would have missed if it only looked at the two that render the
      // decision side by side. `ChangeReviewDocument` is shared (plan
      // operations, workflow proposals), so the correction goes on the *caller*
      // rather than on its defaults: these flags exist for exactly this, and
      // AIB-004 already used them one screen over for the same reason.
      //
      // ⚠️ `acceptLabel` is deliberately NOT overridden here. This document's
      // Accept composes with a selection — "Accept all", "Accept 3 of 5" — so
      // it answers *how much of this?*, not *what happens to my project?*.
      // "Add to project all" would be worse copy, not better.
      rejectLabel: DISCARD_LABEL,
      isRejectDangerous: false,
      onAccept: (rejected: ReadonlySet<string>) => {
        const selection = materializeSelection(changeSet, files, rejected);
        return acceptFiles(selection.files, { rejectedCount: selection.rejected.size });
      },
      onReject: discard
    });
  }, [acceptFiles, discard]);

  // Keep the preview document's stable handlers pointed at the live closures.
  handlersRef.current = { accept, discard, openReview };

  // ── The thread ─────────────────────────────────────────────────────────────

  // History, then the request in flight, then whatever is live — an ordering
  // that holds because `retire` runs before the pending turn exists.
  const turns = useMemo(
    () => composeThread(history, planningRequest ? [pendingTurn(planningRequest)] : [], liveTurns(liveSources)),
    [history, planningRequest, liveSources]
  );

  /** The turn the live plan view attaches to. See `renderOutcome`. */
  const lastPlanTurnId = useMemo(() => {
    const planIds = turns.filter((turn) => turn.id.startsWith('plan-')).map((turn) => turn.id);
    return planIds.length > 0 ? planIds[planIds.length - 1] : null;
  }, [turns]);

  const canDecide = Boolean(state && !state.busy && state.staged);
  const busy = Boolean(planningRequest || state?.busy || runState?.busy || reviewState?.busy);

  /**
   * BLD-003 D2 — which surface owns Accept / Review changes / Discard.
   *
   * ⚠️ This subscription is the whole fix. Both surfaces already knew how to
   * render the buttons; what neither knew was whether the *other* one was. The
   * derivation is one function over one fact — the document the editor is
   * showing — so there is no second opinion to disagree with, which is what
   * "one piece of state on the thread, not two components each guessing" means
   * in code.
   *
   * `useModel` re-renders on `documentChanged`, which is what makes closing the
   * preview hand the buttons back to the card immediately rather than at the
   * next unrelated render.
   */
  useModel(AppRegistry.instance, ['documentChanged']);
  const owner = decisionOwner(AppRegistry.instance.CurrentDocumentId, [
    AuthoringPreviewDocumentProvider.ID,
    // ⚠️ The review diff counts too, and missing it is the easy mistake: it is
    // reached *from* this card's own "Review changes" button, it carries its own
    // Accept, and a document sits beside the sidebar rather than over it — so
    // leaving it out would mean this task's own control opened a second Accept.
    ChangeReviewDocumentProvider.ID
  ]);

  const stop = useCallback(() => {
    if (planningRequest) planAbortRef.current?.abort();
    else if (state?.busy) sessionRef.current?.cancel();
    else if (runState?.busy) planSession.run?.cancel();
    else if (reviewState?.busy) reviewRunRef.current?.cancel();
  }, [planningRequest, state?.busy, runState?.busy, reviewState?.busy, planSession.run]);

  /**
   * The rich card for the live turn.
   *
   * Exactly one surface owns a decision at a time, and it is whichever surface
   * is showing the candidate — so these attach to the turn that produced them
   * rather than to a pinned bar at the bottom of the panel. BLD-003 finishes
   * that job (the preview document still renders its own copy of Accept); this
   * is the half that had to move for the thread to exist at all.
   *
   * ⚠️ **Every match here is on a *live* id.** A retired turn is re-prefixed
   * `history-N-…` by `retireLive`, so none of these three fire on it. That is
   * the only thing keeping a historical turn from mounting a second plan
   * editor, or a second Accept beside the live one — the outcome *kind* is not
   * enough on its own, because a frozen turn keeps the `staged-component`
   * outcome it had when it was frozen, and it should: what it built is worth
   * reading, it is just no longer a decision anyone can take.
   */
  const renderOutcome = useCallback(
    (turn: Turn): React.ReactNode | undefined => {
      if (turn.id.startsWith('plan-')) {
        /*
         * ONE mount, on the LAST plan turn — the view is a single component
         * holding the plan editor, the run and the apply, and mounting it twice
         * would run two subscriptions against one store.
         *
         * ⚠️ It must be the last turn including `plan-applied`, and that is not
         * cosmetic: the view renders its own applied summary, with the backend
         * endpoint, the registered pages and the settings it wrote (AIB-007,
         * AAQ-001, AAQ-003). Attaching the view to `plan-run` instead would put
         * that beside `OutcomeSummary`'s shorter version of the same sentence —
         * the duplicated-message defect this phase is measured on, reintroduced
         * by a rendering detail rather than by a control.
         *
         * Returning `null` for the others suppresses their fallback summary,
         * which is deliberate: while the session is live the view is the record.
         */
        return turn.id === lastPlanTurnId ? (
          <ProjectAuthoringView isConfigured={isConfigured} hasProject={hasProject} isEmbedded />
        ) : null;
      }

      if (turn.id === 'docs-run') {
        return <ProjectReviewView isConfigured={isConfigured} hasProject={hasProject} isEmbedded />;
      }

      if (turn.id.startsWith('component-') && turn.outcome?.kind === 'staged-component' && canDecide) {
        return (
          <VStack UNSAFE_style={{ gap: 8 }}>
            <Text textType={TextType.Default}>
              Staged: {turn.outcome.legacyName} — {turn.outcome.nodeCount} node
              {turn.outcome.nodeCount === 1 ? '' : 's'}, {turn.outcome.connectionCount} connection
              {turn.outcome.connectionCount === 1 ? '' : 's'}.{' '}
              {turn.outcome.mode === 'update'
                ? 'Your component is untouched until you accept.'
                : 'Nothing is in your project yet.'}
            </Text>
            <TextInput
              value={refineText}
              placeholder="Ask for changes…"
              isDisabled={state?.busy}
              onChange={(event) => setRefineText(event.target.value)}
              onEnter={refine}
            />
            {/* BLD-003 D2: exactly one surface owns these at a time, and it is
                whichever one is showing the candidate. With the preview canvas
                up, the decision belongs beside the graph it is about — the card
                says where the buttons went rather than going quiet, because a
                card that simply dropped them reads as a candidate that can no
                longer be accepted. */}
            {owner === 'thread' ? (
              <HStack UNSAFE_style={{ gap: 8, flexWrap: 'wrap' }}>
                <PrimaryButton label={acceptLabel(turn.outcome.mode)} icon={IconName.Check} onClick={accept} />
                <PrimaryButton label={REVIEW_LABEL} variant={PrimaryButtonVariant.Ghost} onClick={openReview} />
                {/* D3: nothing has been written, so discarding destroys nothing
                    — and red means danger. The Docs panel already got this
                    right one screen over. */}
                <PrimaryButton label={DISCARD_LABEL} variant={PrimaryButtonVariant.Ghost} onClick={discard} />
              </HStack>
            ) : (
              <Text textType={TextType.Shy}>
                {AppRegistry.instance.CurrentDocumentId === ChangeReviewDocumentProvider.ID
                  ? ON_REVIEW_NOTE
                  : ON_CANVAS_NOTE}
              </Text>
            )}
          </VStack>
        );
      }

      return undefined;
    },
    [
      lastPlanTurnId,
      isConfigured,
      hasProject,
      canDecide,
      owner,
      refineText,
      state?.busy,
      refine,
      accept,
      openReview,
      discard
    ]
  );

  /*
   * BLD-004 — the component session's heartbeat.
   *
   * The plan run's own is on the pinned header instead, beside the operation it
   * belongs to: during a plan the busy turn in the list *is* the run, while the
   * thing actually streaming is one operation inside it, and attaching the dot
   * to the run would put it next to a turn whose liveness it does not describe.
   *
   * `state` is null between requests and `Heartbeat` renders nothing when not
   * busy, so this is on screen only for the turn it is about.
   */
  const heartbeat = (
    <Heartbeat busy={Boolean(state?.busy)} lastActivityAt={state?.lastActivityAt} stallMs={state?.stallMs} />
  );

  return (
    <BasePanel title="Build" isFill>
      <BuildThread
        width={width}
        turns={turns}
        renderOutcome={renderOutcome}
        runHeader={<RunHeader state={runState} />}
        heartbeat={heartbeat}
        header={
          <>
            {/* The flag moves to the header, out of the turn list, where it
                stops competing with the task. It is honest and it stays. */}
            <ExperimentalFlag />
            {/*
             * ⚠️ C5, and the reason every `HStack` in this header carries an
             * explicit `height`. `Stack` sets `height: 100%` on any row that does
             * not declare one ([Stack.tsx:38]), and these rows sit in a *block*
             * container — so `100%` resolved against the whole header (104px),
             * not against the row's own line (44px). Measured live: this header
             * is 104px tall because the experimental flag above is 60px, so each
             * row became 104px starting 60px down, and overflowed its parent by
             * exactly the flag's height. The header's `overflow` is `visible`, so
             * the excess painted *over* the thread — the override button's 96px
             * box struck a line through the first turn's text.
             *
             * The button's own 96px is the second half: a 104px row with
             * `align-items: normal` stretches its children, so a 36px button grew
             * to 104px minus this row's padding. Both halves come from the one
             * declaration, which is why one word fixes both.
             *
             * ⚠️ This is a trap at every `HStack` inside a block parent, not a
             * defect of this panel — filed on the register for a UIX task, since
             * changing `Stack` reaches several hundred call sites.
             */}
            {setupError && (
              <HStack UNSAFE_style={{ height: 'auto', alignItems: 'flex-start', gap: 6, padding: '0 12px' }}>
                <Icon icon={IconName.WarningCircleFilled} variant={FeedbackType.Danger} size={IconSize.Small} />
                <Text textType={TextType.Default}>{setupError}</Text>
              </HStack>
            )}
            {decision?.override && route === 'component' && (
              <HStack UNSAFE_style={{ height: 'auto', gap: 8, padding: '0 12px 8px' }}>
                <PrimaryButton
                  label={decision.override.label}
                  variant={PrimaryButtonVariant.Ghost}
                  onClick={applyOverride}
                />
              </HStack>
            )}
          </>
        }
        emptyState={
          <VStack UNSAFE_style={{ gap: 12 }}>
            {!isConfigured && (
              <HStack UNSAFE_style={{ alignItems: 'center', gap: 6 }}>
                <Icon icon={IconName.WarningTriangle} variant={FeedbackType.Notice} size={IconSize.Small} />
                <Text textType={TextType.Default}>
                  No AI provider is configured. Open Editor Settings to set one up.
                </Text>
              </HStack>
            )}
            {!hasProject && <Text textType={TextType.Default}>Open a project to build in it.</Text>}
            <Text textType={TextType.Shy}>
              Describe what you want. One component, a change spanning several, or the project's documents — the
              agent works out which, says so before it acts, and nothing reaches your project until you accept it.
            </Text>
            {/* The review banner is a suggestion, not a mode: it fills the
                composer rather than switching the panel to a third application. */}
            <ProjectReviewBanner onStart={() => setComposer(DOCS_SUGGESTION)} />
          </VStack>
        }
        value={composer}
        onChange={setComposer}
        onSend={() => void send()}
        canSend={hasProject && isConfigured && composer.trim().length > 0 && !busy}
        placeholder="Describe a component, a change across the app, or ask for the project docs…"
        busy={busy}
        onStop={stop}
      />
    </BasePanel>
  );
}
