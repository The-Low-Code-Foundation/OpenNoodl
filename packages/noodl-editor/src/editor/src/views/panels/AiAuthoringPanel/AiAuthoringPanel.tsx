/**
 * AIX-002 — Authoring panel
 *
 * Describe a component, watch the agent build it, then accept, refine, or
 * reject. The panel owns no logic beyond presentation: the loop, the
 * validation gate, and the staged candidate all live in `AuthoringSession`;
 * accept is the one call that touches the project (`acceptAuthoredComponent`,
 * undoable), and reject is nothing but dropping the session.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/AiAuthoringPanel
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  acceptAuthoredComponent,
  AuthoringSession,
  AuthoringSetupError,
  buildChangeSet,
  StagingError,
  type AuthoringActivity,
  type AuthoringSessionState
} from '@noodl-models/AiAssistant/authoring';
import { AiClient } from '@noodl-models/AiAssistant/client';
import { fromProjectModel } from '@noodl-models/AiAssistant/explain/graph';
import { AppRegistry } from '@noodl-models/app_registry';
import { ProjectModel } from '@noodl-models/projectmodel';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextArea } from '@noodl-core-ui/components/inputs/TextArea';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { ScrollArea } from '@noodl-core-ui/components/layout/ScrollArea';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { ExperimentalFlag } from '@noodl-core-ui/components/sidebar/ExperimentalFlag';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { ChangeReviewDocumentProvider } from '../../documents/ChangeReviewDocument';
import css from './AiAuthoringPanel.module.scss';

export const AiAuthoringPanel_ID = 'ai-authoring';

function ActivityRow({ activity }: { activity: AuthoringActivity }) {
  switch (activity.kind) {
    case 'user':
      return (
        <div className={css['User']}>
          <Text textType={TextType.Secondary}>{activity.text}</Text>
        </div>
      );
    case 'assistant':
      return (
        <div className={css['Assistant']}>
          <Text textType={TextType.Default}>
            {activity.text}
            {activity.streaming ? '…' : ''}
          </Text>
        </div>
      );
    case 'tool':
      return (
        <div className={css['Event']}>
          <Icon icon={IconName.File} size={IconSize.Small} />
          <Text textType={TextType.Shy}>{activity.label}</Text>
        </div>
      );
    case 'submit':
      return activity.ok ? (
        <div className={css['Event']}>
          <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
          <Text textType={TextType.Secondary}>Submitted — passed validation.</Text>
        </div>
      ) : (
        <VStack UNSAFE_style={{ gap: 2 }}>
          <div className={css['Event']}>
            <Icon icon={IconName.WarningTriangle} variant={FeedbackType.Notice} size={IconSize.Small} />
            <Text textType={TextType.Secondary}>
              Submitted — rejected with {activity.errorLines.length} problem
              {activity.errorLines.length === 1 ? '' : 's'}. Repairing…
            </Text>
          </div>
          {activity.errorLines.slice(0, 3).map((line, index) => (
            <Text key={index} textType={TextType.Shy}>
              {line}
            </Text>
          ))}
          {activity.errorLines.length > 3 && (
            <Text textType={TextType.Shy}>… {activity.errorLines.length - 3} more</Text>
          )}
        </VStack>
      );
  }
}

/** What the feed's tail says when the loop has stopped. */
function outcomeNote(state: AuthoringSessionState): { text: string; type: FeedbackType } | null {
  switch (state.phase) {
    case 'staged':
      return null; // The staged summary and the accept bar say it better.
    case 'exhausted':
      return state.staged
        ? {
            text: 'This refinement did not produce a valid revision — the previous candidate is still staged.',
            type: FeedbackType.Notice
          }
        : {
            text: 'The agent could not produce a valid component within its budget. Reword the description and try again.',
            type: FeedbackType.Notice
          };
    case 'cancelled':
      return {
        text: state.staged
          ? 'Cancelled — the previously staged candidate is untouched.'
          : 'Cancelled. Nothing was written.',
        type: FeedbackType.Notice
      };
    case 'error':
      return { text: state.error ?? 'Something went wrong.', type: FeedbackType.Danger };
    default:
      return null;
  }
}

export function AiAuthoringPanel() {
  const [componentPath, setComponentPath] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState<AuthoringSessionState | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [acceptedName, setAcceptedName] = useState<string | null>(null);
  const [refineText, setRefineText] = useState('');

  const sessionRef = useRef<AuthoringSession | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  const isConfigured = AiClient.isConfigured();
  const hasProject = Boolean(ProjectModel.instance);

  useEffect(() => () => sessionRef.current?.dispose(), []);

  // Follow the stream, but only while the user is already near the bottom —
  // same rule as the Explain panel, same reason.
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
  }, [state?.activities]);

  const start = useCallback(async () => {
    const project = ProjectModel.instance;
    if (!project) return;

    sessionRef.current?.dispose();
    setSetupError(null);
    setAcceptedName(null);

    try {
      const session = AuthoringSession.create(fromProjectModel(project), {
        description: description.trim(),
        componentPath: componentPath.trim()
      });
      sessionRef.current = session;
      session.onChange(setState);
      setState(session.state);
      await session.run();
    } catch (e) {
      sessionRef.current = null;
      setState(null);
      setSetupError(e instanceof AuthoringSetupError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }, [componentPath, description]);

  const refine = useCallback(async () => {
    const session = sessionRef.current;
    const text = refineText.trim();
    if (!session || !text || state?.busy) return;
    setRefineText('');
    await session.refine(text);
  }, [refineText, state?.busy]);

  const accept = useCallback(() => {
    const session = sessionRef.current;
    const project = ProjectModel.instance;
    const files = session?.stagedFiles;
    if (!session || !project || !files) return;

    try {
      const component = acceptAuthoredComponent(project, files);
      NodeGraphContextTmp.switchToComponent?.(component, { pushHistory: true });
      setAcceptedName(session.legacyName);
      session.dispose();
      sessionRef.current = null;
      setState(null);
      setComponentPath('');
      setDescription('');
    } catch (e) {
      setSetupError(e instanceof StagingError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }, []);

  const reject = useCallback(() => {
    // Reject is the absence of an accept call: drop the session, nothing was written.
    sessionRef.current?.dispose();
    sessionRef.current = null;
    setState(null);
  }, []);

  const openReview = useCallback(() => {
    const session = sessionRef.current;
    const project = ProjectModel.instance;
    const files = session?.stagedFiles;
    if (!session || !project || !files) return;

    AppRegistry.instance.openDocument(ChangeReviewDocumentProvider.ID, {
      changeSet: buildChangeSet(project, files),
      title: `Review ${session.legacyName}`,
      onAccept: accept,
      onReject: reject
    });
  }, [accept, reject]);

  const note = state ? outcomeNote(state) : null;
  const canDecide = Boolean(state && !state.busy && state.staged);

  return (
    <BasePanel title="Build" isFill>
      <ExperimentalFlag />

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
          {!hasProject && <Text textType={TextType.Secondary}>Open a project to build components in it.</Text>}

          {!state && !acceptedName && (
            <>
              <TextInput
                value={componentPath}
                label="Component"
                placeholder="Pages/Customers"
                onChange={(event) => setComponentPath(event.target.value)}
              />
              <TextArea
                value={description}
                label="What should it do?"
                placeholder="A page listing customers from the Customers collection, with a search field…"
                onChange={(event) => setDescription(event.target.value)}
              />
            </>
          )}

          {!state && !acceptedName && (
            <PrimaryButton
              label="Build it"
              icon={IconName.MagicWand}
              isDisabled={!hasProject || !isConfigured || !componentPath.trim() || !description.trim()}
              isGrowing
              onClick={start}
            />
          )}

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
          {setupError && (
            <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
              <Icon icon={IconName.WarningCircleFilled} variant={FeedbackType.Danger} size={IconSize.Small} />
              <Text textType={TextType.Secondary}>{setupError}</Text>
            </HStack>
          )}

          {acceptedName && (
            <VStack UNSAFE_style={{ gap: 8 }}>
              <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
                <Text textType={TextType.Secondary}>
                  Added {acceptedName} to your project — it is open on canvas. Accepting is a normal edit: undo
                  removes it.
                </Text>
              </HStack>
              <PrimaryButton label="Build another" variant={PrimaryButtonVariant.Ghost} onClick={() => setAcceptedName(null)} />
            </VStack>
          )}

          {!state && !acceptedName && !setupError && (
            <Text textType={TextType.Shy}>
              Name a new component, describe what it should do, and the agent builds it as nodes — validated
              against your project before you ever see it. Nothing is added until you accept.
            </Text>
          )}

          {state && (
            <VStack UNSAFE_style={{ gap: 12 }}>
              {state.activities.map((activity, index) => (
                <ActivityRow key={index} activity={activity} />
              ))}

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

              {!state.busy && !state.staged && (
                <PrimaryButton label="Start over" variant={PrimaryButtonVariant.Ghost} onClick={reject} />
              )}

              {canDecide && state.staged && (
                <Text textType={TextType.Secondary}>
                  Staged: {state.legacyName} — {state.staged.nodeCount} node
                  {state.staged.nodeCount === 1 ? '' : 's'}, {state.staged.connectionCount} connection
                  {state.staged.connectionCount === 1 ? '' : 's'}. Nothing is in your project yet.
                </Text>
              )}

              <div ref={scrollAnchorRef} />
            </VStack>
          )}
        </Box>
      </ScrollArea>

      {canDecide && (
        <Section variant={SectionVariant.PanelShy} hasGutter>
          <VStack UNSAFE_style={{ gap: 8 }}>
            <TextInput
              value={refineText}
              placeholder="Ask for changes…"
              isDisabled={state?.busy}
              onChange={(event) => setRefineText(event.target.value)}
              onEnter={refine}
            />
            <PrimaryButton
              label="Review changes"
              icon={IconName.Search}
              variant={PrimaryButtonVariant.Ghost}
              isGrowing
              onClick={openReview}
            />
            <HStack UNSAFE_style={{ gap: 8 }}>
              <PrimaryButton label="Accept" icon={IconName.Check} isGrowing onClick={accept} />
              <PrimaryButton label="Reject" variant={PrimaryButtonVariant.Danger} isGrowing onClick={reject} />
            </HStack>
          </VStack>
        </Section>
      )}
    </BasePanel>
  );
}
