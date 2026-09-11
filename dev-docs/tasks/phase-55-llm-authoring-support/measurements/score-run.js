#!/usr/bin/env node
/**
 * Score one storefront replay against the STOREFRONT-BRIEF.md fixture table.
 *
 * The table says "run them, do not eyeball" and session 1 scored by hand, which
 * is why its numbers took a session to produce and cannot be re-derived. This
 * reads a v2 project off disk and prints every mechanical cell in the LAS-011
 * matrix, so a run can be re-scored later, and two runs can be diffed.
 *
 * It deliberately does NOT render — `npm run render:report -- <dir>` is the eyes
 * and stays a separate, slower step. Everything here is a claim about the graph.
 *
 *   node dev-docs/tasks/phase-55-llm-authoring-support/measurements/score-run.js <project-dir> [--json]
 *
 * @module measurements/score-run
 */
const fs = require('fs');
const path = require('path');

/** Node types that carry meaning for the fixture table. */
const T = {
  componentInputs: 'Component Inputs',
  componentOutputs: 'Component Outputs',
  forEach: 'For Each',
  staticData: 'Static Data',
  columns: 'net.noodl.visual.columns',
  states: 'States',
  page: 'Page',
  router: 'Router'
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Every component in the project, with its nodes and connections loaded. */
function loadComponents(projectDir) {
  const root = path.join(projectDir, 'components');
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name === 'component.json') {
        const meta = readJson(p, {});
        const nodes = readJson(path.join(dir, 'nodes.json'), { nodes: [] }).nodes || [];
        const connections = readJson(path.join(dir, 'connections.json'), { connections: [] }).connections || [];
        out.push({
          pathName: path.relative(root, dir).split(path.sep).join('/'),
          meta,
          nodes,
          connections
        });
      }
    }
  })(root);
  return out;
}

function score(projectDir) {
  const components = loadComponents(projectDir);
  const registry = readJson(path.join(projectDir, 'components/_registry.json'), { components: {} });

  const byPath = new Map(components.map((c) => [c.pathName, c]));
  const isPage = (c) => (registry.components[c.pathName] || {}).type === 'page' || c.nodes.some((n) => n.type === T.page);

  const typeCounts = {};
  for (const c of components) for (const n of c.nodes) typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;

  // A component's interface is a `Component Inputs` node whose ports are plugged
  // "output" — the LAS-001 inversion. A node with the right type and the wrong
  // plug is not an interface, so both are counted separately.
  const interfaces = [];
  for (const c of components) {
    const node = c.nodes.find((n) => n.type === T.componentInputs);
    if (!node) continue;
    const ports = (node.ports || []).filter((p) => p.plug === 'output');
    const backwards = (node.ports || []).filter((p) => p.plug === 'input');
    interfaces.push({ component: c.pathName, inputs: ports.map((p) => p.name), backwards: backwards.length });
  }

  // Component instances: a node whose type names another component in this
  // project. `parametersSet` is what makes an instance "vary" — the F2 question.
  const componentTypes = new Set(components.map((c) => '/' + c.pathName));
  const instances = [];
  for (const c of components) {
    for (const n of c.nodes) {
      if (!componentTypes.has(n.type)) continue;
      const params = Object.keys(n.parameters || {});
      instances.push({ in: c.pathName, type: n.type, params });
    }
  }
  const varyingTypes = new Map();
  for (const inst of instances) {
    if (!inst.params.length) continue;
    const seen = varyingTypes.get(inst.type) || new Set();
    inst.params.forEach((p) => seen.add(p));
    varyingTypes.set(inst.type, seen);
  }
  // An instance type "varies" when more than one instance exists and they set
  // parameters — i.e. exactly the case that needs a Component Inputs node.
  const instanceCountByType = {};
  for (const inst of instances) instanceCountByType[inst.type] = (instanceCountByType[inst.type] || 0) + 1;
  const varyingWithoutInterface = [];
  for (const [type, params] of varyingTypes) {
    const target = type.replace(/^\//, '');
    const iface = interfaces.find((i) => i.component === target);
    const declared = new Set(iface ? iface.inputs : []);
    const missing = [...params].filter((p) => !declared.has(p));
    if (missing.length) varyingWithoutInterface.push({ type, instances: instanceCountByType[type], missing });
  }

  const pages = components.filter(isPage);
  const pageOwnNodes = pages.map((c) => ({ page: c.pathName, nodes: c.nodes.length }));

  // Both units, deliberately.
  //
  // AUDIT-SESSION-1 recorded sonnet's wiring as "102 connection endpoints" and
  // the LAS-011 matrix copied that number into a row whose other cell (haiku's
  // 0) is a count of connections. Zero is zero in both units, so the mismatch
  // was invisible until a run produced a non-zero number in the other column.
  // Measured here: sonnet's baseline is 56 connections / 101 distinct endpoints.
  const connections = components.reduce((n, c) => n + c.connections.length, 0);
  const endpoints = new Set();
  for (const c of components) {
    for (const conn of c.connections) {
      endpoints.add(`${c.pathName}|${conn.fromId}.${conn.fromProperty}`);
      endpoints.add(`${c.pathName}|${conn.toId}.${conn.toProperty}`);
    }
  }

  // Optional data with a "not drawn" path — best-practices 02. A `visible` or
  // `mounted` that is *wired* (a connection target) rather than a literal.
  let conditionalWired = 0;
  for (const c of components) {
    for (const conn of c.connections) {
      const port = conn.toProperty || conn.to || '';
      if (/^(visible|mounted)$/.test(String(port))) conditionalWired++;
    }
  }

  return {
    projectDir,
    components: {
      // `total` counts the App root component; session 1's published figures do
      // not (haiku "9" = 10 - App, sonnet "17" = 18 - App), so both are reported
      // rather than silently picking one and breaking the before→after column.
      total: components.length,
      excludingApp: components.filter((c) => c.pathName !== 'App').length,
      pages: pages.length,
      nonPage: components.length - pages.length,
      names: components.map((c) => c.pathName).sort()
    },
    pageOwnNodes,
    connections,
    endpoints: endpoints.size,
    interfaces: {
      componentsWithInterface: interfaces.length,
      totalInputPorts: interfaces.reduce((n, i) => n + i.inputs.length, 0),
      backwardsPorts: interfaces.reduce((n, i) => n + i.backwards, 0),
      detail: interfaces
    },
    instances: {
      total: instances.length,
      withParameters: instances.filter((i) => i.params.length).length,
      varyingWithoutInterface
    },
    repetition: {
      forEach: typeCounts[T.forEach] || 0,
      staticData: typeCounts[T.staticData] || 0
    },
    responsive: { columns: typeCounts[T.columns] || 0 },
    interaction: {
      states: typeCounts[T.states] || 0,
      componentOutputs: typeCounts[T.componentOutputs] || 0
    },
    conditionalWired,
    typeCounts
  };
}

function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir) {
    process.stderr.write('usage: score-run.js <project-dir> [--json]\n');
    process.exit(2);
  }
  const result = score(path.resolve(dir));
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  const r = result;
  const lines = [
    `project                       ${path.basename(r.projectDir)}`,
    `components (excl. App)        ${r.components.excludingApp} (${r.components.nonPage} non-page, ${r.components.pages} page)`,
    `page own nodes                ${r.pageOwnNodes.map((p) => `${p.page}=${p.nodes}`).join(', ') || '—'}`,
    `connections / endpoints       ${r.connections} / ${r.endpoints}`,
    `Component Inputs components   ${r.interfaces.componentsWithInterface} (${r.interfaces.totalInputPorts} ports` +
      `${r.interfaces.backwardsPorts ? `, ${r.interfaces.backwardsPorts} BACKWARDS` : ''})`,
    `instances / with parameters   ${r.instances.total} / ${r.instances.withParameters}`,
    `varying instances w/o input   ${r.instances.varyingWithoutInterface.length ? r.instances.varyingWithoutInterface.map((v) => `${v.type}[${v.missing.join(',')}]`).join(' ') : 'none ✓'}`,
    `For Each / Static Data        ${r.repetition.forEach} / ${r.repetition.staticData}`,
    `Columns                       ${r.responsive.columns}`,
    `States / Component Outputs    ${r.interaction.states} / ${r.interaction.componentOutputs}`,
    `visible|mounted wired         ${r.conditionalWired}`
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

if (require.main === module) main();

module.exports = { score };
