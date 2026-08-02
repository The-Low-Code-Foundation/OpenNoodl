/**
 * AIX-003 / WFA-007 — change-set bookkeeping and dependency closures.
 *
 * Everything here is pure graph algebra over SUB-007's `GraphChange`: stable
 * ids for changes, the "accepting X requires accepting Y" rules, and the two
 * closures the review UI walks when a reader excludes or restores something.
 *
 * ## Why it is not in `ChangeSet.ts`
 *
 * It was, until WFA-007 needed it for a subject that is not a component.
 * `ChangeSet.ts`'s entry point reaches `ProjectModel` and the v2 exporter, so
 * importing it drags the editor in; this file imports `@noodl-versioning` and
 * nothing else, which is what lets a workflow proposal's diff be exercised in
 * plain Node. `ChangeSet.ts` re-exports all of it, so no call site moved.
 *
 * ## What is deliberately generic, and what is not
 *
 * `computeRequirements` states GRAPH facts — an added connection needs the
 * nodes it plugs into; removing a node needs the connections that touched it
 * removed too. Those hold for any graph. The rules that depend on what the
 * graph MEANS do not live here: WFA-007's `upstream.<stepId>` rule, for
 * instance, comes from the workflow engine's validator and is added by the
 * workflow adapter. Inheriting closures written for one subject and using them
 * for another is how you get closures that are subtly wrong in the direction of
 * allowing a bad accept.
 *
 * @module AiAssistant/authoring/changeClosure
 */

import { connectionKey, type GraphChange, type GraphSnapshot } from '@noodl-versioning';

/** A change set with no base — the shape a "create" proposal diffs against. */
export function emptySnapshot(name: string): GraphSnapshot {
  return { name, nodes: new Map(), connections: [], comments: [], metadata: {}, extras: {} };
}

/** One reviewable change: a SUB-007 change plus review bookkeeping. */
export interface ReviewChange {
  /** Stable within the change set — derived from the change's kind and anchor. */
  id: string;
  change: GraphChange;
  /** Ids of changes that must also be accepted for this one to be acceptable. */
  requires: string[];
}

export interface AuthoringChangeSet {
  /** Legacy component name, e.g. "/Pages/Customers". */
  componentName: string;
  /** True when the proposal creates a component the project does not have. */
  isNewComponent: boolean;
  /** The before state — empty for a new component. */
  base: GraphSnapshot;
  /** The proposed state. */
  target: GraphSnapshot;
  changes: ReviewChange[];
}

function rawChangeId(change: GraphChange): string {
  switch (change.kind) {
    case 'node-recreated':
      return `${change.kind}:${change.node.id}->${change.recreatedAs.id}`;
    case 'node-state-changed':
      return `${change.kind}:${change.node.id}:${change.bundle}:${change.state ?? ''}`;
    case 'node-added':
    case 'node-removed':
    case 'node-renamed':
    case 'node-type-changed':
    case 'node-parameters-changed':
    case 'node-variant-changed':
    case 'node-reparented':
    case 'node-reordered':
    case 'node-moved':
    case 'node-ports-changed':
      return `${change.kind}:${change.node.id}`;
    case 'connection-added':
    case 'connection-removed':
    case 'connection-relabelled':
      return `${change.kind}:${connectionKey(change.connection)}`;
    case 'connection-rewired':
      return `${change.kind}:${connectionKey(change.before)}->${connectionKey(change.after)}`;
    case 'comment-added':
    case 'comment-removed':
    case 'comment-changed':
    case 'comment-moved':
      return `${change.kind}:${change.commentKey}`;
    case 'component-renamed':
      return change.kind;
    case 'component-metadata-changed':
      return `${change.kind}:${change.path}`;
  }
}

/**
 * Acceptance requirements, phrased as "accepting X requires accepting Y":
 *
 * - an added connection requires the added/recreated nodes it plugs into
 * - an added node requires its parent, when the parent is itself new
 * - a reparent onto a new node requires that node
 * - removing a node requires removing every connection that touched it
 *   (plain removals, and rewires whose old routing touched it)
 * - removing a node requires a disposition — removal, reparent, or
 *   recreation — for each of its children in the base graph
 * - a recreation carries the removal-side obligations of its old id and the
 *   added-side obligations of its new id
 */
function computeRequirements(
  entries: { id: string; change: GraphChange }[],
  base: GraphSnapshot,
  target: GraphSnapshot
): Map<string, string[]> {
  // Change that introduces a target node id.
  const addOf = new Map<string, string>();
  // Change that disposes of a base node id (it no longer sits where it was).
  const dispositionOf = new Map<string, string>();
  // Changes that remove a base connection touching a node id.
  const connectionRemovalsTouching = new Map<string, string[]>();
  const touch = (nodeId: string, changeId: string) => {
    const list = connectionRemovalsTouching.get(nodeId) ?? [];
    list.push(changeId);
    connectionRemovalsTouching.set(nodeId, list);
  };

  for (const { id, change } of entries) {
    switch (change.kind) {
      case 'node-added':
        addOf.set(change.node.id, id);
        break;
      case 'node-recreated':
        addOf.set(change.recreatedAs.id, id);
        dispositionOf.set(change.node.id, id);
        break;
      case 'node-removed':
      case 'node-reparented':
        dispositionOf.set(change.node.id, id);
        break;
      case 'connection-removed':
        touch(change.connection.fromId, id);
        touch(change.connection.toId, id);
        break;
      case 'connection-rewired': {
        const kept = new Set([change.after.fromId, change.after.toId]);
        if (!kept.has(change.before.fromId)) touch(change.before.fromId, id);
        if (!kept.has(change.before.toId)) touch(change.before.toId, id);
        break;
      }
    }
  }

  const requireNewParent = (targetNodeId: string, requires: Set<string>) => {
    const parent = target.nodes.get(targetNodeId)?.parent;
    if (parent !== undefined && addOf.has(parent)) requires.add(addOf.get(parent));
  };
  const requireRemovalSide = (baseNodeId: string, requires: Set<string>) => {
    for (const changeId of connectionRemovalsTouching.get(baseNodeId) ?? []) requires.add(changeId);
    for (const node of base.nodes.values()) {
      if (node.parent === baseNodeId && dispositionOf.has(node.id)) requires.add(dispositionOf.get(node.id));
    }
  };

  const requirements = new Map<string, string[]>();
  for (const { id, change } of entries) {
    const requires = new Set<string>();
    switch (change.kind) {
      case 'connection-added':
        if (addOf.has(change.connection.fromId)) requires.add(addOf.get(change.connection.fromId));
        if (addOf.has(change.connection.toId)) requires.add(addOf.get(change.connection.toId));
        break;
      case 'connection-rewired':
        if (addOf.has(change.after.fromId)) requires.add(addOf.get(change.after.fromId));
        if (addOf.has(change.after.toId)) requires.add(addOf.get(change.after.toId));
        break;
      case 'node-added':
        requireNewParent(change.node.id, requires);
        break;
      case 'node-reparented':
        requireNewParent(change.node.id, requires);
        break;
      case 'node-removed':
        requireRemovalSide(change.node.id, requires);
        break;
      case 'node-recreated':
        requireNewParent(change.recreatedAs.id, requires);
        requireRemovalSide(change.node.id, requires);
        break;
    }
    requires.delete(id);
    requirements.set(id, [...requires]);
  }
  return requirements;
}

export function wrapChanges(changes: GraphChange[], base: GraphSnapshot, target: GraphSnapshot): ReviewChange[] {
  const seen = new Map<string, number>();
  const entries = changes.map((change) => {
    let id = rawChangeId(change);
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count > 0) id = `${id}#${count}`;
    return { id, change };
  });
  const requirements = computeRequirements(entries, base, target);
  return entries.map(({ id, change }) => ({ id, change, requires: requirements.get(id) ?? [] }));
}

/**
 * The transitive closure of `ids` under `requires` — everything that must be
 * accepted for the given changes to be accepted. Includes the given ids.
 */
export function requiredWith(changeSet: AuthoringChangeSet, ids: Iterable<string>): Set<string> {
  const byId = new Map(changeSet.changes.map((entry) => [entry.id, entry]));
  const closed = new Set<string>();
  const queue = [...ids];
  while (queue.length > 0) {
    const id = queue.pop();
    if (closed.has(id)) continue;
    closed.add(id);
    for (const required of byId.get(id)?.requires ?? []) queue.push(required);
  }
  return closed;
}

/**
 * The reverse closure — everything that must also be rejected when the given
 * changes are rejected (every change that directly or transitively requires
 * one of them). Includes the given ids.
 */
export function excludedWith(changeSet: AuthoringChangeSet, ids: Iterable<string>): Set<string> {
  const dependents = new Map<string, string[]>();
  for (const entry of changeSet.changes) {
    for (const required of entry.requires) {
      const list = dependents.get(required) ?? [];
      list.push(entry.id);
      dependents.set(required, list);
    }
  }
  const closed = new Set<string>();
  const queue = [...ids];
  while (queue.length > 0) {
    const id = queue.pop();
    if (closed.has(id)) continue;
    closed.add(id);
    for (const dependent of dependents.get(id) ?? []) queue.push(dependent);
  }
  return closed;
}
