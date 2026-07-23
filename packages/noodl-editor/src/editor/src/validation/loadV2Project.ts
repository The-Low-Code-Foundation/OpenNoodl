/**
 * SUB-006 — Semantic Validator: on-disk project loader (Node only)
 *
 * Reads a project from disk into the normalized model. Handles both project
 * shapes the validator must serve:
 *   - a v2 decomposed directory (components/_registry.json + per-component
 *     nodes.json / connections.json / component.json), and
 *   - a legacy monolithic project.json (a directory containing one, or the file
 *     itself) — so the CLI can validate the existing real-project corpus too.
 *
 * This module uses `fs`/`path` and must NOT be imported by the editor renderer
 * bundle. The editor uses ./normalize on the in-memory model instead.
 *
 * @module noodl-editor/validation/loadV2Project
 */

import * as fs from 'fs';
import * as path from 'path';

import { NormComponent, NormConnection, NormNode, NormProject, buildComponentRefs } from './model';
import { fromLegacyProject, LegacyProjectLike } from './normalize';

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function instancePortNames(node: any): string[] {
  const names: string[] = [];
  for (const p of node.ports ?? []) if (p && typeof p.name === 'string') names.push(p.name);
  for (const p of node.dynamicports ?? []) if (p && typeof p.name === 'string') names.push(p.name);
  return names;
}

/** Normalise one v2 component (already-flat nodes.json + connections.json). */
function normalizeV2Component(name: string, nodesFile: any, connectionsFile: any): NormComponent {
  const nodes: NormNode[] = (nodesFile?.nodes ?? []).map((n: any) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    parent: n.parent,
    children: Array.isArray(n.children) ? n.children : [],
    instancePorts: instancePortNames(n)
  }));
  const connections: NormConnection[] = (connectionsFile?.connections ?? []).map((c: any) => ({
    fromId: c.fromId,
    fromProperty: c.fromProperty,
    toId: c.toId,
    toProperty: c.toProperty
  }));
  return { name, nodes, connections };
}

function isV2Directory(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, 'components', '_registry.json')) ||
    fs.existsSync(path.join(dir, 'nodegx.project.json'))
  );
}

/** Load a v2 decomposed project directory into the normalized model. */
export function loadV2Directory(dir: string): NormProject {
  const registryPath = path.join(dir, 'components', '_registry.json');
  const registry = readJson(registryPath) as {
    components: Record<string, { path: string }>;
  };
  const componentsDir = path.join(dir, 'components');

  const components: NormComponent[] = [];
  for (const [key, entry] of Object.entries(registry.components)) {
    const compDir = path.join(componentsDir, entry.path);
    const componentFile = fs.existsSync(path.join(compDir, 'component.json'))
      ? readJson(path.join(compDir, 'component.json'))
      : {};
    const nodesFile = fs.existsSync(path.join(compDir, 'nodes.json'))
      ? readJson(path.join(compDir, 'nodes.json'))
      : { nodes: [] };
    const connectionsFile = fs.existsSync(path.join(compDir, 'connections.json'))
      ? readJson(path.join(compDir, 'connections.json'))
      : { connections: [] };

    // Prefer the preserved legacy path (what component-reference node types use);
    // fall back to the registry key.
    const name: string = componentFile.path ?? key;
    components.push(normalizeV2Component(name, nodesFile, connectionsFile));
  }

  // Component references may use either the legacy path or the registry key/path.
  const refNames = new Set<string>();
  for (const c of components) refNames.add(c.name);
  for (const [key, entry] of Object.entries(registry.components)) {
    refNames.add(key);
    refNames.add(entry.path);
  }
  return {
    components,
    componentRefs: buildComponentRefs([...refNames])
  };
}

/** Load a legacy monolithic project.json (file path or containing directory). */
export function loadLegacyProject(target: string): NormProject {
  const stat = fs.statSync(target);
  const file = stat.isDirectory() ? path.join(target, 'project.json') : target;
  const project = readJson(file) as LegacyProjectLike;
  return fromLegacyProject(project);
}

/**
 * Load whichever project shape lives at `target` (v2 directory or legacy
 * project.json / directory) into the normalized model.
 */
export function loadProject(target: string): NormProject {
  const stat = fs.statSync(target);
  if (stat.isDirectory() && isV2Directory(target)) {
    return loadV2Directory(target);
  }
  return loadLegacyProject(target);
}
