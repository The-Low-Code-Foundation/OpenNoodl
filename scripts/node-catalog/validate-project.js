#!/usr/bin/env node
/**
 * Round-trip sanity check for the node catalog: every `node.type` and every
 * connection endpoint appearing in a real project should resolve against the
 * catalog (or be explainable — component references, dynamic ports).
 *
 * Usage: node scripts/node-catalog/validate-project.js <project-dir-or-project.json> [...more]
 *
 * This is a diagnostic previewing SUB-006's semantic validator, not a gate:
 * it prints per-project resolution stats and exits non-zero only if a
 * *static* port or an unknown non-component type fails to resolve.
 */
const fs = require('fs');
const path = require('path');

const catalog = require('../../packages/noodl-types/src/node-catalog.json');

const byType = new Map(catalog.nodes.map((n) => [n.typeName, n]));

function loadProject(target) {
  const stat = fs.statSync(target);
  const file = stat.isDirectory() ? path.join(target, 'project.json') : target;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function walk(node, out) {
  out.push(node);
  for (const child of node.children || []) walk(child, out);
}

function collect(project) {
  const nodes = [];
  const connections = [];
  for (const comp of project.components || []) {
    const graph = comp.graph || {};
    for (const root of graph.roots || []) walk(root, nodes);
    for (const conn of graph.connections || []) connections.push(conn);
  }
  return { nodes, connections };
}

function portNames(catalogNode, plug) {
  return new Set(catalogNode[plug === 'input' ? 'inputs' : 'outputs'].map((p) => p.name));
}

function validate(target) {
  const project = loadProject(target);
  const { nodes, connections } = collect(project);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const failures = [];
  const notes = [];

  let componentRefs = 0;
  for (const node of nodes) {
    if (node.type.startsWith('/') || node.type.startsWith('#')) {
      componentRefs++; // reference to a project component, not a library node
      continue;
    }
    if (!byType.has(node.type)) failures.push(`unknown node type "${node.type}"`);
  }

  let checkedEndpoints = 0;
  let dynamicEndpoints = 0;
  for (const conn of connections) {
    for (const [end, prop, plug] of [
      ['fromId', 'fromProperty', 'output'],
      ['toId', 'toProperty', 'input']
    ]) {
      const node = nodeById.get(conn[end]);
      if (!node) continue; // dangling connection: a project-integrity issue, not a catalog one
      if (node.type.startsWith('/') || node.type.startsWith('#')) continue;
      const cat = byType.get(node.type);
      if (!cat) continue; // already reported above
      checkedEndpoints++;
      if (portNames(cat, plug).has(conn[prop])) continue;
      if (cat.dynamicPorts) {
        dynamicEndpoints++;
        notes.push(`dynamic ${plug} "${conn[prop]}" on ${node.type} (${cat.dynamicPorts.mechanisms.join(',')})`);
      } else {
        failures.push(`static node ${node.type} has no ${plug} named "${conn[prop]}"`);
      }
    }
  }

  console.log(
    `${target}: ${nodes.length} nodes (${componentRefs} component refs), ` +
      `${checkedEndpoints} connection endpoints checked, ${dynamicEndpoints} resolved as dynamic ports, ` +
      `${failures.length} failures`
  );
  for (const f of failures) console.log(`  FAIL ${f}`);
  return failures.length === 0;
}

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error('Usage: node scripts/node-catalog/validate-project.js <project-dir-or-project.json> [...more]');
  process.exit(2);
}

let ok = true;
for (const target of targets) ok = validate(target) && ok;
process.exit(ok ? 0 : 1);
