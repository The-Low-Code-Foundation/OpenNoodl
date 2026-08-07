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

/**
 * Collect per component, not project-wide.
 *
 * Connections (`fromId`/`toId`) resolve *within* a component, so a single
 * project-wide id→node map was wrong twice over: a duplicate id silently
 * displaced the earlier node (SUB-012), and an id reused in two components made
 * an endpoint resolve against whichever component happened to be indexed last.
 */
function collect(project) {
  const components = [];
  for (const comp of project.components || []) {
    const graph = comp.graph || {};
    const nodes = [];
    for (const root of graph.roots || []) walk(root, nodes);
    components.push({ name: comp.name, nodes, connections: graph.connections || [] });
  }
  return components;
}

/**
 * SUB-012: duplicate node ids, found by counting the flat node *array* — a
 * `Map<id, node>` would already have swallowed the collision.
 *
 * Within a component this is an outright failure (connections and parent/child
 * links resolve by id, so a collision is ambiguous). Across components it is
 * counted, not failed: the editor regenerates ids on every component copy, but
 * real projects assembled outside it do reuse ids and still work, so failing on
 * that would reject known-good projects. (The SUB-006 validator makes the same
 * split, as an error and a warning respectively.)
 *
 * Returns the ids reused across components, for the summary line.
 */
function checkDuplicateIds(components, failures) {
  const componentsById = new Map();

  for (const { name, nodes } of components) {
    const byId = new Map();
    for (const node of nodes) {
      if (!byId.has(node.id)) byId.set(node.id, []);
      // Braces deliberately: `push` returns a length, never a control signal.
      byId.get(node.id).push(node);
    }

    for (const [id, group] of byId) {
      if (!componentsById.has(id)) componentsById.set(id, []);
      componentsById.get(id).push(name);

      if (group.length < 2) continue;
      const which = group.map((n) => (n.label ? `${n.type} "${n.label}"` : n.type)).join(', ');
      failures.push(`duplicate node id "${id}" — ${group.length} nodes in component ${name} share it (${which})`);
    }
  }

  const reusedAcrossComponents = [];
  for (const [id, names] of componentsById) {
    if (new Set(names).size > 1) reusedAcrossComponents.push(id);
  }
  return reusedAcrossComponents;
}

function portNames(catalogNode, plug) {
  return new Set(catalogNode[plug === 'input' ? 'inputs' : 'outputs'].map((p) => p.name));
}

function validate(target) {
  const project = loadProject(target);
  const components = collect(project);

  const failures = [];
  const notes = [];

  const reusedIds = checkDuplicateIds(components, failures);

  const nodes = components.flatMap((c) => c.nodes);

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
  for (const component of components) {
    // Scoped to the component the connection lives in — see collect().
    const nodeById = new Map(component.nodes.map((n) => [n.id, n]));
    for (const conn of component.connections) {
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
  }

  console.log(
    `${target}: ${nodes.length} nodes (${componentRefs} component refs), ` +
      `${checkedEndpoints} connection endpoints checked, ${dynamicEndpoints} resolved as dynamic ports, ` +
      `${failures.length} failures` +
      (reusedIds.length ? ` (plus ${reusedIds.length} ids reused across components — not a failure)` : '')
  );
  for (const f of failures) console.log(`  FAIL ${f}`);
  return { ok: failures.length === 0, failures, reusedIds };
}

// ─── Self-test (SUB-012) ──────────────────────────────────────────────────────

/**
 * Exercises the duplicate-id rule against the committed fixtures. This script is
 * a CLI over real projects, so there is nowhere else to assert its behaviour;
 * `--self-test` keeps the rule honest without inventing a test framework here.
 */
function selfTest() {
  const fixtures = path.join(__dirname, 'fixtures');
  const checks = [];

  const dup = validate(path.join(fixtures, 'duplicate-node-id'));
  const dupFailures = dup.failures.filter((f) => f.startsWith('duplicate node id'));
  checks.push(['duplicate fixture fails', dup.ok === false]);
  checks.push(['reports the 2-way collision in /#Home', dupFailures.some((f) => f.includes('"collide-2way"') && f.includes('2 nodes in component /#Home'))]);
  checks.push(['names both colliding nodes', dupFailures.some((f) => f.includes('Text "First"') && f.includes('Text "Second"'))]);
  checks.push(['reports the 3-way collision', dupFailures.some((f) => f.includes('"collide-3way"') && f.includes('3 nodes'))]);
  checks.push(['one failure per colliding id, not per node', dupFailures.length === 2]);
  checks.push(['cross-component reuse counted, not failed', dup.reusedIds.length === 1 && !dupFailures.some((f) => f.includes('shared-across-components'))]);

  const clean = validate(path.join(fixtures, 'unique-node-ids'));
  checks.push(['control fixture passes', clean.ok === true]);
  checks.push(['control reports no reuse', clean.reusedIds.length === 0]);

  console.log('');
  let failed = 0;
  for (const [name, passed] of checks) {
    console.log(`  ${passed ? 'ok  ' : 'FAIL'} ${name}`);
    if (!passed) failed++;
  }
  console.log(`\n${checks.length - failed} passing, ${failed} failing`);
  return failed === 0;
}

const argv = process.argv.slice(2);
if (argv.includes('--self-test')) {
  process.exit(selfTest() ? 0 : 1);
}

const targets = argv;
if (!targets.length) {
  console.error(
    'Usage: node scripts/node-catalog/validate-project.js <project-dir-or-project.json> [...more]\n' +
      '       node scripts/node-catalog/validate-project.js --self-test'
  );
  process.exit(2);
}

let ok = true;
for (const target of targets) ok = validate(target).ok && ok;
process.exit(ok ? 0 : 1);
