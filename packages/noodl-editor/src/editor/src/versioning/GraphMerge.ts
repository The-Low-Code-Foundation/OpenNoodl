/**
 * SUB-007: three-way merge of component graphs, conservative by design.
 *
 * Governing rule (SUB-007-DESIGN.md §4): every semantic base→side change either
 * appears in the merged output or appears in a conflict. Cosmetic changes
 * (canvas position) and editor bookkeeping (node metadata, v2 modified
 * timestamps) are the only sanctioned silent ours-wins cases.
 *
 * Identity is the node id / connection 4-tuple — never structural heuristics
 * (those are diff-display only; see design doc §2.2).
 */

import { cloneSnapshot, connectionKey, deepClone, deepEqual, nodesSoftEqual } from './GraphSnapshot';
import { diffGraphs, nodeRef } from './GraphDiff';
import {
  ConflictSide,
  ConnectionRef,
  GraphConflict,
  GraphSnapshot,
  MergeResult,
  ParamMap,
  SnapshotConnection,
  SnapshotNode
} from './types';

// diff3 is plain JS without type definitions (already a production dependency
// of the legacy merger).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const diff3 = require('diff3') as (
  ours: string[],
  ancestor: string[],
  theirs: string[]
) => Array<{ ok?: string[]; conflict?: { a: string[]; o: string[]; b: string[] } }>;

interface MergeContext {
  base: GraphSnapshot;
  ours: GraphSnapshot;
  theirs: GraphSnapshot;
  merged: GraphSnapshot;
  conflicts: GraphConflict[];
}

function addConflict(context: MergeContext, conflict: Omit<GraphConflict, 'id'>): void {
  const anchor = conflict.node?.id ?? (conflict.connection ? connectionKey(conflict.connection) : '') ?? '';
  const discriminator = [conflict.state, conflict.name].filter((part) => part !== undefined).join('/');
  context.conflicts.push({
    id: `${conflict.kind}:${anchor}${discriminator ? ':' + discriminator : ''}`,
    ...conflict
  });
}

/**
 * Standard three-way scalar rule. Returns the winning value; on a genuine
 * conflict keeps ours and reports via onConflict.
 */
function merge3<T>(base: T, ours: T, theirs: T, onConflict: (base: T, ours: T, theirs: T) => void): T {
  if (deepEqualOrIdentical(ours, theirs)) return ours;
  if (deepEqualOrIdentical(theirs, base)) return ours;
  if (deepEqualOrIdentical(ours, base)) return theirs;
  onConflict(base, ours, theirs);
  return ours;
}

function deepEqualOrIdentical(a: unknown, b: unknown): boolean {
  return a === b || deepEqual(a, b);
}

// ---------------------------------------------------------------------------
// Source code (diff3 line merge for code-editor ports)
// ---------------------------------------------------------------------------

function isSourceCodePort(name: string, ...nodes: (SnapshotNode | undefined)[]): boolean {
  for (const node of nodes) {
    const merge = node?.metadata?.merge as { soureCodePorts?: string[] } | undefined;
    if (merge?.soureCodePorts?.includes(name)) return true;
  }
  return false;
}

function mergeSourceCode(
  base: string,
  ours: string,
  theirs: string
): { merged: string; hasConflicts: boolean; withMarkers: string } {
  const regions = diff3(ours.split(/\r?\n/), base.split(/\r?\n/), theirs.split(/\r?\n/));
  let hasConflicts = false;
  const clean: string[] = [];
  const marked: string[] = [];
  for (const region of regions) {
    if (region.ok) {
      clean.push(...region.ok);
      marked.push(...region.ok);
    } else if (region.conflict) {
      hasConflicts = true;
      marked.push('------------- Original -------------');
      marked.push(...region.conflict.o);
      marked.push('------------- Ours -------------');
      marked.push(...region.conflict.a);
      marked.push('------------- Theirs -------------');
      marked.push(...region.conflict.b);
      marked.push('-------------');
      // The conflict-free result keeps ours for conflicted regions.
      clean.push(...region.conflict.a);
    }
  }
  return { merged: clean.join('\n'), hasConflicts, withMarkers: marked.join('\n') };
}

// ---------------------------------------------------------------------------
// Node field merging
// ---------------------------------------------------------------------------

function mergeParamMap(
  context: MergeContext,
  node: SnapshotNode,
  base: ParamMap,
  ours: ParamMap,
  theirs: ParamMap,
  onConflict: (name: string, baseValue: unknown, oursValue: unknown, theirsValue: unknown) => unknown
): ParamMap {
  const merged: ParamMap = {};
  const keys = new Set([...Object.keys(ours), ...Object.keys(theirs)]);
  for (const name of [...keys].sort()) {
    const baseValue = base[name];
    const oursValue = ours[name];
    const theirsValue = theirs[name];
    let winner: unknown;
    if (deepEqualOrIdentical(oursValue, theirsValue)) winner = oursValue;
    else if (deepEqualOrIdentical(theirsValue, baseValue)) winner = oursValue;
    else if (deepEqualOrIdentical(oursValue, baseValue)) winner = theirsValue;
    else winner = onConflict(name, baseValue, oursValue, theirsValue);
    if (winner !== undefined) merged[name] = winner;
  }
  return merged;
}

function mergeStateBundle(
  context: MergeContext,
  node: SnapshotNode,
  kind: 'state-parameter' | 'state-transition',
  base: Record<string, ParamMap> = {},
  ours: Record<string, ParamMap> = {},
  theirs: Record<string, ParamMap> = {}
): Record<string, ParamMap> | undefined {
  const merged: Record<string, ParamMap> = {};
  const states = new Set([...Object.keys(ours), ...Object.keys(theirs)]);
  for (const state of [...states].sort()) {
    const mergedState = mergeParamMap(
      context,
      node,
      base[state] ?? {},
      ours[state] ?? {},
      theirs[state] ?? {},
      (name, baseValue, oursValue, theirsValue) => {
        addConflict(context, {
          kind,
          node: nodeRef(node),
          state,
          name,
          base: baseValue,
          ours: oursValue,
          theirs: theirsValue
        });
        return oursValue;
      }
    );
    if (Object.keys(mergedState).length > 0) merged[state] = mergedState;
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/** Silent recursive 3-way for editor bookkeeping (node metadata) — leaf conflicts keep ours. */
function mergeJSONSilent(base: unknown, ours: unknown, theirs: unknown): unknown {
  if (deepEqualOrIdentical(ours, theirs)) return ours;
  if (deepEqualOrIdentical(theirs, base)) return ours;
  if (deepEqualOrIdentical(ours, base)) return theirs;
  const bothObjects =
    ours !== null &&
    theirs !== null &&
    typeof ours === 'object' &&
    typeof theirs === 'object' &&
    !Array.isArray(ours) &&
    !Array.isArray(theirs);
  if (!bothObjects) return ours;
  const merged: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(ours as object), ...Object.keys(theirs as object)]);
  for (const key of keys) {
    const value = mergeJSONSilent(
      base !== null && typeof base === 'object' ? (base as Record<string, unknown>)[key] : undefined,
      (ours as Record<string, unknown>)[key],
      (theirs as Record<string, unknown>)[key]
    );
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

function mergeNodeFields(
  context: MergeContext,
  base: SnapshotNode | undefined,
  ours: SnapshotNode,
  theirs: SnapshotNode
): SnapshotNode {
  const merged = deepClone(ours);
  const ref = nodeRef(ours);
  const conflictCountBefore = context.conflicts.length;

  merged.type = merge3(base?.type, ours.type, theirs.type, (b, o, t) => {
    addConflict(context, { kind: 'typename', node: ref, base: b, ours: o, theirs: t });
  });
  merged.label = merge3(base?.label, ours.label, theirs.label, (b, o, t) => {
    addConflict(context, { kind: 'label', node: ref, base: b, ours: o, theirs: t });
  });
  merged.variant = merge3(base?.variant, ours.variant, theirs.variant, (b, o, t) => {
    addConflict(context, { kind: 'variant', node: ref, base: b, ours: o, theirs: t });
  });
  merged.version = merge3(base?.version, ours.version, theirs.version, (b, o, t) => {
    addConflict(context, { kind: 'typename', node: ref, name: 'version', base: b, ours: o, theirs: t });
  });

  // Canvas position: cosmetic — both-changed keeps ours without conflict.
  const basePos = base ? { x: base.x, y: base.y } : undefined;
  const winnerPos = merge3(basePos, { x: ours.x, y: ours.y }, { x: theirs.x, y: theirs.y }, () => undefined);
  merged.x = winnerPos?.x;
  merged.y = winnerPos?.y;

  merged.parameters = mergeParamMap(
    context,
    ours,
    base?.parameters ?? {},
    ours.parameters,
    theirs.parameters,
    (name, baseValue, oursValue, theirsValue) => {
      if (isSourceCodePort(name, ours, theirs)) {
        if (typeof baseValue === 'string' && typeof oursValue === 'string' && typeof theirsValue === 'string') {
          const { merged: mergedText, hasConflicts, withMarkers } = mergeSourceCode(baseValue, oursValue, theirsValue);
          if (!hasConflicts) return mergedText;
          addConflict(context, {
            kind: 'source-code',
            node: ref,
            name,
            base: baseValue,
            ours: oursValue,
            theirs: theirsValue,
            mergedWithMarkers: withMarkers
          });
          return oursValue;
        }
        addConflict(context, {
          kind: 'source-code',
          node: ref,
          name,
          base: baseValue,
          ours: oursValue,
          theirs: theirsValue
        });
        return oursValue;
      }
      addConflict(context, { kind: 'parameter', node: ref, name, base: baseValue, ours: oursValue, theirs: theirsValue });
      return oursValue;
    }
  );

  merged.stateParameters = mergeStateBundle(
    context,
    ours,
    'state-parameter',
    base?.stateParameters,
    ours.stateParameters,
    theirs.stateParameters
  );
  merged.stateTransitions = mergeStateBundle(
    context,
    ours,
    'state-transition',
    base?.stateTransitions,
    ours.stateTransitions,
    theirs.stateTransitions
  );
  if (ours.defaultStateTransitions || theirs.defaultStateTransitions || base?.defaultStateTransitions) {
    merged.defaultStateTransitions = mergeParamMap(
      context,
      ours,
      base?.defaultStateTransitions ?? {},
      ours.defaultStateTransitions ?? {},
      theirs.defaultStateTransitions ?? {},
      (state, baseValue, oursValue, theirsValue) => {
        addConflict(context, {
          kind: 'default-state-transition',
          node: ref,
          state,
          base: baseValue,
          ours: oursValue,
          theirs: theirsValue
        });
        return oursValue;
      }
    );
    if (Object.keys(merged.defaultStateTransitions).length === 0) delete merged.defaultStateTransitions;
  }

  // Instance ports, keyed by name. A both-changed port conflicts unless the node
  // already has parameter-level conflicts (ports are usually derived from those
  // parameters; one conflict per cause, not two).
  const hasParamConflicts = () => context.conflicts.length > conflictCountBefore;
  merged.ports = mergePortsByName(context, ref, base?.ports ?? [], ours.ports, theirs.ports, hasParamConflicts);

  merged.parent = merge3(base?.parent, ours.parent, theirs.parent, (b, o, t) => {
    addConflict(context, { kind: 'reparent', node: ref, base: b, ours: o, theirs: t });
  });

  // Node metadata is editor bookkeeping: silent recursive merge (documented).
  const mergedMetadata = mergeJSONSilent(base?.metadata, ours.metadata, theirs.metadata);
  if (mergedMetadata !== undefined) merged.metadata = mergedMetadata as Record<string, unknown>;
  else delete merged.metadata;

  // Unknown passthrough fields: silent 3-way per key (ours wins on both-changed).
  merged.rest = mergeJSONSilent(base?.rest ?? {}, ours.rest, theirs.rest) as Record<string, unknown>;

  // The merge above may pick values by reference from either input; the merged
  // node must be independent of the inputs.
  return deepClone(merged);
}

function mergePortsByName(
  context: MergeContext,
  ref: ReturnType<typeof nodeRef>,
  base: unknown[],
  ours: unknown[],
  theirs: unknown[],
  suppress: () => boolean
): unknown[] {
  type Port = { name?: string };
  const byName = (ports: unknown[]) => {
    const map = new Map<string, unknown>();
    (ports as Port[]).forEach((port, index) => map.set(String(port?.name ?? `@${index}`), port));
    return map;
  };
  const baseMap = byName(base);
  const oursMap = byName(ours);
  const theirsMap = byName(theirs);
  const merged: unknown[] = [];
  const names = new Set([...oursMap.keys(), ...theirsMap.keys()]);
  for (const name of names) {
    const winner = merge3(baseMap.get(name), oursMap.get(name), theirsMap.get(name), (b, o, t) => {
      if (!suppress()) {
        addConflict(context, { kind: 'ports', node: ref, name, base: b, ours: o, theirs: t });
      }
    });
    if (winner !== undefined) merged.push(winner);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Child ordering
// ---------------------------------------------------------------------------

function orderOf(snapshot: GraphSnapshot, parent: string | undefined): string[] {
  const entries: { id: string; index: number }[] = [];
  for (const node of snapshot.nodes.values()) {
    if (node.parent === parent) entries.push({ id: node.id, index: node.childIndex });
  }
  entries.sort((a, b) => a.index - b.index || (a.id < b.id ? -1 : 1));
  return entries.map((entry) => entry.id);
}

function insertNewIds(skeleton: string[], sideOrder: string[], newIds: Set<string>): string[] {
  const result = [...skeleton];
  for (const id of sideOrder) {
    if (!newIds.has(id)) continue;
    if (result.includes(id)) continue;
    // Place after the nearest preceding sibling (on that side) that survived.
    const index = sideOrder.indexOf(id);
    let insertAt = 0;
    for (let i = index - 1; i >= 0; i--) {
      const anchor = result.indexOf(sideOrder[i]);
      if (anchor !== -1) {
        insertAt = anchor + 1;
        break;
      }
    }
    result.splice(insertAt, 0, id);
  }
  return result;
}

function mergeChildOrders(context: MergeContext): void {
  const { base, ours, theirs, merged } = context;
  const parents = new Set<string | undefined>();
  for (const node of merged.nodes.values()) parents.add(node.parent);

  for (const parent of parents) {
    const inMerged = (id: string) => merged.nodes.has(id) && merged.nodes.get(id).parent === parent;
    const baseOrder = orderOf(base, parent).filter(inMerged);
    const oursOrder = orderOf(ours, parent).filter(inMerged);
    const theirsOrder = orderOf(theirs, parent).filter(inMerged);

    const common = oursOrder.filter((id) => theirsOrder.includes(id));
    const commonSet = new Set(common);
    const seqOurs = oursOrder.filter((id) => commonSet.has(id));
    const seqTheirs = theirsOrder.filter((id) => commonSet.has(id));
    const seqBase = baseOrder.filter((id) => commonSet.has(id));

    let skeleton: string[];
    if (deepEqual(seqOurs, seqTheirs)) skeleton = seqOurs;
    else if (deepEqual(seqTheirs, seqBase)) skeleton = seqOurs;
    else if (deepEqual(seqOurs, seqBase)) skeleton = seqTheirs;
    else {
      skeleton = seqOurs;
      const parentNode = parent !== undefined ? merged.nodes.get(parent) : undefined;
      addConflict(context, {
        kind: 'child-order',
        node: parentNode ? nodeRef(parentNode) : undefined,
        name: parent === undefined ? '<roots>' : undefined,
        base: seqBase,
        ours: oursOrder,
        theirs: theirsOrder
      });
    }

    const oursNew = new Set(oursOrder.filter((id) => !commonSet.has(id)));
    const theirsNew = new Set(theirsOrder.filter((id) => !commonSet.has(id)));
    let order = insertNewIds(skeleton, oursOrder, oursNew);
    order = insertNewIds(order, theirsOrder, theirsNew);
    // Anything still unplaced (defensive) goes at the end deterministically.
    const placed = new Set(order);
    const unplaced: string[] = [];
    for (const node of merged.nodes.values()) {
      if (node.parent === parent && !placed.has(node.id)) unplaced.push(node.id);
    }
    order.push(...unplaced.sort());

    order.forEach((id, index) => {
      merged.nodes.get(id).childIndex = index;
    });
  }
}

/**
 * Two individually-valid reparents can jointly form a parent cycle (ours moved
 * A under B, theirs moved B under A). A cycle would make the subtree
 * unreachable from the roots and silently vanish on serialization — instead,
 * revert one side's reparent (preferring theirs, keeping the result
 * ours-flavored) and raise a reparent conflict.
 */
function breakParentCycles(context: MergeContext): void {
  const { merged, base, ours, theirs } = context;

  const findCycle = (): string[] | undefined => {
    const safe = new Set<string>();
    for (const start of merged.nodes.keys()) {
      const path: string[] = [];
      const onPath = new Set<string>();
      let cursor: string | undefined = start;
      while (cursor !== undefined && merged.nodes.has(cursor) && !safe.has(cursor)) {
        if (onPath.has(cursor)) return path.slice(path.indexOf(cursor));
        onPath.add(cursor);
        path.push(cursor);
        cursor = merged.nodes.get(cursor).parent;
      }
      for (const id of path) safe.add(id);
    }
    return undefined;
  };

  let guard = merged.nodes.size + 1;
  while (guard-- > 0) {
    const cycle = findCycle();
    if (!cycle) break;
    const fromTheirs = cycle.find((id) => {
      const parent = merged.nodes.get(id).parent;
      return parent !== base.nodes.get(id)?.parent && parent === theirs.nodes.get(id)?.parent;
    });
    const victim =
      fromTheirs ?? cycle.find((id) => merged.nodes.get(id).parent !== base.nodes.get(id)?.parent) ?? cycle[0];
    const node = merged.nodes.get(victim);
    const baseParent = base.nodes.get(victim)?.parent;
    const reverted = baseParent !== undefined && merged.nodes.has(baseParent) ? baseParent : undefined;
    addConflict(context, {
      kind: 'reparent',
      node: nodeRef(node),
      name: 'cycle',
      base: baseParent,
      ours: ours.nodes.get(victim)?.parent,
      theirs: theirs.nodes.get(victim)?.parent
    });
    // Guarantee progress: if the base parent is itself in the cycle, go to root.
    node.parent = reverted === node.parent ? undefined : reverted;
  }
}

// ---------------------------------------------------------------------------
// The merge
// ---------------------------------------------------------------------------

export function mergeGraphs(base: GraphSnapshot, ours: GraphSnapshot, theirs: GraphSnapshot): MergeResult {
  const merged = cloneSnapshot(ours);
  merged.nodes = new Map();
  merged.connections = [];
  merged.comments = [];
  const context: MergeContext = { base, ours, theirs, merged, conflicts: [] };

  // --- Nodes ---
  const nodeIds = new Set([...base.nodes.keys(), ...ours.nodes.keys(), ...theirs.nodes.keys()]);
  for (const id of [...nodeIds].sort()) {
    const inBase = base.nodes.get(id);
    const inOurs = ours.nodes.get(id);
    const inTheirs = theirs.nodes.get(id);

    // Order is semantic for non-roots, but compared by relative rank among
    // shared siblings so a sibling deletion on one side does not read as an
    // edit of every node after it.
    const rankUnchanged = (side: GraphSnapshot, node: SnapshotNode) => {
      if (node.parent === undefined) return true; // legacy rule: root order is not an edit
      const inSide = (candidate: string) =>
        side.nodes.has(candidate) && side.nodes.get(candidate).parent === node.parent;
      const inBaseGraph = (candidate: string) =>
        base.nodes.has(candidate) && base.nodes.get(candidate).parent === node.parent;
      const baseRank = orderOf(base, node.parent).filter(inSide).indexOf(node.id);
      const sideRank = orderOf(side, node.parent).filter(inBaseGraph).indexOf(node.id);
      return baseRank === sideRank;
    };

    if (inBase && inOurs && inTheirs) {
      merged.nodes.set(id, mergeNodeFields(context, inBase, inOurs, inTheirs));
    } else if (inBase && inOurs && !inTheirs) {
      // Theirs deleted. Cosmetic-only local edits do not block deletion.
      if (nodesSoftEqual(inBase, inOurs) && rankUnchanged(ours, inOurs)) continue;
      // Ours-flavored: the edited node stays; the conflict records the deletion.
      merged.nodes.set(id, deepClone(inOurs));
      addConflict(context, {
        kind: 'delete-vs-edit',
        node: nodeRef(inOurs),
        deletedBy: 'theirs',
        base: inBase,
        ours: deepClone(inOurs),
        theirs: undefined
      });
    } else if (inBase && !inOurs && inTheirs) {
      if (nodesSoftEqual(inBase, inTheirs) && rankUnchanged(theirs, inTheirs)) continue;
      // Ours-flavored: stays deleted; conflict carries theirs' edited node for restore.
      addConflict(context, {
        kind: 'delete-vs-edit',
        node: nodeRef(inTheirs),
        deletedBy: 'ours',
        base: inBase,
        ours: undefined,
        theirs: deepClone(inTheirs)
      });
    } else if (!inBase && inOurs && inTheirs) {
      // Added on both sides (shared copy/paste origin or identical intent).
      if (nodesSoftEqual(inOurs, inTheirs)) {
        merged.nodes.set(id, deepClone(inOurs));
      } else if (inOurs.type !== inTheirs.type) {
        merged.nodes.set(id, deepClone(inOurs));
        addConflict(context, {
          kind: 'add-add',
          node: nodeRef(inOurs),
          ours: deepClone(inOurs),
          theirs: deepClone(inTheirs)
        });
      } else {
        merged.nodes.set(id, mergeNodeFields(context, undefined, inOurs, inTheirs));
      }
    } else if (!inBase && inOurs) {
      merged.nodes.set(id, deepClone(inOurs));
    } else if (!inBase && inTheirs) {
      merged.nodes.set(id, deepClone(inTheirs));
    }
    // base-only: deleted by both — gone.
  }

  // Orphans: merged nodes whose parent did not survive. Reattach to the nearest
  // surviving ancestor (walking ours' then base's chain) and raise a conflict.
  for (const node of [...merged.nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (node.parent === undefined || merged.nodes.has(node.parent)) continue;
    const missingParent = node.parent;
    let ancestor: string | undefined = undefined;
    let cursor = missingParent;
    const seen = new Set<string>();
    while (cursor !== undefined && !seen.has(cursor)) {
      seen.add(cursor);
      const chainNode = ours.nodes.get(cursor) ?? theirs.nodes.get(cursor) ?? base.nodes.get(cursor);
      cursor = chainNode?.parent;
      if (cursor !== undefined && merged.nodes.has(cursor)) {
        ancestor = cursor;
        break;
      }
    }
    const deletedBy: ConflictSide = ours.nodes.has(missingParent) ? 'theirs' : 'ours';
    node.parent = ancestor;
    addConflict(context, {
      kind: 'orphaned',
      node: nodeRef(node),
      name: missingParent,
      deletedBy,
      ours: deepClone(node),
      theirs: undefined
    });
  }

  breakParentCycles(context);

  mergeChildOrders(context);

  // --- Connections ---
  mergeConnections(context);

  // --- Comments ---
  mergeComments(context);

  // --- Component-level ---
  merged.name = merge3(base.name, ours.name, theirs.name, (b, o, t) => {
    addConflict(context, { kind: 'component-rename', base: b, ours: o, theirs: t });
  });
  merged.metadata = deepClone(
    mergeMetadataWithConflicts(context, 'metadata', base.metadata, ours.metadata, theirs.metadata)
  ) as Record<string, unknown>;
  merged.extras = {};
  const extraKeys = new Set([...Object.keys(base.extras), ...Object.keys(ours.extras), ...Object.keys(theirs.extras)]);
  for (const key of [...extraKeys].sort()) {
    let value: unknown;
    if (key === 'v2:modified') {
      value = mergeJSONSilent(base.extras[key], ours.extras[key], theirs.extras[key]);
    } else {
      value = mergeMetadataWithConflicts(context, key, base.extras[key], ours.extras[key], theirs.extras[key]);
    }
    if (value !== undefined) merged.extras[key] = deepClone(value);
  }

  return { merged, conflicts: context.conflicts };
}

function mergeMetadataWithConflicts(
  context: MergeContext,
  path: string,
  base: unknown,
  ours: unknown,
  theirs: unknown
): unknown {
  if (deepEqualOrIdentical(ours, theirs)) return ours;
  if (deepEqualOrIdentical(theirs, base)) return ours;
  if (deepEqualOrIdentical(ours, base)) return theirs;
  const bothObjects =
    ours !== null &&
    theirs !== null &&
    typeof ours === 'object' &&
    typeof theirs === 'object' &&
    !Array.isArray(ours) &&
    !Array.isArray(theirs);
  if (!bothObjects) {
    addConflict(context, { kind: 'component-metadata', name: path, base, ours, theirs });
    return ours;
  }
  const merged: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(ours as object), ...Object.keys(theirs as object)]);
  for (const key of [...keys].sort()) {
    const value = mergeMetadataWithConflicts(
      context,
      `${path}.${key}`,
      base !== null && typeof base === 'object' ? (base as Record<string, unknown>)[key] : undefined,
      (ours as Record<string, unknown>)[key],
      (theirs as Record<string, unknown>)[key]
    );
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

function connectionRefFor(context: MergeContext, connection: SnapshotConnection): ConnectionRef {
  const ref: ConnectionRef = {
    fromId: connection.fromId,
    fromProperty: connection.fromProperty,
    toId: connection.toId,
    toProperty: connection.toProperty
  };
  for (const graph of [context.merged, context.ours, context.theirs, context.base]) {
    if (!ref.fromNode && graph.nodes.has(connection.fromId)) ref.fromNode = nodeRef(graph.nodes.get(connection.fromId));
    if (!ref.toNode && graph.nodes.has(connection.toId)) ref.toNode = nodeRef(graph.nodes.get(connection.toId));
  }
  return ref;
}

/**
 * Field-level merge for a wire both sides kept (CAN-002).
 *
 * `label` follows the standard three-way scalar rule and raises a conflict when
 * both sides wrote different text — losing one author's stated reason to the
 * other's is exactly what must not happen quietly. `labelT` is presentation:
 * whichever side moved it wins, and two different positions are not worth
 * asking about.
 *
 * `anchors` (SIG-007) takes `labelT`'s rule, and it is here rather than left in
 * `rest` **because of the first line of this function** — `deepClone(ours)`
 * means our `rest` wins unconditionally, so a colleague's hand-drawn routing
 * would be dropped on every merge where we had not touched our own. It is not a
 * conflict either: routing is where a wire goes on a screen, not what it means,
 * and stopping a merge to ask about it would be asking about the wrong thing.
 */
function mergeConnectionFields(
  context: MergeContext,
  base: SnapshotConnection | undefined,
  ours: SnapshotConnection,
  theirs: SnapshotConnection
): SnapshotConnection {
  const merged = deepClone(ours);

  const label = merge3(base?.label, ours.label, theirs.label, (baseLabel, oursLabel, theirsLabel) => {
    addConflict(context, {
      kind: 'connection-label',
      connection: connectionRefFor(context, ours),
      base: baseLabel,
      ours: oursLabel,
      theirs: theirsLabel
    });
  });
  if (label === undefined) delete merged.label;
  else merged.label = label;

  const labelT = ours.labelT === base?.labelT ? theirs.labelT : ours.labelT;
  if (labelT === undefined) delete merged.labelT;
  else merged.labelT = labelT;

  // Compared by value: an anchor list is an array, so `ours === base` is false
  // between two snapshots of the same unchanged routing and every merge would
  // take theirs.
  const untouched = JSON.stringify(ours.anchors ?? null) === JSON.stringify(base?.anchors ?? null);
  const anchors = untouched ? theirs.anchors : ours.anchors;
  if (!anchors || !anchors.length) delete merged.anchors;
  else merged.anchors = anchors;

  return merged;
}

function mergeConnections(context: MergeContext): void {
  const { base, ours, theirs, merged } = context;
  const baseMap = new Map(base.connections.map((c) => [connectionKey(c), c]));
  const oursMap = new Map(ours.connections.map((c) => [connectionKey(c), c]));
  const theirsMap = new Map(theirs.connections.map((c) => [connectionKey(c), c]));

  const oursAdded = [...oursMap.entries()].filter(([key]) => !baseMap.has(key));
  const theirsAdded = [...theirsMap.entries()].filter(([key]) => !baseMap.has(key));

  // Rewire-vs-rewire: both sides replaced the wiring at the same target endpoint
  // with different sources, where the base had a connection there that at least
  // one side removed. Ours' wiring is kept; theirs' goes into the conflict.
  const targetEndpoint = (c: SnapshotConnection) => `${c.toId}:${c.toProperty}`;
  const groupByEndpoint = (entries: [string, SnapshotConnection][]) => {
    const groups = new Map<string, SnapshotConnection[]>();
    for (const [, connection] of entries) {
      const endpoint = targetEndpoint(connection);
      if (!groups.has(endpoint)) groups.set(endpoint, []);
      groups.get(endpoint).push(connection);
    }
    return groups;
  };
  const oursAddedByEndpoint = groupByEndpoint(oursAdded);
  const theirsAddedByEndpoint = groupByEndpoint(theirsAdded);
  const suppressedTheirsAdds = new Set<string>();

  for (const [endpoint, oursGroup] of [...oursAddedByEndpoint.entries()].sort()) {
    const theirsGroup = theirsAddedByEndpoint.get(endpoint);
    if (!theirsGroup) continue;
    const oursKeys = new Set(oursGroup.map(connectionKey));
    const theirsOnly = theirsGroup.filter((c) => !oursKeys.has(connectionKey(c)));
    if (theirsOnly.length === 0) continue;
    const baseAtEndpoint = base.connections.filter((c) => targetEndpoint(c) === endpoint);
    const someoneRemovedBase = baseAtEndpoint.some(
      (c) => !oursMap.has(connectionKey(c)) || !theirsMap.has(connectionKey(c))
    );
    if (!someoneRemovedBase) continue; // pure double-add: keep both (documented)
    for (const theirsConnection of theirsOnly) {
      suppressedTheirsAdds.add(connectionKey(theirsConnection));
      addConflict(context, {
        kind: 'connection-rewire',
        connection: connectionRefFor(context, theirsConnection),
        ours: deepClone(oursGroup),
        theirs: deepClone(theirsConnection)
      });
    }
  }

  const keys = new Set([...baseMap.keys(), ...oursMap.keys(), ...theirsMap.keys()]);
  for (const key of [...keys].sort()) {
    const inBase = baseMap.has(key);
    const inOurs = oursMap.has(key);
    const inTheirs = theirsMap.has(key);
    let keep: SnapshotConnection | undefined;
    if (inOurs && inTheirs) {
      // Same wire on both sides, but its label can still differ (CAN-002).
      // Without this the ours-wins rule would drop the other side's label with
      // nothing said — the exact silent loss the field exists to avoid.
      keep = mergeConnectionFields(context, baseMap.get(key), oursMap.get(key), theirsMap.get(key));
    } else if (!inBase && inOurs) keep = oursMap.get(key);
    else if (inBase && inOurs !== inTheirs) {
      // One side removed the wire. If the other side wrote a label on it in the
      // meantime, that is an edit to something the other side deleted — the
      // deletion still wins, but the reason someone wrote down does not vanish
      // without a word. (Same shape as delete-vs-edit on a node.)
      const survivor = inOurs ? oursMap.get(key) : theirsMap.get(key);
      const baseConnection = baseMap.get(key);
      if ((survivor.label ?? undefined) !== (baseConnection.label ?? undefined)) {
        const labelledBy: ConflictSide = inOurs ? 'ours' : 'theirs';
        addConflict(context, {
          kind: 'connection-label-deleted',
          connection: connectionRefFor(context, survivor),
          deletedBy: labelledBy === 'ours' ? 'theirs' : 'ours',
          base: baseConnection.label,
          ours: labelledBy === 'ours' ? deepClone(survivor) : undefined,
          theirs: labelledBy === 'theirs' ? deepClone(survivor) : undefined
        });
      }
    }
    else if (!inBase && inTheirs && !suppressedTheirsAdds.has(key)) keep = theirsMap.get(key);
    // inBase && missing on one side: removed — dropped.
    if (!keep) continue;

    // Endpoint must exist in the merged graph. A connection added by one side to
    // a node the other side deleted is a conflict, never a silent drop
    // (the legacy path let ProjectValidator.fix() delete these quietly).
    const missingEndpoint = !merged.nodes.has(keep.fromId) || !merged.nodes.has(keep.toId);
    if (missingEndpoint) {
      const addedBy: ConflictSide = !inBase && inOurs ? 'ours' : 'theirs';
      const deletedBy: ConflictSide = addedBy === 'ours' ? 'theirs' : 'ours';
      const missingIds = [keep.fromId, keep.toId].filter((id) => !merged.nodes.has(id));
      const sideGraph = addedBy === 'ours' ? context.ours : context.theirs;
      const restorePayload = {
        connection: deepClone(keep),
        nodes: missingIds
          .filter((id) => sideGraph.nodes.has(id))
          .map((id) => deepClone(sideGraph.nodes.get(id)))
      };
      addConflict(context, {
        kind: 'connection-to-deleted',
        connection: connectionRefFor(context, keep),
        name: missingIds.join(','),
        deletedBy,
        ours: addedBy === 'ours' ? restorePayload : undefined,
        theirs: addedBy === 'theirs' ? restorePayload : undefined
      });
      continue;
    }
    merged.connections.push(deepClone(keep));
  }
}

function mergeComments(context: MergeContext): void {
  const { base, ours, theirs, merged } = context;
  const baseMap = new Map(base.comments.map((c) => [c.key, c]));
  const oursMap = new Map(ours.comments.map((c) => [c.key, c]));
  const theirsMap = new Map(theirs.comments.map((c) => [c.key, c]));
  const keys = new Set([...baseMap.keys(), ...oursMap.keys(), ...theirsMap.keys()]);
  for (const key of [...keys].sort()) {
    const inBase = baseMap.get(key);
    const inOurs = oursMap.get(key);
    const inTheirs = theirsMap.get(key);
    if (inOurs && inTheirs) {
      const winner = deepClone(inOurs);
      winner.text = merge3(inBase?.text, inOurs.text, inTheirs.text, (b, o, t) => {
        addConflict(context, { kind: 'comment', name: key, base: b, ours: o, theirs: t });
      });
      const pos = merge3(
        inBase ? { x: inBase.x, y: inBase.y } : undefined,
        { x: inOurs.x, y: inOurs.y },
        { x: inTheirs.x, y: inTheirs.y },
        () => undefined // cosmetic
      );
      winner.x = pos?.x;
      winner.y = pos?.y;
      winner.rest = deepClone(mergeJSONSilent(inBase?.rest ?? {}, inOurs.rest, inTheirs.rest)) as Record<string, unknown>;
      merged.comments.push(winner);
    } else if (inBase && inOurs && !inTheirs) {
      // Theirs deleted; keep only if ours made a text edit worth surfacing.
      if (inBase.text !== inOurs.text) {
        merged.comments.push(deepClone(inOurs));
        addConflict(context, {
          kind: 'comment',
          name: key,
          deletedBy: 'theirs',
          base: inBase.text,
          ours: inOurs.text,
          theirs: undefined
        });
      }
    } else if (inBase && !inOurs && inTheirs) {
      if (inBase.text !== inTheirs.text) {
        addConflict(context, {
          kind: 'comment',
          name: key,
          deletedBy: 'ours',
          base: inBase.text,
          ours: undefined,
          theirs: inTheirs.text
        });
      }
    } else if (!inBase && inOurs) {
      merged.comments.push(deepClone(inOurs));
    } else if (!inBase && inTheirs) {
      merged.comments.push(deepClone(inTheirs));
    }
  }
}

// ---------------------------------------------------------------------------
// Conflict resolution
// ---------------------------------------------------------------------------

function cascadeDeleteNode(merged: GraphSnapshot, nodeId: string): void {
  const node = merged.nodes.get(nodeId);
  if (!node) return;
  const parent = node.parent;
  merged.nodes.delete(nodeId);
  // Children reattach to the deleted node's parent (or become roots).
  for (const child of merged.nodes.values()) {
    if (child.parent === nodeId) child.parent = parent;
  }
  merged.connections = merged.connections.filter((c) => c.fromId !== nodeId && c.toId !== nodeId);
}

function restoreNode(merged: GraphSnapshot, node: SnapshotNode): void {
  const restored = deepClone(node);
  if (restored.parent !== undefined && !merged.nodes.has(restored.parent)) {
    restored.parent = undefined; // parent gone; surface at root rather than dropping
  }
  merged.nodes.set(restored.id, restored);
  rootIfCyclic(merged, restored.id);
}

/**
 * If the mutation at nodeId created a parent cycle, break it by rooting the
 * node. Any freshly-created cycle necessarily passes through the mutated node,
 * so guarding each parent mutation keeps the graph acyclic.
 */
function rootIfCyclic(merged: GraphSnapshot, nodeId: string): void {
  const seen = new Set<string>([nodeId]);
  let cursor = merged.nodes.get(nodeId)?.parent;
  while (cursor !== undefined) {
    if (seen.has(cursor)) {
      merged.nodes.get(nodeId).parent = undefined;
      return;
    }
    seen.add(cursor);
    cursor = merged.nodes.get(cursor)?.parent;
  }
}

/**
 * Apply a resolution choice to a merge result. Mutates result.merged and marks
 * the conflict resolved. Unknown ids are ignored (idempotent re-application is
 * allowed for 'ours' since the merged graph is already ours-flavored).
 */
export function applyResolution(result: MergeResult, conflictId: string, side: ConflictSide): void {
  const conflict = result.conflicts.find((c) => c.id === conflictId);
  if (!conflict) return;
  const merged = result.merged;
  const chosen = side === 'ours' ? conflict.ours : conflict.theirs;
  const node = conflict.node ? merged.nodes.get(conflict.node.id) : undefined;

  switch (conflict.kind) {
    case 'parameter':
    case 'source-code': {
      if (node) {
        if (chosen === undefined) delete node.parameters[conflict.name];
        else node.parameters[conflict.name] = deepClone(chosen);
      }
      break;
    }
    case 'state-parameter':
    case 'state-transition': {
      if (node) {
        const bundleName = conflict.kind === 'state-parameter' ? 'stateParameters' : 'stateTransitions';
        const bundle = (node[bundleName] = node[bundleName] ?? {});
        const state = (bundle[conflict.state] = bundle[conflict.state] ?? {});
        if (chosen === undefined) delete state[conflict.name];
        else state[conflict.name] = deepClone(chosen);
      }
      break;
    }
    case 'default-state-transition': {
      if (node) {
        const bundle = (node.defaultStateTransitions = node.defaultStateTransitions ?? {});
        if (chosen === undefined) delete bundle[conflict.state];
        else bundle[conflict.state] = deepClone(chosen);
      }
      break;
    }
    case 'label': {
      if (node) node.label = chosen as string | undefined;
      break;
    }
    case 'variant': {
      if (node) node.variant = chosen as string | undefined;
      break;
    }
    case 'typename': {
      if (node) {
        if (conflict.name === 'version') node.version = chosen;
        else node.type = chosen as string;
      }
      break;
    }
    case 'ports': {
      if (node) {
        const others = (node.ports as { name?: string }[]).filter((port) => String(port?.name) !== conflict.name);
        node.ports = chosen === undefined ? others : [...others, deepClone(chosen)];
      }
      break;
    }
    case 'delete-vs-edit': {
      const keepSide: ConflictSide = conflict.deletedBy === 'ours' ? 'theirs' : 'ours';
      if (side === keepSide) {
        const survivor = (side === 'ours' ? conflict.ours : conflict.theirs) as SnapshotNode | undefined;
        if (survivor) restoreNode(merged, survivor);
      } else {
        cascadeDeleteNode(merged, conflict.node.id);
      }
      break;
    }
    case 'add-add': {
      const replacement = chosen as SnapshotNode | undefined;
      if (replacement) {
        restoreNode(merged, replacement);
      }
      break;
    }
    case 'reparent': {
      if (node) {
        const parent = chosen as string | undefined;
        node.parent = parent !== undefined && merged.nodes.has(parent) ? parent : undefined;
        rootIfCyclic(merged, node.id);
        node.childIndex = Number.MAX_SAFE_INTEGER; // append; renormalized below
        renormalizeOrder(merged, node.parent);
      }
      break;
    }
    case 'orphaned': {
      if (side === 'theirs') {
        cascadeDeleteNode(merged, conflict.node.id);
      }
      // 'ours': keep the reattached node — already applied.
      break;
    }
    case 'child-order': {
      const order = chosen as string[] | undefined;
      if (order) {
        let index = 0;
        for (const id of order) {
          const child = merged.nodes.get(id);
          if (child) child.childIndex = index++;
        }
      }
      break;
    }
    case 'connection-rewire': {
      if (side === 'theirs') {
        const theirsConnection = conflict.theirs as SnapshotConnection;
        const endpoint = `${theirsConnection.toId}:${theirsConnection.toProperty}`;
        merged.connections = merged.connections.filter((c) => `${c.toId}:${c.toProperty}` !== endpoint);
        merged.connections.push(deepClone(theirsConnection));
      }
      break;
    }
    case 'connection-label': {
      const key = conflict.connection ? connectionKey(conflict.connection) : undefined;
      const connection = key ? merged.connections.find((c) => connectionKey(c) === key) : undefined;
      if (connection) {
        if (chosen === undefined) delete connection.label;
        else connection.label = chosen as string;
      }
      break;
    }
    case 'connection-label-deleted': {
      // Keeping the labelled side means keeping the wire it was written on.
      const labelled = (conflict.ours ?? conflict.theirs) as SnapshotConnection | undefined;
      const labelledBy: ConflictSide = conflict.ours !== undefined ? 'ours' : 'theirs';
      if (side === labelledBy && labelled) {
        const exists = merged.connections.some((c) => connectionKey(c) === connectionKey(labelled));
        if (!exists && merged.nodes.has(labelled.fromId) && merged.nodes.has(labelled.toId)) {
          merged.connections.push(deepClone(labelled));
        }
      }
      break;
    }
    case 'connection-to-deleted': {
      const payload = (conflict.ours ?? conflict.theirs) as
        | { connection: SnapshotConnection; nodes: SnapshotNode[] }
        | undefined;
      const addedBy: ConflictSide = conflict.ours !== undefined ? 'ours' : 'theirs';
      if (side === addedBy && payload) {
        // Keeping the wiring implies restoring the deleted endpoint(s).
        for (const missing of payload.nodes) {
          if (!merged.nodes.has(missing.id)) restoreNode(merged, missing);
        }
        if (merged.nodes.has(payload.connection.fromId) && merged.nodes.has(payload.connection.toId)) {
          if (!merged.connections.some((c) => connectionKey(c) === connectionKey(payload.connection))) {
            merged.connections.push(deepClone(payload.connection));
          }
        }
      }
      // Choosing the deleting side keeps the connection dropped — already applied.
      break;
    }
    case 'comment': {
      const existing = merged.comments.find((c) => c.key === conflict.name);
      if (chosen === undefined) {
        merged.comments = merged.comments.filter((c) => c.key !== conflict.name);
      } else if (existing) {
        existing.text = chosen as string;
      } else {
        merged.comments.push({ key: conflict.name, text: chosen as string, rest: {} });
      }
      break;
    }
    case 'component-rename': {
      merged.name = chosen as string;
      break;
    }
    case 'component-metadata': {
      applyMetadataPath(merged, conflict.name, chosen);
      break;
    }
  }
  conflict.resolution = side;
}

function renormalizeOrder(merged: GraphSnapshot, parent: string | undefined): void {
  const children: SnapshotNode[] = [];
  for (const node of merged.nodes.values()) if (node.parent === parent) children.push(node);
  children.sort((a, b) => a.childIndex - b.childIndex || (a.id < b.id ? -1 : 1));
  children.forEach((child, index) => (child.childIndex = index));
}

function applyMetadataPath(merged: GraphSnapshot, path: string, value: unknown): void {
  const parts = path.split('.');
  const rootKey = parts[0];
  let container: Record<string, unknown>;
  if (rootKey === 'metadata') {
    container = merged.metadata;
    parts.shift();
  } else {
    // extras entry: first segment is the extras key (may itself contain no dots).
    if (parts.length === 1) {
      if (value === undefined) delete merged.extras[rootKey];
      else merged.extras[rootKey] = deepClone(value);
      return;
    }
    if (typeof merged.extras[rootKey] !== 'object' || merged.extras[rootKey] === null) merged.extras[rootKey] = {};
    container = merged.extras[rootKey] as Record<string, unknown>;
    parts.shift();
  }
  while (parts.length > 1) {
    const key = parts.shift();
    if (typeof container[key] !== 'object' || container[key] === null) container[key] = {};
    container = container[key] as Record<string, unknown>;
  }
  if (parts.length === 0) return;
  if (value === undefined) delete container[parts[0]];
  else container[parts[0]] = deepClone(value);
}

/** Take one side wholesale — the escape hatch. */
export function resolveAll(result: MergeResult, side: ConflictSide): void {
  const priority = (conflict: GraphConflict): number => {
    switch (conflict.kind) {
      case 'delete-vs-edit':
      case 'add-add':
      case 'orphaned':
        return 0; // node existence first
      case 'connection-rewire':
      case 'connection-to-deleted':
        return 2; // wiring last (may need restored nodes)
      case 'child-order':
        return 3;
      default:
        return 1;
    }
  };
  const ordered = [...result.conflicts].sort((a, b) => priority(a) - priority(b));
  for (const conflict of ordered) {
    if (!conflict.resolution) applyResolution(result, conflict.id, side);
  }
}

// ---------------------------------------------------------------------------
// Project-level merge over component snapshot maps
// ---------------------------------------------------------------------------

export interface ProjectMergeResult {
  merged: Map<string, GraphSnapshot>;
  /** Per-component merge results that produced conflicts. */
  conflicted: Map<string, MergeResult>;
  /** Component-level delete-vs-edit conflicts (whole component). */
  componentConflicts: GraphConflict[];
}

/** Semantically unchanged — cosmetic-only edits do not block component deletion. */
function componentEqual(a: GraphSnapshot, b: GraphSnapshot): boolean {
  const diff = diffGraphs(a, b, { structuralMatching: false });
  return diff.changes.every((change) => change.category === 'cosmetic');
}

export function mergeProjectSnapshots(
  base: Map<string, GraphSnapshot>,
  ours: Map<string, GraphSnapshot>,
  theirs: Map<string, GraphSnapshot>
): ProjectMergeResult {
  const result: ProjectMergeResult = { merged: new Map(), conflicted: new Map(), componentConflicts: [] };
  const names = new Set([...base.keys(), ...ours.keys(), ...theirs.keys()]);
  for (const name of [...names].sort()) {
    const inBase = base.get(name);
    const inOurs = ours.get(name);
    const inTheirs = theirs.get(name);
    if (inOurs && inTheirs) {
      const componentResult = mergeGraphs(inBase ?? emptySnapshot(name), inOurs, inTheirs);
      result.merged.set(name, componentResult.merged);
      if (componentResult.conflicts.length > 0) result.conflicted.set(name, componentResult);
    } else if (inBase && inOurs && !inTheirs) {
      if (!componentEqual(inBase, inOurs)) {
        result.merged.set(name, inOurs);
        result.componentConflicts.push({
          id: `delete-vs-edit:component:${name}`,
          kind: 'delete-vs-edit',
          name,
          deletedBy: 'theirs'
        });
      }
    } else if (inBase && !inOurs && inTheirs) {
      if (!componentEqual(inBase, inTheirs)) {
        result.componentConflicts.push({
          id: `delete-vs-edit:component:${name}`,
          kind: 'delete-vs-edit',
          name,
          deletedBy: 'ours',
          theirs: inTheirs as unknown
        });
      }
    } else if (!inBase && inOurs) {
      result.merged.set(name, inOurs);
    } else if (!inBase && inTheirs) {
      result.merged.set(name, inTheirs);
    }
  }
  return result;
}

function emptySnapshot(name: string): GraphSnapshot {
  return { name, nodes: new Map(), connections: [], comments: [], metadata: {}, extras: {} };
}
