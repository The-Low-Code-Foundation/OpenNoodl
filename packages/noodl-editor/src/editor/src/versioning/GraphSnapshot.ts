/**
 * SUB-007: normalized component-graph snapshots.
 *
 * The diff/merge engine never reads project files or editor models directly —
 * it operates on GraphSnapshot, built here from either the v2 on-disk format
 * (component.json / nodes.json / connections.json) or the legacy in-memory
 * component shape produced by ComponentModel.toJSON().
 *
 * Unknown fields are preserved in `rest` so merged output round-trips without
 * dropping data the engine does not understand.
 */

import { GraphSnapshot, SnapshotComment, SnapshotConnection, SnapshotNode } from './types';

/** Node fields the engine understands; everything else goes to `rest`. */
const NODE_KNOWN_KEYS = new Set([
  'id',
  'type',
  'label',
  'x',
  'y',
  'variant',
  'version',
  'parameters',
  'stateParameters',
  'stateParamaters', // legacy typo, normalized on read
  'stateTransitions',
  'defaultStateTransitions',
  'ports',
  'metadata',
  'children',
  'parent'
]);

/** Transient fields written by older diff/merge code — never part of identity or content. */
const NODE_TRANSIENT_KEYS = new Set(['conflicts', 'annotation', 'diffData', '_parent', '_sort']);

const CONNECTION_KNOWN_KEYS = new Set(['fromId', 'fromProperty', 'toId', 'toProperty']);
const CONNECTION_TRANSIENT_KEYS = new Set(['annotation']);

const COMMENT_KNOWN_KEYS = new Set(['id', 'text', 'x', 'y']);
const COMMENT_TRANSIENT_KEYS = new Set(['annotation', 'diffData']);

function pickRest(
  obj: Record<string, unknown>,
  known: Set<string>,
  transient: Set<string>
): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (!known.has(key) && !transient.has(key)) rest[key] = obj[key];
  }
  return rest;
}

function normalizeNode(raw: Record<string, unknown>, parent: string | undefined, childIndex: number): SnapshotNode {
  const stateParameters = (raw.stateParameters ?? raw.stateParamaters) as SnapshotNode['stateParameters'];
  const node: SnapshotNode = {
    id: String(raw.id),
    type: String(raw.type),
    parent,
    childIndex,
    parameters: (raw.parameters as Record<string, unknown>) ?? {},
    ports: Array.isArray(raw.ports) ? (raw.ports as unknown[]) : [],
    rest: pickRest(raw, NODE_KNOWN_KEYS, NODE_TRANSIENT_KEYS)
  };
  if (raw.label !== undefined) node.label = raw.label as string;
  if (raw.x !== undefined) node.x = raw.x as number;
  if (raw.y !== undefined) node.y = raw.y as number;
  if (raw.variant !== undefined) node.variant = raw.variant as string;
  if (raw.version !== undefined) node.version = raw.version;
  if (stateParameters !== undefined) node.stateParameters = stateParameters;
  if (raw.stateTransitions !== undefined) node.stateTransitions = raw.stateTransitions as SnapshotNode['stateTransitions'];
  if (raw.defaultStateTransitions !== undefined)
    node.defaultStateTransitions = raw.defaultStateTransitions as SnapshotNode['defaultStateTransitions'];
  if (raw.metadata !== undefined) node.metadata = raw.metadata as Record<string, unknown>;
  return node;
}

function normalizeComment(raw: Record<string, unknown>, index: number): SnapshotComment {
  const comment: SnapshotComment = {
    key: raw.id !== undefined ? String(raw.id) : `@${index}`,
    text: (raw.text as string) ?? '',
    rest: pickRest(raw, COMMENT_KNOWN_KEYS, COMMENT_TRANSIENT_KEYS)
  };
  if (raw.x !== undefined) comment.x = raw.x as number;
  if (raw.y !== undefined) comment.y = raw.y as number;
  if (raw.id !== undefined) comment.rest.__hasId = true;
  return comment;
}

function normalizeConnection(raw: Record<string, unknown>): SnapshotConnection {
  return {
    fromId: String(raw.fromId),
    fromProperty: String(raw.fromProperty),
    toId: String(raw.toId),
    toProperty: String(raw.toProperty),
    rest: pickRest(raw, CONNECTION_KNOWN_KEYS, CONNECTION_TRANSIENT_KEYS)
  };
}

// ---------------------------------------------------------------------------
// Legacy adapter (ComponentModel.toJSON() shape)
// ---------------------------------------------------------------------------

/**
 * Build a snapshot from a legacy component object:
 * `{ id?, name, graph: { roots, connections, comments }, metadata?, ... }`
 * with nodes nested via `children` arrays.
 */
export function fromLegacyComponent(component: Record<string, unknown>): GraphSnapshot {
  const graph = (component.graph as Record<string, unknown>) ?? {};
  const nodes = new Map<string, SnapshotNode>();

  const walk = (rawNodes: unknown, parent: string | undefined) => {
    if (!Array.isArray(rawNodes)) return;
    rawNodes.forEach((raw: Record<string, unknown>, index) => {
      const node = normalizeNode(raw, parent, index);
      nodes.set(node.id, node);
      walk(raw.children, node.id);
    });
  };
  walk(graph.roots, undefined);

  const connections = Array.isArray(graph.connections)
    ? (graph.connections as Record<string, unknown>[]).map(normalizeConnection)
    : [];
  const comments = Array.isArray(graph.comments)
    ? (graph.comments as Record<string, unknown>[]).map(normalizeComment)
    : [];

  const extras: Record<string, unknown> = {};
  for (const key of Object.keys(component)) {
    if (key !== 'name' && key !== 'graph' && key !== 'metadata') extras[`legacy:${key}`] = component[key];
  }
  for (const key of Object.keys(graph)) {
    if (key !== 'roots' && key !== 'connections' && key !== 'comments') extras[`legacyGraph:${key}`] = graph[key];
  }

  return {
    name: String(component.name ?? ''),
    nodes,
    connections,
    comments,
    metadata: (component.metadata as Record<string, unknown>) ?? {},
    extras
  };
}

// ---------------------------------------------------------------------------
// v2 adapter (component.json / nodes.json / connections.json)
// ---------------------------------------------------------------------------

export interface V2ComponentFiles {
  component: Record<string, unknown>;
  nodes: Record<string, unknown>;
  connections: Record<string, unknown>;
}

/** Build a snapshot from the three v2 files of one component. */
export function fromV2Files(files: V2ComponentFiles): GraphSnapshot {
  const nodesFile = files.nodes ?? {};
  const connectionsFile = files.connections ?? {};
  const componentFile = files.component ?? {};

  const rawNodes = Array.isArray(nodesFile.nodes) ? (nodesFile.nodes as Record<string, unknown>[]) : [];

  // v2 nodes are flat with parent/children id references. childIndex comes from
  // the parent's children array when present, else from file order among siblings.
  const childOrder = new Map<string, number>();
  let rootCounter = 0;
  const siblingCounters = new Map<string, number>();
  for (const raw of rawNodes) {
    if (Array.isArray(raw.children)) {
      (raw.children as string[]).forEach((childId, index) => childOrder.set(String(childId), index));
    }
  }
  const nodes = new Map<string, SnapshotNode>();
  for (const raw of rawNodes) {
    const id = String(raw.id);
    const parent = raw.parent !== undefined ? String(raw.parent) : undefined;
    let index: number;
    if (childOrder.has(id)) {
      index = childOrder.get(id);
    } else if (parent === undefined) {
      index = rootCounter++;
    } else {
      const count = siblingCounters.get(parent) ?? 0;
      index = count;
      siblingCounters.set(parent, count + 1);
    }
    nodes.set(id, normalizeNode(raw, parent, index));
  }

  const connections = Array.isArray(connectionsFile.connections)
    ? (connectionsFile.connections as Record<string, unknown>[]).map(normalizeConnection)
    : [];
  const comments = Array.isArray(nodesFile.comments)
    ? (nodesFile.comments as Record<string, unknown>[]).map(normalizeComment)
    : [];

  const extras: Record<string, unknown> = {};
  if (componentFile.id !== undefined) extras['v2:componentJsonId'] = componentFile.id;
  if (componentFile.name !== undefined) extras['v2:componentName'] = componentFile.name;
  if (componentFile.type !== undefined) extras['v2:componentType'] = componentFile.type;
  if (componentFile.ports !== undefined) extras['v2:ports'] = componentFile.ports;
  if (componentFile.modified !== undefined) extras['v2:modified'] = componentFile.modified;
  if (nodesFile.componentId !== undefined) extras['v2:componentId'] = nodesFile.componentId;
  if (nodesFile.version !== undefined) extras['v2:nodesVersion'] = nodesFile.version;
  if (nodesFile.visualRoots !== undefined) extras['v2:visualRoots'] = nodesFile.visualRoots;
  if (connectionsFile.version !== undefined) extras['v2:connectionsVersion'] = connectionsFile.version;

  return {
    name: String((componentFile.path ?? componentFile.name) ?? ''),
    nodes,
    connections,
    comments,
    metadata: (componentFile.metadata as Record<string, unknown>) ?? {},
    extras
  };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function denormalizeNodeFields(node: SnapshotNode): Record<string, unknown> {
  const out: Record<string, unknown> = { id: node.id, type: node.type };
  if (node.label !== undefined) out.label = node.label;
  if (node.x !== undefined) out.x = node.x;
  if (node.y !== undefined) out.y = node.y;
  if (node.variant !== undefined) out.variant = node.variant;
  if (node.version !== undefined) out.version = node.version;
  if (Object.keys(node.parameters).length > 0) out.parameters = node.parameters;
  if (node.stateParameters !== undefined) out.stateParameters = node.stateParameters;
  if (node.stateTransitions !== undefined) out.stateTransitions = node.stateTransitions;
  if (node.defaultStateTransitions !== undefined) out.defaultStateTransitions = node.defaultStateTransitions;
  if (node.ports.length > 0) out.ports = node.ports;
  if (node.metadata !== undefined) out.metadata = node.metadata;
  for (const key of Object.keys(node.rest)) out[key] = node.rest[key];
  return out;
}

function denormalizeComment(comment: SnapshotComment): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const { __hasId, ...rest } = comment.rest;
  if (__hasId) out.id = comment.key;
  out.text = comment.text;
  if (comment.x !== undefined) out.x = comment.x;
  if (comment.y !== undefined) out.y = comment.y;
  for (const key of Object.keys(rest)) out[key] = rest[key];
  return out;
}

function denormalizeConnection(connection: SnapshotConnection): Record<string, unknown> {
  return {
    fromId: connection.fromId,
    fromProperty: connection.fromProperty,
    toId: connection.toId,
    toProperty: connection.toProperty,
    ...connection.rest
  };
}

/** Children ids of a parent (undefined = roots), ordered by childIndex. */
export function orderedChildren(snapshot: GraphSnapshot, parent: string | undefined): SnapshotNode[] {
  const children: SnapshotNode[] = [];
  for (const node of snapshot.nodes.values()) {
    if (node.parent === parent) children.push(node);
  }
  children.sort((a, b) => a.childIndex - b.childIndex || (a.id < b.id ? -1 : 1));
  return children;
}

/** Serialize back to the legacy component shape (nested children). */
export function toLegacyComponent(snapshot: GraphSnapshot): Record<string, unknown> {
  const buildTree = (parent: string | undefined): Record<string, unknown>[] =>
    orderedChildren(snapshot, parent).map((node) => {
      const out = denormalizeNodeFields(node);
      const children = buildTree(node.id);
      if (children.length > 0) out.children = children;
      return out;
    });

  const component: Record<string, unknown> = {};
  for (const key of Object.keys(snapshot.extras)) {
    if (key.startsWith('legacy:')) component[key.slice('legacy:'.length)] = snapshot.extras[key];
  }
  component.name = snapshot.name;
  const graph: Record<string, unknown> = {
    roots: buildTree(undefined),
    connections: snapshot.connections.map(denormalizeConnection)
  };
  if (snapshot.comments.length > 0) graph.comments = snapshot.comments.map(denormalizeComment);
  for (const key of Object.keys(snapshot.extras)) {
    if (key.startsWith('legacyGraph:')) graph[key.slice('legacyGraph:'.length)] = snapshot.extras[key];
  }
  component.graph = graph;
  if (Object.keys(snapshot.metadata).length > 0) component.metadata = snapshot.metadata;
  return component;
}

/** Serialize back to the three v2 file bodies. */
export function toV2Files(snapshot: GraphSnapshot): V2ComponentFiles {
  // Depth-first, siblings by childIndex — matches the exporter's flattening.
  const flat: Record<string, unknown>[] = [];
  const emit = (parent: string | undefined) => {
    for (const node of orderedChildren(snapshot, parent)) {
      const out = denormalizeNodeFields(node);
      if (node.parent !== undefined) out.parent = node.parent;
      const children = orderedChildren(snapshot, node.id).map((child) => child.id);
      if (children.length > 0) out.children = children;
      flat.push(out);
      emit(node.id);
    }
  };
  emit(undefined);

  const componentId = snapshot.extras['v2:componentId'] ?? snapshot.extras['v2:componentJsonId'] ?? snapshot.name;

  const nodesFile: Record<string, unknown> = {
    componentId,
    version: snapshot.extras['v2:nodesVersion'] ?? 1,
    nodes: flat
  };
  if (snapshot.extras['v2:visualRoots'] !== undefined) nodesFile.visualRoots = snapshot.extras['v2:visualRoots'];
  if (snapshot.comments.length > 0) nodesFile.comments = snapshot.comments.map(denormalizeComment);

  const connectionsFile: Record<string, unknown> = {
    componentId,
    version: snapshot.extras['v2:connectionsVersion'] ?? 1,
    connections: snapshot.connections.map(denormalizeConnection)
  };

  const componentFile: Record<string, unknown> = {};
  if (snapshot.extras['v2:componentJsonId'] !== undefined) componentFile.id = snapshot.extras['v2:componentJsonId'];
  if (snapshot.extras['v2:componentName'] !== undefined) componentFile.name = snapshot.extras['v2:componentName'];
  componentFile.path = snapshot.name;
  if (snapshot.extras['v2:componentType'] !== undefined) componentFile.type = snapshot.extras['v2:componentType'];
  if (snapshot.extras['v2:ports'] !== undefined) componentFile.ports = snapshot.extras['v2:ports'];
  if (Object.keys(snapshot.metadata).length > 0) componentFile.metadata = snapshot.metadata;
  if (snapshot.extras['v2:modified'] !== undefined) componentFile.modified = snapshot.extras['v2:modified'];

  return { component: componentFile, nodes: nodesFile, connections: connectionsFile };
}

// ---------------------------------------------------------------------------
// Utilities shared by diff and merge
// ---------------------------------------------------------------------------

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    // Match legacy semantics: undefined and absent compare equal via ===.
    return false;
  }
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) if (!deepEqual(arrA[i], arrB[i])) return false;
    return true;
  }
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA).filter((k) => objA[k] !== undefined);
  const keysB = Object.keys(objB).filter((k) => objB[k] !== undefined);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!deepEqual(objA[key], objB[key])) return false;
  }
  return true;
}

export function deepClone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

export function cloneSnapshot(snapshot: GraphSnapshot): GraphSnapshot {
  const nodes = new Map<string, SnapshotNode>();
  for (const [id, node] of snapshot.nodes) nodes.set(id, deepClone(node));
  return {
    name: snapshot.name,
    nodes,
    connections: deepClone(snapshot.connections),
    comments: deepClone(snapshot.comments),
    metadata: deepClone(snapshot.metadata),
    extras: deepClone(snapshot.extras)
  };
}

/**
 * "Semantically equal" — the delete-vs-edit test. Ignores canvas position,
 * node metadata, and sibling order (order is compared separately by relative
 * rank, see GraphMerge — absolute childIndex shifts when a sibling is deleted
 * and must not count as an edit). Mirrors the legacy nodesSoftEqual otherwise,
 * so a purely-moved node still deletes cleanly.
 */
export function nodesSoftEqual(a: SnapshotNode, b: SnapshotNode): boolean {
  if (a.type !== b.type) return false;
  if ((a.label ?? undefined) !== (b.label ?? undefined)) return false;
  if ((a.variant ?? undefined) !== (b.variant ?? undefined)) return false;
  if (!deepEqual(a.version, b.version)) return false;
  if ((a.parent ?? undefined) !== (b.parent ?? undefined)) return false;
  if (!deepEqual(a.parameters, b.parameters)) return false;
  if (!deepEqual(a.stateParameters, b.stateParameters)) return false;
  if (!deepEqual(a.stateTransitions, b.stateTransitions)) return false;
  if (!deepEqual(a.defaultStateTransitions, b.defaultStateTransitions)) return false;
  if (!deepEqual(a.ports, b.ports)) return false;
  const restA = { ...a.rest };
  const restB = { ...b.rest };
  delete restA.dynamicports;
  delete restB.dynamicports;
  return deepEqual(restA, restB);
}

export function connectionKey(connection: { fromId: string; fromProperty: string; toId: string; toProperty: string }): string {
  return `${connection.fromId}:${connection.fromProperty}->${connection.toId}:${connection.toProperty}`;
}
