/**
 * AIX-002 — Live authoring preview
 *
 * The graph appearing while the agent writes it — the one thing this product
 * can show that a code-generating AI cannot. A detached, read-only canvas is
 * bound once to an empty preview component; as `submit_component` streams,
 * the session publishes each completed node and this document applies them
 * one at a time through a paced reveal queue, so the canvas renders
 * architecture forming instead of a spinner (or a flash, when a provider
 * hands the whole submission over at once).
 *
 * The preview component is never added to the project — reject remains the
 * absence of an accept call. A repair round resets the canvas and rebuilds:
 * attempt two *is* a different graph, and showing it as one reads truer than
 * morphing the failed attempt in place. Decisions stay where they live: the
 * Build panel owns the session; accept/reject/review here are callbacks into
 * it.
 *
 * @module noodl-editor/views/documents/AuthoringPreviewDocument
 */

import React, { useEffect, useRef, useState } from 'react';

import {
  PreviewGraphBuilder,
  RevealQueue,
  type AuthoringSession,
  type AuthoringSessionState,
  type RevealItem
} from '@noodl-models/AiAssistant/authoring';
import { AppRegistry, IDocumentProvider } from '@noodl-models/app_registry';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { ActivityIndicator } from '@noodl-core-ui/components/common/ActivityIndicator';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Label } from '@noodl-core-ui/components/typography/Label';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { FrameDivider, FrameDividerOwner } from '@noodl-core-ui/components/layout/FrameDivider';

import { Frame } from '../../common/Frame';
import { NodeGraphEditor } from '../../nodegrapheditor';
import { EditorDocumentProvider } from '../EditorDocument';
import css from './AuthoringPreviewDocument.module.scss';
import { SandboxPreview } from './SandboxPreview';

export interface AuthoringPreviewDocumentProps {
  session: AuthoringSession;
  onAccept: () => void;
  onReject: () => void;
  onOpenReview: () => void;
}

/** One reveal per tick — fast enough to feel live, slow enough to follow. */
const REVEAL_INTERVAL_MS = 90;

/** Starting width of the rendered pane, in pixels. */
const DEFAULT_PREVIEW_WIDTH = 620;

function statusLine(state: AuthoringSessionState): { text: string; type: FeedbackType | null } {
  switch (state.phase) {
    case 'working':
      return {
        text: state.building
          ? `${state.mode === 'update' ? 'Revising' : 'Building'} — ${state.building.nodes.length} node${
              state.building.nodes.length === 1 ? '' : 's'
            } so far…`
          : 'The agent is reading context…',
        type: null
      };
    case 'staged':
      return {
        text: state.staged
          ? `Staged — ${state.staged.nodeCount} nodes, ${state.staged.connectionCount} connections. ${
              state.mode === 'update' ? 'Your component is untouched until you accept.' : 'Nothing is in your project yet.'
            }`
          : 'Staged.',
        type: null
      };
    case 'exhausted':
      return { text: 'The agent ran out of attempts. The last valid candidate (if any) is still staged.', type: FeedbackType.Notice };
    case 'cancelled':
      return { text: 'Stopped. A previously staged candidate survives in the Build panel.', type: FeedbackType.Notice };
    case 'error':
      return { text: state.error ?? 'Something went wrong.', type: FeedbackType.Danger };
    default:
      return { text: '', type: null };
  }
}

function AuthoringPreviewDocument({ session, onAccept, onReject, onOpenReview }: AuthoringPreviewDocumentProps) {
  const [nodeGraph] = useState<NodeGraphEditor>(() => {
    const ng = new NodeGraphEditor({});
    ng.setReadOnly(true);
    ng.render();
    return ng;
  });

  const [state, setState] = useState<AuthoringSessionState>(session.state);

  // AIX-008: the rendered half. Wide by default — the question the user is
  // being asked ("is this what you meant?") is answered by the render, and the
  // graph answers the follow-up.
  const splitRef = useRef<HTMLDivElement>(null);
  const [splitSize, setSplitSize] = useState(DEFAULT_PREVIEW_WIDTH);
  const [splitWidth, setSplitWidth] = useState<number | undefined>(undefined);

  const builderRef = useRef<PreviewGraphBuilder | null>(null);
  const queueRef = useRef<RevealQueue | null>(null);
  const submissionRef = useRef(0);
  const enqueuedRef = useRef({ nodes: 0, connections: 0 });
  const completeRef = useRef(false);
  const flushedRef = useRef(false);

  useEffect(() => session.onChange(setState), [session]);
  useEffect(() => () => nodeGraph.dispose(), []);

  // An empty canvas titled with the component being built, before the first
  // node arrives — the stage the graph will assemble on.
  useEffect(() => {
    const builder = new PreviewGraphBuilder(session.legacyName);
    builderRef.current = builder;
    nodeGraph.switchToComponent(builder.component);
  }, [session]);

  // Feed the reveal queue from the forming submission. A new submission
  // (repair round or refinement) resets the canvas and rebuilds.
  useEffect(() => {
    const building = state.building;
    if (!building) return;

    if (submissionRef.current !== building.submission || !queueRef.current) {
      submissionRef.current = building.submission;
      enqueuedRef.current = { nodes: 0, connections: 0 };
      flushedRef.current = false;
      const builder = new PreviewGraphBuilder(state.legacyName);
      builderRef.current = builder;
      queueRef.current = new RevealQueue((item: RevealItem) => {
        if (item.kind === 'node') builder.addNode(item.node, item.order);
        else builder.addConnection(item.connection);
      });
      nodeGraph.switchToComponent(builder.component);
    }

    completeRef.current = building.complete;

    const items: RevealItem[] = [];
    for (let i = enqueuedRef.current.nodes; i < building.nodes.length; i++) {
      items.push({ kind: 'node', node: building.nodes[i], order: i });
    }
    for (let i = enqueuedRef.current.connections; i < building.connections.length; i++) {
      items.push({ kind: 'connection', connection: building.connections[i] });
    }
    enqueuedRef.current = { nodes: building.nodes.length, connections: building.connections.length };
    if (items.length > 0) queueRef.current.enqueue(items);
  }, [state.building, state.legacyName]);

  // The pace. One item per tick; when the stream is done and the queue is
  // drained, root anything still waiting on a parent that never arrived.
  useEffect(() => {
    const timer = setInterval(() => {
      const queue = queueRef.current;
      const builder = builderRef.current;
      if (!queue || !builder) return;
      if (!queue.tick() && completeRef.current && !flushedRef.current) {
        builder.flushOrphans();
        flushedRef.current = true;
      }
    }, REVEAL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const exit = () => AppRegistry.instance.openDocument(EditorDocumentProvider.ID);
  const status = statusLine(state);
  const canDecide = !state.busy && Boolean(state.staged);

  return (
    <div className={css.Root}>
      <div className={css.Topbar}>
        <Label hasLeftSpacing>
          {state.mode === 'update' ? 'Revising' : 'Building'} {state.legacyName}
        </Label>
        <div className={css.Status}>
          {state.busy && <ActivityIndicator />}
          {status.type && <Icon icon={IconName.WarningTriangle} variant={status.type} size={IconSize.Small} />}
          <Text textType={TextType.Secondary}>{status.text}</Text>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {state.busy && (
            <PrimaryButton label="Stop" variant={PrimaryButtonVariant.Ghost} onClick={() => session.cancel()} />
          )}
          {canDecide && (
            <>
              <PrimaryButton label="Review changes" variant={PrimaryButtonVariant.MutedOnLowBg} onClick={onOpenReview} />
              <PrimaryButton label="Accept" onClick={onAccept} />
              <PrimaryButton label="Reject" variant={PrimaryButtonVariant.Danger} onClick={onReject} />
            </>
          )}
          <PrimaryButton label="Close" variant={PrimaryButtonVariant.MutedOnLowBg} onClick={exit} />
        </div>
      </div>

      <div className={css.Canvas} ref={splitRef}>
        <FrameDivider
          horizontal
          splitOwner={FrameDividerOwner.First}
          size={splitSize}
          sizeMin={280}
          sizeMax={splitWidth ? Math.max(320, splitWidth - 280) : undefined}
          first={
            <SandboxPreview
              files={session.stagedFiles}
              sampleData={session.stagedSampleData}
              revision={state.stagedRevision}
            />
          }
          second={<Frame instance={nodeGraph} onResize={(bounds) => nodeGraph.resize(bounds)} />}
          onSizeChanged={setSplitSize}
          onBoundsChanged={(bounds) => setSplitWidth(bounds.width)}
        />
      </div>
    </div>
  );
}

export class AuthoringPreviewDocumentProvider implements IDocumentProvider {
  public static ID = 'AuthoringPreviewDocumentProvider';

  getComponent() {
    return AuthoringPreviewDocument;
  }
}
