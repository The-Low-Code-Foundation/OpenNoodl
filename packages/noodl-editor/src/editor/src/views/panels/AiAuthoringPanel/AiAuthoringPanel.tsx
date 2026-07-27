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
  pathToLegacyName,
  StagingError,
  updateAuthoredComponent,
  validateCandidateComponent,
  type AuthoringActivity,
  type AuthoringMode,
  type AuthoringSessionState,
  type ComponentFiles
} from '@noodl-models/AiAssistant/authoring';
import { AiClient } from '@noodl-models/AiAssistant/client';
import { fromProjectModel } from '@noodl-models/AiAssistant/explain/graph';
import { authoringTelemetry } from '@noodl-models/AiAssistant/telemetry';
import { AppRegistry } from '@noodl-models/app_registry';
import { ProjectModel } from '@noodl-models/projectmodel';
import { buildEffectiveTokens, buildStyleVocabulary, readStoredTokens } from '@noodl-models/StyleTokensModel';

import { buildComponentV2Files } from '../../../io/ProjectExporter';
import { formatDiagnosticLine } from '../../../validation';

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

import { AuthoringPreviewDocumentProvider } from '../../documents/AuthoringPreviewDocument';
import { ChangeReviewDocumentProvider } from '../../documents/ChangeReviewDocument';
import { EditorDocumentProvider } from '../../documents/EditorDocument';
import css from './AiAuthoringPanel.module.scss';
import { ProjectAuthoringView } from './ProjectAuthoringView';

/** AIX-011: the panel's two scopes. Component stays the default — and unchanged. */
type AuthoringScope = 'component' | 'project';

export const AiAuthoringPanel_ID = 'ai-authoring';

export function ActivityRow({ activity }: { activity: AuthoringActivity }) {
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
  const [scope, setScope] = useState<AuthoringScope>('component');
  const [componentPath, setComponentPath] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState<AuthoringSessionState | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<{ name: string; mode: AuthoringMode } | null>(null);
  const [refineText, setRefineText] = useState('');

  const sessionRef = useRef<AuthoringSession | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  // Stable identities for the preview document's buttons — the document is
  // mounted once per build, the handlers re-bind every render.
  const handlersRef = useRef({ accept: () => {}, reject: () => {}, openReview: () => {} });

  const isConfigured = AiClient.isConfigured();
  const hasProject = Boolean(ProjectModel.instance);

  // A path naming an existing component flips the form into update mode — the
  // button label announces it, so a typo'd "new" name cannot silently revise.
  const existingTarget =
    hasProject && componentPath.trim()
      ? ProjectModel.instance.getComponentWithName(pathToLegacyName(componentPath.trim()))
      : undefined;

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
    setAccepted(null);

    try {
      const request = {
        description: description.trim(),
        componentPath: componentPath.trim()
      };
      const existing = project.getComponentWithName(pathToLegacyName(request.componentPath));
      // AIX-006: hand the agent the project's actual style vocabulary (defaults
      // + this project's token overrides) and lint candidates against the same.
      const styleOptions = {
        styleVocabulary: buildStyleVocabulary(project),
        styleTokenRecords: Array.from(buildEffectiveTokens(readStoredTokens(project)).values())
      };
      // An existing component is revised, not recreated: the session gets the
      // exporter's own serialization of it as the base — the source the agent
      // starts from, and the identity the candidate keeps.
      const session = existing
        ? AuthoringSession.createUpdate(
            fromProjectModel(project),
            request,
            buildComponentV2Files(existing.toJSON(), new Date().toISOString()),
            styleOptions
          )
        : AuthoringSession.create(fromProjectModel(project), request, styleOptions);
      sessionRef.current = session;
      session.onChange(setState);
      setState(session.state);

      // The payoff moment is watching the graph form — put the preview canvas
      // up before the first token arrives.
      AppRegistry.instance.openDocument(AuthoringPreviewDocumentProvider.ID, {
        session,
        onAccept: () => handlersRef.current.accept(),
        onReject: () => handlersRef.current.reject(),
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
  }, [componentPath, description]);

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

  /**
   * Stage the given files into the project. The whole-candidate path (Accept
   * in the panel) was validated by the session's gate already; a partial
   * selection from the review document is re-validated through the same gate
   * here. Returns an error message, or null on success.
   */
  const acceptFiles = useCallback((files: ComponentFiles, selection?: { rejectedCount: number }): string | null => {
    const session = sessionRef.current;
    const project = ProjectModel.instance;
    if (!session || !project) return 'The authoring session is no longer available.';

    const validation = validateCandidateComponent(fromProjectModel(project), session.legacyName, files);
    if (!validation.ok) {
      const lines = validation.errors.slice(0, 3).map(formatDiagnosticLine);
      return `The selected subset is not a valid component: ${lines.join(' · ')}`;
    }

    try {
      // The mode is the session's, decided at creation — never re-inferred
      // here, so a component created meanwhile still fails create-accept
      // loudly instead of silently becoming an update.
      const component =
        session.mode === 'update' ? updateAuthoredComponent(project, files) : acceptAuthoredComponent(project, files);
      // Accept navigates to the real component on the live canvas — leave the
      // preview document first so the reveal is visible.
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
      setAccepted({ name: session.legacyName, mode: session.mode });
      session.dispose();
      sessionRef.current = null;
      setState(null);
      // The path stays: describing another change to the same component is the
      // natural next step, and the form is already in update mode for it.
      setDescription('');
      return null;
    } catch (e) {
      const message = e instanceof StagingError ? e.message : e instanceof Error ? e.message : String(e);
      setSetupError(message);
      return message;
    }
  }, []);

  const accept = useCallback(() => {
    const files = sessionRef.current?.stagedFiles;
    if (files) acceptFiles(files);
  }, [acceptFiles]);

  const reject = useCallback(() => {
    // Reject is the absence of an accept call: drop the session, nothing was written.
    const session = sessionRef.current;
    // Only a decision against a staged candidate is worth a record — "Start
    // over" after a failed run is not a rejection.
    if (session?.stagedFiles) {
      authoringTelemetry().record({ event: 'authoring-reject', mode: session.mode });
    }
    session?.dispose();
    sessionRef.current = null;
    setState(null);
    if (AppRegistry.instance.CurrentDocumentId === AuthoringPreviewDocumentProvider.ID) {
      AppRegistry.instance.openDocument(EditorDocumentProvider.ID);
    }
  }, []);

  const openReview = useCallback(() => {
    const session = sessionRef.current;
    const project = ProjectModel.instance;
    const files = session?.stagedFiles;
    if (!session || !project || !files) return;

    AppRegistry.instance.openDocument(ChangeReviewDocumentProvider.ID, {
      changeSet: buildChangeSet(project, files),
      files,
      title: `Review ${session.legacyName}`,
      onAcceptFiles: acceptFiles,
      onReject: reject
    });
  }, [acceptFiles, reject]);

  // Keep the preview document's stable handlers pointed at the live closures.
  handlersRef.current = { accept, reject, openReview };

  const note = state ? outcomeNote(state) : null;
  const canDecide = Boolean(state && !state.busy && state.staged);

  return (
    <BasePanel title="Build" isFill>
      <ExperimentalFlag />

      {/* AIX-011: scope toggle. Component scope is the default and behaves
          exactly as before; project scope plans, then fans out. */}
      <Section variant={SectionVariant.PanelShy} hasGutter>
        <HStack UNSAFE_style={{ gap: 8 }}>
          <PrimaryButton
            label="This component"
            variant={scope === 'component' ? PrimaryButtonVariant.Muted : PrimaryButtonVariant.Ghost}
            isGrowing
            onClick={() => setScope('component')}
          />
          <PrimaryButton
            label="Project"
            variant={scope === 'project' ? PrimaryButtonVariant.Muted : PrimaryButtonVariant.Ghost}
            isGrowing
            onClick={() => setScope('project')}
          />
        </HStack>
      </Section>

      {scope === 'project' ? (
        <ProjectAuthoringView isConfigured={isConfigured} hasProject={hasProject} />
      ) : (
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
          {!hasProject && <Text textType={TextType.Secondary}>Open a project to build components in it.</Text>}

          {!state && !accepted && (
            <>
              <TextInput
                value={componentPath}
                label="Component"
                placeholder="Pages/Customers"
                onChange={(event) => setComponentPath(event.target.value)}
              />
              <TextArea
                value={description}
                label={existingTarget ? 'What should change?' : 'What should it do?'}
                placeholder={
                  existingTarget
                    ? 'Add a search field above the list…'
                    : 'A page listing customers from the Customers collection, with a search field…'
                }
                onChange={(event) => setDescription(event.target.value)}
              />
              {existingTarget && (
                <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                  <Icon icon={IconName.Pencil} size={IconSize.Small} />
                  <Text textType={TextType.Shy}>
                    This component exists — the agent will propose a revision, which you review as a diff before
                    anything changes.
                  </Text>
                </HStack>
              )}
            </>
          )}

          {!state && !accepted && (
            <PrimaryButton
              label={existingTarget ? 'Update it' : 'Build it'}
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

          {accepted && (
            <VStack UNSAFE_style={{ gap: 8 }}>
              <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
                <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
                <Text textType={TextType.Secondary}>
                  {accepted.mode === 'update'
                    ? `Updated ${accepted.name} — it is open on canvas. Accepting is a normal edit: one undo restores the previous version.`
                    : `Added ${accepted.name} to your project — it is open on canvas. Accepting is a normal edit: undo removes it.`}
                </Text>
              </HStack>
              <PrimaryButton
                label="Make more changes"
                variant={PrimaryButtonVariant.Ghost}
                onClick={() => setAccepted(null)}
              />
              <PrimaryButton
                label="Build another"
                variant={PrimaryButtonVariant.Ghost}
                onClick={() => {
                  setAccepted(null);
                  setComponentPath('');
                }}
              />
            </VStack>
          )}

          {!state && !accepted && !setupError && (
            <Text textType={TextType.Shy}>
              Name a component and describe what it should do — the agent builds it as nodes, validated against
              your project before you ever see it. Name an existing component to revise it instead. Nothing
              changes until you accept.
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
                  {state.staged.connectionCount === 1 ? '' : 's'}.{' '}
                  {state.mode === 'update'
                    ? 'Your component is untouched until you accept.'
                    : 'Nothing is in your project yet.'}
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
        </>
      )}
    </BasePanel>
  );
}
