/**
 * FUN-002 — write the seed for a **brand-new** node, if its type has one.
 *
 * The thin half of the pair. `newNodeSeed.ts` next door holds the decision and
 * is import-free so `tests-unit/` can grade it; this file is the one that knows
 * where the string comes from (FUN-001's `notation.ts`) and how the write is
 * made, and it is deliberately small enough to read in one go.
 *
 * Called by the two paths that mint a brand-new node — the node picker and a
 * drag onto the canvas — and by **neither load, paste, duplicate nor import**.
 * That is the whole of the "fires exactly once, on creation" guarantee, and it
 * lives in the call sites rather than in a flag.
 *
 * ⚠️ Called **after** the node is in the graph, so the seed is its own undo
 * entry: one ⌘Z removes the body and leaves the node, which is the escape hatch
 * for someone who knows what they are doing. Writing it before the add would
 * fold it into the `create` entry and make the seed un-undoable on its own.
 *
 * @module models/nodeSeed
 */

import { SEED_FUNCTION_BODY } from '@noodl-core-ui/components/code-editor';

import { planNewNodeSeed, SeedableNode } from './newNodeSeed';

import type { NodeGraphNode } from '../nodegraphmodel';

export function seedNewNode(node: NodeGraphNode, typeName: string): void {
  const seed = planNewNodeSeed(typeName, node as unknown as SeedableNode, SEED_FUNCTION_BODY);
  if (!seed) return;

  node.setParameter(seed.parameter, seed.value, { undo: true, label: 'seed function' });
}
