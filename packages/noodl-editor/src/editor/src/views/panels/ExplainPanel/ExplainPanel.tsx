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
import { ExplainSession, type ExplainSessionState } from '@noodl-models/AiAssistant/explain/ExplainSession';
import { fromComponentModel } from '@noodl-models/AiAssistant/explain/graph';
import type { ExplainDetail } from '@noodl-models/AiAssistant/explain/prompts';
import type { ExplainScope } from '@noodl-models/AiAssistant/explain/types';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Select } from '@noodl-core-ui/components/inputs/Select';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { ScrollArea } from '@noodl-core-ui/components/layout/ScrollArea';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { ExperimentalFlag } from '@noodl-core-ui/components/sidebar/ExperimentalFlag';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { useIsActivePanel } from '../useIsActivePanel';

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
  useEffect(() => {
    if (!state) return;
    if (state.context.component.name !== selection.componentName) {
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
      // Adapt only the active component: explanation never reads the project.
      const session = ExplainSession.create(
        { components: [fromComponentModel(component)] },
        { scope, componentName: component.fullName, nodeIds: selection.selectedNodeIds },
        { detail }
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
            options={DETAIL_OPTIONS}
            value={detail}
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
                  <ExplanationView key={index} markdown={turn.text} componentName={componentName ?? ''} />
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
          <TextInput
            value={question}
            placeholder="Ask a follow-up…"
            isDisabled={state.busy}
            onChange={(event) => setQuestion(event.target.value)}
            onEnter={askFollowUp}
          />
        </Section>
      )}
    </BasePanel>
  );
}
