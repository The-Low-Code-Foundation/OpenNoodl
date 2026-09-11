/**
 * AIX-004 — Explain Mode panel
 *
 * Select something on canvas, ask what it does, read the answer while still
 * looking at the graph. Non-modal by construction: it lives in the sidebar, so
 * the canvas stays visible and the citations in the answer have something to
 * point at.
 *
 * The panel owns no logic beyond presentation. Context assembly, prompting and
 * the conversation belong to `ExplainSession`; this component reads the canvas
 * selection, creates a session for it, and renders whatever the session
 * publishes.
 *
 * @module noodl-editor/views/panels/ExplainPanel/ExplainPanel
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AiClient } from '@noodl-models/AiAssistant/client';
import { ExplainContextError } from '@noodl-models/AiAssistant/explain/assemble';
import { collectAuthoredNotes, type AuthoredNotesResult } from '@noodl-models/AiAssistant/explain/authoredNotes';
import { componentForCitedNode, componentsInExplanation } from '@noodl-models/AiAssistant/explain/citations';
import { ExplainSession, type ExplainSessionState } from '@noodl-models/AiAssistant/explain/ExplainSession';
import { fromComponentModel, fromProjectModel } from '@noodl-models/AiAssistant/explain/graph';
import type { ExplainDetail } from '@noodl-models/AiAssistant/explain/prompts';
import type { TutorContext } from '@noodl-models/AiAssistant/explain/tutor';
import type { ExplainGraph, ExplainScope } from '@noodl-models/AiAssistant/explain/types';
import { ProjectModel } from '@noodl-models/projectmodel';
import { createExplainRuntime } from '@noodl-utils/provenance/explainRuntime';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Select } from '@noodl-core-ui/components/inputs/Select';
import { TextArea } from '@noodl-core-ui/components/inputs/TextArea';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { ScrollArea } from '@noodl-core-ui/components/layout/ScrollArea';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { ExperimentalFlag } from '@noodl-core-ui/components/sidebar/ExperimentalFlag';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { useIsActivePanel } from '../useIsActivePanel';

import { AuthoredNotes } from './components/AuthoredNotes';
import { ExplanationView } from './components/ExplanationView';
import { clearCitedHighlight } from './canvasLink';
import { useCanvasSelection } from './hooks/useCanvasSelection';
import css from './ExplainPanel.module.scss';

export const ExplainPanel_ID = 'explain';

const DETAIL_OPTIONS = [
  { label: 'Brief', value: 'brief' },
  { label: 'Standard', value: 'standard' },
  { label: 'In depth', value: 'deep' }
];

/**
 * UNI-007 — the same list without "In depth", for tutor mode.
 *
 * TUTOR-BOUNDARY §4 disables `deep` while a lesson is active, because `deep`
 * asks the model to *"walk the data flow step by step"* — which, over the graph
 * a learner is halfway through building, is §5's oracle-extraction attack
 * available from a dropdown. The session clamps it too
 * (`clampTutorDetail`); this is only so the menu does not offer a setting that
 * silently does not apply.
 */
const TUTOR_DETAIL_OPTIONS = DETAIL_OPTIONS.filter((option) => option.value !== 'deep');

/**
 * UNI-007 — the tutor context for the lesson the learner is in, or `undefined`
 * when this project is not a lesson.
 *
 * 🔴 **A lesson being open is what arms the boundary — not knowing the step.**
 * When the step text cannot be read (a legacy HTML lesson, or a manifest step
 * with neither title nor body) this still returns an object, so the overlay is
 * still appended and still forbids completing the step. Returning `undefined`
 * there would silently drop the whole boundary for exactly the lessons whose
 * text is hardest to read, which is the wrong way round.
 *
 * This is the only place in the feature that touches `ProjectModel`, which is
 * why it lives in the panel: the session, the prompt and the overlay stay pure
 * and injectable, and the measurement harness reaches none of this.
 */
function tutorContextForActiveLesson(): TutorContext | undefined {
  const lesson = ProjectModel.instance?.getLessonModel?.();
  if (!lesson) return undefined;
  const step = lesson.getCurrentStepSource?.();
  return { stepTitle: step?.title, stepBody: step?.body };
}

/**
 * The graph assembly reads from.
 *
 * FIX-001 §1c — the whole project, not just the active component. Assembly
 * still *renders* only the active component (see `assembleContext`); what the
 * rest is for is resolving a selected component instance to the component it
 * instantiates, which cannot be done from one component's nodes. The adapter is
 * a plain walk producing plain data, so the session stays read-only by
 * construction exactly as before.
 *
 * The single-component fallback is not dead code: `ProjectModel.instance` is
 * unset in the launcher and during a project switch, and an explanation of the
 * component in front of the user beats an error.
 */
function explainGraph(component: Parameters<typeof fromComponentModel>[0]): ExplainGraph {
  const project = ProjectModel.instance;
  if (project) return fromProjectModel(project);
  return { components: [fromComponentModel(component)] };
}

/** What the current selection lets the user ask for. */
function scopeForSelection(selectedNodeIds: string[]): { scope: ExplainScope; label: string } {
  if (selectedNodeIds.length === 1) return { scope: 'node', label: 'Explain this node' };
  if (selectedNodeIds.length > 1) return { scope: 'subgraph', label: `Explain these ${selectedNodeIds.length} nodes` };
  return { scope: 'component', label: 'Explain this component' };
}

export function ExplainPanel() {
  // The panel is mounted once and then hidden behind `display: none`, so
  // "became visible" is the only moment a fresh read of the canvas can happen.
  const isActivePanel = useIsActivePanel(ExplainPanel_ID);
  const selection = useCanvasSelection(isActivePanel);
  const [detail, setDetail] = useState<ExplainDetail>('standard');
  // UNI-007. Read on every render rather than held in state: whether the open
  // project is a lesson is fixed for the life of the project, and the *step* is
  // read at session creation, so there is nothing here to subscribe to.
  const tutorActive = ProjectModel.instance?.isLesson?.() === true;
  const [state, setState] = useState<ExplainSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');

  const sessionRef = useRef<ExplainSession | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  const { scope, label } = useMemo(() => scopeForSelection(selection.selectedNodeIds), [selection.selectedNodeIds]);
  const isConfigured = AiClient.isConfigured();

  // Drop the session when the user navigates away: an explanation of a component
  // you are no longer looking at is worse than none, because its citations point
  // somewhere off screen.
  //
  // 🔴 FIX-001 §1c — "away" now means away from *everything the explanation
  // covers*, not just the component it was assembled from. An interior citation
  // navigates into the component it read, which under the old comparison was
  // indistinguishable from leaving: clicking a link would have disposed the very
  // answer it was in, and the panel would blank at the moment the feature worked.
  useEffect(() => {
    if (!state) return;
    const covered = componentsInExplanation(state.context);
    if (!selection.componentName || !covered.includes(selection.componentName)) {
      sessionRef.current?.dispose();
      sessionRef.current = null;
      setState(null);
      setError(null);
    }
  }, [selection.componentName]);

  useEffect(
    () => () => {
      sessionRef.current?.dispose();
      clearCitedHighlight();
    },
    []
  );

  // Follow the stream, but only while the user is already near the bottom —
  // yanking the view away from someone re-reading an earlier paragraph is worse
  // than making them scroll. The scroller is `ScrollArea`'s outer div, found by
  // overflow rather than by class name, which is hashed by CSS modules.
  useEffect(() => {
    const anchor = scrollAnchorRef.current;
    if (!anchor || !state?.busy) return;

    let scroller: HTMLElement | null = anchor.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight) {
      scroller = scroller.parentElement;
    }
    if (!scroller) return;

    const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    if (distanceFromBottom < 80) anchor.scrollIntoView({ block: 'end' });
  }, [state?.turns]);

  const startExplanation = useCallback(async () => {
    const component = NodeGraphContextTmp.nodeGraph?.activeComponent;
    if (!component) return;

    sessionRef.current?.dispose();
    setError(null);

    try {
      const session = ExplainSession.create(
        explainGraph(component),
        { scope, componentName: component.fullName, nodeIds: selection.selectedNodeIds },
        // FIX-001 §1a. The panel is the only caller with a socket and a
        // `WarningsModel` in reach, so it is the only one that supplies this;
        // the session and everything under it stay pure and injectable.
        //
        // UNI-007 — and the same argument for `tutorContext`: read here, at
        // session creation, so the overlay names the step the learner is on
        // *now* rather than the one they were on when the panel mounted.
        {
          detail,
          resolveRuntime: createExplainRuntime(component.fullName),
          tutorContext: tutorContextForActiveLesson()
        }
      );
      sessionRef.current = session;
      session.onChange(setState);
      setState(session.state);
      await session.explain();
    } catch (e) {
      sessionRef.current = null;
      setState(null);
      setError(e instanceof ExplainContextError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }, [scope, selection.selectedNodeIds, detail]);

  const askFollowUp = useCallback(async () => {
    const session = sessionRef.current;
    const text = question.trim();
    if (!session || !text || state?.busy) return;
    setQuestion('');
    await session.ask(text);
  }, [question, state?.busy]);

  const componentName = state?.context.component.name ?? selection.componentName;

  /**
   * FIX-001 §1c — where each cited node actually lives.
   *
   * Built once per session rather than per click: the context is stable for the
   * life of a session while `state` changes on every streamed delta, and a
   * lookup rebuilt on each delta would be rebuilt hundreds of times per answer.
   */
  const componentForNode = useMemo(() => {
    const context = state?.context;
    if (!context?.nested?.length) return undefined;
    const owners = new Map<string, string>();
    for (const nested of context.nested) {
      for (const node of nested.nodes) owners.set(node.id, componentForCitedNode(context, node.id));
    }
    return (nodeId: string) => owners.get(nodeId) ?? context.component.name;
  }, [state?.context]);

  /**
   * LEG-003 §2 — the author's own text, read straight from the project.
   *
   * Two sources, one collector. Once a session exists the assembled context is
   * the truth (it knows catalog display names and which nodes the answer is
   * actually about); before one does, the live component is read directly, so a
   * comment reaches the reader without a provider, a token or a click. The memo
   * keys on `state.context` rather than `state` because the context object is
   * stable for the life of a session while `state` changes on every streamed
   * delta.
   */
  const authored = useMemo<AuthoredNotesResult>(() => {
    const context = state?.context;
    if (context) {
      return collectAuthoredNotes({
        scope: context.scope,
        component: { name: context.component.name, description: context.component.description },
        selectedIds: context.selectedIds,
        nodes: context.nodes
      });
    }

    const component = NodeGraphContextTmp.nodeGraph?.activeComponent;
    if (!component) return { notes: [], omitted: 0 };
    const graph = fromComponentModel(component);
    return collectAuthoredNotes({
      scope,
      component: { name: graph.name, description: graph.description },
      selectedIds: selection.selectedNodeIds,
      nodes: graph.nodes
    });
  }, [state?.context, scope, selection.selectedNodeIds, selection.componentName]);

  return (
    <BasePanel title="Explain" isFill>
      <ExperimentalFlag />

      <Section variant={SectionVariant.PanelShy} hasGutter>
        <VStack UNSAFE_style={{ gap: 8 }}>
          <HStack UNSAFE_style={{ alignItems: 'center', gap: 6 }}>
            <Icon icon={IconName.SquareHalf} size={IconSize.Small} />
            <Text textType={TextType.Shy}>Read-only — asking never changes your project.</Text>
          </HStack>

          {!isConfigured && (
            <HStack UNSAFE_style={{ alignItems: 'center', gap: 6 }}>
              <Icon icon={IconName.WarningTriangle} variant={FeedbackType.Notice} size={IconSize.Small} />
              <Text textType={TextType.Secondary}>
                No AI provider is configured. Open Editor Settings to set one up.
              </Text>
            </HStack>
          )}

          {selection.componentName ? (
            <Text textType={TextType.Secondary}>
              {selection.selectedNodeIds.length === 0
                ? `Nothing selected — will explain all of ${selection.componentName}.`
                : `${selection.selectedNodeIds.length} node${
                    selection.selectedNodeIds.length === 1 ? '' : 's'
                  } in ${selection.componentName}.`}
            </Text>
          ) : (
            <Text textType={TextType.Secondary}>Open a component to explain it.</Text>
          )}

          {/* LEG-006 — the component's authored sentence, before the model is
              asked for one. It is the answer to "what is this for" that costs
              nothing and is already written; a panel that asks an LLM while
              ignoring the sentence on the component would be absurd. */}
          {selection.componentDescription && (
            <Text textType={TextType.Shy}>{selection.componentDescription}</Text>
          )}

          <Select
            options={tutorActive ? TUTOR_DETAIL_OPTIONS : DETAIL_OPTIONS}
            value={tutorActive && detail === 'deep' ? 'standard' : detail}
            label="Detail"
            onChange={(value) => setDetail(value as ExplainDetail)}
          />

          <PrimaryButton
            label={state?.busy ? 'Explaining…' : label}
            icon={IconName.MagicWand}
            isDisabled={!selection.componentName || !isConfigured || Boolean(state?.busy)}
            isGrowing
            onClick={startExplanation}
          />

          {state?.busy && (
            <PrimaryButton
              label="Stop"
              variant={PrimaryButtonVariant.Ghost}
              isGrowing
              onClick={() => sessionRef.current?.cancel()}
            />
          )}
        </VStack>
      </Section>

      <ScrollArea>
        <Box hasXSpacing hasYSpacing UNSAFE_style={{ width: '100%' }}>
          {/* Above the answer, and above the empty state: the author wrote this,
              and it is worth reading whether or not anyone asks a model. */}
          <AuthoredNotes
            notes={authored.notes}
            omitted={authored.omitted}
            componentName={componentName ?? ''}
          />

          {error && (
            <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
              <Icon icon={IconName.WarningCircleFilled} variant={FeedbackType.Danger} size={IconSize.Small} />
              <Text textType={TextType.Secondary}>{error}</Text>
            </HStack>
          )}

          {!error && !state && (
            <Text textType={TextType.Shy}>
              Select nodes on canvas and come back here, ask about the whole component, or right-click a node
              and choose “Explain this node”. Node names in the answer are links — hover one to light it up on
              canvas, click it to jump there.
            </Text>
          )}

          {state && (
            <VStack UNSAFE_style={{ gap: 12 }}>
              {state.turns.map((turn, index) =>
                turn.role === 'question' ? (
                  <div key={index} className={css['Question']}>
                    <Text textType={TextType.Secondary}>{turn.text}</Text>
                  </div>
                ) : turn.error ? (
                  <HStack key={index} UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                    <Icon icon={IconName.WarningCircleFilled} variant={FeedbackType.Danger} size={IconSize.Small} />
                    <Text textType={TextType.Secondary}>{turn.text}</Text>
                  </HStack>
                ) : (
                  <ExplanationView
                    key={index}
                    markdown={turn.text}
                    componentName={componentName ?? ''}
                    componentForNode={componentForNode}
                  />
                )
              )}

              {state.context.bounds.truncated && (
                <Text textType={TextType.Shy}>
                  This answer is based on part of the component: {state.context.bounds.notes.join(' ')}
                </Text>
              )}

              <div ref={scrollAnchorRef} />
            </VStack>
          )}
        </Box>
      </ScrollArea>

      {state && (
        <Section variant={SectionVariant.PanelShy} hasGutter>
          {/* FIX-002 — a `TextArea`, not a `TextInput`: the single-line input's
              resizable-input mechanism grew the element to the full width of
              the string inside an `overflow-x: hidden` wrapper, so past ~40
              characters the caret left the visible box and Backspace looked
              broken. A textarea wraps, scrolls and grows instead. Enter sends
              and Shift+Enter inserts a newline (the 2026-08-14 ruling — same
              keys as the Build composer), and the Send button is the
              first mouse-only route to submitting this panel has had.

              `autoGrowMaxRows` is criterion 2's ruling (2026-08-15): the
              composer grows with the text up to eight rows and scrolls beyond.
              Eight because this panel is a sidebar — tall enough that a typical
              follow-up is visible whole, short enough that the answer it is a
              follow-up *to* stays on screen while you write it. */}
          <VStack UNSAFE_style={{ gap: 8 }}>
            <TextArea
              value={question}
              placeholder="Ask a follow-up…"
              isDisabled={state.busy}
              autoGrowMaxRows={8}
              onChange={(event) => setQuestion(event.target.value)}
              onEnter={askFollowUp}
            />
            <PrimaryButton
              label="Send"
              isDisabled={Boolean(state.busy) || question.trim().length === 0}
              isGrowing
              onClick={askFollowUp}
            />
          </VStack>
        </Section>
      )}
    </BasePanel>
  );
}
