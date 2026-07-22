/**
 * Default Style Tokens (Minimal Set for MVP)
 *
 * This file defines the minimal set of CSS custom properties (design tokens)
 * that will be available in every Noodl project.
 *
 * These tokens can be used in any CSS property that accepts the relevant value type.
 * Example: style="background: var(--primary); padding: var(--space-md);"
 *
 * @module StyleTokens
 */

export interface StyleToken {
  name: string;
  value: string;
  category: TokenCategory;
  description: string;
}

export type TokenCategory = 'color' | 'spacing' | 'border' | 'shadow';

/**
 * Minimal set of design tokens for MVP
 * Following modern design system conventions (similar to Tailwind/shadcn)
 */
export const DEFAULT_TOKENS: Record<string, StyleToken> = {
  // ===== COLORS =====
  '--primary': {
    name: '--primary',
    value: '#3b82f6', // Blue
    category: 'color',
    description: 'Primary brand color for main actions and highlights'
  },

  '--background': {
    name: '--background',
    value: '#ffffff',
    category: 'color',
    description: 'Main background color'
  },

  '--foreground': {
    name: '--foreground',
    value: '#0f172a', // Near black
    category: 'color',
    description: 'Main text color'
  },

  '--border': {
    name: '--border',
    value: '#e2e8f0', // Light gray
    category: 'color',
    description: 'Default border color'
  },

  // ===== SPACING =====
  '--space-sm': {
    name: '--space-sm',
    value: '8px',
    category: 'spacing',
    description: 'Small spacing (padding, margin, gap)'
  },

  '--space-md': {
    name: '--space-md',
    value: '16px',
    category: 'spacing',
    description: 'Medium spacing (padding, margin, gap)'
  },

  '--space-lg': {
    name: '--space-lg',
    value: '24px',
    category: 'spacing',
    description: 'Large spacing (padding, margin, gap)'
  },

  // ===== BORDERS =====
  '--radius-md': {
    name: '--radius-md',
    value: '8px',
    category: 'border',
    description: 'Medium border radius for rounded corners'
  },

  // ===== SHADOWS =====
  '--shadow-sm': {
    name: '--shadow-sm',
    value: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    category: 'shadow',
    description: 'Small shadow for subtle elevation'
  },

  '--shadow-md': {
    name: '--shadow-md',
    value: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    category: 'shadow',
    description: 'Medium shadow for moderate elevation'
  }
};

/**
 * Get all default tokens as a simple key-value map
 * Useful for CSS injection
 */
export function getDefaultTokenValues(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, token] of Object.entries(DEFAULT_TOKENS)) {
    values[key] = token.value;
  }
  return values;
}

/**
 * Get tokens by category
 */
export function getTokensByCategory(category: TokenCategory): StyleToken[] {
  return Object.values(DEFAULT_TOKENS).filter((token) => token.category === category);
}
