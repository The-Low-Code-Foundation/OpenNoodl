/**
 * LGC-003 §1 — the editor end of the pushed probe.
 *
 * Arm one node's block tracing, pin the viewer that answers, and hand each run's map on. It
 * knows nothing about Blockly and nothing about SVG.
 *
 * ## The one design decision worth knowing before extending this
 *
 * **Broadcast to arm, addressed on the way back.** LGC-002's handover recorded that its Do It
 * request is broadcast because a block editor tab knows a node id and nothing else, and that
 * LGC-003 "will want the opposite: it should address the client it is tracing". Both halves of
 * that turn out to be true and they resolve here:
 *
 *  - **arming stays broadcast**, because the address does not exist yet. The node lives in
 *    whichever preview happens to have its component mounted, and asking every viewer costs a
 *    string in a Set on the ones that do not;
 *  - **listening is addressed.** The first viewer to answer `attached: true` is pinned, and
 *    every frame from any other `clientId` is dropped. With two previews showing the same
 *    component that is the difference between one program's values and two interleaved.
 *
 * ⚠️ **Nothing here touches the trace switch.** `start_trace` also *clears* the buffer the
 * Provenance panel is showing, and TALK-003 recorded a human losing an in-progress recording to
 * exactly that. Block tracing has its own switch end to end (`NodeContext.setBlockTracing`), so
 * opening a block editor cannot commandeer a recording. That is an acceptance criterion, and it
 * is met by not being able to rather than by remembering not to.
 *
 * @module BlocklyEditor
 */

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { ViewerConnection } from '../../ViewerConnection';
import type { BlockRunFrame } from './BlockValueTrace';

/** Why there are no badges. Every one of these is a different thing for a builder to do. */
export type BlockTraceStatus =
  /** Armed, waiting for a viewer to say it has the node. */
  | 'waiting'
  /** A viewer has the node and is reporting. */
  | 'attached'
  /** No preview is running at all. */
  | 'no-preview'
  /** A preview is running, but this Logic Builder is not in it. */
  | 'not-in-preview'
  /** No relay. */
  | 'no-connection';

export interface BlockTraceHandle {
  dispose(): void;
  /** The pinned viewer, once one has answered. Exposed for the overlay's status line. */
  readonly clientId: string | undefined;
  readonly status: BlockTraceStatus;
}

export interface BlockTraceCallbacks {
  onFrame(frame: BlockRunFrame): void;
  onStatus(status: BlockTraceStatus): void;
}

/**
 * Arm block tracing for one node and report every run.
 *
 * Resolves nothing and rejects nothing: this runs for the lifetime of an open block editor
 * tab, and a promise would only be a way to forget one of the four ways it can have no viewer.
 */
export function attachBlockTrace(nodeId: string, callbacks: BlockTraceCallbacks): BlockTraceHandle {
  const connection = ViewerConnection.instance;
  const listenerGroup = {};

  let pinnedClientId: string | undefined;
  let status: BlockTraceStatus = 'waiting';
  let disposed = false;

  const setStatus = (next: BlockTraceStatus) => {
    if (status === next) return;
    status = next;
    callbacks.onStatus(next);
  };

  const handle: BlockTraceHandle = {
    get clientId() {
      return pinnedClientId;
    },
    get status() {
      return status;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      EventDispatcher.instance.off(listenerGroup);
      // Disarm broadcast, exactly as it was armed: any viewer that armed itself has to be
      // able to hear this, not only the one that was pinned. Disarming a node nobody is
      // tracing is a `Set.delete` that finds nothing.
      if (connection) connection.sendSetBlockTracing({ nodeId, enabled: false });
    }
  };

  if (!connection) {
    setStatus('no-connection');
    return handle;
  }

  if (!connection.hasConnectedViewer) {
    // Answered from what the editor already knows rather than by a silence. LGC-002 learned
    // this one the expensive way: three seconds of nothing reads as broken.
    setStatus('no-preview');
  }

  EventDispatcher.instance.on(
    'BlockTraceState',
    (event: { clientId?: string; state?: { nodeId?: string; enabled?: boolean; attached?: boolean } }) => {
      const state = event && event.state;
      if (!state || state.nodeId !== nodeId || !state.enabled) return;

      if (!state.attached) {
        // This viewer does not have the node. Not an error, and not the end of the question —
        // a second preview may still say yes, so this never overwrites a pin.
        if (!pinnedClientId) setStatus('not-in-preview');
        return;
      }

      if (pinnedClientId && pinnedClientId !== event.clientId) return;
      pinnedClientId = event.clientId;
      setStatus('attached');
    },
    listenerGroup
  );

  EventDispatcher.instance.on(
    'BlockValues',
    (event: { clientId?: string; frame?: BlockRunFrame }) => {
      const frame = event && event.frame;
      if (!frame || frame.nodeId !== nodeId) return;

      // The addressing, enforced. A frame that arrives before any ack pins its sender: the
      // viewer that is *running the program* is by definition the one with the node, and a
      // frame is a stronger claim than an ack.
      if (!pinnedClientId) pinnedClientId = event.clientId;
      else if (pinnedClientId !== event.clientId) return;

      setStatus('attached');
      callbacks.onFrame(frame);
    },
    listenerGroup
  );

  connection.sendSetBlockTracing({ nodeId, enabled: true });

  return handle;
}
