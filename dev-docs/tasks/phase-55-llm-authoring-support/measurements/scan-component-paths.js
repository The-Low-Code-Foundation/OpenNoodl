#!/usr/bin/env node
/**
 * LAS-006 — corpus calibration for the plan advisory.
 *
 * The task says a `create` targeting "a component-ish path (`Components/`,
 * `Cards/`, `Sections/` — derive the prefix list from what the corpus actually
 * uses, don't guess)" should draw an advisory when it declares no interface.
 * This is the "don't guess" half.
 *
 * Walks BOTH corpora (session-1's lesson) and answers:
 *
 *  1. What top-level folder does every component actually live in, and how many
 *     of each folder's components declare a `Component Inputs` port?
 *  2. If the advisory keyed on a folder allowlist, what would it cover and what
 *     would it miss — i.e. how many interface-bearing components sit outside
 *     any candidate prefix?
 *  3. The complement: how many components in each folder are *pages* (carry a
 *     `Page` node), since a page is the one shape the advisory must not nag.
 *
 * Usage: node dev-docs/tasks/.../measurements/scan-component-paths.js [--list]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../../..');
const EXTRA_ROOTS = [path.resolve(REPO, '../NodeGX test projects')];
const LIST = process.argv.includes('--list');

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

const COMPONENT_PORT_TYPES = new Set(['Component Inputs', 'Component Outputs']);

/** What `componentmodel.getPorts()` publishes as the component's inputs. */
function declaredInputs(nodes) {
  const names = new Set();
  for (const n of nodes) {
    if (!COMPONENT_PORT_TYPES.has(n.type)) continue;
    for (const p of n.ports || []) {
      if (typeof p.plug === 'string' && p.plug.indexOf('output') !== -1 && typeof p.name === 'string') names.add(p.name);
    }
  }
  return names;
}

const isPage = (nodes) => nodes.some((n) => n.type === 'Page');
const isComponentRef = (t) => typeof t === 'string' && (t.startsWith('/') || t.startsWith('#'));

/** "/Components/Cards/ProductCard" → "Components". "/Home" → "" (root). */
function topFolder(legacyName) {
  const trimmed = legacyName.replace(/^\//, '');
  const cut = trimmed.indexOf('/');
  return cut === -1 ? '' : trimmed.slice(0, cut);
}

const files = [];
walk(REPO, files);
for (const extra of EXTRA_ROOTS) walk(extra, files);

const folders = new Map();
const tally = { legacyProjects: 0, v2Projects: 0, components: 0, pages: 0, withInputs: 0, instantiated: 0 };
const outsideCandidates = [];

/** The prefixes the task file guessed, to be measured rather than trusted. */
const GUESSED = ['Components', 'Cards', 'Sections'];

for (const file of files) {
  let components;
  const isV2 = file.endsWith('nodegx.project.json');
  try {
    components = isV2 ? v2Project(file) : legacyProject(file);
  } catch {
    continue;
  }
  if (!components) continue;
  if (isV2) tally.v2Projects++;
  else tally.legacyProjects++;

  // Which components are instantiated by another component in the same project?
  const instantiated = new Set();
  for (const nodes of components.values()) {
    for (const n of nodes) if (isComponentRef(n.type)) instantiated.add(n.type.replace(/^#/, ''));
  }

  for (const [name, nodes] of components) {
    tally.components++;
    const folder = topFolder(name);
    const entry = folders.get(folder) ?? { total: 0, pages: 0, withInputs: 0, instantiated: 0, examples: [] };
    entry.total++;
    if (isPage(nodes)) {
      entry.pages++;
      tally.pages++;
    }
    const inputs = declaredInputs(nodes);
    if (inputs.size > 0) {
      entry.withInputs++;
      tally.withInputs++;
      if (!GUESSED.includes(folder)) {
        outsideCandidates.push({ project: path.relative(REPO, file), name, inputs: [...inputs].slice(0, 6) });
      }
    }
    if (instantiated.has(name) || instantiated.has(name.replace(/^\//, ''))) {
      entry.instantiated++;
      tally.instantiated++;
    }
    if (entry.examples.length < 3) entry.examples.push(name);
    folders.set(folder, entry);
  }
}

const rows = [...folders.entries()].sort((a, b) => b[1].total - a[1].total);

// ── The alternative predicate: "is it a page?" rather than "where does it live?"
// A folder allowlist turned out to cover almost nothing (see the last line of
// the report), so measure the shape the plan can actually see instead.
const shape = { pageWithInputs: 0, nonPageInstantiated: 0, nonPageInstantiatedWithInputs: 0 };
for (const file of files) {
  let components;
  const isV2 = file.endsWith('nodegx.project.json');
  try {
    components = isV2 ? v2Project(file) : legacyProject(file);
  } catch {
    continue;
  }
  if (!components) continue;
  const instantiated = new Set();
  for (const nodes of components.values()) {
    for (const n of nodes) if (isComponentRef(n.type)) instantiated.add(n.type.replace(/^#/, ''));
  }
  for (const [name, nodes] of components) {
    const inputs = declaredInputs(nodes);
    if (isPage(nodes)) {
      if (inputs.size > 0) shape.pageWithInputs++;
      continue;
    }
    if (!instantiated.has(name) && !instantiated.has(name.replace(/^\//, ''))) continue;
    shape.nonPageInstantiated++;
    if (inputs.size > 0) shape.nonPageInstantiatedWithInputs++;
  }
}

console.log(`projects: ${tally.legacyProjects} legacy + ${tally.v2Projects} v2`);
console.log(
  `components: ${tally.components} (${tally.pages} pages, ${tally.withInputs} declare inputs, ${tally.instantiated} instantiated somewhere)`
);
console.log('');
console.log('folder                     total   pages  inputs  instantiated');
for (const [folder, e] of rows) {
  if (e.total < 3) continue;
  console.log(
    `${(folder || '(root)').padEnd(24)} ${String(e.total).padStart(6)} ${String(e.pages).padStart(7)} ${String(
      e.withInputs
    ).padStart(7)} ${String(e.instantiated).padStart(13)}`
  );
}

console.log('');
console.log(
  `interface-bearing components OUTSIDE the guessed prefixes [${GUESSED.join(', ')}]: ${outsideCandidates.length} of ${
    tally.withInputs
  }`
);
if (LIST) {
  for (const row of outsideCandidates.slice(0, 60)) {
    console.log(`  ${row.name}  (${row.inputs.join(', ')})  — ${row.project}`);
  }
}

console.log('');
console.log('the shape predicate instead of the path predicate:');
console.log(`  pages that declare inputs:                       ${shape.pageWithInputs}`);
console.log(`  non-page components instantiated somewhere:      ${shape.nonPageInstantiated}`);
console.log(
  `  ...of those, declaring at least one input:       ${shape.nonPageInstantiatedWithInputs} (${Math.round(
    (shape.nonPageInstantiatedWithInputs / Math.max(1, shape.nonPageInstantiated)) * 100
  )}%)`
);
