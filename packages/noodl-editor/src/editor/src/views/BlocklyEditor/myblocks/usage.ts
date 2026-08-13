/**
 * VFN-009 — where a saved block is actually used.
 *
 * `MyBlocksStore` deliberately cannot answer this. Its own `remove` says so:
 *
 * > *"Logic Builder nodes known to reference this definition. The store cannot find these
 * > itself — it has no project."*
 *
 * Supplying that list is this task's real work, and it is the same list three surfaces need: the
 * usage column in the *Saved blocks* section, the propagation warning shown before a definition is
 * edited, and the `referencingNodeIds` argument that makes `remove`'s refusal cover nodes as well
 * as other definitions.
 *
 * ## Why this is a pure function of a snapshot
 *
 * The walk is over `ProjectModel` — components, their graphs, their nodes' parameters — and
 * nothing in this directory may import that. So the model side is reduced to {@link ProjectScan},
 * a lump of plain data, and everything that can be *wrong* happens on this side of that line where
 * a plain-Node runner can grade it. The adapter that produces a scan from a live project is
 * `MyBlocksProjectScan.ts`, one directory up, beside `MyBlocksShelves.ts` and for the same reason.
 *
 * ## 🔴 Recomputed, never cached
 *
 * `MyBlocksStore.graph()` already refuses to read the definition graph's edges off the stored
 * `requires`, because *"the case it is guarding against is a stored `requires` that no longer
 * matches the body it claims to describe."* A usage index cached in project settings would be that
 * same mistake one level up, and it would be worse: a stale `requires` is wrong about a body
 * somebody edited, while a stale usage index is wrong about a node somebody deleted, and the
 * warning built on it would name call sites that are not there.
 *
 * ⚠️ **A node open in a tab may have unflushed blocks.** An edit reaches the model 300 ms after it
 * settles, so a scan taken when a panel opened is already out of date by the time a button on it
 * is pressed. Take the scan at the moment the answer is needed. That is a rule about *callers*,
 * and it is why nothing here memoises.
 *
 * @module BlocklyEditor/myblocks
 */

import type { BlocklyWorkspaceJson } from './format';
import { collectReferences } from './references';

/**
 * The node type whose `workspace` parameter can contain call blocks.
 *
 * The runtime's own name for it (`logic-builder.ts`, `name: 'Logic Builder'`), which is what
 * `NodeGraphNode.typename` holds. The *display* name has changed at least once and may change
 * again; this is the identity, and a scan keyed on the display name would silently find nothing.
 */
export const LOGIC_BUILDER_NODE_TYPE = 'Logic Builder';

/** The parameter a Visual Function's blocks are serialised into. */
export const WORKSPACE_PARAMETER = 'workspace';

/** One node, reduced to what a usage scan reads. */
export interface ScannedNode {
  id: string;
  /** `NodeGraphNode.typename`. */
  typename: string;
  /** The node's label — display only, and a snapshot, exactly like `Tab.nodeName`. */
  label?: string;
  /** The `workspace` parameter as it is stored: a JSON string. Anything else is ignored. */
  workspace?: unknown;
}

/** One component, reduced to what a usage scan reads. */
export interface ScannedComponent {
  /** `ComponentModel.id` — the identity, and what a caller navigates by. */
  id?: string;
  /** `ComponentModel.displayName` — the last path segment. */
  name?: string;
  /** `ComponentModel.fullName` — the whole path, read off the model and never assembled. */
  path?: string;
  nodes: ScannedNode[];
}

export interface ProjectScan {
  components: ScannedComponent[];
}

/** One place a definition is used, named rather than counted. */
export interface UsageSite {
  nodeId: string;
  /** The node's label. Never empty — see {@link UNNAMED_NODE}. */
  nodeName: string;
  componentId?: string;
  /** The component's display name, or `''` when the scan did not record one. */
  componentName: string;
  componentPath?: string;
}

/** What a node with no label is called. Matches `tabLocation.ts`, deliberately. */
export const UNNAMED_NODE = 'Unnamed';

/** One other saved block that calls this one. */
export interface UsingDefinition {
  id: string;
  name: string;
}

export interface DefinitionUsage {
  definitionId: string;
  /** Every Logic Builder node whose blocks call it, in scan order. */
  nodes: UsageSite[];
  /** Every other definition whose body calls it. */
  definitions: UsingDefinition[];
  /** How many distinct components the nodes are spread over. */
  componentCount: number;
  /** `nodes.length + definitions.length` — the number the warning leads with. */
  total: number;
}

/**
 * Anything that can answer "which definitions call this one, and what is it called".
 *
 * `MyBlocksStore` satisfies this structurally, which is the point: the definition half of the
 * count comes from `store.referencesTo`, the *same* call `remove` makes when it refuses. If the
 * warning computed it a second way the two could disagree, and a warning that says "used in 5
 * places" over a refusal that names 4 is worse than either number alone.
 */
export interface DefinitionLookup {
  referencesTo(id: string): string[];
  get(id: string): { name?: string } | undefined;
}

/**
 * Parse a node's `workspace` parameter.
 *
 * 🔴 **Never throws, and `null` is a real answer.** A `workspace` parameter can be absent (a
 * freshly dropped node), the empty string (the same thing, spelled differently), or malformed
 * (hand-edited `project.json`, a truncated write). None of those is a reason to fail a scan of the
 * whole project — a single bad node must not make every other definition's usage count vanish,
 * because a count that silently dropped to zero is exactly the input that makes a delete refusal
 * stop refusing.
 *
 * An already-parsed object is accepted too, so a caller holding a workspace in hand does not have
 * to re-stringify it to ask this question.
 */
export function parseWorkspaceParameter(value: unknown): BlocklyWorkspaceJson | null {
  if (value && typeof value === 'object') return value as BlocklyWorkspaceJson;
  if (typeof value !== 'string' || value.trim() === '') return null;

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as BlocklyWorkspaceJson;
  } catch {
    return null;
  }
}

/**
 * Every definition id called by any Logic Builder node in the project, with the sites.
 *
 * **One pass over the project, not one per definition.** Listing a shelf of twenty definitions in
 * the settings section otherwise costs twenty walks of every component's graph and twenty
 * `JSON.parse` of every workspace, on every render.
 *
 * `collectReferences` is the authority on what a reference *is*, and reusing it here is what keeps
 * the count in the warning and the refusal in `remove` the same number.
 */
export function scanNodeUsage(scan: ProjectScan | undefined | null): Map<string, UsageSite[]> {
  const byDefinition = new Map<string, UsageSite[]>();
  if (!scan || !Array.isArray(scan.components)) return byDefinition;

  for (const component of scan.components) {
    if (!component || !Array.isArray(component.nodes)) continue;

    for (const node of component.nodes) {
      if (!node || node.typename !== LOGIC_BUILDER_NODE_TYPE) continue;

      const workspace = parseWorkspaceParameter(node.workspace);
      if (!workspace) continue;

      const ids = collectReferences(workspace);
      if (ids.length === 0) continue;

      const site: UsageSite = {
        nodeId: node.id,
        nodeName: (node.label ?? '').trim() || UNNAMED_NODE,
        componentId: component.id,
        componentName: (component.name ?? '').trim(),
        componentPath: component.path
      };

      for (const id of ids) {
        const sites = byDefinition.get(id);
        if (sites) sites.push(site);
        else byDefinition.set(id, [site]);
      }
    }
  }

  return byDefinition;
}

/** Assemble one definition's usage from a scan that has already been walked. */
export function usageFrom(id: string, nodeSites: Map<string, UsageSite[]>, lookup: DefinitionLookup): DefinitionUsage {
  const nodes = nodeSites.get(id) ?? [];

  const definitions = lookup.referencesTo(id).map((referrer) => ({
    id: referrer,
    // A definition that resolves to nothing still counts — it is a real edge in the graph the
    // store just reported — but it has no name to show, so it says its id rather than nothing.
    name: (lookup.get(referrer)?.name ?? '').trim() || referrer
  }));

  // ⚠️ Keyed by the component's *identity*, and every site whose component is unknown falls into
  // one bucket rather than each becoming a component of its own. "4 nodes across 3 components" has
  // to be a statement about components; counting an absence of knowledge as a distinct place would
  // inflate the number the warning leads with, which is the number a builder decides on.
  const components = new Set<string>();
  for (const site of nodes) components.add(site.componentId ?? site.componentPath ?? site.componentName ?? '');

  return {
    definitionId: id,
    nodes,
    definitions,
    componentCount: components.size,
    total: nodes.length + definitions.length
  };
}

/** One definition's usage, computed live. */
export function definitionUsage(id: string, scan: ProjectScan | undefined | null, lookup: DefinitionLookup): DefinitionUsage {
  return usageFrom(id, scanNodeUsage(scan), lookup);
}

/**
 * Every listed definition's usage, from one walk of the project.
 *
 * The section renders one row per definition and every row shows a count, so this is the call it
 * makes — `definitionUsage` in a loop would re-walk the project per row.
 */
export function definitionUsageMap(
  ids: readonly string[],
  scan: ProjectScan | undefined | null,
  lookup: DefinitionLookup
): Map<string, DefinitionUsage> {
  const nodeSites = scanNodeUsage(scan);
  const result = new Map<string, DefinitionUsage>();
  for (const id of ids) result.set(id, usageFrom(id, nodeSites, lookup));
  return result;
}

/**
 * The node ids `MyBlocksStore.remove` needs, deduplicated.
 *
 * Deduplicated because one node can call the same definition several times, and a refusal that
 * said "used by 3 nodes" about one node three times would be wrong in the direction that makes a
 * builder distrust the whole warning.
 */
export function referencingNodeIds(usage: DefinitionUsage): string[] {
  return distinctSites(usage).map((site) => site.nodeId);
}

/** The distinct nodes, in scan order — what the "where it is used" list renders. */
export function distinctSites(usage: DefinitionUsage): UsageSite[] {
  const seen = new Set<string>();
  const sites: UsageSite[] = [];
  for (const site of usage.nodes) {
    if (seen.has(site.nodeId)) continue;
    seen.add(site.nodeId);
    sites.push(site);
  }
  return sites;
}
