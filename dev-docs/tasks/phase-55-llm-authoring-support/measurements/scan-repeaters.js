#!/usr/bin/env node
/**
 * LAS-012 — corpus calibration for the repeater template contract.
 *
 * Walks BOTH corpora (session-1's lesson: a scan that reads only one silently
 * reports zero) and answers the questions the severity decision needs:
 *
 *  1. How many `For Each` nodes are there, and how do real ones name a template?
 *  2. How many carry no `template` parameter under `templateType`
 *     absent/`explicit` — the proposed `repeater-without-template`?
 *  3. Of those, how many are fed by a **connection** into the `template` port?
 *     That population is the false-positive risk: no precondition check reads
 *     connections, so a check that ignores them would report a working list
 *     as broken.
 *  4. How many name a template that resolves to no component in the project —
 *     the proposed `repeater-template-unresolved`?
 *  5. How many carry children — the proposed `repeater-with-visual-children`,
 *     which is the shape qwen was rejected for and haiku shipped.
 *
 * Usage: node dev-docs/tasks/.../measurements/scan-repeaters.js [--list]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../../..');
const EXTRA_ROOTS = [path.resolve(REPO, '../NodeGX test projects')];
const LIST = process.argv.includes('--list');

const REPEATER_TYPE = 'For Each';

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

// ── project → { components: name → nodes, connections: per component } ────────
//
// Both readers flatten to the same row shape:
//   { id, type, parameters, childTypes: string[], hasChildren: boolean }
// plus a per-component set of ports that a connection lands on:
//   connectedInputs: Set<`${nodeId}::${port}`>

function legacyProject(file) {
  const data = readJSON(file);
  if (!Array.isArray(data.components)) return null;
  const components = new Map();
  for (const c of data.components) {
    const flat = [];
    const visit = (n) => {
      flat.push({
        id: n.id,
        type: n.type,
        parameters: n.parameters || {},
        childTypes: (n.children || []).map((k) => k.type),
        hasChildren: (n.children || []).length > 0
      });
      for (const k of n.children || []) visit(k);
    };
    for (const r of (c.graph && c.graph.roots) || []) visit(r);
    const connectedInputs = new Set();
    for (const conn of (c.graph && c.graph.connections) || []) {
      connectedInputs.add(`${conn.toId}::${conn.toProperty}`);
    }
    components.set(c.name, { nodes: flat, connectedInputs });
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
      const raw = readJSON(path.join(cdir, 'nodes.json'));
      const nodes = raw.nodes || [];
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const flat = nodes.map((n) => ({
        id: n.id,
        type: n.type,
        parameters: n.parameters || {},
        childTypes: (n.children || []).map((c) => (byId.get(c) || {}).type || '(dangling)'),
        hasChildren: (n.children || []).length > 0
      }));
      const connectedInputs = new Set();
      let conns = raw.connections;
      if (!Array.isArray(conns)) {
        try {
          conns = readJSON(path.join(cdir, 'connections.json')).connections || [];
        } catch {
          conns = [];
        }
      }
      for (const conn of conns) connectedInputs.add(`${conn.toId ?? conn.to}::${conn.toProperty ?? conn.toPort}`);
      components.set(meta.path || '/' + key, { nodes: flat, connectedInputs });
    } catch {
      /* a corrupt component is one fewer name, not a fatal scan */
    }
  }
  return components;
}

const refToPath = (r) => {
  const p = r.startsWith('/') ? r.slice(1) : r;
  return p.startsWith('#') ? p.slice(1) : p;
};

// ── the scan ──────────────────────────────────────────────────────────────────

const files = [];
walk(REPO, files);
for (const extra of EXTRA_ROOTS) walk(extra, files);

const tally = {
  legacyProjects: 0,
  v2Projects: 0,
  projectsWithRepeater: 0,
  repeaters: 0,
  templateType: {},
  withTemplate: 0,
  withoutTemplate: 0,
  withoutTemplateButConnected: 0,
  dynamicWithScript: 0,
  dynamicWithoutScript: 0,
  templateUnresolved: 0,
  withChildren: 0,
  withChildrenAndNoTemplate: 0
};
const rows = { noTemplate: [], connected: [], unresolved: [], children: [], dynamicNoScript: [] };

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

  const names = new Set();
  for (const name of components.keys()) {
    names.add(name);
    names.add(refToPath(name));
  }

  let sawRepeater = false;
  for (const [owner, { nodes, connectedInputs }] of components) {
    for (const node of nodes) {
      if (node.type !== REPEATER_TYPE) continue;
      sawRepeater = true;
      tally.repeaters++;
      const where = `${rel} :: ${owner} :: ${node.id}`;

      const templateType = node.parameters.templateType;
      const key = templateType === undefined ? '(unset)' : String(templateType);
      tally.templateType[key] = (tally.templateType[key] || 0) + 1;

      if (node.hasChildren) {
        tally.withChildren++;
        rows.children.push(`${where} children=[${node.childTypes.join(', ')}]`);
      }

      if (templateType === 'dynamic') {
        const script = node.parameters.templateScript;
        if (typeof script === 'string' && script.trim()) tally.dynamicWithScript++;
        else if (connectedInputs.has(`${node.id}::templateScript`)) tally.dynamicWithScript++;
        else {
          tally.dynamicWithoutScript++;
          rows.dynamicNoScript.push(where);
        }
        continue;
      }

      const template = node.parameters.template;
      if (typeof template === 'string' && template.trim()) {
        tally.withTemplate++;
        if (!names.has(template.trim()) && !names.has(refToPath(template.trim()))) {
          // `./` and `../` are resolved against the owning component at runtime.
          if (!template.trim().startsWith('.')) {
            tally.templateUnresolved++;
            rows.unresolved.push(`${where} template=${JSON.stringify(template)}`);
          }
        }
        continue;
      }

      tally.withoutTemplate++;
      if (node.hasChildren) tally.withChildrenAndNoTemplate++;
      if (connectedInputs.has(`${node.id}::template`)) {
        tally.withoutTemplateButConnected++;
        rows.connected.push(where);
      } else {
        rows.noTemplate.push(where);
      }
    }
  }
  if (sawRepeater) tally.projectsWithRepeater++;
}

console.log(JSON.stringify(tally, null, 2));
if (LIST) {
  for (const [name, list] of Object.entries(rows)) {
    if (!list.length) continue;
    console.log(`\n── ${name} (${list.length}) ──`);
    for (const r of list) console.log('  ' + r);
  }
}
