/**
 * LIB-004: Import Engine v2 — pure planner.
 *
 * `plan` is a dry run: it resolves the dependency closure of a selection over the
 * inventory graph, detects collisions against a target project, computes a
 * SUB-007 `ComponentDiff` for every colliding component that would be
 * overwritten, and assigns each item a policy (`add | overwrite | skip |
 * rename`). It performs NO mutation — the result is data for a UI (LIB-005) and
 * for `apply`.
 *
 * The target is injected as a small query interface so the planner stays
 * Electron-free and unit-testable; the editor supplies a `ProjectModel`-backed
 * implementation in `apply.ts`.
 *
 * @module noodl-editor/utils/import-engine/plan
 */

import { diffGraphs, fromLegacyComponent } from '../../versioning';
import type { ComponentDiff } from '../../versioning';

import type {
  ImportPlan,
  ImportSelection,
  ItemPolicy,
  PlannedComponent,
  PlannedItem,
  ProjectComponentData,
  ProjectData,
  SelectionReason,
  SourceInventory
} from './types';

/**
 * The subset of the target project the planner reads. A live `ProjectModel`
 * satisfies this via thin adapters (see apply.ts); tests satisfy it with plain
 * objects.
 */
export interface TargetProject {
  /** The target's component (legacy JSON shape) for collision + diff, or undefined. */
  getComponent(name: string): ProjectComponentData | undefined;
  hasResource(name: string): boolean;
  hasModule(name: string): boolean;
  hasVariant(typename: string, name: string): boolean;
  hasColorStyle(name: string): boolean;
  hasTextStyle(name: string): boolean;
}

export interface PlanOptions {
  /**
   * Per-source-component rename requests: source name → new name. A renamed
   * component's collision is evaluated against its NEW name, and references to it
   * within the imported set are re-pointed during apply.
   */
  renames?: Record<string, string>;
  /**
   * Names the caller explicitly wants skipped even if pulled in as a dependency
   * (component full names / resource paths / `typename/name` for variants /
   * style names). Prefer this over post-filtering so the plan stays honest.
   */
  skip?: {
    components?: string[];
    resources?: string[];
    modules?: string[];
    variants?: string[];
    colors?: string[];
    text?: string[];
  };
}

/** Accumulate "who required this" provenance while resolving the closure. */
class RequiredBy {
  private readonly map = new Map<string, Set<string>>();
  add(target: string, by: string): void {
    if (!this.map.has(target)) this.map.set(target, new Set());
    this.map.get(target)!.add(by);
  }
  get(target: string): string[] {
    return [...(this.map.get(target) ?? [])];
  }
}

export function plan(
  inventory: SourceInventory,
  sourceProject: ProjectData,
  selection: ImportSelection,
  target: TargetProject,
  options: PlanOptions = {}
): ImportPlan {
  const renames = options.renames ?? {};
  const skip = options.skip ?? {};

  const compByName = new Map(inventory.components.map((c) => [c.name, c]));
  const variantByKey = new Map(inventory.variants.map((v) => [`${v.typename}/${v.name}`, v]));

  // ── Resolve the dependency closure over the inventory graph ────────────────
  const requestedComponents = new Set((selection.components ?? []).map((c) => c.name));
  const requestedVariants = new Set((selection.variants ?? []).map((v) => `${v.typename}/${v.name}`));

  const components = new Set<string>();
  const resources = new Set<string>((selection.resources ?? []).map((r) => r.name));
  const modules = new Set<string>((selection.modules ?? []).map((m) => m.name));
  const variantKeys = new Set<string>(requestedVariants);
  const colors = new Set<string>((selection.styles?.colors ?? []).map((c) => c.name));
  const text = new Set<string>((selection.styles?.text ?? []).map((t) => t.name));

  const requiredBy = new RequiredBy();

  // Pull a component and everything it transitively needs.
  const queue: string[] = [...requestedComponents];
  while (queue.length > 0) {
    const name = queue.shift()!;
    if (components.has(name)) continue;
    components.add(name);
    const comp = compByName.get(name);
    if (!comp) continue;

    for (const dep of comp.dependencies) {
      if (!components.has(dep)) {
        requiredBy.add(dep, name);
        queue.push(dep);
      }
    }
    for (const f of comp.fileDependencies) {
      resources.add(f);
      requiredBy.add(f, name);
    }
    for (const v of comp.variantDependencies) {
      const key = `${v.typename}/${v.name}`;
      variantKeys.add(key);
      requiredBy.add(key, name);
    }
    for (const c of comp.styleDependencies.colors) {
      colors.add(c);
      requiredBy.add(c, name);
    }
    for (const t of comp.styleDependencies.text) {
      text.add(t);
      requiredBy.add(t, name);
    }
  }

  // Variants pull their own file/style dependencies.
  for (const key of [...variantKeys]) {
    const v = variantByKey.get(key);
    if (!v) continue;
    for (const f of v.fileDependencies) {
      resources.add(f);
      requiredBy.add(f, key);
    }
    for (const c of v.styleDependencies.colors) {
      colors.add(c);
      requiredBy.add(c, key);
    }
    for (const t of v.styleDependencies.text) {
      text.add(t);
      requiredBy.add(t, key);
    }
  }

  // Text styles pull the font file their definition names. The legacy popup did
  // this (`_markTextStyle` marked the style's `fileDependencies`); without it a
  // text style can arrive with no font behind it. Run last, and over the final
  // set, so a style pulled in by a component is covered too.
  const textByName = new Map(inventory.styles.text.map((t) => [t.name, t]));
  for (const name of [...text]) {
    for (const file of textByName.get(name)?.fileDependencies ?? []) {
      resources.add(file);
      requiredBy.add(file, name);
    }
  }

  // ── Build planned items ────────────────────────────────────────────────────
  const effectiveName = (name: string) => renames[name] ?? name;
  const reasonFor = (name: string, requested: Set<string>): SelectionReason =>
    requested.has(name) ? 'requested' : 'dependency';

  const plannedComponents: PlannedComponent[] = [];
  let anyCollision = false;

  for (const name of components) {
    const src = compByName.get(name);
    const targetName = effectiveName(name);
    const isSkipped = skip.components?.includes(name);
    const targetComp = target.getComponent(targetName);
    const collides = !isSkipped && targetComp !== undefined;
    let policy: ItemPolicy;
    if (isSkipped) policy = { action: 'skip' };
    else if (renames[name]) policy = { action: 'rename', newName: renames[name] };
    else if (collides) policy = { action: 'overwrite' };
    else policy = { action: 'add' };

    // SUB-007 diff for an overwrite: what nodes would change in the target.
    let diff: ComponentDiff | undefined;
    if (collides && policy.action === 'overwrite' && src && targetComp) {
      diff = diffColliding(targetComp, sourceComponentJSON(sourceProject, name, src));
    }

    if (collides) anyCollision = true;
    plannedComponents.push({
      name,
      id: src?.id,
      reason: reasonFor(name, requestedComponents),
      requiredBy: requiredBy.get(name),
      collides,
      policy,
      diff
    });
  }

  const plannedResources = simpleItems([...resources], requiredBy, resources, selection.resources, (n) =>
    target.hasResource(n), skip.resources
  );
  const plannedModules = simpleItems([...modules], requiredBy, modules, selection.modules, (n) => target.hasModule(n), skip.modules);
  const plannedVariants = [...variantKeys].map((key): PlannedItem => {
    const v = variantByKey.get(key);
    const typename = v?.typename ?? key.split('/')[0];
    const name = v?.name ?? key.slice(typename.length + 1);
    const isSkipped = skip.variants?.includes(key) || skip.variants?.includes(name);
    const collides = !isSkipped && target.hasVariant(typename, name);
    return {
      name,
      typename,
      reason: requestedVariants.has(key) ? 'requested' : 'dependency',
      requiredBy: requiredBy.get(key),
      collides,
      policy: isSkipped ? { action: 'skip' } : collides ? { action: 'overwrite' } : { action: 'add' }
    };
  });
  const plannedColors = simpleItems([...colors], requiredBy, new Set((selection.styles?.colors ?? []).map((c) => c.name)), selection.styles?.colors, (n) => target.hasColorStyle(n), skip.colors);
  const plannedText = simpleItems([...text], requiredBy, new Set((selection.styles?.text ?? []).map((t) => t.name)), selection.styles?.text, (n) => target.hasTextStyle(n), skip.text);

  const collisionInAny =
    anyCollision ||
    [...plannedResources, ...plannedModules, ...plannedVariants, ...plannedColors, ...plannedText].some(
      (i) => i.collides && i.policy.action !== 'skip'
    );

  return {
    sourceDir: inventory.sourceDir,
    components: plannedComponents,
    resources: plannedResources,
    modules: plannedModules,
    variants: plannedVariants,
    styles: { colors: plannedColors, text: plannedText },
    renames: { ...renames },
    hasCollisions: collisionInAny
  };
}

function simpleItems(
  names: string[],
  requiredBy: RequiredBy,
  requested: Set<string>,
  requestedList: { name: string }[] | undefined,
  collidesFn: (name: string) => boolean,
  skipList: string[] | undefined
): PlannedItem[] {
  const requestedSet = requested ?? new Set((requestedList ?? []).map((r) => r.name));
  return names.map((name) => {
    const isSkipped = skipList?.includes(name);
    const collides = !isSkipped && collidesFn(name);
    return {
      name,
      reason: requestedSet.has(name) ? 'requested' : 'dependency',
      requiredBy: requiredBy.get(name),
      collides,
      policy: isSkipped ? { action: 'skip' } : collides ? { action: 'overwrite' } : { action: 'add' }
    };
  });
}

/** The source component's legacy JSON, for diffing/serialization. */
function sourceComponentJSON(
  project: ProjectData,
  name: string,
  fallback: { name: string }
): ProjectComponentData {
  return project.components.find((c) => c.name === name) ?? (fallback as ProjectComponentData);
}

/** Diff a colliding component: target (base) → source (incoming). */
function diffColliding(targetComp: ProjectComponentData, sourceComp: ProjectComponentData): ComponentDiff | undefined {
  try {
    return diffGraphs(
      fromLegacyComponent(toLegacyComponentShape(targetComp)),
      fromLegacyComponent(toLegacyComponentShape(sourceComp))
    );
  } catch {
    // A malformed component should not sink the whole plan; the collision is
    // still reported, just without a node-level delta.
    return undefined;
  }
}

/** Normalize a project component into the `fromLegacyComponent` input shape. */
function toLegacyComponentShape(comp: ProjectComponentData): Record<string, unknown> {
  return {
    name: comp.name,
    graph: comp.graph ?? { roots: [], connections: [] },
    ports: (comp as Record<string, unknown>).ports ?? [],
    metadata: (comp as Record<string, unknown>).metadata ?? {}
  };
}
