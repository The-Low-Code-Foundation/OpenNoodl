/**
 * STYLE-003: StylePresetsModel
 *
 * Manages the registry of built-in style presets.
 * Pure functions — no singleton, no side effects.
 *
 * Usage:
 *   import { getAllPresets, getPreset } from './StylePresetsModel';
 *   const presets = getAllPresets(); // all 5 built-ins
 *   const preset  = getPreset('minimal'); // by id
 */

import { ModernPreset, MinimalPreset, PlayfulPreset, EnterprisePreset, SoftPreset } from './presets';
import { StylePreset } from './StylePresetTypes';

/** All built-in presets in display order (Modern first = default). */
const BUILT_IN_PRESETS: StylePreset[] = [ModernPreset, MinimalPreset, PlayfulPreset, EnterprisePreset, SoftPreset];

/**
 * Returns all built-in style presets in display order.
 */
export function getAllPresets(): StylePreset[] {
  return BUILT_IN_PRESETS;
}

/**
 * Returns a built-in preset by its id, or undefined if not found.
 */
export function getPreset(id: string): StylePreset | undefined {
  return BUILT_IN_PRESETS.find((p) => p.id === id);
}

/**
 * Returns the default preset (Modern).
 */
export function getDefaultPreset(): StylePreset {
  return ModernPreset;
}

// ─── Pending Preset ──────────────────────────────────────────────────────────
//
// Module-level store for a "pending preset" to be applied the next time
// StyleTokensModel initialises (i.e. when the editor first opens after a
// new project is created from the launcher).
//
// Flow:
//   1. User picks a preset in CreateProjectModal → launcher calls setPendingPresetId
//   2. Project is created and editor route is triggered
//   3. StyleTokensModel._buildEffectiveTokens() calls consumePendingPreset()
//   4. Preset tokens are applied and persisted to project metadata
//   5. Pending preset is cleared — subsequent reloads behave normally

let _pendingPresetId: string | null = null;

/**
 * Mark a preset as "pending" — it will be applied when StyleTokensModel
 * next builds its effective token map (i.e. on editor startup).
 * Pass `null` or `'modern'` to cancel / use defaults.
 */
export function setPendingPresetId(id: string | null): void {
  // Modern = default values, nothing to apply
  _pendingPresetId = id === 'modern' || id === null ? null : id;
}

/**
 * Consume (read + clear) the pending preset.
 * Returns the pending StylePreset, or null if none is set.
 * After calling this, _pendingPresetId is cleared.
 */
export function consumePendingPreset(): StylePreset | null {
  if (!_pendingPresetId) return null;
  const preset = getPreset(_pendingPresetId);
  _pendingPresetId = null;
  return preset ?? null;
}
