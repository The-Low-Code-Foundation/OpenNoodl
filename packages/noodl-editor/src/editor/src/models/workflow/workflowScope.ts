/**
 * What a `$path` may address from a given step (WFA-004 §4).
 *
 * WFA-003 made a step param able to be a reference — `{"$path": "previous.…"}`,
 * `{"$path": "upstream.<stepId>.…"}` — and gated it at write time: a `$path`
 * may only name a step that is genuinely upstream. A picker that offers a step
 * which is not upstream would produce a definition the backend rejects with a
 * 400, so the picker computes exactly the same set the validator enforces.
 *
 * The scope ROOTS (`body`, `trigger`, `previous`, …) come from the served value
 * language, not from here — they are backend contract. What this module knows
 * is the shape of the graph on screen.
 *
 * @module models/workflow/workflowScope
 */

import type { NodeGraphModel } from '@noodl-models/nodegraphmodel';

export interface UpstreamStep {
  id: string;
  label: string;
  /** The step kind's display name, so a picker row says what it is. */
  kindLabel: string;
}

/**
 * Every step that can have run before this one — the transitive closure of
 * incoming edges.
 *
 * Matches `scope.upstream`, which WFA-003 made deliberately WIDER than
 * `ctx.upstream`: the motivating case (`upstream.save.result.orderId`) has a
 * `branch` in between, where `previous` is the branch's own `{result, isfalse}`
 * rather than the save's output.
 */
export function upstreamSteps(graph: NodeGraphModel, stepId: string): UpstreamStep[] {
  const incoming = new Map<string, string[]>();
  for (const c of graph.connections) {
    const list = incoming.get(c.toId) || [];
    list.push(c.fromId);
    incoming.set(c.toId, list);
  }

  const seen = new Set<string>();
  const stack = [...(incoming.get(stepId) || [])];
  while (stack.length) {
    const id = stack.pop() as string;
    if (seen.has(id) || id === stepId) continue;
    seen.add(id);
    for (const prev of incoming.get(id) || []) stack.push(prev);
  }

  const steps: UpstreamStep[] = [];
  graph.forEachNode((node) => {
    if (!seen.has(node.id)) return;
    steps.push({
      id: node.id,
      label: node.label || node.id,
      kindLabel: node.type?.displayName || ''
    });
  });

  // Definition order, which is the order the canvas laid them out in.
  return steps;
}

/**
 * Is this `$path` one the backend would accept from this step?
 *
 * Only `upstream.<stepId>` is checkable here — every other root is a runtime
 * value whose shape the editor cannot know, and WFA-003 was explicit that an
 * unresolvable path is `undefined` at run time rather than an error. So this
 * flags exactly what write-time validation would reject with a 400, and stays
 * quiet about everything it cannot honestly judge.
 */
export function danglingReference(
  graph: NodeGraphModel,
  stepId: string,
  path: string
): { message: string } | null {
  if (!path.startsWith('upstream.')) return null;

  const named = path.slice('upstream.'.length).split('.')[0];
  if (!named) return { message: 'Name a step after `upstream.`' };

  if (!graph.findNodeWithId(named)) {
    return { message: `There is no step called "${named}" in this workflow.` };
  }

  if (!upstreamSteps(graph, stepId).some((s) => s.id === named)) {
    return {
      message: `"${named}" is not upstream of this step, so its output cannot have been produced yet.`
    };
  }

  return null;
}
