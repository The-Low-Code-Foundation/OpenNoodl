/**
 * LIB-005: dependency links — the closure edges the user can actually see and,
 * where they are only a guess, drop.
 *
 * LIB-004's `SourceInventory` carries two parallel views of the same facts: the
 * flattened per-item dependency lists (`component.fileDependencies`, …) that
 * `plan()` walks, and `inventory.edges`, which additionally records *why* each
 * dependency exists (`via`) and how much to trust it (`confidence`).
 *
 * The UI needs the second view, and it needs one thing the engine does not
 * offer: dropping a heuristic edge. `analyze()`'s `inferred` edges come from the
 * legacy string-matching fallback — "this parameter's value happens to equal a
 * resource path" — and are wrong often enough that the spec asks for them to be
 * individually droppable. Rather than post-filter a plan (which would produce a
 * selection that no longer stands alone — exactly the failure mode AIX-003
 * removed), we drop the edge *before* planning and let the closure recompute.
 * An item that nothing else needs then simply leaves the plan; an item something
 * else still needs stays, correctly.
 *
 * A **link** is the (source item → target) pair a row shows. It may be backed by
 * several edges (`inventory.ts` records both an inferred and a later semantic
 * edge for the same file). A link is droppable only when EVERY edge behind it is
 * inferred — one semantic edge makes the dependency a fact, not a guess.
 *
 * @module noodl-editor/views/ImportFlow/model/dependencyLinks
 */

import type {
  DependencyEdge,
  DependencyKind,
  InventoryComponent,
  InventoryVariant,
  SourceInventory
} from '@noodl-utils/import-engine';

/** Stable identity for a dependency source (a component or a variant). */
export function sourceKey(from: DependencyEdge['from']): string {
  return from.kind === 'variant' ? `variant:${from.typename ?? ''}/${from.name}` : `${from.kind}:${from.name}`;
}

/** Stable identity for a dependency target. */
export function targetKey(to: DependencyEdge['to']): string {
  return to.kind === 'variant' ? `variant:${to.typename ?? ''}/${to.name}` : `${to.kind}:${to.name}`;
}

/** Stable identity for the (source → target) pair a UI row represents. */
export function linkKey(edge: DependencyEdge): string {
  return `${sourceKey(edge.from)}→${targetKey(edge.to)}`;
}

/**
 * One dependency as the UI shows it: what needs what, why, and whether the user
 * is allowed to disagree.
 */
export interface DependencyLink {
  key: string;
  from: DependencyEdge['from'];
  to: DependencyEdge['to'];
  kind: DependencyKind;
  /** All provenance strings behind this link, e.g. `Image.src (port type: image)`. */
  via: string[];
  /**
   * True when every backing edge is `inferred`. Only these are droppable — a
   * link with one semantic edge is a fact about the graph, not a guess.
   */
  isInferred: boolean;
}

/** Collapse `inventory.edges` into the per-link view, preserving first-seen order. */
export function collectLinks(edges: DependencyEdge[]): DependencyLink[] {
  const byKey = new Map<string, DependencyLink>();
  for (const edge of edges) {
    const key = linkKey(edge);
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.via.includes(edge.via)) existing.via.push(edge.via);
      if (edge.confidence === 'semantic') existing.isInferred = false;
      continue;
    }
    byKey.set(key, {
      key,
      from: edge.from,
      to: edge.to,
      kind: edge.to.kind,
      via: [edge.via],
      isInferred: edge.confidence === 'inferred'
    });
  }
  return [...byKey.values()];
}

/** Index links by the item that declares them, for the "what this drags along" panel. */
export function linksBySource(links: DependencyLink[]): Map<string, DependencyLink[]> {
  const map = new Map<string, DependencyLink[]>();
  for (const link of links) {
    const key = sourceKey(link.from);
    const list = map.get(key) ?? [];
    list.push(link);
    map.set(key, list);
  }
  return map;
}

function survivingLinks(edges: DependencyEdge[], dropped: ReadonlySet<string>): DependencyEdge[] {
  return dropped.size === 0 ? edges : edges.filter((edge) => !dropped.has(linkKey(edge)));
}

/**
 * Rebuild an inventory's flattened dependency lists from its edges, minus the
 * dropped links. Every flattened dependency in `buildInventory`'s output has at
 * least one edge, so this reproduces the original lists exactly when nothing is
 * dropped — a property the unit tests pin.
 *
 * The result is a normal `SourceInventory`: `plan()` consumes it unchanged and
 * has no idea an edge was dropped.
 */
export function deriveInventory(inventory: SourceInventory, dropped: ReadonlySet<string>): SourceInventory {
  if (dropped.size === 0) return inventory;

  const edges = survivingLinks(inventory.edges, dropped);

  const byComponent = new Map<string, DependencyEdge[]>();
  const byVariant = new Map<string, DependencyEdge[]>();
  for (const edge of edges) {
    const map = edge.from.kind === 'variant' ? byVariant : byComponent;
    const key = edge.from.kind === 'variant' ? `${edge.from.typename ?? ''}/${edge.from.name}` : edge.from.name;
    const list = map.get(key) ?? [];
    list.push(edge);
    map.set(key, list);
  }

  const unique = (values: string[]): string[] => [...new Set(values)];
  const namesOf = (list: DependencyEdge[], kind: DependencyKind): string[] =>
    unique(list.filter((e) => e.to.kind === kind).map((e) => e.to.name));

  const components: InventoryComponent[] = inventory.components.map((component) => {
    const list = byComponent.get(component.name) ?? [];
    const variantKeys = new Set<string>();
    const variantDependencies: InventoryComponent['variantDependencies'] = [];
    for (const edge of list) {
      if (edge.to.kind !== 'variant') continue;
      const key = `${edge.to.typename ?? ''}/${edge.to.name}`;
      if (variantKeys.has(key)) continue;
      variantKeys.add(key);
      variantDependencies.push({ typename: edge.to.typename ?? '', name: edge.to.name });
    }
    return {
      ...component,
      // `buildInventory` only treats slash-prefixed names as local component
      // references; the rebuild has to apply the same filter.
      dependencies: namesOf(list, 'component').filter((name) => name.startsWith('/')),
      fileDependencies: namesOf(list, 'file'),
      variantDependencies,
      styleDependencies: { colors: namesOf(list, 'colorStyle'), text: namesOf(list, 'textStyle') }
    };
  });

  const variants: InventoryVariant[] = inventory.variants.map((variant) => {
    const list = byVariant.get(`${variant.typename}/${variant.name}`) ?? [];
    return {
      ...variant,
      fileDependencies: namesOf(list, 'file'),
      styleDependencies: { colors: namesOf(list, 'colorStyle'), text: namesOf(list, 'textStyle') }
    };
  });

  return { ...inventory, components, variants, edges };
}
