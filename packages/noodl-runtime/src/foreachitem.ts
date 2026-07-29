'use strict';

/**
 * "The current Repeater item" — the Binding Contract applied to `_forEachModel`.
 *
 * See `dev-docs/reference/BINDING-CONTRACT.md`. `_forEachModel` is the runtime's *ambient
 * item* protocol: whoever instantiates a template component hangs the item's record on the
 * component instance, and every node inside that template finds it by walking up. Five sites
 * did that walk by hand — `modelcrudbase`, `modelnode2`, `dbmodelcrudbase`, `dbmodelnode2`
 * and `javascriptnodeparser._findForEachModel` — and every one of them ended:
 *
 * ```js
 * this.setModel(component !== undefined ? component._forEachModel : undefined);
 * ```
 *
 * which is clause (c) violated five times over: **Id Source = "From repeater" on a node that
 * is not inside a Repeater binds to nothing and says nothing.** Nested Repeaters were clause
 * (a) violated too — nearest-wins, with no way to name the intended one and nothing on the
 * canvas to say which was picked. FINDINGS F-ii, and the highest-value item in defect class F.
 *
 * ## Two producers, not one
 *
 * The name says Repeater and the docs said Repeater, but `runtasks.ts:193` sets `_forEachModel`
 * too, with the same `createNode` extraProps shape. So this file never claims "not inside a
 * Repeater" as a bare fact — the messages name both producers, because telling an author their
 * Run Tasks node is not a Repeater would send them looking for a bug that is not there.
 *
 * ## Why there is no `resolutionIsLoud` gate here
 *
 * `parentcomponentobject.ts` needs one: it looks for a *node* in an ancestor's scope, and that
 * ancestor's nodes are still being created when the child first asks, so an early miss is
 * expected and must stay quiet. This protocol has no such window. `_forEachModel` arrives as
 * `extraProps` on `createNode`, which `NodeContext.createComponentInstanceNode` copies onto the
 * instance *before* `setComponentModel` builds any of the component's inner nodes
 * (`nodecontext.ts:398-403`). By the time a node inside the template can ask, the answer is
 * already there or is never coming — so a miss is genuine on the first attempt, and gating it
 * would only delay a true report.
 *
 * That asymmetry is worth keeping in mind before copying either file's timing into a third.
 */

import { scopeChain, scopeChainNames } from './componentwalk';
import { ResolvedTargetReporter } from './resolvedtarget';

import type { ComponentInstanceLike, ModelLike, NodeInstance } from '@noodl/types';

/** The ambient property. Named once so a rename cannot half-land across the call sites. */
const FOR_EACH_MODEL = '_forEachModel';

/**
 * Clause (b) for every node in the family, sharing one reporter.
 *
 * The contract says "one instance per node *module*", and here one instance covers nine node
 * types instead — deliberately. `ResolvedTargetReporter` keys by graph node id *within a
 * `NodeContext`*, and node ids are unique across the whole graph, not per type; so sharing
 * pools nothing that a per-module instance would have kept apart, and it means the Object node
 * and the Set Record Properties node cannot drift into reporting the same binding differently.
 */
const resolvedTargets = new ResolvedTargetReporter();

/**
 * The last miss already raised per node instance, so a repeated resolution stays quiet.
 *
 * Keyed by instance and *valued* by code-plus-target rather than code alone: retargeting from
 * one missing component to another is a new question about a new target, and would otherwise
 * be swallowed as "already told you". Weak, so it needs no `forget` of its own.
 */
const lastMissByNode = new WeakMap<NodeInstance, string>();

export interface ForEachItemOptions {
  /**
   * BINDING-CONTRACT §(a) — the component named on the node's explicit-target input.
   *
   * Undefined keeps the historical nearest-wins resolution exactly, so no existing project
   * changes behaviour.
   */
  target?: string;
}

/**
 * The current item for `node`, or `undefined` — reporting either way.
 *
 * Every caller was previously a bare walk whose `undefined` meant both "no repeater" and
 * "nothing bound"; this one distinguishes them and says so on both channels.
 */
export function resolveForEachItem(node: NodeInstance, options: ForEachItemOptions = {}): ModelLike | undefined {
  const chain = scopeChain(node.nodeScope.componentOwner);
  const wanted = options.target;

  if (wanted) {
    const named = firstNamed(chain, wanted);

    // A named target that is not in scope is a *failure*, never a quiet fall back to
    // nearest-wins: falling back would reintroduce the silent-wrong-target bug behind the
    // input whose whole purpose is to prevent it (contract §(a)).
    if (!named) {
      return miss(
        node,
        'repeater-item/target-not-found',
        'No component named "' + wanted + '" contains this node',
        wanted,
        { target: wanted, scope: scopeChainNames(node.nodeScope.componentOwner) }
      );
    }

    // Named, in scope, but not an item. Distinct from the above on purpose — "you named a
    // component that is not above this node" and "you named the right component and it is not
    // a repeater template" are different mistakes with different fixes.
    if (named[FOR_EACH_MODEL] === undefined) {
      return miss(
        node,
        'repeater-item/target-has-no-item',
        'The component "' + wanted + '" has no current item — it is not used as a Repeater or Run Tasks template',
        wanted,
        { target: wanted }
      );
    }

    return hit(node, named);
  }

  // Implicit: nearest component in scope carrying an item. Unchanged behaviour, so existing
  // projects bind exactly as they did — what is new is that they now say so.
  const owner = firstWithItem(chain);

  if (!owner) {
    return miss(
      node,
      'repeater-item/no-item-in-scope',
      'Id Source is set to "From repeater", but this node is not inside a Repeater or Run Tasks template',
      undefined,
      { scope: scopeChainNames(node.nodeScope.componentOwner) }
    );
  }

  return hit(node, owner);
}

/**
 * Drop a node's bookkeeping. Call from `_onNodeDeleted`.
 *
 * Not optional: {@link ResolvedTargetReporter} holds instances strongly, so a Repeater
 * churning its template would grow that map for the life of the session.
 */
export function forgetForEachItem(node: NodeInstance): void {
  resolvedTargets.forget(node);
  lastMissByNode.delete(node);
}

/** First component in the chain with this name. */
function firstNamed(chain: ComponentInstanceLike[], name: string): ComponentInstanceLike | undefined {
  for (let i = 0; i < chain.length; i++) {
    if (chain[i].name === name) return chain[i];
  }
  return undefined;
}

/** First component in the chain carrying an item. */
function firstWithItem(chain: ComponentInstanceLike[]): ComponentInstanceLike | undefined {
  for (let i = 0; i < chain.length; i++) {
    if (chain[i][FOR_EACH_MODEL] !== undefined) return chain[i];
  }
  return undefined;
}

/** A resolution: label the card with the component that supplied the item, and forget any miss. */
function hit(node: NodeInstance, owner: ComponentInstanceLike): ModelLike | undefined {
  lastMissByNode.delete(node);
  // The component's name, not the item's id. One graph node is many runtime nodes — a Repeater
  // over ten records is ten instances of this node, each with a different record — so labelling
  // by id would report "→ 10 targets" on a perfectly-bound node. The stable, useful answer to
  // "which repeater am I in" is the template component.
  resolvedTargets.report(node, owner.name);
  return owner[FOR_EACH_MODEL] as ModelLike | undefined;
}

/** A miss: clear the card, raise once, and return nothing. */
function miss(
  node: NodeInstance,
  code: string,
  message: string,
  target: string | undefined,
  detail: unknown
): undefined {
  resolvedTargets.report(node, undefined);

  const seen = code + '|' + (target || '');
  if (lastMissByNode.get(node) !== seen) {
    lastMissByNode.set(node, seen);
    node.raiseRuntimeError(code, message, detail);
  }

  return undefined;
}
