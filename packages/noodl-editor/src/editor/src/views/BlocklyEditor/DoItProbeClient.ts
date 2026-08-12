/**
 * LGC-002 — the editor end of the Do It round trip.
 *
 * generate here → send over the relay → compile and run in the viewer → the value comes back.
 * This file is only the middle two arrows; it knows nothing about blocks and nothing about SVG.
 *
 * ⚠️ **Every failure gets a sentence.** Four things can go wrong before a value arrives, and
 * they want four different actions from the builder:
 *
 *  | what happened | what they should do |
 *  |---|---|
 *  | no relay at all | restart the editor |
 *  | no preview attached | open the preview |
 *  | preview attached, node not in it | show the component the node is on |
 *  | preview has the node, the fragment threw | fix the blocks |
 *
 * Collapsing those into one timeout — or worse, into a balloon that never appears — is the
 * same defect §4 is about, one level up: a Do It that fails quietly teaches nothing.
 *
 * @module BlocklyEditor
 */

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { ViewerConnection } from '../../ViewerConnection';
import { BlockFragmentReply, DoItAnswer, answerForReply } from './DoIt';

/** How long to wait for a viewer that has the node. Generous: the socket coalesces at 200ms. */
const REPLY_TIMEOUT_MS = 3000;

export type { DoItAnswer };

let nextRequestId = 1;

/**
 * Ask the running app what this fragment comes to.
 *
 * Resolves — never rejects. A rejected promise here would have to be caught by the caller and
 * turned back into a balloon, and the one that got forgotten would be the silent Do It.
 */
export function requestBlockValue(
  nodeId: string,
  code: string,
  timeoutMs: number = REPLY_TIMEOUT_MS
): Promise<DoItAnswer> {
  const connection = ViewerConnection.instance;

  if (!connection) {
    return Promise.resolve({
      state: 'error',
      text: 'The editor has no connection to a running app, so there is nothing to ask.'
    });
  }

  if (!connection.hasConnectedViewer) {
    // The task's last acceptance line: "Do It with no running app is offered and explains
    // itself, rather than silently doing nothing." Answered here rather than by a timeout,
    // because the editor already knows the answer and three seconds of nothing reads as broken.
    return Promise.resolve({
      state: 'error',
      text: 'Do It runs the block in your app, and no preview is running. Open the preview and try again.'
    });
  }

  const requestId = 'doit-' + nextRequestId++;

  return new Promise<DoItAnswer>((resolve) => {
    const listenerGroup = {};
    let settled = false;
    /** A viewer answered, but does not have this node. Kept for the timeout's message. */
    let sawViewerWithoutNode = false;

    const finish = (answer: DoItAnswer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      EventDispatcher.instance.off(listenerGroup);
      resolve(answer);
    };

    const timer = setTimeout(() => {
      finish({
        state: 'error',
        text: sawViewerWithoutNode
          ? 'The preview is running, but this Logic Builder is not in it right now. Show the component it sits on, then try again.'
          : 'The running app did not answer. It may still be starting up, or it may have stopped.'
      });
    }, timeoutMs);

    EventDispatcher.instance.on(
      'BlockFragmentResult',
      (event: { clientId?: string; result?: BlockFragmentReply }) => {
        const reply = event && event.result;
        if (!reply || reply.requestId !== requestId) return;

        // Broadcast, so a second preview that does not have the node also answers. Its "no"
        // must not settle the question — another viewer may still say yes — but it is
        // remembered, because it is the difference between "not there" and "no answer at all".
        if (!reply.found) {
          sawViewerWithoutNode = true;
          return;
        }

        finish(answerForReply(reply));
      },
      listenerGroup
    );

    connection.sendEvaluateBlockFragment({ requestId, nodeId, code });
  });
}
