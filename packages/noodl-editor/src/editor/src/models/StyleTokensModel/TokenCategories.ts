/**
 * STYLE-001: Token System Enhancement
 *
 * TypeScript types for the Noodl design token system.
 * Inspired by Tailwind CSS - Tailwind-scale defaults with semantic aliases.
 */

// ─── Token Category Types ─────────────────────────────────────────────────────

export type TokenCategory =
  | 'color-semantic'
  | 'color-palette'
  | 'spacing'
  | 'typography-size'
  | 'typography-weight'
  | 'typography-leading'
  | 'typography-tracking'
  | 'typography-family'
  | 'border-radius'
  | 'border-width'
  | 'shadow'
  | 'animation-duration'
  | 'animation-easing';

export const TOKEN_CATEGORIES: Record<
  TokenCategory,
  { label: string; description: string; group: TokenCategoryGroup }
> = {
  'color-semantic': {
    label: 'Semantic Colors',
    description: 'Purpose-based color tokens (primary, secondary, etc.)',
    group: 'Colors'
  },
  'color-palette': {
    label: 'Palette Colors',
    description: 'Raw color scales (gray, blue, red, etc.)',
    group: 'Colors'
  },
  spacing: {
    label: 'Spacing',
    description: 'Margins, paddings, gaps',
    group: 'Spacing'
  },
  'typography-size': {
    label: 'Font Sizes',
    description: 'Text size scale',
    group: 'Typography'
  },
  'typography-weight': {
    label: 'Font Weights',
    description: 'Thin to black weight scale',
    group: 'Typography'
  },
  'typography-leading': {
    label: 'Line Heights',
    description: 'Line height scale',
    group: 'Typography'
  },
  'typography-tracking': {
    label: 'Letter Spacing',
    description: 'Letter spacing scale',
    group: 'Typography'
  },
  'typography-family': {
    label: 'Font Families',
    description: 'Font family stacks',
    group: 'Typography'
  },
  'border-radius': {
    label: 'Border Radius',
    description: 'Corner radius scale',
    group: 'Borders'
  },
  'border-width': {
    label: 'Border Width',
    description: 'Border thickness scale',
    group: 'Borders'
  },
  shadow: {
    label: 'Shadows',
    description: 'Box shadow scale',
    group: 'Effects'
  },
  'animation-duration': {
    label: 'Durations',
    description: 'Transition and animation durations',
    group: 'Animation'
  },
  'animation-easing': {
    label: 'Easing',
    description: 'Timing functions',
    group: 'Animation'
  }
};

export type TokenCategoryGroup = 'Colors' | 'Spacing' | 'Typography' | 'Borders' | 'Effects' | 'Animation';

export const TOKEN_CATEGORY_GROUPS: TokenCategoryGroup[] = [
  'Colors',
  'Spacing',
  'Typography',
  'Borders',
  'Effects',
  'Animation'
];

// ─── Token Interface ──────────────────────────────────────────────────────────

export interface StyleToken {
  /** CSS custom property name, e.g. "--primary" */
  name: string;
  /** Raw value or reference to another token e.g. "#3b82f6" or "var(--blue-500)" */
  value: string;
  /** Token category for grouping in the panel */
  category: TokenCategory;
  /** User-defined token vs system default */
  isCustom: boolean;
  /** Optional human-readable description */
  description?: string;
}

// ─── Token Map ────────────────────────────────────────────────────────────────

/** Map of CSS custom property name → StyleToken */
export type StyleTokenMap = Map<string, StyleToken>;

// ─── Serializable storage format (for project.json) ─────────────────────────

export interface StyleTokenRecord {
  name: string;
  value: string;
  category: TokenCategory;
  isCustom: boolean;
  description?: string;
}

export interface StyleTokensData {
  /** Version for future migration support */
  version: number;
  /** Custom token overrides — only tokens that differ from defaults */
  customTokens: StyleTokenRecord[];
}
