/**
 * AIX-010 — which components get read in full.
 *
 * The interesting decision in this task. A large project cannot be read whole,
 * and pretending otherwise is how a retrofit fails silently on the only projects
 * where it matters. So the assembler reads a handful in full and reads the rest
 * only as one line of interface each — and the rule for picking that handful is
 * here, in one pure function, so a spec can pin it and the review UI can show
 * the user what it decided.
 *
 * The order, and why:
 *
 *  1. **The root component.** It is where the app starts and usually where the
 *     Router lives; not reading it makes every other read harder to place.
 *  2. **Pages, start page first.** A page is a user-facing screen. The set of
 *     screens is most of what BRIEF.md is about, and the page graph is most of
 *     what ARCHITECTURE.md is about.
 *  3. **By inbound reference count, descending.** A component ten others
 *     instantiate is a convention this project has already made; that is exactly
 *     CONVENTIONS.md's subject. (This is the spec's stated rule, kept.)
 *  4. **By size, descending**, as a tie-break: among equals, the bigger graph
 *     carries more of whatever the project does.
 *
 * Note what this deliberately does *not* do: rank by node count first. The
 * biggest component in a project is very often a settings page or a kitchen-sink
 * demo screen, and spending the budget there produces a document about the
 * project's least representative corner.
 *
 * @module AiAssistant/review/selection
 */

import { isComponentRef } from '../explain/graph';
import type { ExplainGraph } from '../explain/types';
import type { ComponentKind, PageMap, RankedComponent } from './types';

/** `/#__page__/Chat`, `#Chat`, `Chat` all compare equal. */
function key(name: string): string {
  return name.replace(/^\//, '').replace(/^#/, '').toLowerCase();
}

/**
 * How many nodes elsewhere in the project instantiate each component.
 *
 * A component instance's node `type` *is* the target component's legacy name,
 * which is what `isComponentRef` detects. Self-references are not counted: a
 * component that instantiates itself is recursive, not popular.
 */
export function inboundReferenceCounts(graph: ExplainGraph): Map<string, number> {
  const counts = new Map<string, number>();
  const byKey = new Map<string, string>();
  for (const component of graph.components) {
    byKey.set(key(component.name), component.name);
    counts.set(component.name, 0);
  }

  for (const component of graph.components) {
    for (const node of component.nodes) {
      if (!isComponentRef(node.type)) continue;
      const target = byKey.get(key(node.type));
      if (!target || target === component.name) continue;
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Rank every component, most worth reading first. Total order — no ties are left
 * to `Array.prototype.sort`'s stability, so the same project always produces the
 * same reads and a spec can assert on them.
 */
export function rankComponents(
  graph: ExplainGraph,
  pageMap: PageMap,
  rootComponent?: string
): RankedComponent[] {
  const inbound = inboundReferenceCounts(graph);
  const pageByKey = new Map(pageMap.pages.map((p) => [key(p.component), p]));
  const rootKey = rootComponent ? key(rootComponent) : undefined;

  // Fallback root: whichever component hosts a router. A project with no root
  // node recorded (an unsaved or imported one) still has an obvious entry point.
  const routerHost = pageMap.routers[0]?.host;

  const scored = graph.components.map((component) => {
    const k = key(component.name);
    const page = pageByKey.get(k);
    const isRoot = rootKey ? k === rootKey : routerHost !== undefined && k === key(routerHost);
    const refs = inbound.get(component.name) ?? 0;

    const kind: ComponentKind = isRoot ? 'root' : page ? 'page' : refs > 1 ? 'shared' : 'other';
    const tier = isRoot ? 0 : page?.isStart ? 1 : page ? 2 : 3;

    return {
      name: component.name,
      kind,
      nodeCount: component.nodes.length,
      inboundRefs: refs,
      tier,
      reason: reasonFor(kind, page?.isStart === true, refs)
    };
  });

  scored.sort(
    (a, b) =>
      a.tier - b.tier ||
      b.inboundRefs - a.inboundRefs ||
      b.nodeCount - a.nodeCount ||
      a.name.localeCompare(b.name)
  );

  // `tier` is a sort key, not part of the record — the caller sees `rank`.
  return scored.map((entry, rank) => ({
    name: entry.name,
    kind: entry.kind,
    nodeCount: entry.nodeCount,
    inboundRefs: entry.inboundRefs,
    reason: entry.reason,
    rank
  }));
}

function reasonFor(kind: ComponentKind, isStart: boolean, refs: number): string {
  if (kind === 'root') return 'the root component — where the app starts';
  if (isStart) return 'the start page';
  if (kind === 'page') return 'a page';
  if (kind === 'shared') return `used by ${refs} other component${refs === 1 ? '' : 's'}`;
  if (refs === 1) return 'used by 1 other component';
  return 'not referenced by any other component';
}
