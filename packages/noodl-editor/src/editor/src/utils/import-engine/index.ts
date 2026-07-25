/**
 * LIB-004: Import Engine v2 (`ProjectImportEngine`).
 *
 * A typed, three-stage replacement for the legacy singleton
 * `utils/projectimporter.js`, consuming SUB-007's diff engine for overwrite
 * deltas. Deliberately named to collide with neither `utils/projectimporter.js`
 * (the engine it replaces) nor `io/ProjectImporter.ts` (STRUCT-003's v2→legacy
 * converter).
 *
 * Stages:
 *   analyze(sourceDir) → SourceInventory   (analyze.ts, I/O shell over buildInventory)
 *   plan(inventory, source, selection, target) → ImportPlan   (plan.ts, pure)
 *   apply(plan, target) → ImportResult     (apply.ts, I/O shell over applyModel.ts)
 *
 * The five legacy call sites reach the engine through `legacyAdapter.ts`, a thin
 * strangler that keeps the shared `ImportPopup` working until LIB-005 replaces it.
 *
 * @module noodl-editor/utils/import-engine
 */

export * from './types';
export { analyze } from './analyze';
export { buildInventory, catalogPortType } from './inventory';
export type { PortTypeLookup, BuildInventoryInput } from './inventory';
export { plan } from './plan';
export type { TargetProject, PlanOptions } from './plan';
export { apply } from './apply';
export { applyModelChanges } from './applyModel';
export type { ImportSource, ImportTarget, PreparedComponent, ModelApplyResult } from './applyModel';
export { LegacyImportAdapter } from './legacyAdapter';
export type { LegacyImports, LegacyCollisions } from './legacyAdapter';
