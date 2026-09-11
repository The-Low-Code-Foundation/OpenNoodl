#!/usr/bin/env ts-node
/**
 * DEF-012 §2 — `query-fetches-before-its-filter` over the corpus that exists.
 *
 * The rule fires only on CLOUD components; the browser population is printed beside it so the
 * cloud-only scoping is a decision with numbers rather than an argument. Two abstentions are
 * classified so their populations are visible too: a wired collection name (fetch ordering
 * not decidable from the graph) and the applied workaround (both boxes `false`).
 *
 * Enumeration and project reading are `def018-020-corpus-layout.ts`'s, restated: each CLI arg is
 * one project or one directory of projects, legacy `project.json` roots are flattened, and an
 * unreadable project is one fewer row, never a fatal.
 *
 * Usage: npm run calibrate:query-timing -- "<dir-of-projects...>"
 *
 * @module scripts/def-012-corpus-query-timing
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  checkQueryBeforeFilter,
  connectedFilterParameterNames,
  QUERY_NODE_TYPE
} from '../packages/noodl-editor/src/editor/src/validation/queryBeforeFilter';
import type { ParameterizedNode } from '../packages/noodl-editor/src/editor/src/validation/parameterValues';

interface StoredConnection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}
interface ReadComponent {
  name: string;
  nodes: ParameterizedNode[];
  connections: StoredConnection[];
}

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isV2Directory(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, 'components', '_registry.json')) ||
    fs.existsSync(path.join(dir, 'nodegx.project.json'))
  );
}

function isProject(dir: string): boolean {
  try {
    if (!fs.statSync(dir).isDirectory()) return false;
  } catch {
    return false;
  }
  return isV2Directory(dir) || fs.existsSync(path.join(dir, 'project.json'));
}

function flattenLegacyRoots(roots: any[]): ParameterizedNode[] {
  const out: ParameterizedNode[] = [];
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    const children: any[] = Array.isArray(node.children) ? node.children : [];
    out.push({
      id: String(node.id),
      type: typeof node.type === 'string' ? node.type : String(node.type ?? ''),
      ...(typeof node.label === 'string' ? { label: node.label } : {}),
      parameters: (node.parameters ?? null) as Record<string, unknown> | null
    });
    for (const child of children) visit(child);
  };
  for (const root of roots) visit(root);
  return out;
}

function readComponents(target: string): ReadComponent[] {
  if (isV2Directory(target)) {
    const registry = readJson(path.join(target, 'components', '_registry.json')) as {
      components: Record<string, { path: string }>;
    };
    const componentsDir = path.join(target, 'components');
    const out: ReadComponent[] = [];
    for (const [key, entry] of Object.entries(registry.components)) {
      const dir = path.join(componentsDir, entry.path);
      try {
        const component = fs.existsSync(path.join(dir, 'component.json'))
          ? readJson(path.join(dir, 'component.json'))
          : {};
        const nodesFile = fs.existsSync(path.join(dir, 'nodes.json')) ? readJson(path.join(dir, 'nodes.json')) : { nodes: [] };
        const connections = fs.existsSync(path.join(dir, 'connections.json'))
          ? readJson(path.join(dir, 'connections.json'))
          : { connections: [] };
        out.push({
          name: component.path ?? key,
          nodes: Array.isArray(nodesFile.nodes) ? nodesFile.nodes : [],
          connections: Array.isArray(connections.connections) ? connections.connections : []
        });
      } catch {
        out.push({ name: key, nodes: [], connections: [] });
      }
    }
    return out;
  }
  const project = readJson(path.join(target, 'project.json'));
  const components: any[] = Array.isArray(project.components) ? project.components : [];
  return components.map((c) => ({
    name: String(c.name ?? ''),
    nodes: flattenLegacyRoots(Array.isArray(c.graph?.roots) ? c.graph.roots : []),
    connections: Array.isArray(c.graph?.connections) ? c.graph.connections : []
  }));
}

/** A component name in either identifier form, normalised for the cloud test. */
function isCloudComponent(name: string): boolean {
  return name.startsWith('/#__cloud__/') || name.startsWith('#__cloud__/');
}

function main(): void {
  const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (targets.length === 0) {
    console.error('usage: def-012-corpus-query-timing.ts <dir...>');
    process.exit(2);
  }

  const projects: string[] = [];
  for (const arg of targets) {
    const resolved = path.resolve(arg);
    if (isProject(resolved)) projects.push(resolved);
    else if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      for (const child of fs.readdirSync(resolved)) {
        const dir = path.join(resolved, child);
        if (isProject(dir)) projects.push(dir);
      }
    }
  }

  let unreadable = 0;
  let queryNodes = 0;
  let withConnectedFilter = 0; // a filter rule's qp- port carries a wire
  const byClass: Record<string, number> = {
    'cloud-default-boxes': 0, // the firing shape
    'cloud-workaround': 0, // both boxes false
    'cloud-wired-collection': 0, // abstained: ordering not decidable
    'browser-default-boxes': 0, // the population the cloud-only decision leaves alone
    'browser-workaround': 0
  };
  const firingLines: string[] = [];
  const firingProjects = new Set<string>();

  for (const dir of projects) {
    let components: ReadComponent[];
    try {
      components = readComponents(dir);
    } catch {
      unreadable++;
      continue;
    }
    const projectName = path.basename(dir);

    for (const component of components) {
      const cloud = isCloudComponent(component.name);
      for (const node of component.nodes) {
        if (node.type !== QUERY_NODE_TYPE) continue;
        queryNodes++;
        const parameters = node.parameters ?? {};
        const filterNames = connectedFilterParameterNames(parameters['visualFilter']);
        const connected = filterNames.filter((name) =>
          component.connections.some((w) => w.toId === node.id && w.toProperty === 'qp-' + name)
        );
        if (connected.length === 0) continue;
        withConnectedFilter++;
        const wiredCollection =
          typeof parameters['collectionName'] !== 'string' || parameters['collectionName'] === '';
        const boxesOff =
          parameters['runOnChange-collectionName'] === false && parameters['runOnChange-querySettings'] === false;
        if (cloud && wiredCollection) byClass['cloud-wired-collection']++;
        else if (cloud) byClass[boxesOff ? 'cloud-workaround' : 'cloud-default-boxes']++;
        else byClass[boxesOff ? 'browser-workaround' : 'browser-default-boxes']++;
      }

      // The rule itself, over the same component — it and the classifier must agree.
      const legacyName = component.name.startsWith('/') ? component.name : '/' + component.name;
      const found = checkQueryBeforeFilter(component.nodes, {
        component: legacyName,
        wires: component.connections
      });
      for (const d of found) {
        firingProjects.add(projectName);
        firingLines.push(
          `  ${projectName} :: ${component.name} :: ${d.location.nodeLabel ?? d.location.nodeId} — ${
            (d.message.match(/filters "([^"]+)"/) ?? [])[1] ?? '?'
          } on ${(d.message.match(/\(([^)]+)\)/) ?? [])[1] ?? '?'}`
        );
      }
    }
  }

  console.log(`projects: ${projects.length} read, ${unreadable} unreadable`);
  console.log('');
  console.log('query-fetches-before-its-filter');
  console.log(
    `  denominators: ${queryNodes} Query Records nodes, ${withConnectedFilter} with a wired filter parameter — ` +
      `cloud: ${byClass['cloud-default-boxes']} at the default (the firing shape), ` +
      `${byClass['cloud-workaround']} workaround applied, ${byClass['cloud-wired-collection']} wired collection name (abstained) — ` +
      `browser: ${byClass['browser-default-boxes']} at the default (not fired on, by decision), ` +
      `${byClass['browser-workaround']} workaround applied`
  );
  console.log(`  firings: ${firingLines.length} in ${firingProjects.size} projects`);
  for (const line of firingLines) console.log(line);
  if (firingLines.length !== byClass['cloud-default-boxes']) {
    console.log(
      `  ⚠️ RULE/CLASSIFIER DISAGREE: rule fired ${firingLines.length}, classifier counted ${byClass['cloud-default-boxes']} — read the code before believing either`
    );
  }
}

main();
