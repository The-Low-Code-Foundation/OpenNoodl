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
import { createPortal } from 'react-dom';

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
  EXPAND_LABEL,
  expandSuggestion,
  freezeTurns,
  liveTurns,
  ON_CANVAS_NOTE,
  ON_REVIEW_NOTE,
  retiredTurns,
  REVIEW_LABEL,
  shouldOfferExpanding,
  stagedComponentCard,
  threadHost,
  THREADS_CHANGED,
  ThreadStore,
  type BuildIntent,
  type IntentDecision,
  type LiveSources,
  type ThreadsState,
  type Turn
} from '@noodl-models/AiAssistant/thread';
import { ThreadSidecar } from '@noodl-models/AiAssistant/thread/ThreadSidecar';
import { AppRegistry } from '@noodl-models/app_registry';
import { ProjectModel } from '@noodl-models/projectmodel';
import { buildEffectiveTokens, buildStyleVocabulary, readStoredTokens } from '@noodl-models/StyleTokensModel';

import { EditorSettings } from '@noodl-utils/editorsettings';

import { useSidePanelLayoutContext } from '../../../pages/EditorPage/useSidePanelLayout';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';
import { useModel } from '../../../hooks/useModel';
import { buildComponentV2Files } from '../../../io/ProjectExporter';
import { formatDiagnosticLine } from '../../../validation';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { FrameDivider, FrameDividerOwner } from '@noodl-core-ui/components/layout/FrameDivider';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { ExperimentalFlag } from '@noodl-core-ui/components/sidebar/ExperimentalFlag';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { AuthoringCandidatePane, AuthoringPreviewDocumentProvider } from '../../documents/AuthoringPreviewDocument';
// BLD-009 — the second host. `ExpandedBuildDocument` is a shell that publishes a
// box; this panel is the one thread instance and portals itself into it.
import {
  ExpandedBuildDocumentProvider,
  expandedContainer,
  onExpandedContainerChanged
} from '../../documents/ExpandedBuildDocument';
import { ChangeReviewDocumentProvider } from '../../documents/ChangeReviewDocument';
import { EditorDocumentProvider } from '../../documents/EditorDocument';
import { adoptScopePlan } from './adoptScopePlan';
// Shared with `ProjectAuthoringView`, which imports the same module — BLD-017's
// outcome card is rendered here, and the panel's layout rules already lived
// there under this name.
import css from './AiAuthoringPanel.module.scss';
import { ProjectAuthoringView } from './ProjectAuthoringView';
import { ProjectReviewBanner } from './ProjectReviewBanner';
import { ProjectReviewView } from './ProjectReviewView';
import { BuildThread, type ThreadWidth } from './thread/BuildThread';
import { Heartbeat } from './thread/Heartbeat';
import { ReferenceChips } from './thread/ReferenceChips';
import { ReferencePreview } from './thread/ReferencePreview';
import { ReferencePicker } from './thread/ReferencePicker';
import { RunHeader } from './thread/RunHeader';
import { ThreadSwitcher } from './thread/ThreadSwitcher';
// BLD-011 — the pure half (caps, carry-over, cost) and the half that reads a
// project. Kept apart for the reason the turn model is: the arithmetic is what
// a plain-Node spec can grade.
import {
  blockingReferences,
  carryOver,
  referenceMediaBlocks,
  renderReferenceBlock,
  toTurnReferences,
  type AttachedReference,
  type TurnReference
} from '../../../models/AiAssistant/thread/references';
import {
  attachmentCandidates,
  collectionCandidates,
  componentCandidates,
  docCandidates,
  pageCandidates,
  resolveCandidate,
  type ReferenceCandidate
} from '../../../models/AiAssistant/authoring/referenceSources';
// BLD-016 — `@`. The menu is a second door onto `refreshCandidates`' list; the
// hook is the loop that keeps the chip row equal to what the text says.
import { MentionMenu } from './thread/MentionMenu';
import { RenderCaptureControl } from './thread/RenderCaptureControl';
import { useComposerMentions } from './thread/useComposerMentions';
// BLD-013 — the three intake paths' one resolver, and BLD-014's capture. Both
// are `authoring/` modules for the same reason `referenceSources` is: they need
// a browser (a `<canvas>`, a `<webview>`), which is exactly what the pure half
// next door exists to stay free of.
import { ATTACHMENT_ACCEPT, resolveAttachment } from '../../../models/AiAssistant/authoring/fileReferences';
import { resolveLivePreviewCapture, resolveRenderCapture } from '../../../models/AiAssistant/authoring/captureReferences';
import { applyCount, noteApply, onApplyCountChanged } from '../../../models/AiAssistant/authoring/applyCount';
import { hasLivePreview, isExternalUrl, parseViewports } from '../../SandboxSurface';
// ⚠️ By path, not through the barrel: this is the one module that imports
// `electron`, and the barrel is shared with the component bench. See the note
// in `SandboxSurface/index.ts`.
import { renderCapture as runRenderCapture } from '../../SandboxSurface/renderCapture';
import type { AiContentBlock } from '../../../models/AiAssistant/client/content';

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

/**
 * ⚠️ BLD-011 — the declined and failed paths carry their attachments too.
 *
 * These are the turns that never reach a producer, so `liveTurns` never stamps
 * them; without this a request that was declined would show as having carried
 * nothing, which is the one reading that makes the attachment look like the
 * reason it was declined.
 */
function noteTurn(
  id: string,
  request: string,
  text: string,
  tone: 'notice' | 'danger',
  references?: TurnReference[]
): Turn {
  return {
    id,
    request,
    activities: [],
    ...(references && references.length > 0 ? { references } : {}),
    outcome: { kind: 'note', text, tone }
  };
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

/**
 * BLD-009 — whether the one-time offer of the wider workspace has been answered.
 *
 * ⚠️ In `EditorSettings`, not in module state, and that is what "one-time"
 * actually promises. A session-scoped flag re-offers on every restart, which is
 * the nag build item 5 rules out — the offer's whole job is to teach the header
 * control exists, and it is either learned or it is not.
 *
 * Not per project: the thing being taught is a piece of the editor, and a user
 * who has met it in one project has met it.
 */
const EXPAND_OFFER_SETTING = 'aiAuthoring.expandOffered';

export interface AiAuthoringPanelProps {
  /** BLD-009 renders the same thread as a document. One implementation, two hosts. */
  width?: ThreadWidth;
}

export function AiAuthoringPanel({ width = 'panel' }: AiAuthoringPanelProps = {}) {
  // ── The thread ─────────────────────────────────────────────────────────────
  //
  // D5: accepting used to call `setState(null)` and `session.dispose()` — what
  // you asked, what it read and what it repaired, gone at the moment it became
  // part of your project. Finished turns go to the store instead.
  //
  // ⚠️ BLD-006 moved this out of `useState`, and the reason is the one AIB-003
  // wrote down one directory over: a sidebar panel is hidden rather than
  // unmounted *most* of the time, and "most of the time" is the kind of
  // lifetime guarantee that becomes a data-loss defect two refactors later.
  // The store is also what makes the conversation survive a restart, a project
  // switch, and a second host (BLD-009 renders this same panel as a document).
  const threadStore = ThreadStore.instance;
  const [threads, setThreads] = useState<ThreadsState>(() => threadStore.get(ProjectModel.instance?.id));
  useEffect(() => {
    const context = {};
    threadStore.on(THREADS_CHANGED, () => setThreads({ ...threadStore.get(ProjectModel.instance?.id) }), context);
    return () => {
      threadStore.off(context);
    };
  }, [threadStore]);

  /**
   * The conversation on screen, and the turns already in it.
   *
   * `current` never returns undefined — the store creates an empty thread on
   * first ask — but the fallback is kept because `threads` is a snapshot taken
   * at a `setState`, and a snapshot from before a project switch can name a
   * thread this project does not have.
   */
  const currentThread = threads.threads.find((thread) => thread.id === threads.currentId) ?? threads.threads[0];
  const history = currentThread?.turns ?? [];

  /**
   * BLD-006 — the conversations this project left on disk.
   *
   * ⚠️ Keyed on the open project, not on the mount, and that is acceptance
   * criterion 3. The store is keyed by project id, but `threads` above is a
   * *snapshot* of one project's entry and `THREADS_CHANGED` does not fire when
   * the open project changes underneath it — so without this the panel would go
   * on showing project A's conversations after B opened, and append B's turns
   * into A's thread. Re-reading is what makes "switch away and back" return the
   * right history rather than the last one rendered.
   *
   * The read itself is `ProjectAuthoringView`'s saved-build shape and for the
   * same reason: *whether to ask again* outlives every mount, so the guard is
   * in the store rather than in a ref here — which is also why re-running this
   * on a switch back does not re-read the disk.
   */
  const [projectEpoch, setProjectEpoch] = useState(0);
  useEffect(() => {
    const context = {};
    EventDispatcher.instance.on(
      ['ProjectModel.instanceHasChanged', 'ProjectModel.importComplete'],
      () => setProjectEpoch((epoch) => epoch + 1),
      context
    );
    return () => {
      EventDispatcher.instance.off(context);
    };
  }, []);

  useEffect(() => {
    setThreads({ ...threadStore.get(ProjectModel.instance?.id) });
    const project = ProjectModel.instance;
    if (!project) return;
    void threadStore.consultSavedThreads(project.id, async () => {
      const directory = project._retainedProjectDirectory;
      if (!directory) return;
      // Lands in the store, not in this component's state, so a panel that
      // unmounted while the read was in flight still gets its history back.
      threadStore.restore(project.id, await ThreadSidecar.instance.readAll(directory));
    });
  }, [threadStore, projectEpoch]);

  /** Finished turns join the conversation they happened in. */
  const appendTurns = useCallback(
    (turns: readonly Turn[]) => threadStore.append(ProjectModel.instance?.id, turns),
    [threadStore]
  );

  /**
   * How many turns are already in the thread, read *now*.
   *
   * ⚠️ Every id this panel mints is `<something>-<position>`, and the render's
   * `history.length` is a value captured when the callback was created. `send`
   * appends inside `retire()` and can then append a declined note in the same
   * invocation — with a captured length both land on the same id, and two turns
   * sharing a React key is state leaking between them rather than an error
   * anyone sees. Reading the store at the point of use is the only version that
   * cannot go stale, and it is what the old `setHistory((turns) => …)`
   * functional updater was quietly providing before the store existed.
   */
  const threadLength = useCallback(
    () => threadStore.current(ProjectModel.instance?.id).turns.length,
    [threadStore]
  );
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

  /**
   * BLD-011 — what the next message carries besides the words.
   *
   * Lives beside `composer` and empties on the same event, because it is part
   * of the same message: the chip row and the text are one thing the user is
   * composing, and holding them in stores with different lifetimes is how a
   * turn ends up sending an attachment the user removed.
   */
  const [references, setReferences] = useState<AttachedReference[]>([]);
  const [candidates, setCandidates] = useState<ReferenceCandidate[]>([]);

  /**
   * Re-read the attachable things when the picker opens.
   *
   * Not on mount and not on an interval: components are created and renamed
   * while this panel sits idle, and a list assembled once at mount is wrong by
   * the time anybody opens it. Opening the list is the only moment its contents
   * are about to be read.
   */
  const refreshCandidates = useCallback(() => {
    const project = ProjectModel.instance;
    // BLD-016: four kinds, all from `ProjectModel` and the schema cache, so
    // they are in memory and land in this tick.
    const immediate = [
      ...componentCandidates(project),
      ...pageCandidates(project),
      ...collectionCandidates(project)
    ];
    setCandidates(immediate);
    // Docs are a filesystem read, so they land a tick later. Everything else is
    // already in memory and should not wait for them.
    void docCandidates().then((docs) => setCandidates([...immediate, ...docs]));
  }, []);

  const attachReference = useCallback(async (candidate: ReferenceCandidate) => {
    const resolved = await resolveCandidate(candidate, ProjectModel.instance);
    setReferences((current) => [...current, resolved]);
  }, []);

  /**
   * BLD-014 Rule 7 — how many times the agent has changed the project in this
   * run, so a capture can say how far behind it is.
   *
   * Subscribed rather than read at render: an Accept can land while the
   * composer sits untouched, and the chip has to grey *then*, not at whatever
   * moment React next happens to re-render this panel for some other reason.
   */
  const [applies, setApplies] = useState(applyCount);
  useEffect(() => onApplyCountChanged(() => setApplies(applyCount())), []);

  /**
   * BLD-013 — the one destination for drag-and-drop, paste and the picker.
   *
   * Resolved in parallel and appended in one `setReferences`, not one per file:
   * dropping five mocks through five sequential state updates renders five
   * intermediate chip rows, and the meter's total is wrong in four of them.
   */
  const attachFiles = useCallback(async (files: readonly File[]) => {
    if (files.length === 0) return;
    // The model that will serve the *plan* turn, which is where an attachment
    // first lands. See `AiClient.getRoleModel` for why this is not the active
    // model.
    const model = AiClient.getRoleModel('plan');
    const target = {
      modelLabel: model?.displayName ?? 'This model',
      supportsDocuments: model?.capabilities.documents === true
    };
    const resolved = await Promise.all(files.map((file, index) => resolveAttachment(file, target, index)));
    setReferences((current) => [...current, ...resolved]);
  }, []);

  /**
   * BLD-014 — `◎ Look at it`, the webview half.
   *
   * ⚠️ Q6 is answered for the *receipt* (Richard: a one-click offer after an
   * apply, not an automatic render on every one). This control is the other
   * half of that decision: the offer has to exist somewhere the user can reach
   * it mid-conversation too, or "one click after an apply" is the only moment
   * the feature is ever available.
   */
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Whether there is a preview mounted to capture.
   *
   * ⚠️ Polled rather than subscribed, and 500ms is deliberate. The registry is
   * written from a `<webview>` ref callback in a *different* document tree —
   * there is no React path from that mount to this panel's render, and adding
   * an event bus for a boolean that changes when the user opens a document is a
   * larger mechanism than the fact deserves. Half a second is under the time it
   * takes to look down at the composer after opening a preview.
   */
  const [previewLive, setPreviewLive] = useState(hasLivePreview);
  useEffect(() => {
    const timer = setInterval(() => setPreviewLive(hasLivePreview()), 500);
    return () => clearInterval(timer);
  }, []);

  const captureLive = useCallback(async () => {
    const resolved = await resolveLivePreviewCapture();
    if (resolved) setReferences((current) => [...current, resolved]);
  }, []);

  /**
   * BLD-014 — the CDP producer, behind `Render…`.
   *
   * ⚠️ It throws rather than attaching a failed chip, which is the opposite of
   * every other resolver on this row. A dropped file that cannot be read is
   * still a thing the user put there and the chip is where they will look for
   * the reason; a render that never produced a picture attached nothing, so a
   * chip saying so would be a row entry for an event rather than a reference.
   * The popup that asked for the URL is still open and is where the answer
   * belongs.
   */
  const renderCapture = useCallback(async (url: string, viewportSpec: string) => {
    const parsed = parseViewports(viewportSpec);
    if ('error' in parsed) throw new Error(parsed.error);

    const result = await runRenderCapture({ url, viewports: parsed.viewports });
    if (result.error) throw new Error(result.error);

    const resolved = await resolveRenderCapture(url, result.captures, isExternalUrl(url));
    setReferences((current) => [...current, ...resolved]);
  }, []);

  /**
   * The capture the user asked to look at.
   *
   * Held here rather than in `ReferenceChips` because the viewer is a
   * full-window overlay: a surface that escapes the panel should not be owned
   * by a control inside it.
   */
  const [previewing, setPreviewing] = useState<AttachedReference | null>(null);

  /**
   * BLD-009 — the one-time offer, already answered.
   *
   * Read once at mount. `EditorSettings` is the durable half; this is the copy
   * the render reads, so dismissing the offer removes it immediately rather than
   * at the next unrelated re-render.
   */
  const [offerAnswered, setOfferAnswered] = useState<boolean>(() =>
    Boolean(EditorSettings.instance.get(EXPAND_OFFER_SETTING))
  );

  const togglePin = useCallback((id: string) => {
    setReferences((current) => current.map((ref) => (ref.id === id ? { ...ref, pinned: !ref.pinned } : ref)));
  }, []);

  /**
   * BLD-016 — `@`, and the reason this is a hook rather than more of this file.
   *
   * It owns the caret, the menu's highlight and the loop that keeps the chip row
   * equal to what the composer text says. The panel keeps the two stores
   * (`composer`, `references`) because they are the message, and hands them over
   * — a mention is not a third store, it is a *derivation* of the first onto the
   * second.
   *
   * ⚠️ It also owns the chip row's Remove button, which is why there is no
   * plain remover here any more: removing a mention chip has to delete its
   * token too, or reconciliation puts the chip straight back and the control
   * reads as broken.
   */
  const mentions = useComposerMentions({
    text: composer,
    setText: setComposer,
    references,
    setReferences,
    // The `@` menu can name what is already on the row (BLD-016's fifth kind);
    // the Add-context button cannot, so the attachments are added here rather
    // than inside `refreshCandidates`.
    candidates: useMemo(
      () => [...candidates, ...attachmentCandidates(references)],
      [candidates, references]
    ),
    refreshCandidates,
    isEnabled: Boolean(ProjectModel.instance)
  });

  /** What the current attachments will cost, and whether any of them blocks. */
  const referencesBlock = blockingReferences(references).length > 0;

  /** What the current live work is, and what the agent said it was. */
  const [route, setRoute] = useState<BuildIntent | null>(null);
  const [decision, setDecision] = useState<IntentDecision | null>(null);
  /** The plan the decision was made from — the override needs it. */
  const lastPlanRef = useRef<AuthoringPlan | null>(null);

  const [planningRequest, setPlanningRequest] = useState<string | null>(null);
  /**
   * The request the *live* work belongs to, which outlives the planning call.
   *
   * Separate from `planningRequest` because they end at different moments:
   * planning is over as soon as a plan comes back, while a docs review that the
   * plan started can run for minutes afterwards — and it is the only producer
   * that cannot recover the request from its own state. See `LiveSources.request`.
   */
  const [liveRequest, setLiveRequest] = useState<string | null>(null);
  /**
   * BLD-011 — what the *live* request carried, as the persisted record.
   *
   * Separate from `references`, which is the composer's list and has already
   * moved on: by the time a turn is live, `carryOver` has dropped the unpinned
   * ones, and rendering the composer's current list onto the running turn would
   * show a turn carrying attachments it never sent. Same lifetime as
   * `liveRequest`, and cleared by the same `retire()`.
   */
  const [liveReferences, setLiveReferences] = useState<TurnReference[] | null>(null);
  const planAbortRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<AuthoringSessionState | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [refineText, setRefineText] = useState('');
  const sessionRef = useRef<AuthoringSession | null>(null);

  const [reviewState, setReviewState] = useState<ProjectReviewState | null>(() =>
    ProjectReviewStore.instance.getState()
  );
  // ⚠️ BLD-008 removed this panel's `reviewRunRef`. The run lives on
  // `ProjectReviewStore` now, because `ProjectReviewView` needs it too — and its
  // own ref was never filled, so its Stop button had been calling
  // `null?.cancel()` ever since this panel became a thread. One owner, and every
  // reader looks in the same place.

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
    () => ({
      route,
      session: state,
      planSession,
      runState,
      reviewState,
      decision,
      request: liveRequest,
      ...(liveReferences && liveReferences.length > 0 ? { references: liveReferences } : {})
    }),
    [route, state, planSession, runState, reviewState, decision, liveRequest, liveReferences]
  );

  // ── Sending ────────────────────────────────────────────────────────────────

  /**
   * B9 — a new request retires the previous one instead of erasing it.
   *
   * Freeze the record, then release what produced it. Both halves are required:
   * `retiredTurns` re-prefixes the ids so no live control mounts on a
   * historical turn, and dropping the sources is what stops the frozen copy and
   * the live derivation being on screen together.
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
    const retired = retiredTurns(threadLength(), liveSources);
    const hadLive = retired.length > 0;
    appendTurns(retired);

    sessionRef.current?.dispose();
    sessionRef.current = null;
    setState(null);
    setRoute(null);
    setDecision(null);
    setLiveRequest(null);
    setLiveReferences(null);
    if (AppRegistry.instance.CurrentDocumentId === AuthoringPreviewDocumentProvider.ID) {
      AppRegistry.instance.openDocument(EditorDocumentProvider.ID);
    }

    // ⚠️ Guarded on there having *been* something, and that guard is not an
    // optimisation: `discard` removes the AIB-003 sidecar, and a saved build
    // from a previous launch is restored asynchronously. Releasing sources that
    // hold nothing would delete a build that had not finished coming back yet.
    if (!hadLive) return;
    // `clear()` drops the run with the state — see `ProjectReviewStore`.
    ProjectReviewStore.instance.clear();
    store.discard(ProjectModel.instance?.id);
  }, [appendTurns, threadLength, liveSources, store]);

  /**
   * Hand a plan to the path it belongs to.
   *
   * The `plan` branch writes to the store and nothing else: the plan is
   * proposed, prunable, and nothing is built until the user approves it. That
   * is the pre-existing AIX-011 contract, reached now by describing the work
   * rather than by picking a tab first.
   */
  const routePlan = useCallback(
    async (
      intent: BuildIntent,
      plan: AuthoringPlan,
      request: string,
      references?: string,
      referenceMedia?: AiContentBlock[]
    ) => {
      const project = ProjectModel.instance;
      if (!project) return;
      setRoute(intent);

      if (intent === 'plan') {
        store.update(project.id, {
          description: request,
          // BLD-011 — in memory only; `snapshotSession` deliberately omits it,
          // so a plan restored from disk carries no attachments rather than
          // stale copies of components that have since changed.
          references,
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
          // ⚠️ BLD-008 — this now returns with the questions on screen, not with
          // three drafts. `startProjectReview` publishes the run to
          // `ProjectReviewStore`; drafting is a second call, made by the card
          // when the interview is settled.
          await startProjectReview(project);
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
        // BLD-011 — the attachments ride into the opening turn's variable half,
        // beside `planContext`. This is the path where Rule 6 actually binds:
        // it is the only one of the three that carries a `cacheBoundary`.
        // BLD-013/014 — and the media rides in the same half, placed by
        // `openingTurnWithMedia`. 🔴 Read its docstring before touching the
        // order: this is the one route with a cache boundary, so a picture put
        // ahead of it re-bills the entire stable prefix on every operation of
        // every plan, silently.
        const sessionOptions = { ...styleOptions, references, referenceMedia };
        const session = existing
          ? AuthoringSession.createUpdate(
              fromProjectModel(project),
              authoringRequest,
              buildComponentV2Files(existing.toJSON(), new Date().toISOString()),
              sessionOptions
            )
          : AuthoringSession.create(fromProjectModel(project), authoringRequest, sessionOptions);
        sessionRef.current = session;
        session.onChange(setState);
        setState(session.state);

        /*
         * The payoff moment is watching the graph form — put the preview canvas
         * up before the first token arrives.
         *
         * ⚠️ BLD-009 — **unless the expanded workspace is already showing.**
         * There is one document surface, so opening the preview from inside the
         * expanded host would replace the host with it: the thread's portal
         * target would unmount mid-request and the conversation would snap back
         * to the rail at the exact moment the user asked for something. The
         * expanded host renders the same candidate in its right-hand pane, from
         * the same `AuthoringCandidatePane`, so nothing is lost by staying put.
         *
         * Read off `AppRegistry` rather than the `host` derived in the render:
         * this callback is `useCallback([store])` and would otherwise close over
         * a stale host from whenever it was last created.
         */
        if (
          threadHost(AppRegistry.instance.CurrentDocumentId, ExpandedBuildDocumentProvider.ID) !== 'document'
        ) {
          AppRegistry.instance.openDocument(AuthoringPreviewDocumentProvider.ID, {
            session,
            onAccept: () => handlersRef.current.accept(),
            onDiscard: () => handlersRef.current.discard(),
            onOpenReview: () => handlersRef.current.openReview()
          });
        }

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

    // BLD-011 — resolved once, here, into the words this turn sends. The chips
    // already read their sources when they were attached, so this is a render
    // of what the user has been looking at rather than a second, later read
    // that could disagree with the sizes on screen.
    const attached = references;
    // BLD-014 — `applies` is passed so a stale capture states its age *in the
    // prompt text*. Rule 7's "nothing stale is ever sent silently" is this
    // argument, not the grey border on the chip: the border tells the user, the
    // sentence tells the model.
    const referenceBlock = renderReferenceBlock(attached, applies);
    // BLD-013/014 — the half that cannot be a string. Empty for every turn that
    // carries only text attachments, which is what keeps those turns
    // byte-identical to the ones BLD-011 shipped.
    const referenceMedia = referenceMediaBlocks(attached);

    setComposer('');
    // Rule 7 — pinned references ride the next turn; unpinned ones perish,
    // having ridden exactly the turn they were attached to. Applied here rather
    // than after the await for the same reason `retire()` is: everything that
    // decides what this turn *was* must happen before anything can interleave.
    setReferences(carryOver(attached));
    // Before anything is awaited, so the thread's order is an invariant rather
    // than a race: history is always older than the pending turn, which is
    // always older than whatever is live.
    retire();
    setSetupError(null);
    setPlanningRequest(request);
    // Survives the planning call, and is cleared by the next `retire()`. A docs
    // review can still be running long after `planningRequest` has gone.
    setLiveRequest(request);
    setLiveReferences(toTurnReferences(attached));
    try {
      const session = new PlanningSession(fromProjectModel(project), request, {
        references: referenceBlock,
        referenceMedia
      });
      planAbortRef.current = new AbortController();
      const outcome = await session.run({ abortController: planAbortRef.current });

      if (outcome.status === 'planned' && outcome.plan) {
        lastPlanRef.current = outcome.plan;
        const next = decideIntent(outcome.plan);
        setDecision(next);
        await routePlan(next.intent, outcome.plan, request, referenceBlock, referenceMedia);
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
      appendTurns([
        noteTurn(
          `declined-${threadLength()}`,
          request,
          text,
          outcome.status === 'declined' ? 'notice' : 'danger',
          toTurnReferences(attached)
        )
      ]);
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      appendTurns([noteTurn(`failed-${threadLength()}`, request, text, 'danger', toTurnReferences(attached))]);
    } finally {
      planAbortRef.current = null;
      setPlanningRequest(null);
    }
  }, [appendTurns, applies, composer, references, retire, routePlan, threadLength]);

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
      ...(session.baseComponentFiles ? { baseline: session.baseComponentFiles } : {}),
      // REL-002a — see ProjectAuthoringView: `null` means the project has not decided.
      bodyScroll: typeof project.getSettings().bodyScroll === 'boolean' ? !!project.getSettings().bodyScroll : null
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
      // candidate is in the project now — but the record of it outlives it,
      // and since BLD-006 it outlives the process too.
      // BLD-014 Rule 7 — the project has changed, so every capture taken
      // before this moment now depicts something that no longer exists. One
      // call, on the one path that writes to the project from this panel.
      noteApply();
      const at = threadLength();
      const live = componentTurns(session.state, {
        idPrefix: `history-${at}-component`,
        ...(decision ? { sentence: decision.sentence, intent: decision.intent } : {})
      });
      appendTurns([...freezeTurns(live), acceptedTurn(session.legacyName, session.mode, `accepted-${at}`)]);
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
  }, [appendTurns, decision, threadLength]);

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
        idPrefix: `history-${threadLength()}-component`,
        ...(decision ? { sentence: decision.sentence, intent: decision.intent } : {})
      });
      appendTurns(freezeTurns(live));
    }
    session?.dispose();
    sessionRef.current = null;
    setState(null);
    setRoute(null);
    setDecision(null);
    if (AppRegistry.instance.CurrentDocumentId === AuthoringPreviewDocumentProvider.ID) {
      AppRegistry.instance.openDocument(EditorDocumentProvider.ID);
    }
  }, [appendTurns, decision, threadLength]);

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

  const live = useMemo(() => liveTurns(liveSources), [liveSources]);

  /**
   * R6 — the request rendered twice, and the pending turn is why.
   *
   * `pendingTurn` exists to carry the user's words while the planning call is
   * in flight, because at that moment nothing else has them. The moment a
   * producer takes over, it has them too: a component session pushes
   * `{kind:'user'}` at the top of `run()`, and a plan turn carries
   * `plan.request`. So the request was on screen twice for the whole of every
   * component build — and it *looked* like a retired turn, because
   * `composeThread` clears `busy` on all but the last, leaving a bare bubble
   * above the live one.
   *
   * ⚠️ The obvious fix — clear `planningRequest` once the route is decided —
   * is wrong, and the docs path is where it shows. `routePlan` sets the route
   * and then **awaits** `startProjectReview`, so there is a render in between
   * with a route and no producer state; clearing there would blank the thread
   * and drop `busy` at the same instant. The condition is therefore about what
   * is *on screen*, not about what has been decided: the pending turn stands in
   * for the live turns until there are some.
   *
   * ⚠️ A docs run genuinely has nowhere to put the request — `docsTurns` takes
   * one but `liveTurns` has never had it to give. That is why `LiveSources`
   * carries `request` now: without it the fix would trade a duplicated request
   * for a vanished one.
   */
  const turns = useMemo(
    () => composeThread(history, planningRequest && live.length === 0 ? [pendingTurn(planningRequest)] : [], live),
    [history, planningRequest, live]
  );

  /** The turn the live plan view attaches to. See `renderOutcome`. */
  const lastPlanTurnId = useMemo(() => {
    const planIds = turns.filter((turn) => turn.id.startsWith('plan-')).map((turn) => turn.id);
    return planIds.length > 0 ? planIds[planIds.length - 1] : null;
  }, [turns]);

  const canDecide = Boolean(state && !state.busy && state.staged);
  const busy = Boolean(planningRequest || state?.busy || runState?.busy || reviewState?.busy);

  /**
   * BLD-006 — the two controls in the switcher answer to different rules, and
   * the difference is the phase's data-loss doctrine, not an inconsistency.
   *
   * **New thread** is allowed exactly when Send is. Starting a new conversation
   * is at least as strong a statement as sending a new request, and `retire()`
   * already encodes that contract — freeze the record, release the sources.
   *
   * ⚠️ **Switching to an existing thread is navigation, and navigation may not
   * destroy.** AIB-003's rule is that authored output is durable from the
   * moment it validates and nothing may destroy it without the user saying so.
   * Opening a dropdown to read yesterday's conversation is not the user saying
   * so, and routing it through `retire()` would mean a staged eight-node
   * component evaporating on a click. Nor may the switch simply *happen*: the
   * live turns are appended to whatever thread is current, and `renderOutcome`
   * matches live ids — so the Accept card would mount under a conversation it
   * has nothing to do with. It refuses, and says why.
   */
  const switchLockedReason = busy
    ? 'A build is running — it will still be here when it finishes.'
    : live.length > 0
      ? 'This build is still on screen. Accept it, discard it, or start a new thread.'
      : undefined;

  const newThread = useCallback(() => {
    // In this order: the live work is retired into the thread it happened in,
    // and only then does the current thread change under it.
    retire();
    threadStore.newThread(ProjectModel.instance?.id);
  }, [retire, threadStore]);

  const selectThread = useCallback(
    (threadId: string) => threadStore.select(ProjectModel.instance?.id, threadId),
    [threadStore]
  );

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
    else if (reviewState?.busy) ProjectReviewStore.instance.getRun()?.cancel();
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
        /*
         * BLD-017 F2 — the mockup's `.card`: a bordered object with its
         * decisions in a footer band, instead of a paragraph followed by three
         * buttons that happened to be underneath it.
         *
         * ⚠️ The two lines come from `stagedComponentCard`, not from here. This
         * sentence and `OutcomeSummary`'s were character-for-character
         * duplicates before this task, and splitting it into a title and a sub
         * would have made that two copies of two strings — see `outcomeCard.ts`.
         */
        const card = stagedComponentCard(turn.outcome);
        return (
          <div className={css['OutcomeCard']}>
            <div className={css['OutcomeTop']}>
              <Text textType={TextType.Proud} className={css['OutcomeTitle']}>
                {card.title}
              </Text>
              {card.detail && (
                <Text textType={TextType.Shy} className={css['OutcomeSub']}>
                  {card.detail}
                </Text>
              )}
            </div>
            <div className={css['OutcomeRefine']}>
              <TextInput
                value={refineText}
                placeholder="Ask for changes…"
                isDisabled={state?.busy}
                onChange={(event) => setRefineText(event.target.value)}
                onEnter={refine}
              />
            </div>
            {/* BLD-003 D2: exactly one surface owns these at a time, and it is
                whichever one is showing the candidate. With the preview canvas
                up, the decision belongs beside the graph it is about — the card
                says where the buttons went rather than going quiet, because a
                card that simply dropped them reads as a candidate that can no
                longer be accepted. */}
            {owner === 'thread' ? (
              <div className={css['OutcomeActions']}>
                <PrimaryButton label={acceptLabel(turn.outcome.mode)} icon={IconName.Check} onClick={accept} />
                <PrimaryButton label={REVIEW_LABEL} variant={PrimaryButtonVariant.Ghost} onClick={openReview} />
                {/* D3: nothing has been written, so discarding destroys nothing
                    — and red means danger. The Docs panel already got this
                    right one screen over. */}
                <PrimaryButton label={DISCARD_LABEL} variant={PrimaryButtonVariant.Ghost} onClick={discard} />
              </div>
            ) : (
              <div className={css['OutcomeNote']}>
                <Text textType={TextType.Shy}>
                  {AppRegistry.instance.CurrentDocumentId === ChangeReviewDocumentProvider.ID
                    ? ON_REVIEW_NOTE
                    : ON_CANVAS_NOTE}
                </Text>
              </div>
            )}
          </div>
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

  // ── BLD-009: the second host ───────────────────────────────────────────────
  //
  // 🔴 **This component is mounted once and rendered in two places.** It is not
  // mounted twice, and the difference is the whole task: everything a run needs
  // — `sessionRef`, `state`, `planSession`, the composer's text, every
  // subscription above — is `useState` and `useRef` *here*, so a second mount
  // would be a second, empty panel and "expand mid-run, nothing restarts" would
  // be impossible rather than merely unbuilt. `SidePanel` keeps every visited
  // panel mounted behind `display: none`, so this instance is alive whichever
  // document is on screen; expanding changes only where it paints.
  //
  // ⚠️ The host is *derived*, never stored — same rule, same reason as
  // `decisionOwner` above, and it shares that subscription (`useModel` on
  // `documentChanged`). A stored boolean would be falsified silently by every
  // other route out of this document, and there are several: Accept switches
  // the canvas to the component it wrote, Review changes opens the diff.
  const host = threadHost(AppRegistry.instance.CurrentDocumentId, ExpandedBuildDocumentProvider.ID);

  /**
   * The box the expanded document is offering, if one is mounted.
   *
   * Read at mount as well as subscribed to: this panel can remount underneath a
   * live document (the sidebar's error boundary and its hot reload both do it),
   * and an event that has already fired is not going to fire again.
   */
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(() => expandedContainer());
  useEffect(() => onExpandedContainerChanged(() => setPortalTarget(expandedContainer())), []);

  /**
   * Where the thread was scrolled to, kept across the change of host.
   *
   * Declared here rather than in `BuildThread` because that component is what
   * remounts: a portal whose container changes is a delete and a recreate, so
   * every DOM node under it — and every ref declared inside it — is new. This
   * one survives because this component does.
   */
  const threadScroll = useRef(0);

  /** How wide the thread column is in the expanded host. The mockup's ~520px. */
  const [expandedSplit, setExpandedSplit] = useState(520);
  const [expandedWidth, setExpandedWidth] = useState<number | undefined>(undefined);

  /**
   * 🔴 Expanding gives the rail's width to the workspace it opens.
   *
   * A document sits *beside* the sidebar rather than over it (BLD-003 states
   * this, and it is why `decisionOwner` exists at all) — so without this, "the
   * wide workspace" was measurably narrower than the surface it replaced: on a
   * 1368px window the rail took 452px and left the candidate pane 396px, which
   * is less than the 400px panel the whole task exists to escape. The feature
   * does not deliver its own premise unless the rail stands down.
   *
   * ⚠️ Only reversed if *we* hid it. A user who had already collapsed the
   * sidebar and then collapses the thread must not have it thrown back open —
   * and `hideIfShown` is idempotent precisely so this stays one flag rather than
   * a second reading of the mode.
   */
  const layout = useSidePanelLayoutContext();
  const railHiddenByExpand = useRef(false);

  /*
   * 🔴 The rail comes back when the thread leaves the expanded host — by any
   * route, not just the Collapse button.
   *
   * This is `ExpandedBuildDocument`'s own lesson one level up, and it took a
   * drive to see it: **Accept switches the canvas to the component it just
   * wrote**, and Review changes opens the diff. Neither goes near Collapse. Hung
   * off that button, the reveal would leave the sidebar hidden *and* the
   * expanded document gone — the Build thread mounted, alive, holding the run,
   * and on screen nowhere at all.
   *
   * Keyed on the derived host rather than on a click, so every exit is one exit.
   */
  const previousHost = useRef(host);
  useEffect(() => {
    const left = previousHost.current === 'document' && host === 'panel';
    previousHost.current = host;
    if (!left || !railHiddenByExpand.current) return;
    railHiddenByExpand.current = false;
    layout?.revealIfHidden();
  }, [host, layout]);

  const expand = useCallback(() => {
    // One-time, and *accepting* the offer answers it as surely as dismissing —
    // a user who has been here has found the control.
    EditorSettings.instance.set(EXPAND_OFFER_SETTING, true);
    setOfferAnswered(true);
    if (layout && layout.mode !== 'hidden') {
      railHiddenByExpand.current = true;
      layout.hideIfShown();
    }
    AppRegistry.instance.openDocument(ExpandedBuildDocumentProvider.ID);
  }, [layout]);

  const collapse = useCallback(() => {
    /*
     * ⚠️ Collapsing with a candidate live puts the preview document back, rather
     * than dropping to the canvas.
     *
     * In the expanded host the candidate is the right-hand pane; in the rail it
     * has nowhere to go, and `AuthoringPreviewDocumentProvider` is where it has
     * lived since AIX-002. Returning to the bare canvas instead would make
     * collapsing look like it had thrown the staged component away — and the
     * thread's card would then be the only surface with it, which is the exact
     * ownership `decisionOwner` re-derives one line later.
     */
    const session = sessionRef.current;
    if (session && state) {
      AppRegistry.instance.openDocument(AuthoringPreviewDocumentProvider.ID, {
        session,
        onAccept: () => handlersRef.current.accept(),
        onDiscard: () => handlersRef.current.discard(),
        onOpenReview: () => handlersRef.current.openReview()
      });
      return;
    }
    AppRegistry.instance.openDocument(EditorDocumentProvider.ID);
  }, [state]);

  /**
   * Build item 5 — the offer, at the moment it helps.
   *
   * A plan the rail cannot hold is the moment: it is the first time the panel is
   * demonstrably too small for what is in it, and the count is on screen for the
   * user to check the sentence against. The rule itself is pure and specced —
   * see `thread/expanded.ts` — so what is left here is reading the two facts.
   */
  const planOperationCount = planSession.plan?.operations.length ?? 0;
  const offerExpanding = shouldOfferExpanding({
    operationCount: planOperationCount,
    isExpanded: host === 'document',
    offered: offerAnswered
  });

  const expandNotice = offerExpanding ? (
    <div className={css['ExpandOffer']} data-test="expand-offer">
      {/*
       * ⚠️ The glyph is grouped with the sentence rather than being a sibling of
       * it, and that is a flexbox fact rather than a preference: `flex-wrap`
       * wraps a line *before* it shrinks the items on it, so a `flex: 1 1 auto`
       * paragraph whose content is longer than the row claims the whole line and
       * pushes a 14px icon onto one of its own. Measured at the shipped 400px:
       * three rows and **113px** for one dismissible offer.
       *
       * It is the same `Columns` glyph as the header control, which is the
       * reason it earns its place at all — the offer's real job is to teach
       * where the permanent control is.
       */}
      <span className={css['ExpandOfferText']}>
        <Icon icon={IconName.Columns} size={IconSize.Small} />
        <Text textType={TextType.Default}>{expandSuggestion(planOperationCount)}</Text>
      </span>
      <PrimaryButton
        label="Open it"
        variant={PrimaryButtonVariant.Ghost}
        size={PrimaryButtonSize.Small}
        onClick={expand}
        testId="expand-offer-accept"
      />
      <button
        type="button"
        className={css['ExpandOfferDismiss']}
        data-test="expand-offer-dismiss"
        onClick={() => {
          EditorSettings.instance.set(EXPAND_OFFER_SETTING, true);
          setOfferAnswered(true);
        }}
      >
        Not now
      </button>
    </div>
  ) : undefined;

  const thread = (
    <BuildThread
        width={host === 'document' ? 'expanded' : width}
        scrollMemory={threadScroll}
        {...(expandNotice ? { notice: expandNotice } : {})}
        turns={turns}
        renderOutcome={renderOutcome}
        runHeader={<RunHeader state={runState} />}
        heartbeat={heartbeat}
        header={
          <>
            {/* The flag moves to the header, out of the turn list, where it
                stops competing with the task. It is honest and it stays. */}
            <ExperimentalFlag />
            {/* BLD-006. The slot BLD-005 deliberately left free — it took a
                separate `runHeader` so the two would not fight over one node,
                because they have opposite lifetimes. */}
            <ThreadSwitcher
              threads={threads.threads}
              currentId={threads.currentId}
              onSelect={selectThread}
              onNew={newThread}
              canStartNew={!busy}
              {...(switchLockedReason ? { lockedReason: switchLockedReason } : {})}
            />
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
        composerAccessory={
          <VStack UNSAFE_style={{ gap: 6 }}>
            <ReferenceChips
              references={references}
              onTogglePin={togglePin}
              onRemove={mentions.removeReference}
              applyCount={applies}
              onPreview={setPreviewing}
            />
            {/*
              * 🔴 A plain wrapping row, not an `HStack`, and the drive is why.
              *
              * BLD-011 shipped this as an `HStack` holding one 112px button, so
              * it could not overflow. Adding `Attach` (80px) and `Look at it`
              * (95px) takes the row to 299px plus the composer's 24px padding —
              * and an `HStack` does not wrap. Swept across the panel's real
              * width range it overflowed by **71px at 248px** and **19px at
              * 300px**, zero from 340px up. The shipped default is 400px, which
              * is exactly why nothing caught it: the defect lives entirely
              * below the value anyone spot-checks.
              *
              * ⚠️ `HStack` also forces `height: 100%` on every child, which is
              * what the `height: 'auto'` override above was for — a plain flex
              * row needs neither that nor the override.
              */}
            <div className={css['ComposerControls']}>
              <ReferencePicker
                candidates={candidates}
                attachedTargets={new Set(references.map((ref) => ref.target))}
                onAttach={(candidate) => void attachReference(candidate)}
                onOpen={refreshCandidates}
                isDisabled={!hasProject}
              />
              {/*
               * BLD-013's third intake path. A hidden input rather than
               * Electron's `dialog.showOpenDialog`: the same `File` objects the
               * drop and paste paths produce, so one resolver serves all three
               * — and no main-process round trip to open a file the renderer
               * then has to read back off disk anyway.
               */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ATTACHMENT_ACCEPT}
                style={{ display: 'none' }}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  // Cleared so that picking the *same* file twice in a row
                  // still fires `change` — the input compares values, and a
                  // second attach of one mock is a legitimate thing to want.
                  event.target.value = '';
                  void attachFiles(files);
                }}
              />
              <PrimaryButton
                label="Attach"
                icon={IconName.ImportSlanted}
                variant={PrimaryButtonVariant.MutedOnLowBg}
                size={PrimaryButtonSize.Small}
                isDisabled={!hasProject}
                onClick={() => fileInputRef.current?.click()}
                testId="attach-file"
              />
              {/*
               * BLD-014's webview grab. Greyed with no preview mounted rather
               * than hidden: a control that appears and disappears as documents
               * change is one the user never learns exists.
               *
               * ⚠️ `MutedOnLowBg`, like its neighbours — `Ghost`'s accent label
               * measured 4.33:1 in light on this exact ground three tasks
               * running, and a fourth call-site override would be a fourth copy
               * of one token defect that can disagree with the other three.
               */}
              <PrimaryButton
                label="Look at it"
                icon={IconName.Image}
                variant={PrimaryButtonVariant.MutedOnLowBg}
                size={PrimaryButtonSize.Small}
                isDisabled={!hasProject || !previewLive}
                onClick={() => void captureLive()}
                testId="capture-preview"
              />
              {/*
               * BLD-014's CDP producer — the second of the task's two, and the
               * only one that can name a viewport or a URL. Not greyed with the
               * preview down, unlike `Look at it`: this one does not need a
               * mounted webview, because it opens its own window.
               */}
              <RenderCaptureControl onRender={renderCapture} isDisabled={!hasProject} />
              {/*
               * BLD-016 — the `@` menu, inside `.ComposerControls` because that
               * is the positioned ancestor `.List` resolves against (the same
               * one `ReferencePicker` documents at both ends). It is absolutely
               * positioned, so it is out of flow and the control row measures
               * 30px whether it is open or shut.
               */}
              {mentions.menu && (
                <MentionMenu
                  query={mentions.menu.query}
                  candidates={mentions.menu.candidates}
                  activeIndex={mentions.menu.activeIndex}
                  onActiveIndexChange={mentions.setActiveIndex}
                  onPick={mentions.pick}
                />
              )}
            </div>
            {/*
             * 🔴 Build item 4 — a mention that resolves to nothing is refused
             * *here*, before Send, and this line is the whole of the refusal.
             *
             * AIB-010's finding was that a name typed into a parameter is never
             * checked for resolving, so a wrong one silently means nothing. A
             * composer is the second place that could happen and it is worse,
             * because the user watched themselves write it. Blocking is
             * therefore deliberate — and so is `Not a mention`: somebody asking
             * about `@media` queries must not be trapped in a composer that
             * will not send, and dismissing marks the token without touching a
             * character of what they wrote.
             */}
            {mentions.refusals.map((refusal) => (
              <div key={refusal.token} className={css['MentionRefusal']} data-test="mention-refusal">
                <Icon icon={IconName.WarningTriangle} variant={FeedbackType.Danger} size={IconSize.Tiny} />
                <Text textType={TextType.Default} isSpan>
                  {refusal.token} — {refusal.reason}
                </Text>
                <button
                  type="button"
                  className={css['MentionDismiss']}
                  onClick={() => mentions.dismiss(refusal.token)}
                >
                  Not a mention
                </button>
              </div>
            ))}
          </VStack>
        }
        composer={mentions.bindings}
        onComposerFiles={(files) => void attachFiles(files)}
        value={composer}
        onChange={setComposer}
        onSend={() => void send()}
        /*
         * BLD-011 build item 6 — an attachment that could not be read blocks the
         * send. Folded into the one condition that already governs both the Send
         * button and the Enter key, rather than a second rule beside it: two conditions that
         * can disagree is exactly the defect BLD-001 fixed here when the button
         * and the key answered to different state.
         */
        canSend={
          hasProject &&
          isConfigured &&
          composer.trim().length > 0 &&
          !busy &&
          !referencesBlock &&
          // BLD-016 build item 4, in the same single condition and for the same
          // reason: a mention naming nothing is a message that says something
          // the request does not carry.
          !mentions.blocksSend
        }
      placeholder="Describe a component, a change across the app, or ask for the project docs…"
      busy={busy}
      onStop={stop}
    />
  );

  /**
   * What the expanded host puts to the right of the thread.
   *
   * ⚠️ Gated on `state`, not on `sessionRef.current`: a ref read during render
   * is not a subscription, so a pane keyed off it would keep the last candidate
   * on screen after a discard until something unrelated re-rendered. `state` is
   * the value every other surface here already reacts to, and it goes null in
   * the same call that clears the ref.
   */
  const candidate =
    state && sessionRef.current ? (
      <AuthoringCandidatePane session={sessionRef.current} state={state} />
    ) : (
      <div className={css['ExpandedEmpty']}>
        <Text textType={TextType.Shy}>
          A component the agent builds appears here as it forms, beside the graph it is assembling. A plan reports
          its operations in the thread.
        </Text>
      </div>
    );

  /**
   * The thread, in whichever host is live.
   *
   * ⚠️ `ReferencePreview` travels with it rather than staying at the panel root.
   * It is a full-window overlay, and an overlay rendered inside a `display:
   * none` ancestor draws nothing — which is what would happen the moment the
   * user opened the capture viewer from the expanded workspace and then clicked
   * any other rail icon. It belongs to the thread; it goes where the thread is.
   */
  const body = (
    <>
      {host === 'document' ? (
        <div className={css['Expanded']}>
          <FrameDivider
            horizontal
            splitOwner={FrameDividerOwner.First}
            size={expandedSplit}
            sizeMin={380}
            sizeMax={expandedWidth ? Math.max(420, expandedWidth - 320) : undefined}
            first={thread}
            second={candidate}
            onSizeChanged={setExpandedSplit}
            onBoundsChanged={(bounds) => setExpandedWidth(bounds.width)}
          />
        </div>
      ) : (
        thread
      )}
      {previewing && <ReferencePreview reference={previewing} onClose={() => setPreviewing(null)} />}
    </>
  );

  return (
    <BasePanel
      title="Build"
      isFill
      headerSlot={
        /*
         * Build item 5's "quiet control in the header always".
         *
         * ⚠️ In `BasePanel.headerSlot`, which `PanelHeader` renders in
         * `.Children` — a group that never shrinks, so the title absorbs the
         * squeeze instead. Deliberately **not** tagged
         * `data-panel-chrome="secondary"`: that attribute is what
         * `PanelHeader`'s narrow band hides below 360px, and the width where a
         * bigger workspace helps most is the width where the panel is smallest.
         *
         * Icon-only, and `Columns` rather than `ViewportDiagonalArrow`: the
         * latter is two buttons to the right of this one in the side panel's
         * own mode group, where it means "fill the editor". Two adjacent
         * controls with one glyph and two meanings is the drift BLD-003 names,
         * drawn instead of written.
         */
        host === 'document' ? undefined : (
          <Tooltip content={EXPAND_LABEL} showAfterMs={400}>
            <IconButton
              icon={IconName.Columns}
              size={IconSize.Default}
              variant={IconButtonVariant.Transparent}
              testId="expand-build"
              onClick={expand}
            />
          </Tooltip>
        )
      }
    >
      {/*
       * One instance, two containers. `createPortal` moves the DOM this
       * component paints; the component itself never unmounts, which is what
       * makes a run survive the move — see the note above `host`.
       */}
      {host === 'document' ? (
        <>
          {portalTarget && createPortal(body, portalTarget)}
          {/*
           * ⚠️ The rail says where its contents went, rather than going blank.
           *
           * BLD-003's `ON_CANVAS_NOTE` made exactly this call for a card whose
           * buttons had moved: a surface that simply empties reads as something
           * lost. A panel showing nothing while a build runs elsewhere is the
           * same misreading, one level up.
           */}
          <div className={css['Elsewhere']} data-test="thread-elsewhere">
            <Icon icon={IconName.Columns} size={IconSize.Small} />
            <Text textType={TextType.Default}>
              This conversation is open in the wide workspace. It is the same thread — nothing was copied.
            </Text>
            <PrimaryButton
              label="Bring it back here"
              variant={PrimaryButtonVariant.Ghost}
              size={PrimaryButtonSize.Small}
              onClick={collapse}
              testId="thread-elsewhere-collapse"
            />
          </div>
        </>
      ) : (
        body
      )}
    </BasePanel>
  );
}
