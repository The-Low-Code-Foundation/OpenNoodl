/**
 * LIB-004: Import Engine v2 — public types.
 *
 * The engine separates PLANNING from APPLYING across three pure-ish stages:
 *
 *   analyze(sourceDir) → SourceInventory     what a source project contains + a
 *                                            real dependency graph
 *   plan(inventory, selection, target)       a dry-run ImportPlan: closure,
 *        → ImportPlan                        collisions, per-item policy, diffs
 *   apply(plan, target) → ImportResult       mutate the live model in one undo
 *                                            group; report file writes separately
 *
 * Design notes and the SUB-007 consumption contract live in
 * dev-docs/tasks/phase-21-library-and-import/LIB-004-IMPORT-ENGINE.md.
 *
 * Naming: this is `ProjectImportEngine`, deliberately distinct from
 * src/editor/src/io/ProjectImporter.ts (STRUCT-003's v2→legacy converter) and
 * from the legacy src/editor/src/utils/projectimporter.js it replaces.
 *
 * @module noodl-editor/utils/import-engine/types
 */

import type { ComponentDiff } from '../../versioning';

// ─── Dependency graph ────────────────────────────────────────────────────────

/**
 * How a dependency edge was established.
 * - `semantic`: derived from actual node/parameter semantics — the node's type
 *   is a component reference, or a parameter's catalog PORT TYPE says
 *   filepath/color/textstyle/component. Trustworthy.
 * - `inferred`: the legacy string-matching heuristic — a string parameter value
 *   that merely *equals* a known resource path or style name. Retained (not
 *   deleted) because catalog port names lag the stored parameter keys for
 *   evolved nodes (e.g. Image's file port is catalogued as `src` but old
 *   projects store it under `image`), so the heuristic still catches real edges
 *   the semantic pass misses. Flagged so callers can treat it as a guess.
 */
export type EdgeConfidence = 'semantic' | 'inferred';

export type DependencyKind = 'component' | 'file' | 'variant' | 'colorStyle' | 'textStyle' | 'module';

/** An importable item that can be the source of a dependency edge. */
export type InventoryItemKind = 'component' | 'variant' | 'style';

export interface DependencyTarget {
  kind: DependencyKind;
  /** File path, component full name, style name, module name, or variant name. */
  name: string;
  /** For variant edges, the node type the variant applies to. */
  typename?: string;
}

export interface DependencyEdge {
  /** Which inventory item declares the dependency. */
  from: { kind: InventoryItemKind; name: string; typename?: string };
  to: DependencyTarget;
  confidence: EdgeConfidence;
  /** Human-readable provenance, e.g. `Image.src (port type: image)`. */
  via: string;
}

// ─── Source inventory ────────────────────────────────────────────────────────

export interface InventoryStyleDependencies {
  colors: string[];
  text: string[];
}

export interface InventoryVariantDependency {
  typename: string;
  name: string;
}

/**
 * A component in the source project. The per-item dependency lists are kept
 * back-compatible with the legacy `listComponentsAndDependencies` output (so the
 * `ImportPopup` adapter and the closure walk keep working); the richer provenance
 * lives in {@link SourceInventory.edges}.
 */
export interface InventoryComponent {
  name: string;
  /** The source component's id, preserved for overwrite-id-reuse in apply(). */
  id?: string;
  dependencies: string[];
  fileDependencies: string[];
  variantDependencies: InventoryVariantDependency[];
  styleDependencies: InventoryStyleDependencies;
}

export interface InventoryColorStyle {
  name: string;
}

export interface InventoryTextStyle {
  name: string;
  fileDependencies?: string[];
}

export interface InventoryStyles {
  colors: InventoryColorStyle[];
  text: InventoryTextStyle[];
}

export interface InventoryVariant {
  name: string;
  typename: string;
  fileDependencies: string[];
  styleDependencies: InventoryStyleDependencies;
}

export interface InventoryResource {
  name: string;
}

export interface InventoryModule {
  name: string;
}

export interface SourceInventory {
  /** Absolute directory the source project was loaded from. */
  sourceDir: string;
  components: InventoryComponent[];
  resources: InventoryResource[];
  modules: InventoryModule[];
  styles: InventoryStyles;
  variants: InventoryVariant[];
  /** The real dependency graph — every edge with its provenance and confidence. */
  edges: DependencyEdge[];
}

// ─── Selection ───────────────────────────────────────────────────────────────

/**
 * What the caller asked to import, by name. Anything omitted is not requested
 * directly (but may still be pulled in as a dependency during planning). Shapes
 * mirror the legacy `getSelectedImports()` output so the adapter is thin.
 */
export interface ImportSelection {
  components?: { name: string }[];
  resources?: { name: string }[];
  modules?: { name: string }[];
  variants?: { name: string; typename: string }[];
  styles?: {
    colors?: { name: string }[];
    text?: { name: string }[];
  };
}

// ─── Plan ────────────────────────────────────────────────────────────────────

export type ItemPolicy =
  | { action: 'add' }
  | { action: 'overwrite' }
  | { action: 'skip' }
  | { action: 'rename'; newName: string };

/** Why an item is in the plan. */
export type SelectionReason = 'requested' | 'dependency';

export interface PlannedComponent {
  name: string;
  id?: string;
  reason: SelectionReason;
  /** Names of items that pulled this one in (for `dependency` reason). */
  requiredBy: string[];
  collides: boolean;
  policy: ItemPolicy;
  /**
   * For a colliding component under an `overwrite` policy, the SUB-007 diff of
   * the source component against the target's current version — names the nodes
   * that would change. Undefined when there is no collision or the target has no
   * such component to diff against.
   */
  diff?: ComponentDiff;
}

export interface PlannedItem {
  name: string;
  typename?: string;
  reason: SelectionReason;
  requiredBy: string[];
  collides: boolean;
  policy: ItemPolicy;
}

export interface ImportPlan {
  sourceDir: string;
  components: PlannedComponent[];
  resources: PlannedItem[];
  modules: PlannedItem[];
  variants: PlannedItem[];
  styles: {
    colors: PlannedItem[];
    text: PlannedItem[];
  };
  /**
   * Rename map applied within the imported set: source component name → new
   * name. References to renamed components inside other imported components are
   * re-pointed during apply().
   */
  renames: Record<string, string>;
  /** True if any planned item (with a non-skip policy) collides with the target. */
  hasCollisions: boolean;
}

// ─── Result ──────────────────────────────────────────────────────────────────

export interface ImportResult {
  result: 'success' | 'failure';
  message?: string;
  /** Component full names added or overwritten in the model (undoable). */
  componentsImported: string[];
  /** Variant `typename/name` keys added (undoable). */
  variantsImported: string[];
  /** Style names merged into project metadata (undoable). */
  stylesImported: { colors: string[]; text: string[] };
  /**
   * File and module copies performed on disk. Reported separately with the
   * honest note that disk writes are NOT part of the undo group.
   */
  filesCopied: string[];
  modulesCopied: string[];
  /** Non-fatal notes (e.g. a file that failed to copy). */
  warnings: string[];
}

// ─── Minimal target/source data shapes (keep the pure core Electron-free) ─────

/**
 * The subset of a project the pure inventory/plan cores read. Both a live
 * `ProjectModel` (via `toJSON()`) and a raw `project.json` object satisfy this,
 * which is what keeps `buildInventory` and `plan` unit-testable outside Electron.
 */
export interface ProjectData {
  name?: string;
  components: ProjectComponentData[];
  metadata?: {
    styles?: {
      colors?: Record<string, unknown>;
      text?: Record<string, unknown>;
    };
    [key: string]: unknown;
  };
  variants?: RawVariant[];
  [key: string]: unknown;
}

export interface ProjectComponentData {
  name: string;
  id?: string;
  graph?: {
    roots?: RawNode[];
    connections?: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface RawNode {
  id?: string;
  type?: string;
  parameters?: Record<string, unknown>;
  /** Correct spelling. */
  stateParameters?: Record<string, Record<string, unknown>>;
  /** Legacy typo — present in on-disk fixtures; both are read. */
  stateParamaters?: Record<string, Record<string, unknown>>;
  variantName?: string;
  children?: RawNode[];
  [key: string]: unknown;
}

export interface RawVariant {
  name?: string;
  typename?: string;
  parameters?: Record<string, unknown>;
  stateParameters?: Record<string, Record<string, unknown>>;
  stateParamaters?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}
