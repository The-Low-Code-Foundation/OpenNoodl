/**
 * STYLE-003: Style Preset Types
 *
 * TypeScript interfaces for the style preset system.
 * Presets define a complete set of semantic token overrides that give
 * a project a cohesive visual aesthetic from the moment of creation.
 */

/**
 * Minimal preview metadata used to render preset cards in the selector UI.
 * All values are raw CSS color strings or px values — no token references.
 */
export interface PresetPreview {
  /** Primary action color (button backgrounds, links). */
  primaryColor: string;
  /** Page/card background. */
  backgroundColor: string;
  /** Card/surface color. */
  surfaceColor: string;
  /** Default border color. */
  borderColor: string;
  /** Text color. */
  textColor: string;
  /** Secondary/muted text color. */
  mutedTextColor: string;
  /** Border radius for medium elements (e.g. buttons, cards). */
  radiusMd: string;
}

/**
 * A named style preset — a curated set of semantic token overrides.
 *
 * Built-in presets are never stored in project metadata; they're applied
 * as overrides on top of the default token set when a project is created.
 *
 * The `tokens` map uses the same CSS custom property names as `DefaultTokens.ts`
 * (e.g. `--primary`, `--radius-md`). Only the semantic/structural tokens that
 * vary between presets are included — palette scale tokens stay as-is.
 */
export interface StylePreset {
  /** Unique slug identifier (e.g. 'modern', 'minimal'). */
  id: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** One-line description shown below the preset cards. */
  description: string;
  /** Whether this is a built-in (non-deletable) preset. */
  isBuiltIn: boolean;
  /**
   * Token overrides. Keys are CSS custom property names.
   * Only needs to contain tokens that DIFFER from the Modern/default preset.
   * For the Modern preset, this is empty (it IS the defaults).
   */
  tokens: Record<string, string>;
  /** Simplified preview data for the PresetCard UI. */
  preview: PresetPreview;
}
