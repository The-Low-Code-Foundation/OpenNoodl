/**
 * STYLE-002: Element Config Types
 *
 * TypeScript interfaces for the element configuration and variant system.
 * Configs define default styles and pre-built variants for Noodl's core visual nodes,
 * so elements look good immediately on creation and offer quick style switching.
 */

/**
 * Style properties applied in a specific interaction state.
 */
export interface StateStyles {
  hover?: Record<string, string>;
  active?: Record<string, string>;
  focus?: Record<string, string>;
  disabled?: Record<string, string>;
  placeholder?: Record<string, string>;
}

/**
 * A named style variant for a node type.
 * Contains base CSS property overrides and optional interaction state styles.
 */
export interface VariantConfig {
  /** Base CSS properties for this variant (camelCase keys). */
  [property: string]: string | StateStyles | undefined;
  /** Interaction state style overrides. */
  states?: StateStyles;
}

/**
 * A size preset — a named set of CSS property overrides (typically spacing + font size).
 */
export type SizePresets = Record<string, Record<string, string>>;

/**
 * Full configuration for a node type.
 * Describes defaults applied on creation, optional size presets, and named style variants.
 */
export interface ElementConfig {
  /** Noodl node type identifier (e.g. 'net.noodl.controls.button'). */
  nodeType: string;

  /**
   * Default CSS property values applied when the node is first created.
   * Use `var(--token-name)` references to link to design tokens.
   * The special key `_variant` sets the initially-selected variant name.
   */
  defaults: Record<string, string>;

  /**
   * Optional named size presets (e.g. sm, md, lg, xl).
   * Each preset is a partial set of CSS overrides applied on top of defaults.
   */
  sizes?: SizePresets;

  /**
   * Named style variants. Keys are variant names (e.g. 'primary', 'card').
   * Each variant specifies CSS properties and optional interaction states.
   */
  variants: Record<string, VariantConfig>;
}

/**
 * Resolved variant styles — base styles with interaction states separated out.
 */
export interface ResolvedVariant {
  /** Flat CSS properties for the default (non-interacting) state. */
  baseStyles: Record<string, string>;
  /** Interaction state style overrides. */
  states: StateStyles;
}
