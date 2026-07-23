/**
 * Headless bootstrap for the editor's export pipeline.
 *
 * The editor's exporter (`utils/exporter`) needs two globals that normally come
 * from the running Electron app:
 *
 *   - an initialised `@noodl/platform` (several editor modules read
 *     `platform.getUserDataPath()` at *module scope*, so this must happen before
 *     anything else is imported — hence the bare side-effect imports at the top,
 *     which esbuild preserves in order);
 *   - a populated `NodeLibrary.instance`, which the editor normally fills from
 *     `window.NodeLibraryData` after the viewer pushes its node library over the
 *     WebSocket (`ViewerConnection` → `NodeLibraryImporter`).
 *
 * We supply the second from the same source the editor ultimately gets it from —
 * the live browser runtime register — just in-process instead of over a socket.
 * That is the whole trick behind "zero new runtime code": no node metadata is
 * re-declared here, it is read out of `NoodlRuntime.getNodeLibrary()`.
 *
 * @module noodl-preview/headless
 */

// Order matters — see above. dom-shim must precede the runtime import (viewer
// node modules touch `window`/`document` at module scope); platform-node must
// precede any editor import.
import '../../../scripts/node-catalog/dom-shim.js';
import '../../noodl-platform-node/src/index';

import { NodeLibrary } from '@noodl-models/nodelibrary/nodelibrary';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const NoodlRuntime = require('@noodl/runtime');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const registerViewerNodes = require('../../noodl-viewer-react/src/register-nodes').default;

let bootstrapped = false;

/**
 * Registers the browser runtime's nodes and hands the resulting node library to
 * the editor's `NodeLibrary`. Idempotent; safe to call from tests.
 *
 * @returns the number of node types the library ended up with.
 */
export function bootstrapNodeLibrary(): number {
  if (bootstrapped) return NodeLibrary.instance.getNodeTypes().length;

  const runtime = new NoodlRuntime({
    type: 'browser',
    // Deployed mode: no editor WebSocket, no root component instantiation —
    // we only want the register populated.
    runDeployed: true,
    dontCreateRootComponent: true,
    platform: {
      requestUpdate: (cb: () => void) => setTimeout(cb, 0),
      getCurrentTime: () => 0,
      objectToString: (o: unknown) => JSON.stringify(o)
    }
  });
  registerViewerNodes(runtime);

  // `NodeLibrary.loadLibrary()` reads `window.NodeLibraryData` — the same shape
  // `sendNodeLibrary()` puts on the wire.
  (globalThis as unknown as { window: Record<string, unknown> }).window.NodeLibraryData = JSON.parse(
    runtime.getNodeLibrary()
  );
  NodeLibrary.instance.loadLibrary();

  const count = NodeLibrary.instance.getNodeTypes().length;
  if (count === 0) {
    throw new Error(
      'Node library came back empty — the browser runtime register did not load. ' +
        'The preview cannot resolve node types without it.'
    );
  }

  bootstrapped = true;
  return count;
}
