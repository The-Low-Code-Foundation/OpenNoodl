/**
 * AIX-002/AIX-008's two panes, lifted out of the document that used to be their
 * only host.
 *
 * BLD-009 puts the same candidate — the rendered result and the graph forming
 * beside it — inside the expanded build workspace, where it sits to the right of
 * the thread instead of filling the surface on its own. Nothing here changed in
 * the move: this is `AuthoringPreviewDocument`'s body, verbatim, with the topbar
 * left behind because that is the half the two hosts genuinely differ on.
 *
 * ⚠️ **The topbar is what carries the decisions**, and that is why it did not
 * come with the pane. BLD-003's rule is that whichever surface shows the
 * candidate owns Accept / Review / Discard, and it reads that from
 * `AppRegistry.CurrentDocumentId`. In the expanded host the candidate and the
 * thread are one surface, so the thread's card owns them — which is what
 * `decisionOwner` already returns there, since the expanded document is not one
 * of the candidate document ids. Giving this component an action bar of its own
 * would put a second Accept on screen and reopen D2 from the other end.
 *
 * @module noodl-editor/views/documents/AuthoringPreviewDocument/AuthoringCandidatePane
 */

import React, { useEffect, useRef, useState } from 'react';

import {
  PreviewGraphBuilder,
  RevealQueue,
  type AuthoringSession,
  type AuthoringSessionState,
  type RevealItem
} from '@noodl-models/AiAssistant/authoring';

import { FrameDivider, FrameDividerOwner } from '@noodl-core-ui/components/layout/FrameDivider';

import { Frame } from '../../common/Frame';
import { NodeGraphEditor } from '../../nodegrapheditor';
import css from './AuthoringPreviewDocument.module.scss';
import { SandboxPreview } from './SandboxPreview';

/** One reveal per tick — fast enough to feel live, slow enough to follow. */
const REVEAL_INTERVAL_MS = 90;

/** Starting width of the rendered pane, in pixels. */
const DEFAULT_PREVIEW_WIDTH = 620;

export interface AuthoringCandidatePaneProps {
  session: AuthoringSession;
  /**
   * The session's state, from whichever host is already subscribed to it.
   *
   * ⚠️ Required rather than optional, and that is this task's trap one level
   * down. Both hosts hold `session.onChange` already — the preview document for
   * its status bar, the Build panel for the thread — so a convenience
   * subscription in here would be a *third* reader of one session, and the
   * reveal queue would be paced by a state the surface around it had not seen
   * yet. Taking the state as a prop makes it structurally impossible for the
   * graph to be revealing a submission the sentence above it is not describing.
   */
  state: AuthoringSessionState;
}

export function AuthoringCandidatePane({ session, state }: AuthoringCandidatePaneProps) {
  const [nodeGraph] = useState<NodeGraphEditor>(() => {
    const ng = new NodeGraphEditor({});
    ng.setReadOnly(true);
    ng.render();
    return ng;
  });

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

  return (
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
            unrenderableHint="The graph beside this shows what it does."
          />
        }
        second={<Frame instance={nodeGraph} onResize={(bounds) => nodeGraph.resize(bounds)} />}
        onSizeChanged={setSplitSize}
        onBoundsChanged={(bounds) => setSplitWidth(bounds.width)}
      />
    </div>
  );
}
