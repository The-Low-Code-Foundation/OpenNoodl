#!/usr/bin/env ts-node
/**
 * DEF-018 + DEF-020 — `columns-child-keeps-own-width` and
 * `justify-content-distributes-nothing` over the corpus that exists.
 *
 * Whether either code can be promoted past advisory is a corpus measurement,
 * not an argument, and the number that decides it is not the firing count but
 * the firing count BESIDE its denominators: how many `Columns` children exist
 * at all, how many are knowable, how many distributing rows exist. A zero over
 * a corpus with no Columns says nothing about the rule.
 *
 * Every firing is printed so it can be read individually, split by the axis
 * that matters for D28's promotion question: whether the offending `sizeMode`
 * was AUTHORED onto the child (a value somebody chose) or arrives from the
 * TYPE DEFAULT (a bare button in a Columns — the runtime falls back to
 * `contentSize`, so it overlaps just as surely, but the author never typed it).
 *
 * Enumeration and project reading are `phase80-door-corpus.ts`'s, restated:
 * each CLI arg is one project or one directory of projects, legacy
 * `project.json` roots are flattened, and an unreadable project is one fewer
 * row, never a fatal.
 *
 * Usage: npm run calibrate:layout -- "<dir-of-projects...>"
 *
 * @module scripts/def018-020-corpus-layout
 */

import * as fs from 'fs';
import * as path from 'path';

import { CatalogIndex } from '../packages/noodl-editor/src/editor/src/validation/CatalogIndex';
import { connectedInputs } from '../packages/noodl-editor/src/editor/src/validation/authoredCandidate';
import { defaultCatalog } from '../packages/noodl-editor/src/editor/src/validation/catalog';
import { DiagnosticCode } from '../packages/noodl-editor/src/editor/src/validation/diagnostics';
import {
  checkLayoutInertCombination,
  type LayoutNode
} from '../packages/noodl-editor/src/editor/src/validation/layoutInertCombination';
import { COLUMNS_TYPE } from '../packages/noodl-editor/src/editor/src/validation/responsiveArrangement';

interface StoredNodeLike extends LayoutNode {
  ports?: Array<{ name: string; plug?: string; type?: unknown }>;
}
interface StoredConnection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}
interface ReadComponent {
  name: string;
  nodes: StoredNodeLike[];
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

function flattenLegacyRoots(roots: any[]): StoredNodeLike[] {
  const out: StoredNodeLike[] = [];
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    const children: any[] = Array.isArray(node.children) ? node.children : [];
    out.push({
      id: String(node.id),
      type: typeof node.type === 'string' ? node.type : String(node.type ?? ''),
      ...(typeof node.label === 'string' ? { label: node.label } : {}),
      parameters: (node.parameters ?? null) as Record<string, unknown> | null,
      ...(children.length ? { children: children.map((c: any) => String(c?.id)) } : {})
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

function main(): void {
  const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (targets.length === 0) {
    console.error('usage: def018-020-corpus-layout.ts <dir...>');
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
  // D28 denominators.
  let columnsNodes = 0;
  let columnsChildren = 0;
  let d28AuthoredHits = 0;
  let d28DefaultHits = 0;
  // D32 denominators.
  let rowGroups = 0;
  let distributingRows = 0;
  const d28Lines: string[] = [];
  const d32Lines: string[] = [];
  const d28Projects = new Set<string>();
  const d32Projects = new Set<string>();

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
      const nodes = component.nodes;
      const byId = new Map(nodes.map((n) => [n.id, n]));
      for (const n of nodes) {
        if (n.type === COLUMNS_TYPE) {
          columnsNodes++;
          columnsChildren += (n.children ?? []).length;
        }
        if (n.type === 'Group' && n.parameters?.['flexDirection'] === 'row') {
          rowGroups++;
          const j = n.parameters?.['justifyContent'];
          if (j === 'space-between' || j === 'space-around' || j === 'space-evenly') distributingRows++;
        }
      }

      const found = checkLayoutInertCombination(nodes, {
        component: component.name,
        catalog,
        connectedInputs: connectedInputs(component.connections)
      });
      for (const d of found) {
        const where = `${projectName} :: ${component.name} :: ${d.location.nodeLabel ?? d.location.nodeId}`;
        if (d.code === DiagnosticCode.ColumnsChildKeepsOwnWidth) {
          const child = byId.get(d.location.nodeId ?? '');
          const authored = child?.parameters?.['sizeMode'] !== undefined;
          if (authored) d28AuthoredHits++;
          else d28DefaultHits++;
          d28Projects.add(projectName);
          d28Lines.push(`  [${authored ? 'authored' : 'type-default'}] ${where} (${d.location.nodeType})`);
        } else if (d.code === DiagnosticCode.JustifyContentDistributesNothing) {
          d32Projects.add(projectName);
          const m = d.message.match(/(\d+) children/);
          d32Lines.push(`  [${m ? m[1] : '?'} growers] ${where}`);
        }
      }
    }
  }

  console.log(`projects: ${projects.length} read, ${unreadable} unreadable`);
  console.log('');
  console.log(`D28 columns-child-keeps-own-width`);
  console.log(`  denominators: ${columnsNodes} Columns nodes, ${columnsChildren} direct children`);
  console.log(
    `  firings: ${d28AuthoredHits + d28DefaultHits} (${d28AuthoredHits} authored sizeMode, ${d28DefaultHits} from the type default) in ${d28Projects.size} projects`
  );
  for (const line of d28Lines) console.log(line);
  console.log('');
  console.log(`D32 justify-content-distributes-nothing`);
  console.log(`  denominators: ${rowGroups} row Groups, ${distributingRows} with a distributing justifyContent`);
  console.log(`  firings: ${d32Lines.length} in ${d32Projects.size} projects`);
  for (const line of d32Lines) console.log(line);
}

main();
