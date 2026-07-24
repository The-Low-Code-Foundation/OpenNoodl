/**
 * SUB-007 step 7: three-way merge of a whole legacy project.json on top of the
 * graph engine, replacing `utils/projectmerger.js`.
 *
 * The engine merges one component at a time (GraphMerge). A project adds three
 * things the engine deliberately knows nothing about: the component list, the
 * variant list, and the project-level scalars (settings, styles, metadata,
 * rootNodeId, …). This module supplies those three and nothing else.
 *
 * Two deliberate differences from the legacy merger, both stated in
 * SUB-007-DESIGN.md §4.2:
 *
 *  - Where the legacy `mergeJSON` silently preferred ours on a project-level
 *    both-changed key, this raises a `project-setting` conflict. Nothing is
 *    dropped without being reported.
 *  - Conflicts live outside the graph data. `mergeProject()` still stamps the
 *    legacy `node.conflicts` arrays so the existing warnings UI keeps working,
 *    but that is a compatibility shim over the structured conflict list, not
 *    the source of truth.
 */

import { diffGraphs } from './GraphDiff';
import { applyResolution, mergeProjectSnapshots, resolveAll } from './GraphMerge';
import { deepClone, deepEqual, fromLegacyComponent, toLegacyComponent } from './GraphSnapshot';
import { ConflictSide, GraphConflict, GraphSnapshot, MergeResult, ParamMap } from './types';

export type LegacyProject = Record<string, unknown>;
type LegacyComponent = Record<string, unknown>;
type LegacyVariant = Record<string, unknown>;

/** A conflict plus where in the project it lives. */
export interface ProjectMergeConflict extends GraphConflict {
  /** Component display name, when the conflict is inside a component. */
  component?: string;
  /** `typename/name`, when the conflict is inside a variant. */
  variant?: string;
}

/**
 * The merge in progress. Held open so the conflict UI can apply resolutions
 * and re-serialize; `mergeProject()` just serializes it immediately.
 */
export interface ProjectMergeState {
  /** Ours-flavored project with `components` and `variants` removed. */
  skeleton: LegacyProject;
  /** Output order of component keys. */
  componentOrder: string[];
  /** Merged snapshot per component key. Mutated in place by resolutions. */
  mergedComponents: Map<string, GraphSnapshot>;
  /** Per-component merge results, for components that produced conflicts. */
  componentResults: Map<string, MergeResult>;
  /** Component key → display name, for conflict labelling. */
  componentNames: Map<string, string>;
  /** Snapshots for components dropped by a delete-vs-edit, keyed by conflict id. */
  pendingComponents: Map<string, { key: string; snapshot: GraphSnapshot }>;
  /**
   * Components only one side touched, kept as their original JSON. Serializing
   * these through the snapshot would normalize them (drop absent keys, add
   * empty arrays) and churn the diff of a component nobody edited.
   */
  verbatimComponents: Map<string, LegacyComponent>;
  variants: LegacyVariant[];
  /** Variant key → conflicts raised inside it. */
  variantConflicts: Map<string, ProjectMergeConflict[]>;
  conflicts: ProjectMergeConflict[];
}

// ---------------------------------------------------------------------------
// Keyed three-way helpers
// ---------------------------------------------------------------------------

/**
 * The legacy merger keys components by `id || name`. Keeping that means a
 * component rename is tracked by id (and surfaces as a rename, not a
 * delete + add) exactly as before; id-less components still key by name.
 */
function componentKey(component: LegacyComponent): string {
  return String(component.id ?? component.name ?? '');
}

function variantKey(variant: LegacyVariant): string {
  return `${String(variant.typename ?? '')}/${String(variant.name ?? '')}`;
}

function byKey<T extends Record<string, unknown>>(list: unknown, key: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  if (!Array.isArray(list)) return map;
  for (const item of list as T[]) {
    if (item && typeof item === 'object') map.set(key(item), item);
  }
  return map;
}

/**
 * Standard three-way over a parameter map. Both-changed calls `onConflict`,
 * whose return value wins (ours, by convention of every caller here).
 */
function mergeParamMap(
  base: ParamMap,
  ours: ParamMap,
  theirs: ParamMap,
  onConflict: (name: string, base: unknown, ours: unknown, theirs: unknown) => unknown
): ParamMap {
  const merged: ParamMap = { ...ours };
  const names = new Set([...Object.keys(ours ?? {}), ...Object.keys(theirs ?? {})]);
  for (const name of names) {
    const a = base?.[name];
    const o = ours?.[name];
    const t = theirs?.[name];
    if (deepEqual(o, t)) continue;
    if (deepEqual(t, a)) continue; // theirs unchanged — keep ours
    if (deepEqual(o, a)) {
      // ours unchanged — take theirs (including their deletion)
      if (t === undefined) delete merged[name];
      else merged[name] = t;
      continue;
    }
    merged[name] = onConflict(name, a, o, t);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Project-level scalars
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursive keyed three-way over the project's non-component fields.
 *
 * Deviation from legacy `mergeJSON`, deliberate: arrays are compared whole
 * rather than merged index-by-index (index-wise array merging produces
 * nonsense whenever an element is inserted), and a genuine both-changed key
 * raises a conflict instead of silently keeping ours.
 */
function mergeProjectFields(
  base: Record<string, unknown> | undefined,
  ours: Record<string, unknown> | undefined,
  theirs: Record<string, unknown> | undefined,
  path: string,
  conflicts: ProjectMergeConflict[]
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(ours ?? {}) };
  const keys = new Set([...Object.keys(ours ?? {}), ...Object.keys(theirs ?? {})]);

  for (const key of keys) {
    const a = base?.[key];
    const o = ours?.[key];
    const t = theirs?.[key];
    const here = path ? `${path}.${key}` : key;

    if (deepEqual(o, t)) continue;
    if (deepEqual(t, a)) continue;
    if (deepEqual(o, a)) {
      if (t === undefined) delete merged[key];
      else merged[key] = deepClone(t);
      continue;
    }

    if (isPlainObject(o) && isPlainObject(t)) {
      merged[key] = mergeProjectFields(isPlainObject(a) ? a : {}, o, t, here, conflicts);
      continue;
    }

    conflicts.push({
      id: `project-setting:${here}`,
      kind: 'project-setting',
      name: here,
      base: a,
      ours: o,
      theirs: t
    });
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const VARIANT_STATE_BUNDLES = ['stateParameters', 'stateTransitions'] as const;

function variantConflictRef(variant: LegacyVariant): GraphConflict['node'] {
  return {
    id: `variant:${variantKey(variant)}`,
    type: String(variant.typename ?? ''),
    label: String(variant.name ?? '')
  };
}

/**
 * Merge one variant. Same shape as the legacy `mergeVariant`: parameters,
 * the two state bundles, and default state transitions, each conflicting
 * per key rather than per variant.
 */
function mergeVariant(
  base: LegacyVariant | undefined,
  ours: LegacyVariant,
  theirs: LegacyVariant,
  conflicts: ProjectMergeConflict[]
): LegacyVariant {
  const key = variantKey(ours);
  const node = variantConflictRef(ours);
  const merged: LegacyVariant = { ...ours };

  const push = (kind: GraphConflict['kind'], name: string | undefined, state: string | undefined, o: unknown, t: unknown, a: unknown) => {
    conflicts.push({
      id: `${kind}:${node.id}:${[state, name].filter(Boolean).join('/')}`,
      kind,
      node,
      variant: key,
      name,
      state,
      base: a,
      ours: o,
      theirs: t
    });
  };

  merged.parameters = mergeParamMap(
    (base?.parameters as ParamMap) ?? {},
    (ours.parameters as ParamMap) ?? {},
    (theirs.parameters as ParamMap) ?? {},
    (name, a, o, t) => {
      push('parameter', name, undefined, o, t, a);
      return o;
    }
  );

  for (const bundle of VARIANT_STATE_BUNDLES) {
    if (ours[bundle] === undefined && theirs[bundle] === undefined && base?.[bundle] === undefined) continue;
    const kind = bundle === 'stateParameters' ? 'state-parameter' : 'state-transition';
    merged[bundle] = mergeParamMap(
      (base?.[bundle] as ParamMap) ?? {},
      (ours[bundle] as ParamMap) ?? {},
      (theirs[bundle] as ParamMap) ?? {},
      (state, a, o, t) =>
        mergeParamMap((a as ParamMap) ?? {}, (o as ParamMap) ?? {}, (t as ParamMap) ?? {}, (name, aa, oo, tt) => {
          push(kind, name, state, oo, tt, aa);
          return oo;
        })
    );
  }

  if (
    ours.defaultStateTransitions !== undefined ||
    theirs.defaultStateTransitions !== undefined ||
    base?.defaultStateTransitions !== undefined
  ) {
    merged.defaultStateTransitions = mergeParamMap(
      (base?.defaultStateTransitions as ParamMap) ?? {},
      (ours.defaultStateTransitions as ParamMap) ?? {},
      (theirs.defaultStateTransitions as ParamMap) ?? {},
      (state, a, o, t) => {
        push('default-state-transition', undefined, state, o, t, a);
        return o;
      }
    );
  }

  return merged;
}

function mergeVariants(
  base: unknown,
  ours: unknown,
  theirs: unknown,
  conflicts: ProjectMergeConflict[]
): LegacyVariant[] {
  const a = byKey<LegacyVariant>(base, variantKey);
  const o = byKey<LegacyVariant>(ours, variantKey);
  const t = byKey<LegacyVariant>(theirs, variantKey);

  const order: string[] = [];
  const push = (key: string) => {
    if (!order.includes(key)) order.push(key);
  };
  for (const key of o.keys()) push(key);
  for (const key of t.keys()) push(key);

  const merged: LegacyVariant[] = [];
  for (const key of order) {
    const ourVariant = o.get(key);
    const theirVariant = t.get(key);
    const baseVariant = a.get(key);

    if (deepEqual(ourVariant, theirVariant)) {
      if (ourVariant) merged.push(deepClone(ourVariant));
      continue;
    }
    if (deepEqual(theirVariant, baseVariant)) {
      if (ourVariant) merged.push(deepClone(ourVariant));
      continue;
    }
    if (deepEqual(ourVariant, baseVariant)) {
      if (theirVariant) merged.push(deepClone(theirVariant));
      continue;
    }
    // Deleted on one side, edited on the other: the edit survives (legacy rule).
    if (!ourVariant) {
      merged.push(deepClone(theirVariant));
      continue;
    }
    if (!theirVariant) {
      merged.push(deepClone(ourVariant));
      continue;
    }
    merged.push(mergeVariant(baseVariant, deepClone(ourVariant), theirVariant, conflicts));
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Project merge
// ---------------------------------------------------------------------------

function snapshotMap(components: unknown): Map<string, GraphSnapshot> {
  const map = new Map<string, GraphSnapshot>();
  if (!Array.isArray(components)) return map;
  for (const component of components as LegacyComponent[]) {
    if (!component || typeof component !== 'object') continue;
    map.set(componentKey(component), fromLegacyComponent(component));
  }
  return map;
}

/** Ours order first, then components only theirs has, then anything left. */
function outputOrder(ours: unknown, theirs: unknown, merged: Map<string, GraphSnapshot>): string[] {
  const order: string[] = [];
  const take = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const component of list as LegacyComponent[]) {
      if (!component || typeof component !== 'object') continue;
      const key = componentKey(component);
      if (merged.has(key) && !order.includes(key)) order.push(key);
    }
  };
  take(ours);
  take(theirs);
  for (const key of merged.keys()) if (!order.includes(key)) order.push(key);
  return order;
}

/**
 * Three-way merge a whole project, keeping the result open for resolution.
 * Inputs are not mutated.
 */
export function mergeProjectGraph(
  ancestors: LegacyProject | undefined,
  ours: LegacyProject,
  theirs: LegacyProject
): ProjectMergeState {
  const base = ancestors ?? {};
  const conflicts: ProjectMergeConflict[] = [];

  // Project-level scalars, with components and variants held out.
  const strip = (project: LegacyProject): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(project ?? {})) {
      if (key === 'components' || key === 'variants') continue;
      out[key] = project[key];
    }
    return out;
  };
  const skeleton = mergeProjectFields(strip(base), strip(ours), strip(theirs), '', conflicts);

  // Components. A component only one side changed needs no merge at all — keep
  // the original object so the merge does not rewrite untouched JSON.
  const baseRaw = byKey<LegacyComponent>(base.components, componentKey);
  const ourRaw = byKey<LegacyComponent>(ours.components, componentKey);
  const theirRaw = byKey<LegacyComponent>(theirs.components, componentKey);
  const verbatimComponents = new Map<string, LegacyComponent>();
  for (const key of new Set([...ourRaw.keys(), ...theirRaw.keys()])) {
    const o = ourRaw.get(key);
    const t = theirRaw.get(key);
    const a = baseRaw.get(key);
    if (!o || !t) continue;
    if (deepEqual(o, t) || deepEqual(t, a)) verbatimComponents.set(key, o);
    else if (deepEqual(o, a)) verbatimComponents.set(key, t);
  }

  const baseSnapshots = snapshotMap(base.components);
  const ourSnapshots = snapshotMap(ours.components);
  const theirSnapshots = snapshotMap(theirs.components);
  const componentMerge = mergeProjectSnapshots(baseSnapshots, ourSnapshots, theirSnapshots);

  const componentNames = new Map<string, string>();
  for (const [key, snapshot] of componentMerge.merged) componentNames.set(key, snapshot.name);
  for (const [key, snapshot] of ourSnapshots) if (!componentNames.has(key)) componentNames.set(key, snapshot.name);
  for (const [key, snapshot] of theirSnapshots) if (!componentNames.has(key)) componentNames.set(key, snapshot.name);

  for (const [key, result] of componentMerge.conflicted) {
    for (const conflict of result.conflicts) {
      conflicts.push({ ...conflict, id: `${key}::${conflict.id}`, component: componentNames.get(key) ?? key });
    }
  }

  const pendingComponents = new Map<string, { key: string; snapshot: GraphSnapshot }>();
  for (const conflict of componentMerge.componentConflicts) {
    const key = [...componentNames.entries()].find(([, name]) => name === conflict.name)?.[0] ?? conflict.name ?? '';
    conflicts.push({ ...conflict, component: conflict.name });
    if (conflict.deletedBy === 'ours' && conflict.theirs) {
      pendingComponents.set(conflict.id, { key, snapshot: conflict.theirs as GraphSnapshot });
    }
  }

  // Variants.
  const variantConflicts = new Map<string, ProjectMergeConflict[]>();
  const variantConflictList: ProjectMergeConflict[] = [];
  const variants = mergeVariants(base.variants, ours.variants, theirs.variants, variantConflictList);
  for (const conflict of variantConflictList) {
    const list = variantConflicts.get(conflict.variant) ?? [];
    list.push(conflict);
    variantConflicts.set(conflict.variant, list);
    conflicts.push(conflict);
  }

  return {
    skeleton,
    componentOrder: outputOrder(ours.components, theirs.components, componentMerge.merged),
    mergedComponents: componentMerge.merged,
    componentResults: componentMerge.conflicted,
    componentNames,
    pendingComponents,
    verbatimComponents,
    variants,
    variantConflicts,
    conflicts
  };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function splitConflictId(id: string): { componentKey?: string; innerId: string } {
  const index = id.indexOf('::');
  if (index === -1) return { innerId: id };
  return { componentKey: id.slice(0, index), innerId: id.slice(index + 2) };
}

/** Apply one side of one conflict. No-op for an unknown id. */
export function resolveProjectConflict(state: ProjectMergeState, conflictId: string, side: ConflictSide): void {
  const conflict = state.conflicts.find((c) => c.id === conflictId);
  if (!conflict || conflict.resolution) return;

  const { componentKey: key, innerId } = splitConflictId(conflictId);
  if (key && state.componentResults.has(key)) {
    applyResolution(state.componentResults.get(key), innerId, side);
    conflict.resolution = side;
    return;
  }

  if (conflict.kind === 'delete-vs-edit' && !conflict.node) {
    resolveComponentDeletion(state, conflict, side);
    conflict.resolution = side;
    return;
  }

  if (conflict.kind === 'project-setting') {
    if (side === 'theirs') setByPath(state.skeleton, conflict.name, conflict.theirs);
    conflict.resolution = side;
    return;
  }

  if (conflict.variant) {
    resolveVariantConflict(state, conflict, side);
    conflict.resolution = side;
  }
}

function resolveComponentDeletion(state: ProjectMergeState, conflict: ProjectMergeConflict, side: ConflictSide): void {
  const pending = state.pendingComponents.get(conflict.id);
  if (conflict.deletedBy === 'ours') {
    // Theirs kept an edited component we deleted. 'theirs' restores it.
    if (side === 'theirs' && pending) {
      state.mergedComponents.set(pending.key, pending.snapshot);
      if (!state.componentOrder.includes(pending.key)) state.componentOrder.push(pending.key);
    }
    return;
  }
  // Theirs deleted a component we edited. 'theirs' honours the deletion.
  if (side === 'theirs') {
    const key = [...state.componentNames.entries()].find(([, name]) => name === conflict.name)?.[0];
    if (key) {
      state.mergedComponents.delete(key);
      state.componentOrder = state.componentOrder.filter((entry) => entry !== key);
    }
  }
}

function resolveVariantConflict(state: ProjectMergeState, conflict: ProjectMergeConflict, side: ConflictSide): void {
  if (side !== 'theirs') return;
  const variant = state.variants.find((entry) => variantKey(entry) === conflict.variant);
  if (!variant) return;

  switch (conflict.kind) {
    case 'parameter':
      setInMap(variant, 'parameters', [conflict.name], conflict.theirs);
      break;
    case 'state-parameter':
      setInMap(variant, 'stateParameters', [conflict.state, conflict.name], conflict.theirs);
      break;
    case 'state-transition':
      setInMap(variant, 'stateTransitions', [conflict.state, conflict.name], conflict.theirs);
      break;
    case 'default-state-transition':
      setInMap(variant, 'defaultStateTransitions', [conflict.state], conflict.theirs);
      break;
    default:
      break;
  }
}

function setInMap(target: Record<string, unknown>, bundle: string, path: string[], value: unknown): void {
  if (!isPlainObject(target[bundle])) target[bundle] = {};
  let container = target[bundle] as Record<string, unknown>;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!isPlainObject(container[key])) container[key] = {};
    container = container[key] as Record<string, unknown>;
  }
  const last = path[path.length - 1];
  if (value === undefined) delete container[last];
  else container[last] = deepClone(value);
}

function setByPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let container = target;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isPlainObject(container[parts[i]])) container[parts[i]] = {};
    container = container[parts[i]] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (value === undefined) delete container[last];
  else container[last] = deepClone(value);
}

/** Take one side for every unresolved conflict — the escape hatch. */
export function resolveAllProjectConflicts(state: ProjectMergeState, side: ConflictSide): void {
  // Component-internal conflicts go through the engine's own ordering rules.
  for (const [key, result] of state.componentResults) {
    resolveAll(result, side);
    for (const conflict of state.conflicts) {
      if (conflict.resolution) continue;
      const parts = splitConflictId(conflict.id);
      if (parts.componentKey === key) conflict.resolution = side;
    }
  }
  for (const conflict of state.conflicts) {
    if (!conflict.resolution) resolveProjectConflict(state, conflict.id, side);
  }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Legacy `node.conflicts` entry, as the warnings UI expects it. */
interface LegacyNodeConflict {
  type: string;
  name?: string;
  state?: string;
  ours: unknown;
  theirs: unknown;
  oursDisplayName?: string;
  theirsDisplayName?: string;
}

/**
 * The seven conflict kinds the pre-SUB-007 warnings UI knows how to render.
 * Kinds with no legacy equivalent (delete-vs-edit, reparent, connection-*,
 * child-order, add-add, comment, component-*) were silently resolved by the
 * legacy merger and have no warning to regress — they surface in the new
 * conflict UI only.
 */
function toLegacyNodeConflict(conflict: GraphConflict): LegacyNodeConflict | undefined {
  switch (conflict.kind) {
    case 'parameter':
      return { type: 'parameter', name: conflict.name, ours: conflict.ours, theirs: conflict.theirs };
    case 'source-code':
      return {
        type: 'sourceCode',
        name: conflict.name,
        oursDisplayName: '[Source code]',
        theirsDisplayName: '[Source code]',
        ours: conflict.ours,
        theirs: conflict.theirs
      };
    case 'state-parameter':
      return {
        type: 'stateParameter',
        state: conflict.state,
        name: conflict.name,
        ours: conflict.ours,
        theirs: conflict.theirs
      };
    case 'state-transition':
      return {
        type: 'stateTransition',
        state: conflict.state,
        name: conflict.name,
        ours: conflict.ours,
        theirs: conflict.theirs
      };
    case 'default-state-transition':
      return { type: 'defaultStateTransition', state: conflict.state, ours: conflict.ours, theirs: conflict.theirs };
    case 'variant':
      return { type: 'variant', ours: conflict.ours, theirs: conflict.theirs };
    case 'typename':
      return { type: 'typename', ours: conflict.ours, theirs: conflict.theirs };
    default:
      return undefined;
  }
}

export interface SerializeOptions {
  /**
   * Write unresolved conflicts into `node.conflicts` / `variant.conflicts` so
   * the pre-SUB-007 warnings UI can render them. Default true — the new
   * conflict UI passes false and reads the structured list instead.
   */
  stampLegacyConflicts?: boolean;
}

/** Build the merged project.json from the current state of the merge. */
export function serializeMergedProject(state: ProjectMergeState, options: SerializeOptions = {}): LegacyProject {
  const stamp = options.stampLegacyConflicts !== false;

  const byNode = new Map<string, LegacyNodeConflict[]>();
  if (stamp) {
    for (const conflict of state.conflicts) {
      if (conflict.resolution || conflict.variant || !conflict.node) continue;
      const legacy = toLegacyNodeConflict(conflict);
      if (!legacy) continue;
      const { componentKey: key } = splitConflictId(conflict.id);
      const mapKey = `${key ?? ''}::${conflict.node.id}`;
      const list = byNode.get(mapKey) ?? [];
      list.push(legacy);
      byNode.set(mapKey, list);
    }
  }

  const components: LegacyComponent[] = [];
  for (const key of state.componentOrder) {
    const snapshot = state.mergedComponents.get(key);
    if (!snapshot) continue;
    const verbatim = state.verbatimComponents.get(key);
    const component = verbatim ? deepClone(verbatim) : toLegacyComponent(snapshot);
    if (stamp) stampComponentConflicts(component, key, byNode);
    components.push(component);
  }

  const project: LegacyProject = { ...deepClone(state.skeleton), components };

  if (state.variants.length > 0) {
    project.variants = state.variants.map((variant) => {
      const out = deepClone(variant);
      if (!stamp) {
        delete out.conflicts;
        return out;
      }
      const conflicts = (state.variantConflicts.get(variantKey(variant)) ?? [])
        .filter((conflict) => !conflict.resolution)
        .map(toLegacyNodeConflict)
        .filter(Boolean);
      if (conflicts.length > 0) out.conflicts = conflicts;
      else delete out.conflicts;
      return out;
    });
  }

  return project;
}

/** Walk the nested legacy node tree, attaching (or clearing) conflict arrays. */
function stampComponentConflicts(
  component: LegacyComponent,
  key: string,
  byNode: Map<string, LegacyNodeConflict[]>
): void {
  const walk = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes as Record<string, unknown>[]) {
      const conflicts = byNode.get(`${key}::${String(node.id)}`);
      if (conflicts && conflicts.length > 0) node.conflicts = conflicts;
      else delete node.conflicts;
      walk(node.children);
    }
  };
  const graph = component.graph as Record<string, unknown> | undefined;
  walk(graph?.roots);
}

// ---------------------------------------------------------------------------
// Legacy entry point
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for `utils/projectmerger.js#mergeProject`.
 *
 * Same signature, same return shape (the merged project, ours-flavored where
 * conflicted, with legacy `conflicts` arrays stamped on nodes) — so the git
 * merge driver, the Git client and the version-control panel can switch over
 * without changing their call shape.
 */
export function mergeProject(
  ancestors: LegacyProject | undefined,
  ours: LegacyProject,
  theirs: LegacyProject
): LegacyProject {
  const state = mergeProjectGraph(ancestors, ours, theirs);
  return serializeMergedProject(state);
}

/**
 * Semantic diff of two whole projects, component by component. Used by the
 * diff review UI; `diffProjectSnapshots` is the per-component engine call.
 */
export function diffProjects(base: LegacyProject, target: LegacyProject) {
  const baseSnapshots = snapshotMap(base?.components);
  const targetSnapshots = snapshotMap(target?.components);
  const addedComponents: string[] = [];
  const removedComponents: string[] = [];
  const changedComponents = [];

  const keys = new Set([...baseSnapshots.keys(), ...targetSnapshots.keys()]);
  for (const key of keys) {
    const before = baseSnapshots.get(key);
    const after = targetSnapshots.get(key);
    if (!before && after) addedComponents.push(after.name);
    else if (before && !after) removedComponents.push(before.name);
    else if (before && after) {
      const diff = diffGraphs(before, after);
      if (diff.changes.length > 0) changedComponents.push(diff);
    }
  }

  return { addedComponents, removedComponents, changedComponents };
}
