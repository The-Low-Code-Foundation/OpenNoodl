/**
 * ElementConfigTypes
 *
 * Type definitions for the Element Configuration system.
 * This system provides default styling, variants, and size presets
 * for Noodl's visual nodes (Button, Text, Group, etc.).
 *
 * @module noodl-editor/models/ElementConfigs
 * @since 1.2.0
 */

/**
 * CSS property values with design token references
 * Values can be direct CSS values or CSS variable references like 'var(--token-name)'
 */
export type CSSValue = string;

/**
 * State-specific style overrides for interactive elements
 */
export interface StateConfig {
  /** Styles applied on hover state */
  hover?: Record<string, CSSValue>;

  /** Styles applied on active/pressed state */
  active?: Record<string, CSSValue>;

  /** Styles applied on focus state (inputs, buttons) */
  focus?: Record<string, CSSValue>;

  /** Styles applied when element is disabled */
  disabled?: Record<string, CSSValue>;

  /** Styles applied to placeholder text (inputs only) */
  placeholder?: Record<string, CSSValue>;
}

/**
 * A style variant configuration
 * Defines the CSS properties and state-specific overrides for a variant
 */
export interface VariantConfig {
  /** Base CSS properties for this variant */
  [property: string]: CSSValue | StateConfig | undefined;

  /** Optional state-specific overrides */
  states?: StateConfig;
}

/**
 * Size preset configuration
 * Defines CSS property overrides for different size variations (sm, md, lg, xl)
 */
export interface SizeConfig {
  /** CSS properties for this size */
  [property: string]: CSSValue;
}

/**
 * Complete element configuration
 * Defines defaults, variants, and size presets for a visual node type
 */
export interface ElementConfig {
  /** Noodl node type identifier (e.g., 'net.noodl.visual.button') */
  nodeType: string;

  /** Default CSS properties applied on node creation */
  defaults: Record<string, CSSValue>;

  /** Named style variants (e.g., 'primary', 'secondary', 'outline') */
  variants: Record<string, VariantConfig>;

  /** Optional size presets (e.g., 'sm', 'md', 'lg', 'xl') */
  sizes?: Record<string, SizeConfig>;

  /** Optional description for documentation */
  description?: string;

  /** Optional categories for grouping (e.g., ['button', 'form', 'input']) */
  categories?: string[];
}

/**
 * Resolved styles for a node
 * Result of merging defaults + variant + size + user overrides
 */
export interface ResolvedStyles {
  /** Base CSS properties (defaults + variant + size) */
  base: Record<string, CSSValue>;

  /** State-specific style overrides (if applicable) */
  states?: StateConfig;
}

/**
 * Parameters for applying a variant to a node
 */
export interface ApplyVariantParams {
  /** The variant name to apply */
  variantName: string;

  /** Optional size to apply simultaneously */
  size?: string;

  /** Whether to preserve user overrides (default: true) */
  preserveUserOverrides?: boolean;
}

/**
 * Parameters for resolving styles for a node
 */
export interface ResolveStylesParams {
  /** The node type identifier */
  nodeType: string;

  /** Current variant name */
  variant?: string;

  /** Current size name */
  size?: string;

  /** User-defined CSS overrides */
  userOverrides?: Record<string, CSSValue>;
}

/**
 * Result of style resolution with metadata
 */
export interface StyleResolutionResult {
  /** Resolved CSS properties */
  styles: ResolvedStyles;

  /** Which variant was applied */
  appliedVariant?: string;

  /** Which size was applied */
  appliedSize?: string;

  /** Whether user overrides were present */
  hasUserOverrides: boolean;

  /** Source of each property (for debugging) */
  sources?: Record<string, 'default' | 'variant' | 'size' | 'user'>;
}

/**
 * Options for registering a new element config
 */
export interface RegisterConfigOptions {
  /** Whether to override existing config with same nodeType */
  override?: boolean;

  /** Whether to validate the config structure */
  validate?: boolean;
}

/**
 * Validation result for element config
 */
export interface ConfigValidationResult {
  /** Whether the config is valid */
  valid: boolean;

  /** Validation errors (if any) */
  errors: string[];

  /** Validation warnings (if any) */
  warnings: string[];
}

/**
 * Custom variant created by user
 * Contains variant configuration plus metadata
 */
export interface CustomVariant {
  /** User-defined variant name */
  name: string;

  /** Node type this variant applies to */
  nodeType: string;

  /** The actual variant configuration (styles and states) */
  config: VariantConfig;

  /** Scope: 'project' (this project only) or 'global' (all projects) */
  scope: 'project' | 'global';

  /** When the variant was created */
  createdAt: Date;

  /** Optional user description */
  description?: string;
}

/**
 * Event emitted when a variant is applied to a node
 */
export interface VariantAppliedEvent {
  /** Node ID that was modified */
  nodeId: string;

  /** Node type */
  nodeType: string;

  /** Previous variant (if any) */
  previousVariant?: string;

  /** New variant applied */
  newVariant: string;

  /** Timestamp of the change */
  timestamp: Date;
}

/**
 * Event emitted when element config is registered/updated
 */
export interface ConfigRegisteredEvent {
  /** Node type registered */
  nodeType: string;

  /** Number of variants in this config */
  variantCount: number;

  /** Whether this was an update to existing config */
  isUpdate: boolean;

  /** Timestamp of registration */
  timestamp: Date;
}
