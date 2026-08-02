/**
 * AIX-003 — Graph-Native Review: materializing a partial acceptance
 *
 * Turns "accept everything except these changes" into concrete component
 * files. The result is built forward from the base snapshot by applying every
 * accepted change, so a rejected change simply never happens — there is no
 * inverse-patching, and the all-accepted case reproduces the proposal.
 *
 * Rejection is closed over the change set's dependency edges before anything
 * is applied (`excludedWith`): rejecting a node rejects the connections that
 * need it, and so on. Invalid subsets are therefore unrepresentable here —
 * the caller still runs the result through the same validation gate as
 * authoring before staging it, as belt and braces.
 *
 * Component-level changes (rename, metadata) are not individually rejectable:
 * they are the proposal's identity, and the assembled files reuse the
 * proposal's component.json verbatim.
 *
 * @module AiAssistant/authoring/applyChangeSet
 */

import {
  cloneSnapshot,
  connectionKey,
  toV2Files,
  type GraphChange,
  type GraphSnapshot,
  type SnapshotNode
} from '@noodl-versioning';

import type { ConnectionV2, NodesV2File, NodeV2 } from '../../../schemas';
import { excludedWith, type AuthoringChangeSet } from './ChangeSet';
import type { ComponentFiles } from './types';

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function removeConnection(snapshot: GraphSnapshot, key: string): void {
  snapshot.connections = snapshot.connections.filter((connection) => connectionKey(connection) !== key);
}

function pushTargetConnection(snapshot: GraphSnapshot, target: GraphSnapshot, key: string): void {
  const connection = target.connections.find((candidate) => connectionKey(candidate) === key);
  if (connection) snapshot.connections.push(deepClone(connection));
}

function relabelConnection(snapshot: GraphSnapshot, target: GraphSnapshot, key: string): void {
  const connection = snapshot.connections.find((candidate) => connectionKey(candidate) === key);
  if (!connection) return;
  const targetConnection = target.connections.find((candidate) => connectionKey(candidate) === key);
  if (targetConnection?.label === undefined) delete connection.label;
  else connection.label = targetConnection.label;
}

function replaceComment(snapshot: GraphSnapshot, target: GraphSnapshot, key: string): void {
  const targetComment = target.comments.find((comment) => comment.key === key);
  if (!targetComment) return;
  const index = snapshot.comments.findIndex((comment) => comment.key === key);
  if (index >= 0) snapshot.comments[index] = deepClone(targetComment);
  else snapshot.comments.push(deepClone(targetComment));
}

function applyChange(result: GraphSnapshot, target: GraphSnapshot, change: GraphChange): void {
  switch (change.kind) {
    case 'node-added': {
      const node = target.nodes.get(change.node.id);
      if (node) result.nodes.set(node.id, deepClone(node));
      return;
    }
    case 'node-removed':
      result.nodes.delete(change.node.id);
      return;
    case 'node-recreated': {
      result.nodes.delete(change.node.id);
      const node = target.nodes.get(change.recreatedAs.id);
      if (node) result.nodes.set(node.id, deepClone(node));
      return;
    }
    default:
      break;
  }

  // Field-level node changes: copy the affected field from the target node.
  if ('node' in change && change.node) {
    const resultNode = result.nodes.get(change.node.id);
    const targetNode = target.nodes.get(change.node.id);
    if (resultNode && targetNode) {
      switch (change.kind) {
        case 'node-renamed':
          resultNode.label = targetNode.label;
          return;
        case 'node-type-changed':
          resultNode.type = targetNode.type;
          return;
        case 'node-parameters-changed':
          resultNode.parameters = deepClone(targetNode.parameters);
          return;
        case 'node-state-changed':
          if (change.bundle === 'defaultStateTransitions') {
            resultNode.defaultStateTransitions = deepClone(targetNode.defaultStateTransitions);
          } else if (change.state !== undefined) {
            const bundle = { ...(resultNode[change.bundle] ?? {}) };
            const targetBundle = targetNode[change.bundle] ?? {};
            if (targetBundle[change.state] === undefined) delete bundle[change.state];
            else bundle[change.state] = deepClone(targetBundle[change.state]);
            resultNode[change.bundle] = bundle;
          }
          return;
        case 'node-variant-changed':
          resultNode.variant = targetNode.variant;
          return;
        case 'node-ports-changed':
          resultNode.ports = deepClone(targetNode.ports);
          return;
        case 'node-reparented':
          resultNode.parent = targetNode.parent;
          resultNode.childIndex = targetNode.childIndex;
          return;
        case 'node-reordered':
          resultNode.childIndex = targetNode.childIndex;
          return;
        case 'node-moved':
          resultNode.x = targetNode.x;
          resultNode.y = targetNode.y;
          return;
        default:
          break;
      }
    }
  }

  switch (change.kind) {
    case 'connection-added':
      pushTargetConnection(result, target, connectionKey(change.connection));
      return;
    case 'connection-removed':
      removeConnection(result, connectionKey(change.connection));
      return;
    case 'connection-rewired':
      removeConnection(result, connectionKey(change.before));
      pushTargetConnection(result, target, connectionKey(change.after));
      return;
    case 'connection-relabelled':
      // The wire itself is on both sides — only its text moves. Accepting the
      // rest of the proposal while rejecting a relabel has to leave the base
      // label in place, which is why this copies the field rather than the
      // whole connection.
      relabelConnection(result, target, connectionKey(change.connection));
      return;
    case 'comment-added':
    case 'comment-changed':
    case 'comment-moved':
      replaceComment(result, target, change.commentKey);
      return;
    case 'comment-removed':
      result.comments = result.comments.filter((comment) => comment.key !== change.commentKey);
      return;
    case 'component-renamed':
    case 'component-metadata-changed':
      // Component identity is not individually rejectable; handled wholesale.
      return;
  }
}

/**
 * Rebuild sibling order after applying a selection.
 *
 * `childIndex` is a per-parent number, and each change carries the index from
 * its own side of the diff: an added node arrives with the *proposal's* index
 * while the neighbours it was inserted among still hold the *base's*. Nothing
 * in the diff reconciles them — inserting a node between two existing children
 * produces no `node-reordered` rows for the children it displaced, because on
 * the proposal's side those children never moved. Left alone the two numbering
 * schemes collide, ties break on node id, and a fully accepted proposal can
 * come out with its new nodes sitting somewhere else on the canvas than the
 * review showed. (Found live: a proposal that inserted two rows into a card
 * materialized with both in the wrong slot.)
 *
 * So order is rebuilt rather than carried. The proposal's order wins for every
 * node it places under this parent; anything surviving from the base that the
 * proposal does not place there — a rejected removal, a rejected reparent, a
 * rejected reorder — slots back in behind the base sibling it used to follow.
 */
function reindexChildren(
  result: GraphSnapshot,
  target: GraphSnapshot,
  base: GraphSnapshot,
  keepBaseOrder: Set<string>
): void {
  const byParent = new Map<string | undefined, SnapshotNode[]>();
  for (const node of result.nodes.values()) {
    const siblings = byParent.get(node.parent) ?? [];
    siblings.push(node);
    byParent.set(node.parent, siblings);
  }

  for (const [parent, siblings] of byParent) {
    // Nodes the proposal itself places here, in the proposal's order.
    const placedByTarget = (node: SnapshotNode): boolean => {
      if (keepBaseOrder.has(node.id)) return false;
      const inTarget = target.nodes.get(node.id);
      // `inTarget?.parent === parent` would be true for a node the proposal
      // does not have at all whenever `parent` is undefined — both sides read
      // undefined, and every kept-from-base root would claim a proposal slot.
      return inTarget !== undefined && inTarget.parent === parent;
    };
    const fromTarget = siblings
      .filter(placedByTarget)
      .sort((a, b) => target.nodes.get(a.id).childIndex - target.nodes.get(b.id).childIndex);
    const key = new Map<string, number>(fromTarget.map((node, index) => [node.id, index]));

    // Everything else keeps the base's neighbourhood: walk the base's children
    // in order, remembering the last surviving proposal-placed sibling, and
    // hang the strays off it with fractions so their own order is preserved.
    const survivors = new Set(siblings.map((node) => node.id));
    const baseSiblings = [...base.nodes.values()]
      .filter((node) => node.parent === parent && survivors.has(node.id))
      .sort((a, b) => a.childIndex - b.childIndex);
    let anchor = -1;
    let offset = 0;
    for (const node of baseSiblings) {
      if (key.has(node.id)) {
        anchor = key.get(node.id);
        offset = 0;
        continue;
      }
      offset += 1;
      key.set(node.id, anchor + offset / (baseSiblings.length + 1));
    }

    // A node in neither list (there should be none) sorts last, order kept.
    siblings
      .map((node, index) => ({ node, sort: key.has(node.id) ? key.get(node.id) : Number.MAX_SAFE_INTEGER + index }))
      .sort((a, b) => a.sort - b.sort)
      .forEach((entry, index) => {
        entry.node.childIndex = index;
      });
  }
}

export interface MaterializedSelection {
  files: ComponentFiles;
  /** The rejection closure that was actually applied (input ids expanded). */
  rejected: Set<string>;
}

/**
 * Build the component files for "the proposal minus these changes".
 *
 * `files` is the staged proposal the change set was built from — its
 * component.json (identity, description, timestamps) is reused verbatim, and
 * `visualRoots` is filtered to surviving nodes. With an empty rejection this
 * reproduces the proposal's graph exactly.
 */
export function materializeSelection(
  changeSet: AuthoringChangeSet,
  files: ComponentFiles,
  rejectedIds: Iterable<string>
): MaterializedSelection {
  const rejected = excludedWith(changeSet, rejectedIds);

  const result = cloneSnapshot(changeSet.base);
  result.name = changeSet.componentName;
  result.metadata = deepClone(changeSet.target.metadata);
  result.extras = deepClone(changeSet.target.extras);

  // A rejected reorder is the one case where the base's sibling order is the
  // answer the reviewer asked for, so it is recorded before anything is applied.
  const keepBaseOrder = new Set<string>();
  for (const entry of changeSet.changes) {
    if (rejected.has(entry.id) && entry.change.kind === 'node-reordered') keepBaseOrder.add(entry.change.node.id);
  }

  for (const entry of changeSet.changes) {
    if (rejected.has(entry.id)) continue;
    applyChange(result, changeSet.target, entry.change);
  }
  reindexChildren(result, changeSet.target, changeSet.base, keepBaseOrder);

  const v2 = toV2Files(result);

  const visualRoots = (files.nodes.visualRoots ?? []).filter((id) => result.nodes.has(id));
  const nodesFile: NodesV2File = {
    $schema: files.nodes.$schema,
    componentId: files.nodes.componentId,
    version: files.nodes.version,
    nodes: v2.nodes.nodes as NodeV2[],
    ...(visualRoots.length > 0 ? { visualRoots } : {}),
    ...(v2.nodes.comments !== undefined ? { comments: v2.nodes.comments as NodesV2File['comments'] } : {})
  };

  return {
    files: {
      component: deepClone(files.component),
      nodes: nodesFile,
      connections: {
        $schema: files.connections.$schema,
        componentId: files.connections.componentId,
        version: files.connections.version,
        connections: v2.connections.connections as ConnectionV2[]
      }
    },
    rejected
  };
}
