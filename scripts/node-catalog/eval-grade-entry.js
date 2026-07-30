/**
 * SUB-013 §4 — the grader, bundled so it can drive the real node registries.
 *
 * Reads model answers from $EVAL_ANSWERS and writes grades to $EVAL_OUT.
 *
 * There is no expected-answer key, and that is the point. Each answer's `parameters` object is
 * handed to the node's own dynamic-port hook, and a key counts as correct when the hook generates
 * a port with that name. This is exactly the test the runtime applies — which is to say none:
 * a key naming no port is accepted by the file, reaches the runtime, and does nothing. Grading
 * this way cannot drift from the runtime, and it cannot reward an answer for looking plausible.
 */
import './dom-shim';

const fs = require('fs');

const NoodlRuntime = require('@noodl/runtime');
const registerViewerNodes = require('../../packages/noodl-viewer-react/src/register-nodes').default;
const { registerNodes: registerCloudNodes } = require('../../packages/noodl-viewer-cloud/src/nodes');
const { driveSetup } = require('./lib/observe-ports');

const records = new Map();
const originalRegisterNode = NoodlRuntime.prototype.registerNode;
NoodlRuntime.prototype.registerNode = function (nodeDefinition) {
  originalRegisterNode.call(this, nodeDefinition);
  const raw = nodeDefinition && nodeDefinition.node ? nodeDefinition.node : nodeDefinition;
  const typeName = (raw && raw.name) || (raw && raw.metadata && raw.metadata.name);
  if (!records.has(typeName)) {
    records.set(typeName, { metadata: this.context.nodeRegister.getNodeMetadata(typeName), rawDef: nodeDefinition });
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
registerViewerNodes(makeRuntime('browser'));
registerCloudNodes(makeRuntime('cloud'));

const answers = JSON.parse(fs.readFileSync(process.env.EVAL_ANSWERS, 'utf8'));
const graded = [];

for (const answer of answers) {
  const record = records.get(answer.typeName);
  const result = {
    id: answer.id,
    condition: answer.condition,
    typeName: answer.typeName,
    parsed: answer.parsed,
    parseError: answer.parseError
  };

  if (!answer.parsed || !record) {
    graded.push({ ...result, correctKeys: [], wrongKeys: [], missingRequired: answer.requires, score: 0 });
    continue;
  }

  const parameters = answer.parameters || {};

  // The port set the node really generates for these parameters.
  let generated = new Set();
  try {
    const observed = driveSetup(answer.typeName, record.rawDef, parameters, {});
    generated = new Set((observed.ports || []).map((p) => p.name));
  } catch (err) {
    result.driveError = String((err && err.message) || err);
  }

  // Keys that are static ports or seeds are not what is being tested — the whole difficulty is
  // the derived ones — but they are not counted as wrong either.
  const staticNames = new Set([
    ...Object.keys(record.metadata.inputs || {}),
    ...Object.keys(record.metadata.outputs || {})
  ]);

  const correctKeys = [];
  const wrongKeys = [];
  // Shape validity is a second, weaker question: does the key match a documented formula, even
  // if the names interpolated into it resolve to nothing? The two come apart when a model writes
  // `value-true-pos` but never writes `values` at all — the formula is right and the node is
  // still broken. Keeping them separate is what lets a null end-to-end result be diagnosed
  // rather than just reported, and both conditions are scored the same way, so the comparison
  // stays fair to the condition that has no patterns to match against.
  const shapeValidKeys = [];
  for (const key of Object.keys(parameters)) {
    if (staticNames.has(key)) continue;
    if (generated.has(key)) correctKeys.push(key);
    else wrongKeys.push(key);
    if (answer.patterns && answer.patterns.some((p) => new RegExp(p).test(key))) shapeValidKeys.push(key);
  }

  const missingRequired = answer.requires.filter((port) => !(port in parameters));

  // Precision over the derived keys, times the fraction of required ports present. A model that
  // writes only the seed parameters gets a precision of 1 and a recall of 0, and scores 0.
  const derived = correctKeys.length + wrongKeys.length;
  const precision = derived ? correctKeys.length / derived : 0;
  const shapeValidity = derived ? shapeValidKeys.length / derived : 0;
  const recall = answer.requires.length ? (answer.requires.length - missingRequired.length) / answer.requires.length : 1;

  graded.push({
    ...result,
    correctKeys,
    wrongKeys,
    shapeValidKeys,
    missingRequired,
    precision,
    recall,
    shapeValidity,
    wroteSeeds: (answer.seededBy || []).every((name) => name in parameters),
    score: precision * recall
  });
}

fs.writeFileSync(process.env.EVAL_OUT, JSON.stringify(graded, null, 2));
console.log(`graded ${graded.length} answers`);
