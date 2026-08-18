/**
 * LIB-005: the selection model.
 *
 * The one idea that makes this flow different from the checkbox tree it
 * replaces: **the user selects roots, the engine derives the rest.**
 *
 * The old popup stored a boolean per row and then patched a second boolean
 * (`implicit`) over the top by re-walking the dependency graph itself, which
 * meant the on-screen state and the thing that actually got imported were two
 * different data structures that had to be kept in agreement. Here the state is
 * only `requested` (plus dropped heuristic links); everything else — what comes
 * along, what it collides with, what would change — is a pure function of that
 * via LIB-004's `plan()`.
 *
 * This is AIX-003's rule applied to import: a selection that does not stand on
 * its own is not *rejected*, it is **unrepresentable**. There is no state in
 * which a component is in and its dependency is out, because "out" is not a
 * thing a derived row can be.
 *
 * @module noodl-editor/views/ImportFlow/model/selection
 */

import type {
  ImportOrigin,
  ImportPlan,
  ImportSelection,
  ItemPolicy,
  PlanOptions,
  SelectionReason
} from '@noodl-utils/import-engine';

import { deriveInventory } from './dependencyLinks';
import { FlowItem, ItemCategory, itemKey } from './items';

export interface SelectionState {
  /** `FlowItem.key`s the user asked for directly. */
  requested: ReadonlySet<string>;
  /** Heuristic dependency links the user dropped (see dependencyLinks.ts). */
  droppedLinks: ReadonlySet<string>;
}

export const EMPTY_SELECTION: SelectionState = { requested: new Set(), droppedLinks: new Set() };

export function toggleRequested(state: SelectionState, keys: string[], select: boolean): SelectionState {
  const requested = new Set(state.requested);
  for (const key of keys) {
    if (select) requested.add(key);
    else requested.delete(key);
  }
  return { ...state, requested };
}

export function toggleDroppedLink(state: SelectionState, key: string): SelectionState {
  const droppedLinks = new Set(state.droppedLinks);
  if (droppedLinks.has(key)) droppedLinks.delete(key);
  else droppedLinks.add(key);
  return { ...state, droppedLinks };
}

/** Translate the requested key set into the engine's `ImportSelection`. */
export function toImportSelection(items: FlowItem[], requested: ReadonlySet<string>): ImportSelection {
  const pick = (category: ItemCategory) => items.filter((i) => i.category === category && requested.has(i.key));
  return {
    components: pick('component').map((i) => ({ name: i.name })),
    resources: pick('resource').map((i) => ({ name: i.name })),
    modules: pick('module').map((i) => ({ name: i.name })),
    variants: pick('variant').map((i) => ({ name: i.name, typename: i.typename ?? '' })),
    styles: {
      colors: pick('colorStyle').map((i) => ({ name: i.name })),
      text: pick('textStyle').map((i) => ({ name: i.name }))
    }
  };
}

// ─── Reading a plan back as per-row state ────────────────────────────────────

export interface PlannedStatus {
  key: string;
  category: ItemCategory;
  name: string;
  typename?: string;
  reason: SelectionReason;
  /** Names of the items that pulled this one in (empty when directly requested). */
  requiredBy: string[];
  collides: boolean;
  policy: ItemPolicy;
  /** SUB-007 delta for a colliding component under an overwrite policy. */
  diff?: ImportPlan['components'][number]['diff'];
}

/** Index a plan by `FlowItem.key` so a row can ask "am I in, and why?". */
export function planIndex(plan: ImportPlan): Map<string, PlannedStatus> {
  const index = new Map<string, PlannedStatus>();
  const add = (category: ItemCategory, item: PlannedStatus) => index.set(item.key, { ...item, category });

  for (const c of plan.components) {
    add('component', {
      key: itemKey('component', c.name),
      category: 'component',
      name: c.name,
      reason: c.reason,
      requiredBy: c.requiredBy,
      collides: c.collides,
      policy: c.policy,
      diff: c.diff
    });
  }

  const simple = (category: ItemCategory, items: ImportPlan['resources']) => {
    for (const i of items) {
      add(category, {
        key: itemKey(category, i.name, i.typename),
        category,
        name: i.name,
        typename: i.typename,
        reason: i.reason,
        requiredBy: i.requiredBy,
        collides: i.collides,
        policy: i.policy
      });
    }
  };
  simple('resource', plan.resources);
  simple('module', plan.modules);
  simple('variant', plan.variants);
  simple('colorStyle', plan.styles.colors);
  simple('textStyle', plan.styles.text);

  return index;
}

/**
 * What a browse row shows.
 * - `requested` — the user asked for it; they can take it back.
 * - `required` — it is in the plan because something requested needs it. There
 *   is no interaction that removes it while its requirer is in, which is the
 *   whole point (see the module comment).
 * - `available` — not in the plan.
 */
export type RowState = 'requested' | 'required' | 'available';

export function rowState(key: string, state: SelectionState, index: Map<string, PlannedStatus>): RowState {
  if (state.requested.has(key)) return 'requested';
  return index.has(key) ? 'required' : 'available';
}

/** Folder rows aggregate their descendants: all / some / none in the plan. */
export type FolderState = 'all' | 'some' | 'none';

export function folderState(keys: string[], index: Map<string, PlannedStatus>): FolderState {
  if (keys.length === 0) return 'none';
  const inPlan = keys.filter((key) => index.has(key)).length;
  if (inPlan === 0) return 'none';
  return inPlan === keys.length ? 'all' : 'some';
}

// ─── Collision resolutions ───────────────────────────────────────────────────

/**
 * The three explicit resolutions the review stage offers for a collision.
 *
 * `skip` is only ever offered where an item *collides*, which is what keeps the
 * closure honest through the review stage: skipping means "keep the version you
 * already have", and that version exists by definition — so every reference in
 * the imported set still resolves. A non-colliding item has no skip.
 */
export type Resolution = { kind: 'overwrite' } | { kind: 'skip' } | { kind: 'rename'; newName: string };

export const OVERWRITE: Resolution = { kind: 'overwrite' };
export const SKIP: Resolution = { kind: 'skip' };

export type ResolutionMap = Readonly<Record<string, Resolution>>;

/**
 * Turn per-item resolutions into the `PlanOptions` the engine understands.
 *
 * ⚠️ CN-017: `origin` is passed straight through rather than defaulted here. The
 * flow does not know where its source came from — its caller does — and a
 * default in this function would be the "safe-looking omission" the required
 * field exists to prevent.
 */
export function toPlanOptions(items: FlowItem[], resolutions: ResolutionMap, origin: ImportOrigin): PlanOptions {
  const byKey = new Map(items.map((i) => [i.key, i] as const));
  const renames: Record<string, string> = {};
  const skip: NonNullable<PlanOptions['skip']> = {
    components: [],
    resources: [],
    modules: [],
    variants: [],
    colors: [],
    text: []
  };

  for (const [key, resolution] of Object.entries(resolutions)) {
    const item = byKey.get(key);
    if (!item) continue;

    if (resolution.kind === 'rename') {
      // Only components can be renamed — the engine re-points references within
      // the imported set for components only.
      if (item.category === 'component' && resolution.newName.trim() !== '') {
        renames[item.name] = resolution.newName.trim();
      }
      continue;
    }
    if (resolution.kind !== 'skip') continue;

    switch (item.category) {
      case 'component':
        skip.components.push(item.name);
        break;
      case 'resource':
        skip.resources.push(item.name);
        break;
      case 'module':
        skip.modules.push(item.name);
        break;
      case 'variant':
        skip.variants.push(`${item.typename ?? ''}/${item.name}`);
        break;
      case 'colorStyle':
        skip.colors.push(item.name);
        break;
      case 'textStyle':
        skip.text.push(item.name);
        break;
    }
  }

  return { origin, renames, skip };
}

/**
 * Propose a non-colliding name: `Button` → `Button 2`, then `Button 3`, …
 * `taken` is everything the target already has plus the names this import will
 * introduce, so a rename can never collide with a sibling in the same import.
 */
export function suggestName(name: string, taken: ReadonlySet<string>): string {
  const { folder, label } = splitName(name);
  const base = label.replace(/ \d+$/, '');
  for (let n = 2; n < 1000; n++) {
    const candidate = `${folder}${base} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${folder}${base} ${Date.now()}`;
}

function splitName(name: string): { folder: string; label: string } {
  const index = name.lastIndexOf('/');
  return index === -1 ? { folder: '', label: name } : { folder: name.slice(0, index + 1), label: name.slice(index + 1) };
}

/** `deriveInventory` re-exported so the flow's callers only import one module. */
export { deriveInventory };
