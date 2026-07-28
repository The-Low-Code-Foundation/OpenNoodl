/**
 * The graph model a workflow is drawn from (WFA-004).
 *
 * A `NodeGraphModel` subclass, not a replacement: every node, connection, undo
 * entry and canvas gesture is the one the editor already has. What it overrides
 * is the *rules* — which is what `getConnectionStatus` exists for, and what
 * makes "the canvas will not let you draw a cycle" a three-line answer rather
 * than a new surface.
 *
 * WHY ACYCLICITY IS ENFORCED HERE AND NOT ON SAVE
 * The engine already rejects a cyclic definition at write time, and a
 * definition that fails validation on load stops the backend booting. A canvas
 * that lets you draw a cycle and then refuses to save it teaches you nothing at
 * the moment you made the mistake, and leaves you holding a graph you cannot
 * persist. Refusing the connection is both kinder and cheaper.
 *
 * @module models/workflow/WorkflowGraphModel
 */

import { NodeGraphModel } from '@noodl-models/nodegraphmodel';

import { placeNewStep } from './workflowLayout';
import { kindFromTypeName, PORT_IN } from './workflowNodeLibrary';

/** The shape `utils.guid()` produces — 8-4-4-4-12 hex. */
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ConnectionStatusArgs {
  sourceNode: { id: string };
  sourcePort: string;
  targetNode: { id: string };
  targetPort: string;
}

export class WorkflowGraphModel extends NodeGraphModel {
  /**
   * Extra right-click actions contributed by the graph (see NodeContextMenu).
   * Set by `WorkflowDocument`, which is the thing that knows about entry steps.
   */
  public contextMenuActionsProvider?: (selectedNodeIds: string[]) => unknown[];

  getContextMenuActions(selectedNodeIds: string[]): unknown[] {
    return this.contextMenuActionsProvider ? this.contextMenuActionsProvider(selectedNodeIds) : [];
  }

  /**
   * A canvas node id IS the step id (F15) — which means it has to be readable.
   *
   * `NodeOperations.createNewNode` mints a guid, and a guid is a legal step id,
   * so nothing would break; but every execution record would then read
   * `nodeId: "3f2a1c04-…"` instead of `nodeId: "charge"`, and the run inspector
   * this canvas exists to feed would be unreadable. So a node arriving with a
   * guid is renamed from its kind (`branch`, `branch2`, …) on the way in.
   *
   * A node arriving with a non-guid id keeps it: that is the undo of a delete
   * re-adding a step whose id is already in `next`/`routes` on other steps, and
   * renaming it there would break every edge pointing at it.
   */
  addRoot(model: TSFixme, args?: TSFixme) {
    if (model && typeof model.id === 'string' && (GUID_RE.test(model.id) || this.nodeMap.has(model.id))) {
      model.id = this.mintStepId(model.typename);
    }

    // A step added with no position — by MCP, or by WFA-007 — must not land on
    // top of something the user arranged, and must not move anything that is
    // already placed (§5). The canvas's own create path supplies the click
    // position and never reaches this.
    if (model && !model.x && !model.y) {
      const existing: { x: number; y: number }[] = [];
      this.forEachNode((n) => {
        existing.push({ x: n.x, y: n.y });
      });
      const placed = placeNewStep(existing);
      model.x = placed.x;
      model.y = placed.y;
    }

    return super.addRoot(model, args);
  }

  /** A short, unique, readable id derived from the step kind. */
  mintStepId(typename: string | undefined): string {
    const kind = kindFromTypeName(typename || '') || 'step';
    const base = kind.replace(/-/g, '');
    if (!this.nodeMap.has(base)) return base;
    let n = 2;
    while (this.nodeMap.has(base + n)) n++;
    return base + n;
  }

  /**
   * Would adding this edge close a cycle? Walks forward from the target and
   * looks for the source.
   *
   * Cheap by construction: a workflow is a control-flow graph with tens of
   * steps, not a data graph with hundreds of wires.
   */
  private wouldCreateCycle(fromId: string, toId: string): boolean {
    if (fromId === toId) return true;

    const outgoing = new Map<string, string[]>();
    for (const c of this.connections) {
      const list = outgoing.get(c.fromId) || [];
      list.push(c.toId);
      outgoing.set(c.fromId, list);
    }

    const seen = new Set<string>();
    const stack = [toId];
    while (stack.length) {
      const id = stack.pop() as string;
      if (id === fromId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const next of outgoing.get(id) || []) stack.push(next);
    }
    return false;
  }

  getConnectionStatus(args: ConnectionStatusArgs) {
    const base = super.getConnectionStatus(args);
    if (!base.connectable) return base;

    // Every edge lands on the same input: "an edge reached me". A connection
    // into anything else is a param wire, which a workflow does not have —
    // params are values, and a value that comes from another step is written as
    // a `{"$path": …}` reference (WFA-003), not as a wire.
    if (args.targetPort !== PORT_IN) {
      return {
        connectable: false,
        message:
          'A workflow edge lands on <strong>in</strong>. To feed one step&rsquo;s output into another&rsquo;s ' +
          'parameter, set that parameter to a reference instead of drawing a wire.'
      };
    }

    if (args.sourcePort === PORT_IN) {
      return {
        connectable: false,
        message: 'An edge runs out of <strong>next</strong>, a route or <strong>onError</strong> — not out of in.'
      };
    }

    if (this.wouldCreateCycle(args.sourceNode.id, args.targetNode.id)) {
      return {
        connectable: false,
        message:
          'That would make a loop. A workflow runs each step once, in dependency order, so its steps must form ' +
          'a DAG — the engine rejects a cyclic definition and would refuse to load it.'
      };
    }

    return { connectable: true };
  }
}
