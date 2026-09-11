#!/usr/bin/env ts-node
/**
 * Phase 80 — the ONE corpus pass DEF-009, DEF-010 and DEF-011 share.
 *
 * Three of the four door tasks say the same thing about their own fix: whether
 * the new check *blocks* authored output is a corpus measurement, not an
 * argument (SB-009 §"Open decision", SB-010 §"two questions", DEF-009 AC3).
 * That sweep is shared work and is done once, here:
 *
 *  - `component-parameter-unresolved` (DEF-010): fires per component-typed
 *    parameter naming a component the project does not have. The DENOMINATOR —
 *    how many such parameters exist at all, by (nodeType, port) — is printed
 *    whether or not anything fires: a zero over a corpus that holds no
 *    `taskTemplate` says nothing about the rule.
 *  - `wrong-runtime-node` from the same check (the cross-runtime half; already
 *    blocking for the instance case, so its count here is the blast radius of
 *    reusing the code, not a promotion decision).
 *  - `public-write-door-unlimited` (DEF-009): per project, read
 *    `nodegx.security.json` beside the components — the same file the check
 *    reads through the door — and report the doors, with their function names.
 *  - DEF-011 debt (informational, no promotion attached): `JavaScriptFunction`
 *    nodes whose script derives signal outputs that are NOT persisted on the
 *    node (`ports` + `dynamicports`). These are the graphs that break wherever
 *    no editor derives ports — the population the door fix stops growing.
 *
 * Enumeration, project reading and the corrupt-neighbour convention are
 * def-002-corpus-preconditions.ts's, restated: each CLI arg is one project or
 * one directory of projects, legacy `project.json` roots are flattened with
 * `dynamicports` folded in beside `ports`, and an unreadable component is one
 * fewer name that resolves, never a fatal.
 *
 * Usage:
 *   npm run calibrate:door -- "<dir-of-projects...>" [--json] [--examples=N]
 *
 * @module scripts/phase80-door-corpus
 */

import * as fs from 'fs';
import * as path from 'path';

import { CatalogIndex } from '../packages/noodl-editor/src/editor/src/validation/CatalogIndex';
import { defaultCatalog } from '../packages/noodl-editor/src/editor/src/validation/catalog';
import { checkComponentRefParameters } from '../packages/noodl-editor/src/editor/src/validation/componentRefParameters';
import {
  checkPublicWriteDoor,
  type FunctionSecurityPolicy
} from '../packages/noodl-editor/src/editor/src/validation/publicWriteDoor';
import { portTypeShape, type ParameterizedNode } from '../packages/noodl-editor/src/editor/src/validation/parameterValues';
import { REPEATER_TYPE } from '../packages/noodl-editor/src/editor/src/validation/repeaterTemplate';
import { scriptPortsForNode } from '../packages/noodl-editor/src/editor/src/models/nodelibrary/cloudDynamicPorts';
import { extractProjectOverlay } from '../packages/noodl-mcp/src/kitExtract/extract';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mergeOverlay } = require('@nodegx/kit-catalog');

interface StoredNodeLike extends ParameterizedNode {
  ports?: Array<{ name: string; plug?: string; type?: unknown }>;
  children?: readonly string[];
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
    const ports = [
      ...(Array.isArray(node.ports) ? node.ports : []),
      ...(Array.isArray(node.dynamicports) ? node.dynamicports : [])
    ];
    out.push({
      id: String(node.id),
      type: typeof node.type === 'string' ? node.type : String(node.type ?? ''),
      ...(typeof node.label === 'string' ? { label: node.label } : {}),
      parameters: (node.parameters ?? null) as Record<string, unknown> | null,
      ...(ports.length ? { ports } : {}),
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
        const nodes: StoredNodeLike[] = (Array.isArray(nodesFile.nodes) ? nodesFile.nodes : []).map((n: any) => ({
          ...n,
          // v2 nodes can carry both fields too — fold, the way normalize.ts does.
          ...(Array.isArray(n.dynamicports)
            ? { ports: [...(Array.isArray(n.ports) ? n.ports : []), ...n.dynamicports] }
            : {})
        }));
        out.push({
          name: component.path ?? key,
          nodes,
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

function catalogFor(target: string): CatalogIndex {
  try {
    const overlay = extractProjectOverlay(target);
    if (!overlay.unavailable && overlay.nodes.length > 0) {
      return new CatalogIndex(mergeOverlay(defaultCatalog(), overlay.nodes));
    }
  } catch {
    /* built-ins — a broken kit must not stop the measurement */
  }
  return new CatalogIndex(defaultCatalog());
}

function securityFor(target: string): FunctionSecurityPolicy | null {
  try {
    const parsed = readJson(path.join(target, 'nodegx.security.json'));
    return parsed && typeof parsed === 'object' && parsed.functions && typeof parsed.functions === 'object'
      ? parsed.functions
      : null;
  } catch {
    return null;
  }
}

function main(): void {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const exampleArg = argv.find((a) => a.startsWith('--examples='));
  const exampleLimit = exampleArg ? Number(exampleArg.split('=')[1]) : 3;
  const targets = argv.filter((a) => !a.startsWith('--'));
  if (targets.length === 0) {
    console.error('usage: phase80-door-corpus.ts <dir...> [--json] [--examples=N]');
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
  if (projects.length === 0) {
    console.error('No projects found under the given directories — nothing was measured.');
    process.exit(2);
  }

  // Denominators.
  let componentTypedParams = 0; // parameters whose catalog port type is `component`, non-For-Each, unwired
  const paramsByPort = new Map<string, number>(); // "NodeType.port" → count
  let forEachTemplates = 0; // the skipped pair, counted so the skip is visible
  let cloudComponents = 0;
  let publicDoors = 0; // request ticks allowNoAuth (before the write/limit tests)
  let jsFunctionNodes = 0;

  // Findings.
  interface Finding {
    code: string;
    where: string;
    detail: string;
  }
  const unresolved: Finding[] = [];
  const crossRuntime: Finding[] = [];
  const unlimitedDoors: Finding[] = [];
  const def011Debt: Finding[] = []; // nodes with underived-but-needed signal ports
  const projectsWith = { unresolved: new Set<string>(), crossRuntime: new Set<string>(), unlimited: new Set<string>(), debt: new Set<string>() };

  for (const project of projects) {
    const projectName = path.basename(project);
    const catalog = catalogFor(project);
    const security = securityFor(project);
    let components: ReadComponent[];
    try {
      components = readComponents(project);
    } catch {
      continue;
    }
    const names = components.map((c) => c.name);

    for (const comp of components) {
      const isCloud = comp.name.startsWith('/#__cloud__/') || comp.name.startsWith('#__cloud__/');
      if (isCloud) cloudComponents++;
      const wired = new Set(comp.connections.map((c) => `${c.toId}::${c.toProperty}`));

      // Denominator: the population the DEF-010 check walks.
      for (const node of comp.nodes) {
        if (typeof node.type !== 'string' || !node.parameters) continue;
        if (node.type === REPEATER_TYPE) {
          if (typeof node.parameters['template'] === 'string') forEachTemplates++;
          continue;
        }
        if (!catalog.hasType(node.type)) continue;
        for (const [key, value] of Object.entries(node.parameters)) {
          if (typeof value !== 'string' || value.trim() === '') continue;
          if (portTypeShape(catalog.getPort(node.type, 'input', key))?.name !== 'component') continue;
          if (wired.has(`${node.id}::${key}`)) continue;
          componentTypedParams++;
          const slot = `${node.type}.${key}`;
          paramsByPort.set(slot, (paramsByPort.get(slot) ?? 0) + 1);
        }
        if (node.type === 'JavaScriptFunction') jsFunctionNodes++;
      }

      // DEF-010.
      for (const d of checkComponentRefParameters(comp.nodes, {
        component: comp.name,
        components: names,
        catalog,
        connectedInputs: wired
      })) {
        const where = `${projectName} ${comp.name} ${d.location?.nodeType}.${d.location?.port}`;
        if (d.code === 'component-parameter-unresolved') {
          unresolved.push({ code: d.code, where, detail: d.message.slice(0, 160) });
          projectsWith.unresolved.add(projectName);
        } else if (d.code === 'wrong-runtime-node') {
          crossRuntime.push({ code: d.code, where, detail: d.message.slice(0, 160) });
          projectsWith.crossRuntime.add(projectName);
        }
      }

      // DEF-009. `security` is null when the project ships no policy — the
      // same value the MCP door passes, so this measures the door's behaviour.
      if (isCloud) {
        const legacy = comp.name.startsWith('/') ? comp.name : `/${comp.name}`;
        const req = comp.nodes.find((n) => n.type === 'noodl.cloud.request');
        if (req?.parameters?.['allowNoAuth'] === true) publicDoors++;
        for (const d of checkPublicWriteDoor(comp.nodes, { component: legacy, security, catalog })) {
          unlimitedDoors.push({ code: d.code, where: `${projectName} ${comp.name}`, detail: d.message.slice(0, 160) });
          projectsWith.unlimited.add(projectName);
        }
      }

      // DEF-011 debt.
      for (const node of comp.nodes) {
        if (node.type !== 'JavaScriptFunction') continue;
        const have = new Set((node.ports ?? []).map((p) => `${p.plug ?? ''} ${p.name}`));
        const missing = scriptPortsForNode({ parameters: node.parameters ?? {} }).filter(
          (p) => p.plug === 'output' && p.type === 'signal' && !have.has(`output ${p.name}`)
        );
        if (missing.length > 0) {
          def011Debt.push({
            code: 'underived-script-signal',
            where: `${projectName} ${comp.name} ${node.id}`,
            detail: missing.map((p) => p.name).join(', ')
          });
          projectsWith.debt.add(projectName);
        }
      }
    }
  }

  const summary = {
    projects: projects.length,
    denominators: {
      componentTypedParams,
      byPort: Object.fromEntries([...paramsByPort.entries()].sort((a, b) => b[1] - a[1])),
      forEachTemplatesSkipped: forEachTemplates,
      cloudComponents,
      publicDoors,
      jsFunctionNodes
    },
    findings: {
      'component-parameter-unresolved': { total: unresolved.length, projects: projectsWith.unresolved.size },
      'wrong-runtime-node (parameter)': { total: crossRuntime.length, projects: projectsWith.crossRuntime.size },
      'public-write-door-unlimited': { total: unlimitedDoors.length, projects: projectsWith.unlimited.size },
      'def-011 underived signal ports (informational)': { total: def011Debt.length, projects: projectsWith.debt.size }
    }
  };

  if (json) {
    console.log(JSON.stringify({ summary, unresolved, crossRuntime, unlimitedDoors, def011Debt }, null, 2));
    return;
  }

  console.log(JSON.stringify(summary, null, 2));
  const show = (label: string, rows: Finding[]) => {
    if (rows.length === 0) return;
    console.log(`\n${label}:`);
    for (const row of rows.slice(0, Math.max(exampleLimit, 0))) console.log(`  ${row.where}\n    ${row.detail}`);
    if (rows.length > exampleLimit) console.log(`  … and ${rows.length - exampleLimit} more`);
  };
  show('component-parameter-unresolved', unresolved);
  show('wrong-runtime-node (parameter)', crossRuntime);
  show('public-write-door-unlimited', unlimitedDoors);
  show('def-011 debt', def011Debt);
}

main();
