/**
 * FLD-010 — the relay half of `session_status`. The reading it answers with is `./collect`.
 *
 * Installed from `router.tsx` beside `installExternalProjectOpen`, for the same reason: one
 * window, one subscription, and the window is its lifetime.
 *
 * 🔴 **No relay change was needed for this, and that is the finding.** FLD-010's own §2 says the
 * relay's routing "is wrong for this use" because an `editor` peer fans only to `viewer` peers.
 * That is true of *broadcast* and irrelevant here: `target` routing matches on `clientId` and
 * ignores peer type entirely, and HLS-009 has been carrying an agent→editor command over it since
 * it shipped. `relay-server.js` is untouched by this task — which is also what keeps AC5 (the
 * `nodegx-observe` fan-out) true by construction rather than by assertion.
 *
 * @module models/sessionStatus
 */

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { ViewerConnection } from '../../ViewerConnection';
import { collectSessionStatus, type EditorSessionStatus } from './collect';

export { collectSessionStatus };
export type { EditorSessionStatus };

/**
 * Answer `sessionStatus` on the relay, for the life of the window.
 *
 * Mirrors `installExternalProjectOpen` deliberately: `ViewerConnection` stays transport, the
 * decision lives here, and the reply is addressed back to the asker by `clientId`.
 */
export function installSessionStatus(): void {
  EventDispatcher.instance.on(
    'ViewerConnection.sessionStatusRequested',
    (args: { requestId: string; replyTo: string }) => {
      let result: EditorSessionStatus | { error: string };
      try {
        result = collectSessionStatus();
      } catch (e) {
        // An answer that failed is still an answer. Staying silent would leave the caller to
        // time out, and a timeout is indistinguishable from an editor too old to have this
        // handler at all — which the tool reports very differently.
        result = { error: 'The editor failed while reading its own state: ' + ((e as Error)?.message || String(e)) };
      }
      ViewerConnection.instance?.sendSessionStatusResult(args?.replyTo, args?.requestId, result);
    },
    null
  );
}
