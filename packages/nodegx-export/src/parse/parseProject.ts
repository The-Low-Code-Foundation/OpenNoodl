/**
 * v2 files → Graph IR. The faithful half of the pipeline: this stage records what the project
 * says, resolves it against the catalog, and refuses to guess. Decisions (dispositions, names,
 * file plans) belong to analysis, not here.
 *
 * Parsing never drops and never fails on content: unknown node types get catalogRef null,
 * statically-unknowable port sets get portKnowledge 'unknown'/'partial', script parameters are
 * captured verbatim. See EXP-002-IR-DESIGN.md.
 */

import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex, EXECUTION_REVEALED_TYPES, isCodeEditorType, isSignalPort, portTypeName } from '../catalog';
import {
  AuthoringIntent,
  ComponentIR,
  ConnectionIR,
  ExportIR,
  NodeIR,
  ParamIR,
  ParamValue,
  PortIR,
  ProjectIR,
  RouterIR
} from '../ir/types';

export const EXPORTER_VERSION = '0.0.1';

interface RawPort {
  name: string;
  plug?: 'input' | 'output';
  type?: string | { name?: string; codeeditor?: string };
  default?: unknown;
}

interface RawNode {
  id: string;
  /** Absent on rare editor debris (a node with only an id and canvas position) — see parseNode. */
  type?: string;
  label?: string;
  parameters?: Record<string, unknown>;
  dynamicports?: RawPort[];
  metadata?: { comment?: string };
  parent?: string;
  children?: string[];
}

export function parseProject(projectDir: string, catalog: Catalog): ExportIR {
  const index = new CatalogIndex(catalog);
  const projectFile = readJson(path.join(projectDir, 'nodegx.project.json'));
  const componentsDir = path.join(projectDir, projectFile.structure?.componentsDir ?? 'components');

  const components = findComponentDirs(componentsDir)
    .map((dir) => parseComponent(dir, index))
    // D1: components sort by path, codepoint order.
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const project: ProjectIR = {
    name: projectFile.name ?? path.basename(projectDir),
    catalogFormatVersion: index.catalogFormatVersion,
    exporterVersion: EXPORTER_VERSION,
    designTokens: (projectFile.metadata?.designTokens?.customTokens ?? []).map((t: any) => ({
      name: t.name,
      value: t.value,
      ...(t.category !== undefined ? { category: t.category } : {}),
      ...(t.description !== undefined ? { description: t.description } : {})
    })),
    collections: (projectFile.metadata?.dbCollections ?? []).map((c: any) => ({
      name: c.name,
      columns: (c.columns ?? []).map((col: any) => ({ name: col.name, type: col.type }))
    })),
    routers: collectRouters(components)
  };

  return { project, components };
}

/** Recursively finds every directory under `root` holding a component.json. */
function findComponentDirs(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (!entry.isDirectory()) continue;
      const child = path.join(dir, entry.name);
      if (fs.existsSync(path.join(child, 'component.json'))) found.push(child);
      walk(child);
    }
  };
  walk(root);
  return found;
}

function parseComponent(dir: string, catalog: CatalogIndex): ComponentIR {
  const meta = readJson(path.join(dir, 'component.json'));
  const nodesFile = readJson(path.join(dir, 'nodes.json'));
  const connectionsPath = path.join(dir, 'connections.json');
  const connectionsFile = fs.existsSync(connectionsPath) ? readJson(connectionsPath) : { connections: [] };

  const rawNodes: RawNode[] = nodesFile.nodes ?? [];
  const nodes = rawNodes.map((raw) => parseNode(raw, catalog));
  const nodeById = new Map(rawNodes.map((raw) => [raw.id, raw]));

  const connections: ConnectionIR[] = (connectionsFile.connections ?? []).map((raw: any) => {
    const kind = resolveSourcePortKind(nodeById.get(raw.fromId), catalog, raw.fromProperty);
    return {
      // The GraphSnapshot.connectionKey format, adopted verbatim (EXP-006 keys wire labels by it).
      key: `${raw.fromId}:${raw.fromProperty}->${raw.toId}:${raw.toProperty}`,
      fromId: raw.fromId,
      fromProperty: raw.fromProperty,
      toId: raw.toId,
      toProperty: raw.toProperty,
      kind,
      ...(typeof raw.label === 'string' ? { label: raw.label } : {})
    };
  });

  const intent: AuthoringIntent = {
    nodeComments: rawNodes
      .filter((n) => typeof n.metadata?.comment === 'string' && n.metadata.comment.length > 0)
      .map((n) => ({ nodeId: n.id, text: n.metadata!.comment! })),
    wireLabels: connections.filter((c) => c.label !== undefined).map((c) => ({ connectionKey: c.key, text: c.label! })),
    // v2 files do not yet serialise comment boxes; EXP-006 owns wiring these through.
    regions: [],
    ...(typeof meta.description === 'string' ? { componentDescription: meta.description } : {})
  };

  return {
    id: meta.id,
    path: String(meta.path ?? meta.name).replace(/^\//, ''),
    role: meta.type === 'page' ? 'page' : 'component',
    nodes,
    connections,
    intent
  };
}

function parseNode(raw: RawNode, catalog: CatalogIndex): NodeIR {
  // The fixture corpus contains real editor debris: a node with only an id and a position.
  // Parse never fails on content — an empty type parses to catalogRef null and analysis
  // dispositions it as unknown-type (and the report says so).
  const type = typeof raw.type === 'string' ? raw.type : '';
  const isComponentInstance = type.startsWith('/');
  const catalogEntry = isComponentInstance ? undefined : catalog.get(type);

  const declaredPorts: PortIR[] = (raw.dynamicports ?? []).map((p) => ({
    name: p.name,
    plug: p.plug ?? 'input',
    kind: isSignalPort(p) ? 'signal' : 'value',
    ...(portTypeName(p.type) !== undefined ? { type: portTypeName(p.type) } : {}),
    ...(p.default !== undefined ? { default: p.default } : {})
  }));

  const scriptParamNames = new Set(
    (raw.dynamicports ?? []).filter((p) => isCodeEditorType(p.type)).map((p) => p.name)
  );

  const parameters: ParamIR[] = Object.entries(raw.parameters ?? {})
    .map(([name, value]) => ({ name, value: classifyParam(value, scriptParamNames.has(name)) }))
    // D3: parameters sort by name; the source JSON's object key order is not trusted.
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const scriptSources = parameters.filter((p) => p.value.kind === 'script');

  return {
    id: raw.id,
    type,
    catalogRef: catalogEntry ? catalogEntry.typeName : null,
    ...('label' in raw && typeof raw.label === 'string' ? { authoredLabel: raw.label } : {}),
    parameters,
    declaredPorts,
    portKnowledge: portKnowledgeOf(type, isComponentInstance, catalogEntry?.dynamicPorts ?? null),
    ...(scriptSources.length > 0 ? { sourceText: (scriptSources[0].value as { source: string }).source } : {}),
    ...(raw.parent !== undefined ? { parent: raw.parent } : {}),
    ...(raw.children !== undefined ? { children: raw.children } : {})
  };
}

function portKnowledgeOf(
  type: string,
  isComponentInstance: boolean,
  dynamicPorts: { mechanisms?: string[] } | null
): NodeIR['portKnowledge'] {
  // A component instance's interface is its Component Inputs/Outputs declarations — knowable.
  if (isComponentInstance) return 'complete';
  if (EXECUTION_REVEALED_TYPES.has(type)) return 'unknown';
  return dynamicPorts ? 'partial' : 'complete';
}

function classifyParam(value: unknown, declaredAsScript: boolean): ParamValue {
  if (declaredAsScript && typeof value === 'string') return { kind: 'script', source: value };
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { kind: 'literal', value };
  }
  if (isDimension(value)) return { kind: 'dimension', value: value.value, unit: value.unit };
  return { kind: 'json', value };
}

function isDimension(value: unknown): value is { value: number; unit: string } {
  if (typeof value !== 'object' || value === null) return false;
  const keys = Object.keys(value);
  return (
    keys.length === 2 &&
    typeof (value as any).value === 'number' &&
    typeof (value as any).unit === 'string'
  );
}

/**
 * The kind of a connection's source port. Checks the node's own declared ports first, then the
 * catalog. Falls back to 'value' when neither knows — never guesses 'signal', because EXP-003's
 * equivalence rules count signals and a phantom one is worse than a missed one.
 */
function resolveSourcePortKind(
  fromNode: RawNode | undefined,
  catalog: CatalogIndex,
  portName: string
): 'value' | 'signal' {
  if (fromNode) {
    const declared = (fromNode.dynamicports ?? []).find((p) => p.name === portName);
    if (declared) return isSignalPort(declared) ? 'signal' : 'value';
    const fromType = fromNode.type ?? '';
    if (fromType && !fromType.startsWith('/')) {
      const kind = catalog.portKind(fromType, portName, 'output');
      if (kind) return kind;
    }
  }
  return 'value';
}

function collectRouters(components: ComponentIR[]): RouterIR[] {
  const routers: RouterIR[] = [];
  for (const component of components) {
    for (const node of component.nodes) {
      if (node.type !== 'Router') continue;
      const nameParam = node.parameters.find((p) => p.name === 'name')?.value;
      const pagesParam = node.parameters.find((p) => p.name === 'pages')?.value;
      const pages =
        pagesParam?.kind === 'json' ? (pagesParam.value as { startPage?: string; routes?: string[] }) : undefined;
      routers.push({
        name: nameParam?.kind === 'literal' ? String(nameParam.value) : 'Main',
        componentPath: component.path,
        nodeId: node.id,
        ...(pages?.startPage !== undefined ? { startPage: pages.startPage } : {}),
        routes: pages?.routes ?? []
      });
    }
  }
  return routers;
}

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
