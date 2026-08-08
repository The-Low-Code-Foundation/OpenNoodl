/**
 * AWP-001/AWP-002 — which top-level nodes are the ones that actually draw.
 *
 * `visualRoots` is the list the runtime renders a component instance from:
 * `componentModel.roots` comes from `componentData.roots`, and
 * `if (this._internal.roots.length === 0)` means nothing is drawn
 * (`componentinstance.ts:322`). The disk-render harness maps the field straight
 * through as `roots: nodesFile.visualRoots || []`.
 *
 * **In the editor the field is derived, never authored.** `NodeGraphModel.toJSON()`
 * recomputes it on every serialize via
 * `getVisualRootIds() = this.roots.filter((root) => root.type.allowAsChild).map((x) => x.id)`,
 * so an editor save repairs any component that lacks it. MCP had no equivalent:
 * `visual_roots` was `.optional()` on all three write doors, carried no
 * `.describe()`, appeared in no tool description, and absent-in meant absent-out.
 * A model that never mentioned the field authored an app that renders nothing
 * while every instrument reported a pass — F43, which cost DeepSeek V4 Pro 18
 * turns and about $1.70 before it dismantled its own page.
 *
 * This module is that derivation, as one function, so the two producers of the
 * project format can stop disagreeing about the shape of a component.
 *
 * ### The predicate, measured rather than assumed
 *
 * The editor filters on the *node library's* `allowAsChild`; this side has the
 * catalog's `isVisual`. AWP-001's task file assumed they were equivalent, so it
 * was checked across the whole enriched catalog on 2026-08-08:
 *
 *   allowAsChild === true && isVisual === true : 29 types
 *   allowAsChild === true && isVisual !== true :  0 types
 *   isVisual === true && allowAsChild !== true :  0 types
 *
 * **The two predicates select the same 29 types, with zero disagreement**, and
 * `Component Inputs` / `Component Outputs` are outside that set under both — so
 * an interface node can never land in a derived list. `visualRootsParity` in the
 * conformance suite re-runs that measurement, so the day the catalog and the node
 * library drift apart is the day it fails rather than the day an app renders blank.
 */

import { catalogIndex, isVisualNodeType } from './catalog';
import { unflattenNodes } from './editor-deps';
import type { LegacyNode, NodeV2 } from './editor-deps';

/**
 * Answers "does a node of this type draw anything?" for one project.
 *
 * A node's type is either a catalog type (`Group`, `Text`) or the legacyName of
 * a project component (`/Components/NavBar`) — an instance. An instance draws
 * exactly when the component it points at has visual roots of its own, so the
 * question is recursive, and a project that has not been loaded cannot answer it.
 */
export type VisualTypePredicate = (typeName: string) => boolean;

/** The catalog's answer alone. Correct for every built-in type; says `false` for
 * a component instance, because the catalog has never heard of one. */
export const catalogVisualPredicate: VisualTypePredicate = (typeName) => isVisualNodeType(typeName);

/**
 * The editor's rule, applied to a component's flat `nodes.json` list.
 *
 * Root determination is the editor's own `unflattenNodes` rather than a
 * re-implementation of "has no parent" — the same anti-paraphrase reason the
 * conformance gate runs the real reader.
 */
export function deriveVisualRootIds(nodes: NodeV2[] | undefined, isVisual: VisualTypePredicate): string[] {
  const roots: LegacyNode[] = unflattenNodes(nodes ?? []);
  return roots.filter((root) => isVisual(root.type)).map((root) => root.id);
}

/**
 * `deriveVisualRootIds` over a component that may instantiate other components.
 *
 * `componentIsVisual` is asked about any type the catalog does not know; a caller
 * with the whole project in hand resolves it against that component's own derived
 * roots, and a caller without one passes `() => false` and gets the catalog answer.
 */
export function deriveVisualRootIdsInProject(
  nodes: NodeV2[] | undefined,
  componentIsVisual: VisualTypePredicate
): string[] {
  return deriveVisualRootIds(nodes, (typeName) =>
    catalogIndex().hasType(typeName) ? catalogVisualPredicate(typeName) : componentIsVisual(typeName)
  );
}

/**
 * AWP-001 §3 — the read-time half.
 *
 * Write-time derivation fixes every component written from now on. It does
 * nothing for what is already on disk, and 11 components in one real project are
 * already on disk. So every *reader* derives too when the field is absent, and a
 * damaged project becomes correct the next time anything looks at it rather than
 * the next time somebody remembers to re-save it.
 *
 * ⚠️ Absent and empty are not the same thing, and the difference is the whole
 * point. `undefined` means nobody computed this — derive. `[]` means a writer
 * computed it and there was nothing visual — believe it. A fallback that treated
 * `[]` as "derive" would make a logic-only component undiagnosable.
 */
export function readVisualRoots(
  nodesFile: { nodes?: NodeV2[]; visualRoots?: string[] } | undefined,
  isVisual: VisualTypePredicate
): string[] {
  if (!nodesFile) return [];
  if (nodesFile.visualRoots !== undefined) return nodesFile.visualRoots;
  return deriveVisualRootIds(nodesFile.nodes, isVisual);
}

/**
 * A predicate that can answer for component instances too, by asking whether the
 * component being instantiated has visual roots of its own.
 *
 * `nodesFor` takes a node type that is not a catalog type — i.e. a component
 * legacyName such as `/Components/NavBar` — and returns that component's flat
 * node list, or `undefined` if the project has no such component.
 *
 * Memoised, and cycle-guarded: a component that (directly or transitively)
 * instantiates itself is treated as non-visual for the purposes of the recursion
 * rather than overflowing the stack. A cycle is already invalid, and a gate that
 * crashes on invalid input reports nothing about the valid input beside it.
 */
export function makeProjectVisualPredicate(nodesFor: (legacyName: string) => NodeV2[] | undefined): VisualTypePredicate {
  const memo = new Map<string, boolean>();
  const inFlight = new Set<string>();

  const isVisual = (typeName: string): boolean => {
    if (catalogIndex().hasType(typeName)) return catalogVisualPredicate(typeName);
    const cached = memo.get(typeName);
    if (cached !== undefined) return cached;
    if (inFlight.has(typeName)) return false; // cycle
    const nodes = nodesFor(typeName);
    if (!nodes) {
      memo.set(typeName, false);
      return false;
    }
    inFlight.add(typeName);
    const visual = deriveVisualRootIds(nodes, isVisual).length > 0;
    inFlight.delete(typeName);
    memo.set(typeName, visual);
    return visual;
  };

  return isVisual;
}

/**
 * What a writer should put in `nodes.json`, given what the caller asked for.
 *
 * Two rules that are not optional, both from AWP-001:
 *
 * - **An explicit `visual_roots` wins, verbatim.** Derivation is the default, not
 *   an override — a model that deliberately passes a *subset* of the visual roots
 *   must get exactly that subset. All three session-6 models passed the field.
 * - **A logic-only component gets no key at all**, not `[]`. "No visual node" is a
 *   legitimate, renders-nowhere state and is distinct from "nobody computed this";
 *   BEN-003 depends on that distinction being real, and an empty array would erase it.
 */
export function resolveVisualRoots(
  nodes: NodeV2[] | undefined,
  explicit: string[] | undefined,
  isVisual: VisualTypePredicate
): { visualRoots?: string[]; derived: boolean } {
  const chosen = explicit !== undefined ? explicit : deriveVisualRootIds(nodes, isVisual);
  // Empty means "omit the key", from either source. `buildComponentV2Files` only
  // writes the field when `length > 0`, so writing `[]` would put MCP output
  // outside what the editor's own writer can produce — the exact class of defect
  // AWP-002 gates. It also keeps `visualRoots: []` free to mean nothing at all.
  if (chosen.length === 0) return { derived: explicit === undefined };
  return { visualRoots: chosen, derived: explicit === undefined };
}
