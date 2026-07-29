'use strict';

/**
 * Clause (b) of the Binding Contract: *show what it resolved*, on the canvas.
 *
 * See `dev-docs/reference/BINDING-CONTRACT.md`. A node that walks scope and keeps the answer
 * to itself is the defect this exists to remove — "bound to: CardList" on the node card
 * diagnoses a nested-component mix-up in seconds, where `getInspectInfo` only helps somebody
 * who already suspects the node.
 *
 * ## Why this is not just `sendWarning` with a nicer message
 *
 * A successful binding is not a problem, so it must not draw the danger ring, must not reach
 * the Problems panel, and must not count towards a component's warning badge. What it wants
 * is the node card's *sub-label* slot, which the editor already paints (see
 * `NodeGraphEditorNode.typeDisplayName`) and which nothing at runtime could reach before.
 *
 * ## Why it aggregates
 *
 * One node on the canvas is many nodes at runtime — a component used twice, or once inside a
 * Repeater, has one graph node id and N live instances, each of which may resolve to a
 * *different* target. Reporting them one at a time would make the card flicker between
 * answers and show whichever instance updated last, which is precisely the "deterministic but
 * reads as random" experience the contract is written against.
 *
 * So instances are collected per graph node and summarised. One distinct target shows that
 * target. Several show *that there are several*, with the names — which is not a fallback,
 * it is the most useful thing the canvas can say. The contract's litmus test asks whether an
 * author with two nested instances of one component can predict which one a node affects;
 * when the honest answer is "these two", saying so is the whole point.
 */

import type { EditorConnectionLike, NodeInstance } from '@noodl/types';

/** How many target names a summary spells out before it stops listing them. */
const MAX_NAMES_LISTED = 3;

/** Per graph node id, the live instances and what each one resolved to. */
type InstanceLabels = Map<NodeInstance, string | undefined>;

/**
 * One runtime's worth of state.
 *
 * Scoped per `NodeContext` rather than per reporter, because a node id is only unique
 * *within* a runtime. Two runtimes in one JS realm — a sandbox preview beside the main one,
 * or several graphs in a single test file — share the module-level reporter and would
 * otherwise pool each other's instances into one summary, so a node bound correctly in each
 * would report "2 targets" in both.
 */
interface ContextState {
  byGraphNode: Map<string, InstanceLabels>;
  lastSent: Map<string, string | undefined>;
}

/**
 * Summarise what the instances of one graph node agree (or disagree) on.
 *
 * `undefined` in, `undefined` out: a node that resolved nothing has no sub-label, because
 * the *failure* channel is already reporting that and two reports of one fact on one card is
 * noise. Exported for the tests, which are the only reason it is not a closure.
 */
export function summariseTargets(labels: readonly (string | undefined)[]): string | undefined {
  const distinct: string[] = [];
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label === undefined) continue;
    if (distinct.indexOf(label) === -1) distinct.push(label);
  }

  if (distinct.length === 0) return undefined;
  if (distinct.length === 1) return '→ ' + distinct[0];

  const listed = distinct.slice(0, MAX_NAMES_LISTED).join(', ');
  const rest = distinct.length - MAX_NAMES_LISTED;
  return '→ ' + distinct.length + ' targets: ' + listed + (rest > 0 ? ', +' + rest : '');
}

/**
 * The reporter one node *type* owns — instantiate once per node module, not per instance.
 *
 * Keyed by graph node id at the top and by the live instance object underneath, because node
 * ids are shared across component instances (that is why editor warnings are per graph node
 * too). Instances are held strongly, so {@link forget} in `_onNodeDeleted` is not optional:
 * without it a Repeater churning its template would grow this map without bound.
 */
export class ResolvedTargetReporter {
  /** Weak, so a torn-down runtime's bookkeeping goes with it and needs no reset call. */
  private _byContext: WeakMap<object, ContextState> = new WeakMap();

  /**
   * Record what `node` bound to and push the summary to the editor.
   *
   * Safe to call every resolution; identical summaries are dropped rather than sent, so a
   * node that re-resolves each frame costs one string comparison.
   */
  report(node: NodeInstance, target: string | undefined): void {
    const state = this._stateFor(node);
    if (!state) return;

    let instances = state.byGraphNode.get(node.id);
    if (!instances) {
      instances = new Map();
      state.byGraphNode.set(node.id, instances);
    }
    instances.set(node, target);

    this._flush(node, state, instances);
  }

  /** Drop an instance. Call from `_onNodeDeleted`, or this map is a leak. */
  forget(node: NodeInstance): void {
    const state = this._stateFor(node);
    if (!state) return;

    const instances = state.byGraphNode.get(node.id);
    if (!instances) return;

    instances.delete(node);
    if (instances.size === 0) {
      state.byGraphNode.delete(node.id);
      state.lastSent.delete(node.id);
      // Deliberately no clearing message: the graph node is going away with its component,
      // and the editor drops the sub-label with the node.
      return;
    }

    this._flush(node, state, instances);
  }

  private _stateFor(node: NodeInstance): ContextState | undefined {
    const context = node.context as unknown as object | undefined;
    if (!context) return undefined;

    let state = this._byContext.get(context);
    if (!state) {
      state = { byGraphNode: new Map(), lastSent: new Map() };
      this._byContext.set(context, state);
    }
    return state;
  }

  private _flush(node: NodeInstance, state: ContextState, instances: InstanceLabels): void {
    // `forEach` rather than iterating `instances.values()`: `noodl-viewer-react` compiles
    // this file through a pre-ES2015 ts-jest target, where a Map iterator needs
    // `downlevelIteration` and fails the whole suite with TS2802.
    const labels: Array<string | undefined> = [];
    instances.forEach((label) => labels.push(label));

    const summary = summariseTargets(labels);
    if (state.lastSent.has(node.id) && state.lastSent.get(node.id) === summary) return;
    state.lastSent.set(node.id, summary);

    const editorConnection = node.context && (node.context.editorConnection as EditorConnectionLike | undefined);
    if (!editorConnection || !editorConnection.isRunningLocally()) return;
    if (typeof editorConnection.sendNodeSubLabel !== 'function') return;

    (editorConnection.sendNodeSubLabel as (nodeId: string, subLabel: string | undefined) => void)(node.id, summary);
  }
}
