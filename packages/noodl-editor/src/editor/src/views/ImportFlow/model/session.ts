/**
 * LIB-005: one import session — the seam between the React surface and LIB-004.
 *
 * The UI never calls `analyze`/`plan`/`apply` directly. It holds a
 * `LoadedSource` (one disk read) and a `SelectionState`, and asks for a plan
 * whenever either changes. Planning is pure and cheap, so "what happens if I
 * rename this?" is answered by re-planning rather than by patching a plan —
 * there is no second code path that could disagree with the engine.
 *
 * @module noodl-editor/views/ImportFlow/model/session
 */

import { analyzeSource, plan as planImport } from '@noodl-utils/import-engine';
import type { ImportOrigin, ImportPlan, ProjectData, SourceInventory } from '@noodl-utils/import-engine';

import { collectLinks, DependencyLink, deriveInventory, linksBySource } from './dependencyLinks';
import { buildItems, FlowItem } from './items';
import { ResolutionMap, SelectionState, toImportSelection, toPlanOptions } from './selection';
import type { TargetSnapshot } from './targetProject';

export interface LoadedSource {
  sourceDir: string;
  inventory: SourceInventory;
  project: ProjectData;
  items: FlowItem[];
  links: DependencyLink[];
  /** Links indexed by the item that declares them (`sourceKey`). */
  linksBySource: Map<string, DependencyLink[]>;
}

export async function loadSource(sourceDir: string): Promise<LoadedSource> {
  const { inventory, project } = await analyzeSource(sourceDir);
  const links = collectLinks(inventory.edges);
  return {
    sourceDir,
    inventory,
    project,
    items: buildItems(inventory, project),
    links,
    linksBySource: linksBySource(links)
  };
}

/**
 * Plan the current selection. Dropped heuristic links are applied by deriving a
 * new inventory *before* planning — so the closure recomputes and the plan stays
 * internally consistent, rather than being filtered afterwards into something
 * that no longer stands alone.
 */
export function planSelection(
  source: LoadedSource,
  target: TargetSnapshot,
  state: SelectionState,
  /** CN-017: where `source` came from. Required — see {@link ImportOrigin}. */
  origin: ImportOrigin,
  resolutions: ResolutionMap = {}
): ImportPlan {
  const inventory = deriveInventory(source.inventory, state.droppedLinks);
  return planImport(
    inventory,
    source.project,
    toImportSelection(source.items, state.requested),
    target,
    toPlanOptions(source.items, resolutions, origin)
  );
}

/**
 * Names a rename must avoid: everything the target already has, plus every
 * component this import is about to introduce (under its effective name).
 *
 * `excludeName` drops one component — identified by its ORIGINAL name, which is
 * its stable identity — from the set. Callers validating a rename must pass the
 * component being renamed, because that component contributes its own new name
 * here: without the exclusion every proposed rename collides with itself and the
 * field can never be satisfied. Excluding by original name is still safe against
 * renaming onto the target's existing component of that name, since
 * `target.componentNames` supplies it independently.
 */
export function takenComponentNames(
  plan: ImportPlan,
  target: TargetSnapshot,
  excludeName?: string
): Set<string> {
  const taken = new Set(target.componentNames);
  for (const component of plan.components) {
    if (excludeName !== undefined && component.name === excludeName) continue;
    taken.add(component.policy.action === 'rename' ? component.policy.newName : component.name);
  }
  return taken;
}
