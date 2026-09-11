#!/usr/bin/env node
/**
 * LAS-001 — corpus calibration for the interface gate.
 *
 * Walks BOTH corpora (session-1's lesson: a scan that reads only one silently
 * reports zero) and answers the questions the severity decision needs:
 *
 *  1. How do real `Component Inputs` nodes declare their ports — which `plug`?
 *     This decides whether the interface index may key on plug direction at all.
 *  2. How many component-instance parameters name no port on the target's
 *     interface, under each candidate derivation?
 *  3. How many components have ≥2 instances that vary while exposing no inputs?
 *
 * Usage: node dev-docs/tasks/.../measurements/scan-interfaces.js [--list]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../../..');
const EXTRA_ROOTS = [path.resolve(REPO, '../NodeGX test projects')];
const LIST = process.argv.includes('--list');

// ── walking ───────────────────────────────────────────────────────────────────

function walk(dir, out, depth = 0) {
  if (depth > 12) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'build') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, depth + 1);
    else if (e.name === 'project.json' || e.name === 'nodegx.project.json') out.push(p);
  }
  return out;
}

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ── project → { name → flat nodes } ───────────────────────────────────────────

function legacyProject(file) {
  const data = readJSON(file);
  if (!Array.isArray(data.components)) return null;
  const components = new Map();
  for (const c of data.components) {
    const flat = [];
    const visit = (n) => {
      flat.push(n);
      for (const k of n.children || []) visit(k);
    };
    for (const r of (c.graph && c.graph.roots) || []) visit(r);
    components.set(c.name, flat);
  }
  return components;
}

function v2Project(file) {
  const root = path.dirname(file);
  const project = readJSON(file);
  const dir = path.join(root, (project.structure && project.structure.componentsDir) || 'components');
  let registry;
  try {
    registry = readJSON(path.join(dir, '_registry.json'));
  } catch {
    return null;
  }
  const components = new Map();
  for (const key of Object.keys(registry.components || {})) {
    const cdir = path.join(dir, registry.components[key].path);
    try {
      const meta = readJSON(path.join(cdir, 'component.json'));
      const nodes = readJSON(path.join(cdir, 'nodes.json')).nodes || [];
      components.set(meta.path || '/' + key, nodes);
    } catch {
      /* a corrupt component is one fewer name, not a fatal scan */
    }
  }
  return components;
}

// ── the two candidate derivations ─────────────────────────────────────────────

const COMPONENT_PORT_TYPES = new Set(['Component Inputs', 'Component Outputs']);

/** STRICT: what `componentmodel.getPorts()` (and therefore the runtime) sees. */
function strictInputs(nodes) {
  const names = new Set();
  for (const n of nodes) {
    if (!COMPONENT_PORT_TYPES.has(n.type)) continue;
    for (const p of n.ports || []) {
      if (typeof p.plug === 'string' && p.plug.indexOf('output') !== -1 && typeof p.name === 'string') {
        names.add(p.name);
      }
    }
  }
  return names;
}

/** LENIENT: what `explain/graph.ts::componentPorts` and render-from-disk assume. */
function lenientInputs(nodes) {
  const names = new Set();
  for (const n of nodes) {
    if (n.type !== 'Component Inputs' && n.type !== 'PageInputs') continue;
    for (const p of n.ports || []) if (typeof p.name === 'string') names.add(p.name);
  }
  return names;
}

const isComponentRef = (t) => typeof t === 'string' && (t.startsWith('/') || t.startsWith('#'));
const refToPath = (r) => {
  let p = r.startsWith('/') ? r.slice(1) : r;
  return p.startsWith('#') ? p.slice(1) : p;
};

// ── the scan ──────────────────────────────────────────────────────────────────

const files = [];
walk(REPO, files);
for (const extra of EXTRA_ROOTS) walk(extra, files);

const tally = {
  legacyProjects: 0,
  v2Projects: 0,
  componentsWithInputsNode: 0,
  plug: {},
  portsOnComponentInputs: 0,
  instances: 0,
  instancesWithParams: 0,
  parameters: 0,
  unknownStrict: 0,
  unknownLenient: 0,
  /** Of the unknown ones, how many the instance node declares as its own port. */
  coveredByInstancePort: 0,
  /** Of the unknown ones: target declares SOME inputs (a near-miss / stale name). */
  unknownAgainstAnInterface: 0,
  /** Of the unknown ones: target declares NO inputs at all. */
  unknownAgainstNoInterface: 0,
  /** Distinct (candidate component, target) pairs where the target has no inputs. */
  interfacelessTargets: 0,
  interfacelessVariance: 0,
  pageInputsOnly: 0
};
const unknownRows = [];
const varianceRows = [];
const plugInputRows = [];

for (const file of files) {
  const isV2 = path.basename(file) === 'nodegx.project.json';
  let components;
  try {
    components = isV2 ? v2Project(file) : legacyProject(file);
  } catch {
    continue;
  }
  if (!components) continue;
  isV2 ? tally.v2Projects++ : tally.legacyProjects++;
  const rel = path.relative(REPO, file);

  // Interface index, both derivations, keyed by both name forms.
  const strict = new Map();
  const lenient = new Map();
  for (const [name, nodes] of components) {
    const s = strictInputs(nodes);
    const l = lenientInputs(nodes);
    for (const key of [name, refToPath(name)]) {
      strict.set(key, s);
      lenient.set(key, l);
    }
    const inputsNodes = nodes.filter((n) => n.type === 'Component Inputs');
    if (inputsNodes.length) {
      tally.componentsWithInputsNode++;
      for (const n of inputsNodes) {
        for (const p of n.ports || []) {
          tally.portsOnComponentInputs++;
          const plug = typeof p.plug === 'string' ? p.plug : '(none)';
          tally.plug[plug] = (tally.plug[plug] || 0) + 1;
          if (plug !== 'output' && plug !== 'input/output') {
            plugInputRows.push(`${rel} :: ${name} :: ${p.name} plug=${plug}`);
          }
        }
      }
    }
  }

  // Instance parameters vs the interface.
  const instancesByTarget = new Map();
  for (const [owner, nodes] of components) {
    for (const node of nodes) {
      if (!isComponentRef(node.type)) continue;
      const target = strict.has(node.type) ? node.type : strict.has(refToPath(node.type)) ? refToPath(node.type) : null;
      if (target === null) continue; // unresolved-component-ref owns this
      tally.instances++;
      const params = Object.keys(node.parameters || {});
      if (params.length) tally.instancesWithParams++;
      tally.parameters += params.length;

      const s = strict.get(target);
      const l = lenient.get(target);
      const own = new Set(
        [...(node.ports || []), ...(node.dynamicports || [])]
          .map((p) => p && p.name)
          .filter((n) => typeof n === 'string')
      );
      for (const p of params) {
        if (!s.has(p)) {
          tally.unknownStrict++;
          if (!l.has(p)) {
            tally.unknownLenient++;
            if (own.has(p)) tally.coveredByInstancePort++;
            if (s.size > 0) tally.unknownAgainstAnInterface++;
            else tally.unknownAgainstNoInterface++;
            unknownRows.push(`${rel} :: ${owner} :: ${node.id} (${node.type}) :: ${p} :: iface=${s.size}`);
          } else {
            tally.pageInputsOnly++;
          }
        }
      }

      const list = instancesByTarget.get(target) || [];
      list.push({ owner, id: node.id, params: JSON.stringify(node.parameters || {}, Object.keys(node.parameters || {}).sort()) });
      instancesByTarget.set(target, list);
    }
  }

  // The generalised predicate the rule actually uses: any candidate component
  // holding ≥1 instance of an inputs-less target that carries parameters.
  for (const [owner, nodes] of components) {
    const seen = new Set();
    for (const node of nodes) {
      if (!isComponentRef(node.type)) continue;
      const target = strict.has(node.type) ? node.type : strict.has(refToPath(node.type)) ? refToPath(node.type) : null;
      if (target === null || seen.has(target)) continue;
      if (strict.get(target).size > 0) continue;
      if (!Object.keys(node.parameters || {}).length) continue;
      seen.add(target);
      tally.interfacelessTargets++;
      varianceRows.push(`[target] ${rel} :: ${owner} instantiates ${target}, which declares no inputs`);
    }
  }

  for (const [target, list] of instancesByTarget) {
    if (list.length < 2) continue;
    // Variance means the *values* differ — haiku's four cards carry identical
    // parameter NAMES and four different products, which is exactly the case
    // the rule exists for. Comparing name sets would have missed it.
    const sets = new Set(list.map((i) => i.params));
    if (sets.size < 2) continue;
    if (strict.get(target).size > 0) continue;
    if (list.every((i) => i.params === '{}')) continue;
    tally.interfacelessVariance++;
    varianceRows.push(`${rel} :: ${target} :: ${list.length} instances, ${sets.size} distinct parameter maps`);
  }
}

console.log(JSON.stringify(tally, null, 2));
console.log(`\nunknown-parameter rows (lenient derivation): ${unknownRows.length}`);
console.log(`interfaceless-variance rows: ${varianceRows.length}`);
console.log(`Component Inputs ports NOT plugged 'output': ${plugInputRows.length}`);
if (LIST) {
  console.log('\n── unknown parameters ──');
  for (const r of unknownRows) console.log(r);
  console.log('\n── interfaceless variance ──');
  for (const r of varianceRows) console.log(r);
  console.log('\n── non-output plugs on Component Inputs ──');
  for (const r of plugInputRows.slice(0, 60)) console.log(r);
}
