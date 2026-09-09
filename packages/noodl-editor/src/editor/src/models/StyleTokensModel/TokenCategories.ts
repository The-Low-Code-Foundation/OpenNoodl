/**
 * STYLE-001: Token System Enhancement
 *
 * TypeScript types for the Noodl design token system.
 * Inspired by Tailwind CSS - Tailwind-scale defaults with semantic aliases.
 */

// ─── Token Category Types ─────────────────────────────────────────────────────

// ─── Token Category Types ─────────────────────────────────────────────────────

// 🔴 `TokenCategory` and `StyleTokenRecord` moved to `@nodegx/project-contract` with the token
// vocabulary that uses them (HLS-001): the exporter needs all three and cannot import them from
// the editor. Re-exported here so every existing import in the editor keeps working.
export type { TokenCategory, StyleTokenRecord } from '@nodegx/project-contract/tokens';
import type { StyleTokenRecord, TokenCategory } from '@nodegx/project-contract/tokens';


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
  // VIB-002. Grouped under Effects beside shadows rather than under Colors,
  // because a gradient is a decorative ground, not a colour a border or a label
  // can be set to — and because every port that accepts one accepts a shadow's
  // kind of value (a complete CSS declaration) rather than a colour's.
  gradient: {
    label: 'Gradients',
    description: 'Decorative grounds for heroes, CTA bands and image scrims',
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


export interface StyleTokensData {
  /** Version for future migration support */
  version: number;
  /** Custom token overrides — only tokens that differ from defaults */
  customTokens: StyleTokenRecord[];
}
