#!/usr/bin/env ts-node
/**
 * DEF-024 — `gate-only-turns-on` over the corpus that exists.
 *
 * The rule fires only when a gate port's whole pushable set is `{true}`. Two neighbouring shapes
 * are DECISIONS rather than firings, and this script prints their populations so the decisions
 * carry numbers: a set of `{false}` (a one-way dismiss — ends in the emptier screen, not fired
 * on) and an empty set (a dead gate — writers that can never push; a different absence). Reading
 * the `{true}` firings individually is what settles whether a solo reveal-once latch is an
 * authored intention in this corpus or always the accumulation defect.
 *
 * Enumeration and project reading are `def018-020-corpus-layout.ts`'s, restated: each CLI arg is
 * one project or one directory of projects, legacy `project.json` roots are flattened, and an
 * unreadable project is one fewer row, never a fatal.
 *
 * Usage: npm run calibrate:gates -- "<dir-of-projects...>"
 *
 * @module scripts/def-024-corpus-gates
 */

import * as fs from 'fs';
import * as path from 'path';

import { CatalogIndex } from '../packages/noodl-editor/src/editor/src/validation/CatalogIndex';
import { defaultCatalog } from '../packages/noodl-editor/src/editor/src/validation/catalog';
import { isComponentRef } from '../packages/noodl-editor/src/editor/src/validation/model';
import { checkOneWayGate } from '../packages/noodl-editor/src/editor/src/validation/oneWayGate';
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

/** The classification the RULE makes internally, recomputed here so the decisions have numbers. */
function classifyGatePort(
  writers: StoredConnection[],
  byId: Map<string, ParameterizedNode>,
  wires: StoredConnection[]
): 'abstained' | 'dead' | 'only-true' | 'only-false' | 'two-way' {
  const union = new Set<boolean>();
  for (const w of writers) {
    const source = byId.get(w.fromId);
    if (!source || source.type !== 'Condition') return 'abstained';
    if (w.fromProperty !== 'result' && w.fromProperty !== 'isfalse') return 'abstained';
    if (wires.some((x) => x.toId === source.id && x.toProperty === 'condition')) return 'abstained';
    if (!wires.some((x) => x.toId === source.id && x.toProperty === 'eval')) continue;
    const condition = !!(source.parameters ?? {})['condition'];
    union.add(w.fromProperty === 'result' ? condition : !condition);
  }
  if (union.size === 0) return 'dead';
  if (union.size === 2) return 'two-way';
  return union.has(true) ? 'only-true' : 'only-false';
}

function main(): void {
  const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (targets.length === 0) {
    console.error('usage: def-024-corpus-gates.ts <dir...>');
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

  const catalog = new CatalogIndex(defaultCatalog());

  let unreadable = 0;
  let gatePorts = 0; // mounted/visible inputs with >=1 writer on a knowable visual node
  const byClass: Record<string, number> = { abstained: 0, dead: 0, 'only-true': 0, 'only-false': 0, 'two-way': 0 };
  const firingLines: string[] = [];
  const dismissLines: string[] = [];
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
      const byId = new Map(component.nodes.map((n) => [n.id, n]));
      // The denominators, classified the way the rule classifies.
      const seen = new Set<string>();
      for (const w of component.connections) {
        if (w.toProperty !== 'mounted' && w.toProperty !== 'visible') continue;
        const key = `${w.toId}::${w.toProperty}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const target = byId.get(w.toId);
        if (!target || isComponentRef(target.type) || !catalog.getNode(target.type)?.isVisual) continue;
        gatePorts++;
        const writers = component.connections.filter((x) => x.toId === w.toId && x.toProperty === w.toProperty);
        const cls = classifyGatePort(writers, byId, component.connections);
        byClass[cls]++;
        if (cls === 'only-false') {
          const target2 = byId.get(w.toId);
          dismissLines.push(`  ${projectName} :: ${component.name} :: ${target2?.label ?? w.toId} (${target2?.type}) .${w.toProperty}`);
        }
      }

      // The rule itself, over the same component — the two must agree on only-true.
      const found = checkOneWayGate(component.nodes, {
        component: component.name,
        catalog,
        wires: component.connections
      });
      for (const d of found) {
        firingProjects.add(projectName);
        firingLines.push(
          `  ${projectName} :: ${component.name} :: ${d.location.nodeLabel ?? d.location.nodeId} (${d.location.nodeType}) .${d.location.port}`
        );
      }
    }
  }

  console.log(`projects: ${projects.length} read, ${unreadable} unreadable`);
  console.log('');
  console.log('gate-only-turns-on');
  console.log(
    `  denominators: ${gatePorts} written mounted/visible ports on knowable visual nodes — ` +
      `${byClass['abstained']} abstained (a writer that can push either value), ${byClass['two-way']} two-way constant pairs, ` +
      `${byClass['dead']} dead (no writer can fire), ${byClass['only-false']} one-way dismiss ({false}, not fired on)`
  );
  console.log(`  firings ({true} only): ${firingLines.length} in ${firingProjects.size} projects`);
  for (const line of firingLines) console.log(line);
  if (dismissLines.length) {
    console.log('  one-way dismiss population (decision: not fired on):');
    for (const line of dismissLines) console.log(line);
  }
  if (firingLines.length !== byClass['only-true']) {
    console.log(
      `  ⚠️ RULE/CLASSIFIER DISAGREE: rule fired ${firingLines.length}, classifier counted ${byClass['only-true']} — read the code before believing either`
    );
  }
}

main();
