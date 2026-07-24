import _ from 'underscore';

import { rectanglesOverlap } from '../../../utils/utils';
import type { NodeGraphEditorConnection } from '../NodeGraphEditorConnection';
import type { NodeGraphEditorNode } from '../NodeGraphEditorNode';
import { IVector2, Rect } from './types';

/**
 * Spatial queries over the node graph scene (PLAT-001 extraction).
 *
 * Pure functions: the editor's `roots` and `connections` arrays are reassigned
 * on every `bindModel`, so queries take them as arguments instead of holding
 * references. Node-local hit maths (ports, borders, attach points) stays on
 * the node/connection view classes; this module covers the editor-level
 * queries.
 *
 * Traversal order is depth-first from the root list (each root before its
 * children), matching the pre-decomposition `forEachNode` — first-match
 * queries depend on it.
 */

export type MultiselectMode = 'select' | 'union' | 'reduce';

/** Visit every node; stop early (and return true) when the callback returns true. */
export function forEachNode(
  roots: readonly NodeGraphEditorNode[],
  callback: (node: NodeGraphEditorNode) => boolean | void
): boolean {
  const cb = callback as (node: NodeGraphEditorNode) => boolean;
  for (const i in roots) {
    if (roots[i].forEach(cb)) return true;
  }
  return false;
}

export function findNodeWithId(roots: readonly NodeGraphEditorNode[], id: string): NodeGraphEditorNode | undefined {
  let res;
  forEachNode(roots, function (node) {
    if (id === node.id) {
      res = node;
      return true;
    }
  });
  return res;
}

export function findConnectionWithModel(
  connections: readonly NodeGraphEditorConnection[],
  model: TSFixme
): NodeGraphEditorConnection | undefined {
  for (const i in connections) if (connections[i].model === model) return connections[i];
}

export function findConnectionWithKey(
  connections: readonly NodeGraphEditorConnection[],
  key: string
): NodeGraphEditorConnection | undefined {
  for (const i in connections) {
    const m = connections[i].model;
    if (m.fromId + m.fromProperty + m.toId + m.toProperty === key) return connections[i];
  }
}

function nodeRect(node: NodeGraphEditorNode): Rect {
  return { x: node.global.x, y: node.global.y, width: node.nodeSize.width, height: node.nodeSize.height };
}

function pointInRect(pos: IVector2, rect: Rect): boolean {
  return pos.x >= rect.x && pos.x <= rect.x + rect.width && pos.y >= rect.y && pos.y <= rect.y + rect.height;
}

/** Is the point (graph coordinates) inside any of the given nodes? Edges inclusive. */
export function isPointInsideNodes(pos: IVector2, nodes: readonly NodeGraphEditorNode[]): boolean {
  return nodes.some((node) => pointInRect(pos, nodeRect(node)));
}

/** First node in the given list whose rect contains the point. */
export function findNodeContaining(
  pos: IVector2,
  nodes: readonly NodeGraphEditorNode[]
): NodeGraphEditorNode | undefined {
  return nodes.find((node) => pointInRect(pos, nodeRect(node)));
}

/** First node in traversal order whose rect contains the point. */
export function findNodeAtPoint(pos: IVector2, roots: readonly NodeGraphEditorNode[]): NodeGraphEditorNode | null {
  let hit: NodeGraphEditorNode | null = null;
  forEachNode(roots, (node) => {
    if (pointInRect(pos, nodeRect(node))) {
      hit = node;
      return true; // stop iteration
    }
  });
  return hit;
}

/** All nodes whose rect overlaps the given rect (partial overlap counts). */
export function nodesInRect(roots: readonly NodeGraphEditorNode[], rect: Rect): NodeGraphEditorNode[] {
  const selected: NodeGraphEditorNode[] = [];
  forEachNode(roots, (node) => {
    if (rectanglesOverlap(nodeRect(node), rect)) {
      selected.push(node);
    }
  });
  return selected;
}

/**
 * Combine a fresh rect-selection with the previous selection according to the
 * multiselect mode (plain select, shift-union, ctrl-reduce).
 */
export function resolveMultiselect(
  mode: MultiselectMode,
  lastSelection: readonly NodeGraphEditorNode[] | undefined,
  selected: NodeGraphEditorNode[]
): NodeGraphEditorNode[] {
  if (mode === 'union') {
    return lastSelection ? _.union(lastSelection, selected) : selected;
  }
  if (mode === 'reduce') {
    return lastSelection ? _.difference(lastSelection, selected) : [];
  }
  return selected;
}
