'use strict';

/**
 * Walking up the component tree — the one implementation.
 *
 * See `dev-docs/reference/BINDING-CONTRACT.md`. Every node that "finds" something by
 * climbing out of its own component does it through here, so that the answer to *which
 * ancestor did it pick* has a single definition and a single place to fix.
 *
 * Before this file the same recursive `getParentComponent` existed four times, hand-copied:
 * `parentcomponentobject.ts`, `setparentcomponentobjectproperties.ts`,
 * `javascriptnodeparser.js` and the deprecated `parentcomponentstate.ts`. They had already
 * drifted — the JS one also accepts the deprecated `'Component State'` node type, the two TS
 * ones do not — which is exactly the failure mode a copy invites: a Function node and a
 * Parent Component Object node sitting in the same place could resolve to *different*
 * ancestors, and nothing said so.
 *
 * ## Why the hop is awkward
 *
 * There is no single parent pointer. A component instance mounted inside another node's
 * visual tree is reached through its first root's `getVisualParentNode()`; one that is not
 * visual is reached through `parentNodeScope`. {@link parentComponentOf} is that decision,
 * preserved exactly as the four copies made it, and it is the reason the contract calls the
 * implicit binding *deterministic but not predictable*: the visual branch means the answer
 * can change when the layout changes, with nothing on the canvas to say it did.
 */

import type { ComponentInstanceLike } from '@noodl/types';

/**
 * Depth cap for every walk here.
 *
 * The four copies recursed with no bound. A component tree deep enough to reach this does
 * not exist — but a *cycle* would have hung the whole app, and a hang is the one failure the
 * Failure Contract cannot report. Chosen far above any real graph so it can never change an
 * answer, only stop a runaway.
 */
const MAX_WALK_DEPTH = 1000;

/**
 * One hop up: the component instance that contains `component`, or `undefined` at the top.
 *
 * The `parent.nodeScope.componentOwner !== component` guard reads oddly and is load-bearing.
 * A component instance's own `nodeScope.componentOwner` is itself, so the test is really
 * `parent !== component` — a self-loop guard for the root component, whose roots have no
 * visual parent and whose `parentNodeScope` is undefined. Removing it turns the root into an
 * infinite walk.
 */
export function parentComponentOf(component: ComponentInstanceLike | undefined): ComponentInstanceLike | undefined {
  if (!component) return undefined;

  let parent: ComponentInstanceLike | undefined;

  if (component.getRoots().length > 0) {
    // Visual: climb out through the first root's visual parent.
    const root = component.getRoots()[0];

    if (root.getVisualParentNode) {
      // A regular visual node.
      const visualParent = root.getVisualParentNode();
      if (visualParent) {
        parent = visualParent.nodeScope.componentOwner;
      }
    } else if (root.parentNodeScope) {
      // A component-instance node. Note this reads `component.parentNodeScope`, not the
      // root's — as all four copies did. Kept: changing it would move bindings in existing
      // projects, which is not this contract's business.
      parent = component.parentNodeScope.componentOwner;
    }
  } else if (component.parentNodeScope) {
    parent = component.parentNodeScope.componentOwner;
  }

  if (parent && parent.nodeScope && parent.nodeScope.componentOwner !== component) {
    return parent;
  }

  return undefined;
}

/**
 * Every ancestor of `component`, nearest first. Empty at the root.
 *
 * The contract's clause (c) needs this as much as clause (a) does: when an explicit target
 * misses, "no ancestor named X — the ancestors are A, B, C" is a message an author can act
 * on, and "not found" is not.
 */
export function componentAncestors(component: ComponentInstanceLike | undefined): ComponentInstanceLike[] {
  const ancestors: ComponentInstanceLike[] = [];

  let current = component;
  for (let depth = 0; depth < MAX_WALK_DEPTH; depth++) {
    const parent = parentComponentOf(current);
    if (!parent) break;
    ancestors.push(parent);
    current = parent;
  }

  return ancestors;
}

/**
 * The nearest ancestor `predicate` accepts, or `undefined`.
 *
 * `component` itself is never tested — every caller wants a *parent*, and a node that could
 * satisfy itself would make "Parent Component Object" bind to its own component.
 */
export function findComponentAncestor(
  component: ComponentInstanceLike | undefined,
  predicate: (candidate: ComponentInstanceLike) => boolean
): ComponentInstanceLike | undefined {
  let current = component;
  for (let depth = 0; depth < MAX_WALK_DEPTH; depth++) {
    const parent = parentComponentOf(current);
    if (!parent) return undefined;
    if (predicate(parent)) return parent;
    current = parent;
  }

  return undefined;
}

/**
 * The nearest ancestor that owns a node of any of `types`.
 *
 * The list is a list rather than a single name because of the drift described at the top of
 * this file: the Component Object family has to accept the deprecated `'Component State'`
 * node alongside `'net.noodl.ComponentObject'`, and the only reason the TS copies did not
 * was that whoever ported them dropped a line.
 */
export function findAncestorWithNodeType(
  component: ComponentInstanceLike | undefined,
  types: readonly string[]
): ComponentInstanceLike | undefined {
  return findComponentAncestor(component, (candidate) =>
    types.some((type) => candidate.nodeScope.getNodesWithType(type).length > 0)
  );
}

/**
 * The node types that make a component "one that owns a Component Object".
 *
 * Here rather than beside any one node, because the four copies of this walk each carried
 * their *own* list and the lists had diverged — which is worse than the duplication, since it
 * produces disagreement rather than mere repetition:
 *
 * | Site | Accepted before |
 * |---|---|
 * | `parentcomponentobject.ts` (reads) | both |
 * | `javascriptnodeparser.js` (Function nodes read) | both |
 * | `setparentcomponentobjectproperties.ts` (**writes**) | modern only |
 * | `parentcomponentstate.ts` (deprecated) | deprecated only |
 *
 * So with a deprecated `Component State` on `/Outer` and a modern Component Object on
 * `/Root`, a Parent Component Object node **read** `/Outer` while the Set Parent Component
 * Object Properties node beside it **wrote** `/Root` — the read and the write of one piece of
 * state landing on two different components, silently. One list, one walk, no drift.
 */
export const COMPONENT_OBJECT_TYPES = ['net.noodl.ComponentObject', 'Component State'] as const;

/**
 * The nearest ancestor that owns a Component Object — the one definition of that question.
 *
 * Every node in the Component Object family must resolve through this and nothing else, or
 * the table above starts growing rows again.
 */
export function findAncestorWithComponentObject(
  component: ComponentInstanceLike | undefined
): ComponentInstanceLike | undefined {
  return findAncestorWithNodeType(component, COMPONENT_OBJECT_TYPES);
}

/**
 * The nearest ancestor whose component name is `name` — the explicit-target walk.
 *
 * Named, not counted. "Two levels up" breaks the moment somebody wraps a component in a
 * Group; "the component named X" survives it (BINDING-CONTRACT §(a)).
 */
export function findAncestorWithName(
  component: ComponentInstanceLike | undefined,
  name: string
): ComponentInstanceLike | undefined {
  return findComponentAncestor(component, (candidate) => candidate.name === name);
}

/**
 * The `parentNodeScope` chain, **self included**, nearest first.
 *
 * Deliberately not {@link componentAncestors}, on both counts:
 *
 * - *Self included.* The ambient protocols below are set on a component instance by whoever
 *   created it, so the node asking is normally inside that very component. A Repeater item's
 *   Object node sits in the item template, and the instance carrying `_forEachModel` is its
 *   own `componentOwner` — excluding self would make an item unable to see its own item.
 * - *Creation, not layout.* This follows `parentNodeScope` only and never takes the visual
 *   branch, because these properties are handed down at `createNode` time. Routing them
 *   through the visual walk would let a binding move when somebody re-parents a Group.
 *
 * Keeping the two walks distinct is the point. Collapsing them into one would look like
 * tidying and would silently move bindings in existing projects.
 */
export function scopeChain(component: ComponentInstanceLike | undefined): ComponentInstanceLike[] {
  const chain: ComponentInstanceLike[] = [];

  let current = component;
  for (let depth = 0; depth < MAX_WALK_DEPTH; depth++) {
    if (!current) break;
    chain.push(current);
    if (!current.parentNodeScope) break;
    current = current.parentNodeScope.componentOwner;
  }

  return chain;
}

/** Scope-chain component names, nearest first — for a failure message that names the alternatives. */
export function scopeChainNames(component: ComponentInstanceLike | undefined): string[] {
  return scopeChain(component).map((entry) => entry.name);
}

/**
 * The nearest component in the scope chain carrying `property` — the "ambient" protocol.
 *
 * `_forEachModel` (the current Repeater item) and `_popupCloseHandler` are both resolved this
 * way. See {@link scopeChain} for why this walk is not the visual one.
 */
export function findAncestorWithProperty(
  component: ComponentInstanceLike | undefined,
  property: string
): ComponentInstanceLike | undefined {
  const chain = scopeChain(component);

  for (let i = 0; i < chain.length; i++) {
    if (chain[i][property] !== undefined) return chain[i];
  }

  return undefined;
}

/** Ancestor names, nearest first — for a failure message that names the alternatives. */
export function componentAncestorNames(component: ComponentInstanceLike | undefined): string[] {
  return componentAncestors(component).map((ancestor) => ancestor.name);
}
