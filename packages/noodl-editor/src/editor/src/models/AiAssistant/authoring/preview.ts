/**
 * AIX-002 — The Authoring Loop: live preview graph
 *
 * The forming component, rendered while the agent is still writing it. The
 * builder owns one *detached* `ComponentModel` — created empty, bound to a
 * read-only canvas once, and then mutated node by node so the canvas
 * re-renders incrementally through the ordinary model events
 * (`nodeAdded`/`connectionAdded`). Nothing here touches the project: the
 * component is never added to `ProjectModel`, so reject stays the absence of
 * a call, exactly as in staging.
 *
 * Tolerance is the point. The scanner hands over whatever the stream has
 * completed — parents may not have arrived yet, connections may name nodes
 * still being written, coordinates may be missing. The builder holds what it
 * cannot place yet and places it the moment it can; `flushOrphans()` (called
 * when a submission finishes) roots anything still waiting. The validation
 * gate judges the submission; the preview only ever shows its best picture.
 *
 * `RevealQueue` paces application so a burst of stream fragments still reads
 * as architecture forming rather than a flash — the spec's "staged reveal"
 * fallback and true live streaming are the same code path at different
 * arrival rates.
 *
 * @module AiAssistant/authoring/preview
 */

import type { ConnectionV2 } from '../../../schemas';
import { ComponentModel } from '../../componentmodel';
import { NodeGraphNode } from '../../nodegraphmodel';
import type { SubmittedNode } from './types';

/** Fallback layout for nodes the agent submitted without coordinates. */
const FALLBACK_COLUMNS = 4;
const FALLBACK_X = 60;
const FALLBACK_Y = 60;
const FALLBACK_STEP_X = 220;
const FALLBACK_STEP_Y = 140;

export class PreviewGraphBuilder {
  readonly component: ComponentModel;

  private readonly applied = new Map<string, NodeGraphNode>();
  /** Nodes whose parent has not arrived yet, keyed by the missing parent id. */
  private readonly waitingForParent = new Map<string, Array<{ node: SubmittedNode; order: number }>>();
  /** Connections whose endpoints have not both arrived yet. */
  private pendingConnections: ConnectionV2[] = [];
  private placedCount = 0;

  constructor(legacyName: string) {
    this.component = ComponentModel.fromJSON({
      name: legacyName,
      graph: { roots: [], connections: [] }
    });
  }

  /** Node ids placed on the canvas so far. */
  get appliedNodeIds(): ReadonlySet<string> {
    return new Set(this.applied.keys());
  }

  /**
   * Place one submitted node — under its parent when the parent is already
   * on canvas, held back when it is not, dropped when it has no id or reuses
   * one. Applies any waiting children and eligible connections afterwards.
   */
  addNode(node: SubmittedNode, order: number): void {
    if (!node.id || this.applied.has(node.id) || typeof node.type !== 'string') return;

    if (node.parent && !this.applied.has(node.parent)) {
      const waiting = this.waitingForParent.get(node.parent) ?? [];
      waiting.push({ node, order });
      this.waitingForParent.set(node.parent, waiting);
      return;
    }

    this.place(node, order, node.parent ? this.applied.get(node.parent) : undefined);
  }

  /** Wire one connection, now or as soon as both endpoints exist. */
  addConnection(connection: ConnectionV2): void {
    this.pendingConnections.push(connection);
    this.applyEligibleConnections();
  }

  /**
   * The submission finished streaming: whatever still waits on a parent that
   * never arrived becomes a root, so the preview always shows every node the
   * agent wrote. Connections with a missing endpoint stay unshown — there is
   * nothing to draw them to.
   */
  flushOrphans(): void {
    while (this.waitingForParent.size > 0) {
      const [parentId, waiting] = this.waitingForParent.entries().next().value as [
        string,
        Array<{ node: SubmittedNode; order: number }>
      ];
      this.waitingForParent.delete(parentId);
      for (const entry of waiting) {
        if (!entry.node.id || this.applied.has(entry.node.id)) continue;
        this.place(entry.node, entry.order, undefined);
      }
    }
  }

  private place(node: SubmittedNode, order: number, parent: NodeGraphNode | undefined): void {
    const fallbackIndex = this.placedCount++;
    const graphNode = NodeGraphNode.fromJSON({
      id: node.id,
      type: node.type,
      label: node.label,
      x: node.x ?? FALLBACK_X + (fallbackIndex % FALLBACK_COLUMNS) * FALLBACK_STEP_X,
      y: node.y ?? FALLBACK_Y + Math.floor(fallbackIndex / FALLBACK_COLUMNS) * FALLBACK_STEP_Y,
      parameters: node.parameters ? { ...node.parameters } : {},
      ports: node.ports?.map((p) => ({ ...p })),
      children: []
    } as TSFixme);

    if (parent) parent.addChild(graphNode, { disableSelect: true });
    else this.component.graph.addRoot(graphNode, { disableSelect: true });
    this.applied.set(node.id, graphNode);

    // The node this one was blocking on may have been waiting as well.
    const waiting = this.waitingForParent.get(node.id);
    if (waiting) {
      this.waitingForParent.delete(node.id);
      for (const entry of waiting) {
        if (!entry.node.id || this.applied.has(entry.node.id)) continue;
        this.place(entry.node, entry.order, graphNode);
      }
    }

    this.applyEligibleConnections();
  }

  private applyEligibleConnections(): void {
    const still: ConnectionV2[] = [];
    for (const connection of this.pendingConnections) {
      if (this.applied.has(connection.fromId) && this.applied.has(connection.toId)) {
        this.component.graph.addConnection({
          fromId: connection.fromId,
          fromProperty: connection.fromProperty,
          toId: connection.toId,
          toProperty: connection.toProperty
        });
      } else {
        still.push(connection);
      }
    }
    this.pendingConnections = still;
  }
}

// ── Pacing ────────────────────────────────────────────────────────────────────

export type RevealItem = { kind: 'node'; node: SubmittedNode; order: number } | { kind: 'connection'; connection: ConnectionV2 };

/**
 * A queue the caller drains on a timer: one item per tick, so nodes appear at
 * a readable pace no matter how the stream bursts. `flush()` applies the rest
 * at once — used when a submission completes or the document closes mid-build.
 */
export class RevealQueue {
  private readonly items: RevealItem[] = [];

  constructor(private readonly apply: (item: RevealItem) => void) {}

  get pending(): number {
    return this.items.length;
  }

  enqueue(items: RevealItem[]): void {
    this.items.push(...items);
  }

  /** Apply the next item. Returns true when something was applied. */
  tick(): boolean {
    const item = this.items.shift();
    if (!item) return false;
    this.apply(item);
    return true;
  }

  flush(): void {
    while (this.tick()) {
      // Drain.
    }
  }
}
