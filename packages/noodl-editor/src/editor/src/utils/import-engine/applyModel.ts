/**
 * LIB-004: Import Engine v2 — pure apply core (model changes only).
 *
 * `applyModelChanges` executes an {@link ImportPlan}'s MODEL mutations
 * (components, styles, variants) against a target project, reading the source's
 * components/variants/styles through small injected interfaces. It is
 * deliberately Electron-free — no `ProjectModel`, no filesystem — so the id
 * semantics that nothing used to test (overwrite-id-reuse + node re-keying) are
 * unit-testable outside Electron with plain fakes. The disk work (resource and
 * module copies) and the `ProjectModel`-backed adapters live in `apply.ts`.
 *
 * The characterization suite in `tests/project/projectimport.js` is the contract
 * these semantics must preserve; `tests/import-engine/apply.test.ts` pins the
 * orchestration headlessly.
 *
 * @module noodl-editor/utils/import-engine/applyModel
 */

import type { ImportPlan, ItemPolicy } from './types';

/**
 * A source component that has been detached from its project and re-keyed (its
 * component id cleared, every node id refreshed) and is ready to graft into the
 * target. `model` is the opaque project-component object handed to
 * {@link ImportTarget.addComponent}; the pure core never inspects it.
 */
export interface PreparedComponent<M = unknown> {
  /** The detached, re-keyed component to add to the target. */
  readonly model: M;
  /** Overwrite the component id — used to reuse the target's id on overwrite. */
  setId(id: string): void;
  /** Rename the component (rename policy). */
  setName(newName: string): void;
  /** Re-point node references to a renamed sibling within the imported set. */
  rerouteComponentRefs(oldName: string, newName: string): void;
}

/** Reads the source project. Detach operations mutate the source in place. */
export interface ImportSource<M = unknown, V = unknown> {
  /**
   * Detach the named component from the source and prepare it for import
   * (clear component id, re-key node ids). Returns undefined if absent.
   */
  takeComponent(name: string): PreparedComponent<M> | undefined;
  /** The raw style definition for a kind+name, or undefined. */
  styleDef(kind: 'colors' | 'text', name: string): unknown;
  /** Detach the named variant from the source, or undefined if absent. */
  takeVariant(typename: string, name: string): V | undefined;
}

/** Mutates the target project. Model ops should enroll in the caller's undo group. */
export interface ImportTarget<M = unknown, V = unknown> {
  /** Whether a component already exists under this name. Asked separately from
   * `existingComponentId` because a component can exist WITHOUT an id — see the
   * overwrite path below. */
  hasComponent(name: string): boolean;
  /** The existing component's id under this name, for overwrite-id-reuse; undefined if none. */
  existingComponentId(name: string): string | undefined;
  removeComponentByName(name: string): void;
  addComponent(model: M): void;
  /** Merge style definitions into project metadata. Not undoable (legacy parity). */
  mergeStyles(styles: { colors: Record<string, unknown>; text: Record<string, unknown> }): void;
  hasVariant(typename: string, name: string): boolean;
  removeVariant(typename: string, name: string): void;
  addVariant(variant: V): void;
}

export interface ModelApplyResult {
  /** Component full names added or overwritten in the model. */
  componentsImported: string[];
  /** Variant `typename/name` keys added. */
  variantsImported: string[];
  /** Style names merged into project metadata. */
  stylesImported: { colors: string[]; text: string[] };
  /** Non-fatal notes (e.g. a planned item missing from the source). */
  warnings: string[];
}

const isSkip = (p: ItemPolicy): boolean => p.action === 'skip';

/**
 * Apply the plan's model mutations. Faithful to the legacy engine
 * (`projectimporter.js` `import`): every imported component is re-keyed to fresh
 * node ids, EXCEPT that an overwrite reuses the target component's existing id so
 * references to it keep resolving. Rename re-points references to renamed
 * siblings within the imported set.
 */
export function applyModelChanges<M, V>(
  plan: ImportPlan,
  source: ImportSource<M, V>,
  target: ImportTarget<M, V>
): ModelApplyResult {
  const componentsImported: string[] = [];
  const variantsImported: string[] = [];
  const stylesImported = { colors: [] as string[], text: [] as string[] };
  const warnings: string[] = [];

  // Rename map over the imported set: source name → new name.
  const renameMap = new Map<string, string>();
  for (const pc of plan.components) {
    if (!isSkip(pc.policy) && pc.policy.action === 'rename') renameMap.set(pc.name, pc.policy.newName);
  }

  // ── Components ───────────────────────────────────────────────────────────
  for (const pc of plan.components) {
    if (isSkip(pc.policy)) continue;
    const ref = source.takeComponent(pc.name);
    if (!ref) {
      warnings.push(`Component "${pc.name}" not found in source; skipped.`);
      continue;
    }
    const targetName = pc.policy.action === 'rename' ? pc.policy.newName : pc.name;
    if (pc.policy.action === 'rename') ref.setName(targetName);
    // Re-point references to any OTHER renamed sibling in the imported set.
    for (const [from, to] of renameMap) {
      if (from !== pc.name) ref.rerouteComponentRefs(from, to);
    }
    // Overwrite reuses the target's id (references keep resolving); else keep
    // the fresh id from re-keying.
    //
    // Removal is gated on EXISTENCE, not on having an id. Gating both on
    // `existingComponentId !== undefined` conflated "no such component" with
    // "component exists but carries no id", so an id-less component was never
    // removed and `addComponent` appended a SECOND component under the same
    // name. That is not a fixture curiosity: every real project has exactly one
    // id-less component — its root (`/App`) — so overwriting it on import
    // duplicated the root of the target project.
    if (target.hasComponent(targetName)) {
      const existingId = target.existingComponentId(targetName);
      target.removeComponentByName(targetName);
      if (existingId !== undefined) ref.setId(existingId);
    }
    target.addComponent(ref.model);
    componentsImported.push(targetName);
  }

  // ── Styles (metadata merge — not part of the undo group) ─────────────────
  const colors: Record<string, unknown> = {};
  const text: Record<string, unknown> = {};
  for (const s of plan.styles.colors) {
    if (isSkip(s.policy)) continue;
    const def = source.styleDef('colors', s.name);
    if (def !== undefined) {
      colors[s.name] = def;
      stylesImported.colors.push(s.name);
    }
  }
  for (const s of plan.styles.text) {
    if (isSkip(s.policy)) continue;
    const def = source.styleDef('text', s.name);
    if (def !== undefined) {
      text[s.name] = def;
      stylesImported.text.push(s.name);
    }
  }
  if (Object.keys(colors).length > 0 || Object.keys(text).length > 0) {
    target.mergeStyles({ colors, text });
  }

  // ── Variants ─────────────────────────────────────────────────────────────
  for (const v of plan.variants) {
    if (isSkip(v.policy)) continue;
    const typename = v.typename ?? '';
    const ref = source.takeVariant(typename, v.name);
    if (!ref) {
      warnings.push(`Variant "${typename}/${v.name}" not found in source; skipped.`);
      continue;
    }
    if (target.hasVariant(typename, v.name)) target.removeVariant(typename, v.name);
    target.addVariant(ref);
    variantsImported.push(`${typename}/${v.name}`);
  }

  return { componentsImported, variantsImported, stylesImported, warnings };
}
