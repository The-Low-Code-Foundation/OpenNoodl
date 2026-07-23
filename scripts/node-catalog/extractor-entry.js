/**
 * Bundled entry point for the node-catalog generator (see generate.js).
 *
 * Loads the real runtime registries exactly the way the applications do —
 * `noodl-runtime` + `noodl-viewer-react` for the browser runtime and
 * `noodl-runtime` + `noodl-viewer-cloud` for the cloud-function runtime —
 * then serialises the registered metadata into the catalog and writes it to
 * the path in $NODE_CATALOG_OUT.
 *
 * Extraction happens from the *live* register rather than by parsing node
 * sources: the register is the source of truth the runtime itself uses.
 */
import './dom-shim';

const fs = require('fs');

const NoodlRuntime = require('@noodl/runtime');
const generateNodeLibrary = require('@noodl/runtime/src/nodelibraryexport');
const registerViewerNodes = require('../../packages/noodl-viewer-react/src/register-nodes').default;
const { registerNodes: registerCloudNodes } = require('../../packages/noodl-viewer-cloud/src/nodes');
const { buildCatalog } = require('./lib/build-catalog');

const packageVersions = {
  'noodl-runtime': require('../../packages/noodl-runtime/package.json').version,
  'noodl-viewer-react': require('../../packages/noodl-viewer-react/package.json').version,
  'noodl-viewer-cloud': require('../../packages/noodl-viewer-cloud/package.json').version
};

// ---------------------------------------------------------------------------
// Capture raw definitions as they are registered. The register itself only
// keeps `metadata`; the raw definition additionally carries numberedInputs,
// setup hooks and instance methods, which the dynamism detection inspects.
// ---------------------------------------------------------------------------
const records = new Map(); // typeName -> { metadata, rawDef, providedBy, environments:Set }
let currentEnvironment = null;
let currentPackage = null;

const originalRegisterNode = NoodlRuntime.prototype.registerNode;
NoodlRuntime.prototype.registerNode = function (nodeDefinition) {
  originalRegisterNode.call(this, nodeDefinition);

  const raw = nodeDefinition && nodeDefinition.node ? nodeDefinition.node : nodeDefinition;
  const typeName = (raw && raw.name) || (raw && raw.metadata && raw.metadata.name);
  if (!typeName) throw new Error('Registered a node definition without a resolvable name');

  const metadata = this.context.nodeRegister.getNodeMetadata(typeName);
  const existing = records.get(typeName);
  if (existing) {
    existing.environments.add(currentEnvironment);
  } else {
    records.set(typeName, {
      metadata,
      rawDef: nodeDefinition,
      providedBy: currentPackage,
      environments: new Set([currentEnvironment])
    });
  }
};

function makeRuntime(type) {
  return new NoodlRuntime({
    type,
    runDeployed: true,
    dontCreateRootComponent: true,
    platform: {
      requestUpdate: (cb) => setTimeout(cb, 0),
      getCurrentTime: () => 0,
      objectToString: (o) => JSON.stringify(o)
    }
  });
}

// Browser runtime: std library registers in the constructor, then the React
// viewer nodes on top.
currentEnvironment = 'browser';
currentPackage = 'noodl-runtime';
const browserRuntime = makeRuntime('browser');
currentPackage = 'noodl-viewer-react';
registerViewerNodes(browserRuntime);

// Cloud runtime: std library again (same types — recorded as also available
// in "cloud"), plus the cloud-function nodes.
currentEnvironment = 'cloud';
currentPackage = 'noodl-runtime';
const cloudRuntime = makeRuntime('cloud');
currentPackage = 'noodl-viewer-cloud';
registerCloudNodes(cloudRuntime);

// Sanity: every type in each live register must have been captured.
for (const [runtime, env] of [
  [browserRuntime, 'browser'],
  [cloudRuntime, 'cloud']
]) {
  for (const typeName of Object.keys(runtime.context.nodeRegister._constructors)) {
    const record = records.get(typeName);
    if (!record || !record.environments.has(env)) {
      throw new Error(`Registered type "${typeName}" (${env}) was not captured by the generator`);
    }
  }
}

const nodeLibrary = generateNodeLibrary(browserRuntime.context.nodeRegister);
const typecasts = nodeLibrary.typecasts;

// Types offered by the editor's add-node picker (the curated core-node
// index). Registered types absent from it are legacy/superseded or created
// through specialised flows only.
const nodePickerTypes = new Set();
for (const category of nodeLibrary.nodeIndex.coreNodes) {
  for (const sub of category.subCategories) {
    for (const item of sub.items) nodePickerTypes.add(item);
  }
}

const catalog = buildCatalog(records, { typecasts, packageVersions, nodePickerTypes });

const outPath = process.env.NODE_CATALOG_OUT;
if (!outPath) throw new Error('NODE_CATALOG_OUT must be set');
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + '\n');
