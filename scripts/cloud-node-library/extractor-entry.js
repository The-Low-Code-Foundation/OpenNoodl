/**
 * Bundled entry point for the cloud node-library generator (WFA-001).
 *
 * Produces the `NodeLibraryData` blob that the *cloud* runtime would have sent
 * the editor over `sendNodeLibrary`, by registering the real cloud node set the
 * way `CloudRunner` does — `noodl-runtime`'s std library under `type: 'cloud'`,
 * plus `noodl-viewer-cloud`'s own nodes — and exporting the live register.
 *
 * Why this exists: the editor's node library is delivered *by connected viewer
 * clients* (`ViewerConnection.loadNodeLibrary`). The browser types arrive from
 * the preview window; the cloud types used to arrive from the hidden
 * cloud-runtime window on port 8577, which WF-007 deleted. Since then the
 * editor has had **no cloud node types at all**, so a cloud function's canvas
 * painted its own template's Request/Response nodes as unknown types. The
 * library is generated here rather than served by a backend because you author
 * a function before you ever start one.
 *
 * This is the same headless-registry recipe as `scripts/node-catalog`, and the
 * same `nodelibraryexport` the runtime itself uses — not a parallel description
 * of the nodes that could drift from them.
 */
import '../node-catalog/dom-shim';

const fs = require('fs');

const NoodlRuntime = require('@noodl/runtime');
const generateNodeLibrary = require('@noodl/runtime/src/nodelibraryexport');
const { registerNodes: registerCloudNodes } = require('../../packages/noodl-viewer-cloud/src/nodes');

const cloudRuntime = new NoodlRuntime({
  type: 'cloud',
  runDeployed: true,
  dontCreateRootComponent: true,
  platform: {
    requestUpdate: (cb) => setTimeout(cb, 0),
    getCurrentTime: () => 0,
    objectToString: (o) => JSON.stringify(o)
  }
});

registerCloudNodes(cloudRuntime);

const library = generateNodeLibrary(cloudRuntime.context.nodeRegister);

const outPath = process.env.CLOUD_NODE_LIBRARY_OUT;
if (!outPath) throw new Error('CLOUD_NODE_LIBRARY_OUT must be set');
fs.writeFileSync(outPath, JSON.stringify(library, null, 2) + '\n');
