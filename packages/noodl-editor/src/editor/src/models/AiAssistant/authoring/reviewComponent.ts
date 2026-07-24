/**
 * AIX-003 — Graph-Native Review: the annotated review component
 *
 * Renders a change set the way the editor already knows how to show change:
 * a merged before/after component whose nodes and connections carry the
 * `annotation` / `diffData` fields the read-only diff canvas paints
 * (`ComponentDiffDocument`, the same surface version control uses). The
 * merged graph is the proposed state plus the removed elements re-inserted
 * in place, so a reviewer sees additions, removals and modifications on one
 * canvas without reading JSON.
 *
 * Pure data-in/data-out: `AuthoringChangeSet` → legacy component JSON ready
 * for `ComponentModel.fromJSON`. Nothing here touches the live project.
 *
 * @module AiAssistant/authoring/reviewComponent
 */

import { connectionKey, cloneSnapshot, toLegacyComponent, type SnapshotConnection } from '@noodl-versioning';

import type { AuthoringChangeSet } from './ChangeSet';

type ReviewAnnotation = 'Created' | 'Deleted' | 'Changed';

interface LegacyNodeJson {
  id: string;
  annotation?: ReviewAnnotation;
  diffData?: { parent: Record<string, unknown> };
  children?: LegacyNodeJson[];
  [key: string]: unknown;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Build the annotated merged component for a change set.
 *
 * - Added nodes/connections are annotated `Created`
 * - Removed ones are re-inserted where they were and annotated `Deleted`
 *   (a removed node whose parent is also gone stays under it — whole removed
 *   subtrees remain intact; one whose parent survives stays in place)
 * - Modified nodes are annotated `Changed` and carry `diffData.parent`
 *   (the base node), which the diff canvas offers as parameter detail
 * - A rewired connection appears as its old routing (`Deleted`) plus its new
 *   routing (`Created`), so both are visible at once
 * - Purely cosmetic changes (canvas moves) are not annotated
 */
export function buildReviewComponent(changeSet: AuthoringChangeSet): Record<string, unknown> {
  const { base, target, changes, componentName } = changeSet;

  const nodeAnnotations = new Map<string, ReviewAnnotation>();
  const removedNodeIds: string[] = [];
  const deletedConnectionKeys = new Set<string>();
  const createdConnectionKeys = new Set<string>();
  const removedCommentKeys = new Set<string>();
  const commentAnnotations = new Map<string, string>();

  for (const { change } of changes) {
    switch (change.kind) {
      case 'node-added':
        nodeAnnotations.set(change.node.id, 'Created');
        break;
      case 'node-removed':
        nodeAnnotations.set(change.node.id, 'Deleted');
        removedNodeIds.push(change.node.id);
        break;
      case 'node-recreated':
        nodeAnnotations.set(change.node.id, 'Deleted');
        removedNodeIds.push(change.node.id);
        nodeAnnotations.set(change.recreatedAs.id, 'Created');
        break;
      case 'node-renamed':
      case 'node-type-changed':
      case 'node-parameters-changed':
      case 'node-state-changed':
      case 'node-variant-changed':
      case 'node-ports-changed':
      case 'node-reparented':
      case 'node-reordered':
        if (!nodeAnnotations.has(change.node.id)) nodeAnnotations.set(change.node.id, 'Changed');
        break;
      case 'connection-added':
        createdConnectionKeys.add(connectionKey(change.connection));
        break;
      case 'connection-removed':
        deletedConnectionKeys.add(connectionKey(change.connection));
        break;
      case 'connection-rewired':
        deletedConnectionKeys.add(connectionKey(change.before));
        createdConnectionKeys.add(connectionKey(change.after));
        break;
      case 'comment-added':
        commentAnnotations.set(change.commentKey, 'created');
        break;
      case 'comment-removed':
        removedCommentKeys.add(change.commentKey);
        commentAnnotations.set(change.commentKey, 'deleted');
        break;
      case 'comment-changed':
        commentAnnotations.set(change.commentKey, 'changed');
        break;
      // node-moved / comment-moved are cosmetic; component-level entries have
      // no canvas anchor.
    }
  }

  const review = cloneSnapshot(target);
  review.name = componentName;

  // Re-insert removed nodes, then re-root any whose parent did not survive.
  for (const id of removedNodeIds) {
    const node = base.nodes.get(id);
    if (node) review.nodes.set(id, deepClone(node));
  }
  for (const id of removedNodeIds) {
    const node = review.nodes.get(id);
    if (node && node.parent !== undefined && !review.nodes.has(node.parent)) node.parent = undefined;
  }

  // Re-append removed connections (their endpoints are back on the canvas).
  const deletedConnections: SnapshotConnection[] = base.connections.filter((connection) =>
    deletedConnectionKeys.has(connectionKey(connection))
  );
  review.connections.push(...deletedConnections.map(deepClone));

  // Re-insert removed comments; annotations ride along in `rest`.
  for (const comment of base.comments) {
    if (removedCommentKeys.has(comment.key)) review.comments.push(deepClone(comment));
  }
  for (const comment of review.comments) {
    const annotation = commentAnnotations.get(comment.key);
    if (annotation) comment.rest = { ...comment.rest, annotation };
  }

  const legacy = toLegacyComponent(review);
  legacy.name = componentName;

  // Stamp node annotations, with the base node as parameter-detail context.
  const baseLegacy = toLegacyComponent(base);
  const baseNodesById = new Map<string, Record<string, unknown>>();
  const index = (nodes: LegacyNodeJson[] | undefined) => {
    for (const node of nodes ?? []) {
      baseNodesById.set(node.id, node);
      index(node.children);
    }
  };
  index((baseLegacy.graph as { roots?: LegacyNodeJson[] }).roots);

  const stamp = (nodes: LegacyNodeJson[] | undefined) => {
    for (const node of nodes ?? []) {
      const annotation = nodeAnnotations.get(node.id);
      if (annotation) {
        node.annotation = annotation;
        if (annotation === 'Changed') {
          const parent = baseNodesById.get(node.id);
          if (parent) node.diffData = { parent };
        }
      }
      stamp(node.children);
    }
  };
  const graph = legacy.graph as { roots?: LegacyNodeJson[]; connections?: Record<string, unknown>[] };
  stamp(graph.roots);

  for (const connection of graph.connections ?? []) {
    const key = connectionKey(connection as unknown as SnapshotConnection);
    if (createdConnectionKeys.has(key)) connection.annotation = 'Created';
    else if (deletedConnectionKeys.has(key)) connection.annotation = 'Deleted';
  }

  return legacy;
}
