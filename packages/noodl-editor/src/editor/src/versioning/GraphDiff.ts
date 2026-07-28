/**
 * SUB-007: semantic diff between two component graph snapshots.
 *
 * Produces a typed change list (see types.ts) meant to be rendered as
 * sentences ("Button 'Login' rewired to Navigate") rather than JSON deltas.
 * Consumed by the diff review UI and Phase 15's AI review.
 */

import { connectionKey, deepEqual } from './GraphSnapshot';
import { matchRecreatedNodes } from './NodeIdentity';
import {
  ComponentDiff,
  ConnectionRef,
  GraphChange,
  GraphSnapshot,
  NodeRef,
  ParamDelta,
  ProjectDiffV2,
  SnapshotConnection,
  SnapshotNode
} from './types';

export function nodeRef(node: SnapshotNode): NodeRef {
  const ref: NodeRef = { id: node.id, type: node.type };
  if (node.label !== undefined) ref.label = node.label;
  return ref;
}

function connectionRef(connection: SnapshotConnection, ...graphs: GraphSnapshot[]): ConnectionRef {
  const ref: ConnectionRef = {
    fromId: connection.fromId,
    fromProperty: connection.fromProperty,
    toId: connection.toId,
    toProperty: connection.toProperty
  };
  for (const graph of graphs) {
    if (!ref.fromNode && graph.nodes.has(connection.fromId)) ref.fromNode = nodeRef(graph.nodes.get(connection.fromId));
    if (!ref.toNode && graph.nodes.has(connection.toId)) ref.toNode = nodeRef(graph.nodes.get(connection.toId));
  }
  return ref;
}

/** Per-key deltas between two parameter maps (undefined = absent). */
export function paramDeltas(base: Record<string, unknown> = {}, target: Record<string, unknown> = {}): ParamDelta[] {
  const deltas: ParamDelta[] = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(target)]);
  for (const name of [...keys].sort()) {
    if (!deepEqual(base[name], target[name])) {
      const delta: ParamDelta = { name };
      if (base[name] !== undefined) delta.base = base[name];
      if (target[name] !== undefined) delta.target = target[name];
      deltas.push(delta);
    }
  }
  return deltas;
}

/** Longest common subsequence of two id sequences; returns the common subsequence. */
function lcs(a: string[], b: string[]): string[] {
  const lengths: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push(a[i]);
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++;
    else j++;
  }
  return out;
}

function orderedIds(snapshot: GraphSnapshot, parent: string | undefined): string[] {
  const ids: { id: string; index: number }[] = [];
  for (const node of snapshot.nodes.values()) {
    if (node.parent === parent) ids.push({ id: node.id, index: node.childIndex });
  }
  ids.sort((a, b) => a.index - b.index || (a.id < b.id ? -1 : 1));
  return ids.map((entry) => entry.id);
}

/**
 * Instance ports compare with `index` stripped: the editor stamps a numeric
 * `index` onto loaded ports while freshly authored ones (AI proposals, hand
 * written v2 files) carry none, and the array order already expresses the
 * ordering — so `index` never carries independent information. Found live in
 * AIX-003 review, where every loaded Component Inputs node spuriously
 * reported "ports changed" against its own re-proposal.
 */
function normalizedPorts(ports: unknown[]): unknown[] {
  return ports.map((port) => {
    if (port !== null && typeof port === 'object' && !Array.isArray(port) && 'index' in port) {
      const { index: _index, ...rest } = port as Record<string, unknown>;
      return rest;
    }
    return port;
  });
}

function diffNodePair(base: SnapshotNode, target: SnapshotNode, baseGraph: GraphSnapshot, targetGraph: GraphSnapshot): GraphChange[] {
  const changes: GraphChange[] = [];
  const ref = nodeRef(target);

  if (base.type !== target.type) {
    changes.push({ kind: 'node-type-changed', node: ref, fromType: base.type, toType: target.type, category: 'semantic' });
  }
  if ((base.label ?? undefined) !== (target.label ?? undefined)) {
    changes.push({ kind: 'node-renamed', node: ref, fromLabel: base.label, toLabel: target.label, category: 'semantic' });
  }
  if ((base.variant ?? undefined) !== (target.variant ?? undefined)) {
    changes.push({
      kind: 'node-variant-changed',
      node: ref,
      fromVariant: base.variant,
      toVariant: target.variant,
      category: 'semantic'
    });
  }

  const params = paramDeltas(base.parameters, target.parameters);
  if (params.length > 0) {
    changes.push({ kind: 'node-parameters-changed', node: ref, params, category: 'semantic' });
  }

  for (const bundle of ['stateParameters', 'stateTransitions'] as const) {
    const baseBundle = base[bundle] ?? {};
    const targetBundle = target[bundle] ?? {};
    const states = new Set([...Object.keys(baseBundle), ...Object.keys(targetBundle)]);
    for (const state of [...states].sort()) {
      const deltas = paramDeltas(baseBundle[state] ?? {}, targetBundle[state] ?? {});
      if (deltas.length > 0) {
        changes.push({ kind: 'node-state-changed', node: ref, bundle, state, params: deltas, category: 'semantic' });
      }
    }
  }
  const defaultDeltas = paramDeltas(base.defaultStateTransitions ?? {}, target.defaultStateTransitions ?? {});
  if (defaultDeltas.length > 0) {
    changes.push({
      kind: 'node-state-changed',
      node: ref,
      bundle: 'defaultStateTransitions',
      params: defaultDeltas,
      category: 'semantic'
    });
  }

  if (!deepEqual(normalizedPorts(base.ports), normalizedPorts(target.ports))) {
    changes.push({ kind: 'node-ports-changed', node: ref, category: 'semantic' });
  }

  if ((base.parent ?? undefined) !== (target.parent ?? undefined)) {
    const change: GraphChange = { kind: 'node-reparented', node: ref, category: 'semantic' };
    const fromParent = base.parent !== undefined ? baseGraph.nodes.get(base.parent) : undefined;
    const toParent = target.parent !== undefined ? targetGraph.nodes.get(target.parent) : undefined;
    if (fromParent) (change as { fromParent?: NodeRef }).fromParent = nodeRef(fromParent);
    if (toParent) (change as { toParent?: NodeRef }).toParent = nodeRef(toParent);
    changes.push(change);
  }

  if ((base.x ?? undefined) !== (target.x ?? undefined) || (base.y ?? undefined) !== (target.y ?? undefined)) {
    changes.push({
      kind: 'node-moved',
      node: ref,
      from: { x: base.x, y: base.y },
      to: { x: target.x, y: target.y },
      category: 'cosmetic'
    });
  }

  return changes;
}

/** Leaf-path deltas for component metadata/extras; arrays compared atomically. */
function metadataDeltas(prefix: string, base: unknown, target: unknown, out: GraphChange[]): void {
  if (deepEqual(base, target)) return;
  const bothObjects =
    base !== null && target !== null && typeof base === 'object' && typeof target === 'object' && !Array.isArray(base) && !Array.isArray(target);
  if (!bothObjects) {
    const change: GraphChange = { kind: 'component-metadata-changed', path: prefix, category: 'semantic' };
    if (base !== undefined) (change as { base?: unknown }).base = base;
    if (target !== undefined) (change as { target?: unknown }).target = target;
    out.push(change);
    return;
  }
  const keys = new Set([...Object.keys(base as object), ...Object.keys(target as object)]);
  for (const key of [...keys].sort()) {
    metadataDeltas(
      prefix ? `${prefix}.${key}` : key,
      (base as Record<string, unknown>)[key],
      (target as Record<string, unknown>)[key],
      out
    );
  }
}

/**
 * Snapshot `extras` mixes two kinds of thing: real component-level content
 * (ports, component type) and bookkeeping the editor derives or the format
 * requires. Only the first belongs in a change list a human reads — showing
 * `legacyGraph:visualRoots: [] → ["ae0d…"]` tells the reader nothing about
 * what anyone did, and it changes as a side effect of ordinary edits.
 *
 * Found by reviewing the diff panel against a real project rather than a
 * fixture; the round-trip still preserves every one of these verbatim.
 */
const DERIVED_EXTRAS = new Set([
  'legacyGraph:visualRoots',
  'v2:visualRoots',
  'v2:modified',
  'v2:nodesVersion',
  'v2:connectionsVersion',
  'v2:componentId',
  'v2:componentJsonId',
  // The v2 display name is the path's last segment; a real rename surfaces as
  // `component-renamed` through the snapshot name, so this never carries
  // independent information (AIX-003's empty-base diffs made it visible).
  'v2:componentName',
  'legacy:id',
  'hasCommentsArray'
]);

/** Strip the adapter prefix so paths read as the user's vocabulary. */
function displayExtrasKey(key: string): string {
  return key.replace(/^(legacyGraph:|legacy:|v2:)/, '');
}

export interface DiffOptions {
  /** Disable the structural recreated-node matcher (design doc §2.2). */
  structuralMatching?: boolean;
}

export function diffGraphs(base: GraphSnapshot, target: GraphSnapshot, options: DiffOptions = {}): ComponentDiff {
  const structural = options.structuralMatching !== false;
  const changes: GraphChange[] = [];

  // --- Nodes: added / removed by id ---
  const removedNodes: SnapshotNode[] = [];
  const addedNodes: SnapshotNode[] = [];
  for (const [id, node] of base.nodes) if (!target.nodes.has(id)) removedNodes.push(node);
  for (const [id, node] of target.nodes) if (!base.nodes.has(id)) addedNodes.push(node);

  const matches = structural ? matchRecreatedNodes(removedNodes, addedNodes) : [];
  const matchedRemoved = new Set(matches.map((m) => m.removed.id));
  const matchedAdded = new Set(matches.map((m) => m.added.id));

  for (const match of matches) {
    changes.push({
      kind: 'node-recreated',
      node: nodeRef(match.removed),
      recreatedAs: nodeRef(match.added),
      identity: 'structural',
      params: paramDeltas(match.removed.parameters, match.added.parameters),
      category: 'semantic'
    });
  }
  for (const node of removedNodes) {
    if (!matchedRemoved.has(node.id)) changes.push({ kind: 'node-removed', node: nodeRef(node), category: 'semantic' });
  }
  for (const node of addedNodes) {
    if (!matchedAdded.has(node.id)) changes.push({ kind: 'node-added', node: nodeRef(node), category: 'semantic' });
  }

  // --- Nodes present on both sides: field diffs ---
  for (const [id, baseNode] of base.nodes) {
    const targetNode = target.nodes.get(id);
    if (targetNode) changes.push(...diffNodePair(baseNode, targetNode, base, target));
  }

  // --- Sibling reorders (order of surviving common children per parent) ---
  const parents = new Set<string | undefined>();
  for (const node of base.nodes.values()) parents.add(node.parent);
  for (const node of target.nodes.values()) parents.add(node.parent);
  for (const parent of parents) {
    const baseOrder = orderedIds(base, parent).filter((id) => target.nodes.has(id) && target.nodes.get(id).parent === parent);
    const targetOrder = orderedIds(target, parent).filter((id) => base.nodes.has(id) && base.nodes.get(id).parent === parent);
    if (baseOrder.length !== targetOrder.length) continue; // membership differences already reported
    const stable = new Set(lcs(baseOrder, targetOrder));
    for (const id of targetOrder) {
      if (!stable.has(id)) {
        const node = target.nodes.get(id);
        const parentNode = parent !== undefined ? target.nodes.get(parent) ?? base.nodes.get(parent) : undefined;
        const change: GraphChange = {
          kind: 'node-reordered',
          node: nodeRef(node),
          fromIndex: baseOrder.indexOf(id),
          toIndex: targetOrder.indexOf(id),
          category: 'semantic'
        };
        if (parentNode) (change as { parent?: NodeRef }).parent = nodeRef(parentNode);
        changes.push(change);
      }
    }
  }

  // --- Connections ---
  const baseConnections = new Map(base.connections.map((c) => [connectionKey(c), c]));
  const targetConnections = new Map(target.connections.map((c) => [connectionKey(c), c]));
  const removedConnections: SnapshotConnection[] = [];
  const addedConnections: SnapshotConnection[] = [];
  for (const [key, connection] of baseConnections) if (!targetConnections.has(key)) removedConnections.push(connection);
  for (const [key, connection] of targetConnections) if (!baseConnections.has(key)) addedConnections.push(connection);

  // Pair removed+added sharing an endpoint into "rewired" (display-level intent).
  const pairedRemoved = new Set<string>();
  const pairedAdded = new Set<string>();
  const byEndpoint = (connections: SnapshotConnection[], end: 'target' | 'source') => {
    const groups = new Map<string, SnapshotConnection[]>();
    for (const connection of connections) {
      const key =
        end === 'target' ? `${connection.toId}:${connection.toProperty}` : `${connection.fromId}:${connection.fromProperty}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(connection);
    }
    return groups;
  };
  for (const end of ['target', 'source'] as const) {
    const removedGroups = byEndpoint(
      removedConnections.filter((c) => !pairedRemoved.has(connectionKey(c))),
      end
    );
    const addedGroups = byEndpoint(
      addedConnections.filter((c) => !pairedAdded.has(connectionKey(c))),
      end
    );
    for (const [endpoint, removedGroup] of [...removedGroups.entries()].sort()) {
      const addedGroup = addedGroups.get(endpoint);
      if (!addedGroup || removedGroup.length !== 1 || addedGroup.length !== 1) continue;
      const before = removedGroup[0];
      const after = addedGroup[0];
      pairedRemoved.add(connectionKey(before));
      pairedAdded.add(connectionKey(after));
      changes.push({
        kind: 'connection-rewired',
        at: end,
        before: connectionRef(before, base, target),
        after: connectionRef(after, target, base),
        category: 'semantic'
      });
    }
  }
  for (const connection of removedConnections) {
    if (!pairedRemoved.has(connectionKey(connection)))
      changes.push({ kind: 'connection-removed', connection: connectionRef(connection, base, target), category: 'semantic' });
  }
  for (const connection of addedConnections) {
    if (!pairedAdded.has(connectionKey(connection)))
      changes.push({ kind: 'connection-added', connection: connectionRef(connection, target, base), category: 'semantic' });
  }

  // A wire that exists on both sides can still differ: its author-written label
  // (CAN-002). `connectionKey` is the four endpoints, so nothing above notices.
  // Position (`labelT`) is deliberately not compared — moving a label is not an
  // edit to the graph's meaning.
  for (const [key, baseConnection] of baseConnections) {
    const targetConnection = targetConnections.get(key);
    if (!targetConnection) continue;
    if ((baseConnection.label ?? undefined) === (targetConnection.label ?? undefined)) continue;

    const change: GraphChange = {
      kind: 'connection-relabelled',
      connection: connectionRef(targetConnection, target, base),
      category: 'semantic'
    };
    if (baseConnection.label !== undefined) change.fromLabel = baseConnection.label;
    if (targetConnection.label !== undefined) change.toLabel = targetConnection.label;
    changes.push(change);
  }

  // --- Comments ---
  const baseComments = new Map(base.comments.map((c) => [c.key, c]));
  const targetComments = new Map(target.comments.map((c) => [c.key, c]));
  for (const [key, comment] of baseComments) {
    if (!targetComments.has(key)) changes.push({ kind: 'comment-removed', commentKey: key, text: comment.text, category: 'semantic' });
  }
  for (const [key, comment] of targetComments) {
    if (!baseComments.has(key)) changes.push({ kind: 'comment-added', commentKey: key, text: comment.text, category: 'semantic' });
  }
  for (const [key, baseComment] of baseComments) {
    const targetComment = targetComments.get(key);
    if (!targetComment) continue;
    if (baseComment.text !== targetComment.text) {
      changes.push({
        kind: 'comment-changed',
        commentKey: key,
        fromText: baseComment.text,
        toText: targetComment.text,
        category: 'semantic'
      });
    } else if (
      (baseComment.x ?? undefined) !== (targetComment.x ?? undefined) ||
      (baseComment.y ?? undefined) !== (targetComment.y ?? undefined) ||
      !deepEqual(baseComment.rest, targetComment.rest)
    ) {
      changes.push({ kind: 'comment-moved', commentKey: key, category: 'cosmetic' });
    }
  }

  // --- Component-level ---
  if (base.name !== target.name) {
    changes.push({ kind: 'component-renamed', fromName: base.name, toName: target.name, category: 'semantic' });
  }
  metadataDeltas('metadata', base.metadata, target.metadata, changes);
  const extraKeys = new Set([...Object.keys(base.extras), ...Object.keys(target.extras)]);
  for (const key of [...extraKeys].sort()) {
    if (DERIVED_EXTRAS.has(key)) continue;
    metadataDeltas(displayExtrasKey(key), base.extras[key], target.extras[key], changes);
  }

  return { component: target.name || base.name, changes };
}

/** Diff two project-level maps of component snapshots, keyed by component name. */
export function diffProjectSnapshots(
  base: Map<string, GraphSnapshot>,
  target: Map<string, GraphSnapshot>,
  options: DiffOptions = {}
): ProjectDiffV2 {
  const result: ProjectDiffV2 = { addedComponents: [], removedComponents: [], changedComponents: [] };
  for (const name of [...base.keys()].sort()) {
    if (!target.has(name)) result.removedComponents.push(name);
  }
  for (const name of [...target.keys()].sort()) {
    if (!base.has(name)) result.addedComponents.push(name);
  }
  for (const name of [...base.keys()].sort()) {
    const targetSnapshot = target.get(name);
    if (!targetSnapshot) continue;
    const diff = diffGraphs(base.get(name), targetSnapshot, options);
    if (diff.changes.length > 0) result.changedComponents.push(diff);
  }
  return result;
}
