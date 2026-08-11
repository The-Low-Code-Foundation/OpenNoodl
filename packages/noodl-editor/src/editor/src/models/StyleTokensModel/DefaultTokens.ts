/**
 * STYLE-001: Default design tokens for new Noodl projects.
 *
 * Tailwind CSS-inspired scales with semantic aliases.
 * All values are CSS custom properties that get injected as :root { ... }
 */

import { StyleTokenRecord } from './TokenCategories';

export const DEFAULT_TOKENS: StyleTokenRecord[] = [
  // ─── Semantic Colors ─────────────────────────────────────────────────────────

  // Primary - Main brand/action color
  {
    name: '--primary',
    value: '#3b82f6',
    category: 'color-semantic',
    isCustom: false,
    description: 'Main brand and action color'
  },
  {
    name: '--primary-hover',
    value: '#2563eb',
    category: 'color-semantic',
    isCustom: false,
    description: 'Primary color on hover'
  },
  {
    name: '--primary-foreground',
    value: '#ffffff',
    category: 'color-semantic',
    isCustom: false,
    description: 'Text color on primary background'
  },

  // Secondary
  {
    name: '--secondary',
    value: '#64748b',
    category: 'color-semantic',
    isCustom: false,
    description: 'Supporting action color'
  },
  {
    name: '--secondary-hover',
    value: '#475569',
    category: 'color-semantic',
    isCustom: false,
    description: 'Secondary color on hover'
  },
  {
    name: '--secondary-foreground',
    value: '#ffffff',
    category: 'color-semantic',
    isCustom: false,
    description: 'Text color on secondary background'
  },

  // Destructive
  {
    name: '--destructive',
    value: '#ef4444',
    category: 'color-semantic',
    isCustom: false,
    description: 'Dangerous actions and errors'
  },
  {
    name: '--destructive-hover',
    value: '#dc2626',
    category: 'color-semantic',
    isCustom: false,
    description: 'Destructive color on hover'
  },
  {
    name: '--destructive-foreground',
    value: '#ffffff',
    category: 'color-semantic',
    isCustom: false,
    description: 'Text color on destructive background'
  },

  // Muted
  {
    name: '--muted',
    value: '#f1f5f9',
    category: 'color-semantic',
    isCustom: false,
    description: 'Subtle backgrounds, disabled states'
  },
  {
    name: '--muted-foreground',
    value: '#64748b',
    category: 'color-semantic',
    isCustom: false,
    description: 'Text color on muted background'
  },

  // Accent
  {
    name: '--accent',
    value: '#f1f5f9',
    category: 'color-semantic',
    isCustom: false,
    description: 'Highlights and selections'
  },
  {
    name: '--accent-foreground',
    value: '#0f172a',
    category: 'color-semantic',
    isCustom: false,
    description: 'Text color on accent background'
  },

  // Surface colors
  {
    name: '--background',
    value: '#ffffff',
    category: 'color-semantic',
    isCustom: false,
    description: 'Page/app background'
  },
  {
    name: '--foreground',
    value: '#0f172a',
    category: 'color-semantic',
    isCustom: false,
    description: 'Default text color'
  },
  {
    name: '--surface',
    value: '#f8fafc',
    category: 'color-semantic',
    isCustom: false,
    description: 'Card and panel surfaces'
  },
  {
    name: '--surface-raised',
    value: '#ffffff',
    category: 'color-semantic',
    isCustom: false,
    description: 'Elevated surface (dialogs, dropdowns)'
  },

  // Border colors
  {
    name: '--border',
    value: '#e2e8f0',
    category: 'color-semantic',
    isCustom: false,
    description: 'Default border color'
  },
  {
    name: '--border-subtle',
    value: '#f1f5f9',
    category: 'color-semantic',
    isCustom: false,
    description: 'Subtle/light border'
  },
  {
    name: '--border-strong',
    value: '#cbd5e1',
    category: 'color-semantic',
    isCustom: false,
    description: 'Strong/dark border'
  },
  {
    // The design doctrine prescribes this at 3:1 so a control reads as a
    // control; without it `border-color` falls back to `currentColor`, which is
    // the defect the sentence exists to prevent. Seeded from the editor's own
    // `--theme-color-border-control`. Measured 3.46:1 against `--surface`
    // (#f8fafc) and 3.62:1 against `--background` (#ffffff).
    name: '--border-control',
    value: '#7c8894',
    category: 'color-semantic',
    isCustom: false,
    description: 'Border for controls — meets 3:1 against surface, unlike --border'
  },

  // Focus ring
  { name: '--ring', value: '#3b82f6', category: 'color-semantic', isCustom: false, description: 'Focus ring color' },
  {
    name: '--ring-offset',
    value: '#ffffff',
    category: 'color-semantic',
    isCustom: false,
    description: 'Focus ring offset color'
  },

  // ─── Palette Colors (Gray) ────────────────────────────────────────────────────

  { name: '--gray-50', value: '#f8fafc', category: 'color-palette', isCustom: false },
  { name: '--gray-100', value: '#f1f5f9', category: 'color-palette', isCustom: false },
  { name: '--gray-200', value: '#e2e8f0', category: 'color-palette', isCustom: false },
  { name: '--gray-300', value: '#cbd5e1', category: 'color-palette', isCustom: false },
  { name: '--gray-400', value: '#94a3b8', category: 'color-palette', isCustom: false },
  { name: '--gray-500', value: '#64748b', category: 'color-palette', isCustom: false },
  { name: '--gray-600', value: '#475569', category: 'color-palette', isCustom: false },
  { name: '--gray-700', value: '#334155', category: 'color-palette', isCustom: false },
  { name: '--gray-800', value: '#1e293b', category: 'color-palette', isCustom: false },
  { name: '--gray-900', value: '#0f172a', category: 'color-palette', isCustom: false },
  { name: '--gray-950', value: '#020617', category: 'color-palette', isCustom: false },

  // Blue
  { name: '--blue-50', value: '#eff6ff', category: 'color-palette', isCustom: false },
  { name: '--blue-100', value: '#dbeafe', category: 'color-palette', isCustom: false },
  { name: '--blue-200', value: '#bfdbfe', category: 'color-palette', isCustom: false },
  { name: '--blue-300', value: '#93c5fd', category: 'color-palette', isCustom: false },
  { name: '--blue-400', value: '#60a5fa', category: 'color-palette', isCustom: false },
  { name: '--blue-500', value: '#3b82f6', category: 'color-palette', isCustom: false },
  { name: '--blue-600', value: '#2563eb', category: 'color-palette', isCustom: false },
  { name: '--blue-700', value: '#1d4ed8', category: 'color-palette', isCustom: false },
  { name: '--blue-800', value: '#1e40af', category: 'color-palette', isCustom: false },
  { name: '--blue-900', value: '#1e3a8a', category: 'color-palette', isCustom: false },

  // Red
  { name: '--red-50', value: '#fef2f2', category: 'color-palette', isCustom: false },
  { name: '--red-100', value: '#fee2e2', category: 'color-palette', isCustom: false },
  { name: '--red-200', value: '#fecaca', category: 'color-palette', isCustom: false },
  { name: '--red-300', value: '#fca5a5', category: 'color-palette', isCustom: false },
  { name: '--red-400', value: '#f87171', category: 'color-palette', isCustom: false },
  { name: '--red-500', value: '#ef4444', category: 'color-palette', isCustom: false },
  { name: '--red-600', value: '#dc2626', category: 'color-palette', isCustom: false },
  { name: '--red-700', value: '#b91c1c', category: 'color-palette', isCustom: false },
  { name: '--red-800', value: '#991b1b', category: 'color-palette', isCustom: false },
  { name: '--red-900', value: '#7f1d1d', category: 'color-palette', isCustom: false },

  // Green
  { name: '--green-50', value: '#f0fdf4', category: 'color-palette', isCustom: false },
  { name: '--green-100', value: '#dcfce7', category: 'color-palette', isCustom: false },
  { name: '--green-200', value: '#bbf7d0', category: 'color-palette', isCustom: false },
  { name: '--green-300', value: '#86efac', category: 'color-palette', isCustom: false },
  { name: '--green-400', value: '#4ade80', category: 'color-palette', isCustom: false },
  { name: '--green-500', value: '#22c55e', category: 'color-palette', isCustom: false },
  { name: '--green-600', value: '#16a34a', category: 'color-palette', isCustom: false },
  { name: '--green-700', value: '#15803d', category: 'color-palette', isCustom: false },
  { name: '--green-800', value: '#166534', category: 'color-palette', isCustom: false },
  { name: '--green-900', value: '#14532d', category: 'color-palette', isCustom: false },

  // Yellow/Amber
  { name: '--amber-50', value: '#fffbeb', category: 'color-palette', isCustom: false },
  { name: '--amber-100', value: '#fef3c7', category: 'color-palette', isCustom: false },
  { name: '--amber-200', value: '#fde68a', category: 'color-palette', isCustom: false },
  { name: '--amber-300', value: '#fcd34d', category: 'color-palette', isCustom: false },
  { name: '--amber-400', value: '#fbbf24', category: 'color-palette', isCustom: false },
  { name: '--amber-500', value: '#f59e0b', category: 'color-palette', isCustom: false },
  { name: '--amber-600', value: '#d97706', category: 'color-palette', isCustom: false },
  { name: '--amber-700', value: '#b45309', category: 'color-palette', isCustom: false },
  { name: '--amber-800', value: '#92400e', category: 'color-palette', isCustom: false },
  { name: '--amber-900', value: '#78350f', category: 'color-palette', isCustom: false },

  // Purple
  { name: '--purple-50', value: '#faf5ff', category: 'color-palette', isCustom: false },
  { name: '--purple-100', value: '#f3e8ff', category: 'color-palette', isCustom: false },
  { name: '--purple-200', value: '#e9d5ff', category: 'color-palette', isCustom: false },
  { name: '--purple-300', value: '#d8b4fe', category: 'color-palette', isCustom: false },
  { name: '--purple-400', value: '#c084fc', category: 'color-palette', isCustom: false },
  { name: '--purple-500', value: '#a855f7', category: 'color-palette', isCustom: false },
  { name: '--purple-600', value: '#9333ea', category: 'color-palette', isCustom: false },
  { name: '--purple-700', value: '#7e22ce', category: 'color-palette', isCustom: false },
  { name: '--purple-800', value: '#6b21a8', category: 'color-palette', isCustom: false },
  { name: '--purple-900', value: '#581c87', category: 'color-palette', isCustom: false },

  // ─── Spacing ──────────────────────────────────────────────────────────────────

  { name: '--space-0', value: '0px', category: 'spacing', isCustom: false },
  { name: '--space-px', value: '1px', category: 'spacing', isCustom: false },
  { name: '--space-0-5', value: '2px', category: 'spacing', isCustom: false },
  { name: '--space-1', value: '4px', category: 'spacing', isCustom: false },
  { name: '--space-1-5', value: '6px', category: 'spacing', isCustom: false },
  { name: '--space-2', value: '8px', category: 'spacing', isCustom: false },
  { name: '--space-2-5', value: '10px', category: 'spacing', isCustom: false },
  { name: '--space-3', value: '12px', category: 'spacing', isCustom: false },
  { name: '--space-3-5', value: '14px', category: 'spacing', isCustom: false },
  { name: '--space-4', value: '16px', category: 'spacing', isCustom: false },
  { name: '--space-5', value: '20px', category: 'spacing', isCustom: false },
  { name: '--space-6', value: '24px', category: 'spacing', isCustom: false },
  { name: '--space-7', value: '28px', category: 'spacing', isCustom: false },
  { name: '--space-8', value: '32px', category: 'spacing', isCustom: false },
  { name: '--space-9', value: '36px', category: 'spacing', isCustom: false },
  { name: '--space-10', value: '40px', category: 'spacing', isCustom: false },
  { name: '--space-11', value: '44px', category: 'spacing', isCustom: false },
  { name: '--space-12', value: '48px', category: 'spacing', isCustom: false },
  { name: '--space-14', value: '56px', category: 'spacing', isCustom: false },
  { name: '--space-16', value: '64px', category: 'spacing', isCustom: false },
  { name: '--space-20', value: '80px', category: 'spacing', isCustom: false },
  { name: '--space-24', value: '96px', category: 'spacing', isCustom: false },
  { name: '--space-28', value: '112px', category: 'spacing', isCustom: false },
  { name: '--space-32', value: '128px', category: 'spacing', isCustom: false },

  // Semantic spacing aliases
  {
    name: '--space-xs',
    value: 'var(--space-1)',
    category: 'spacing',
    isCustom: false,
    description: 'Extra small (4px)'
  },
  { name: '--space-sm', value: 'var(--space-2)', category: 'spacing', isCustom: false, description: 'Small (8px)' },
  { name: '--space-md', value: 'var(--space-4)', category: 'spacing', isCustom: false, description: 'Medium (16px)' },
  { name: '--space-lg', value: 'var(--space-6)', category: 'spacing', isCustom: false, description: 'Large (24px)' },
  {
    name: '--space-xl',
    value: 'var(--space-8)',
    category: 'spacing',
    isCustom: false,
    description: 'Extra large (32px)'
  },
  {
    name: '--space-2xl',
    value: 'var(--space-12)',
    category: 'spacing',
    isCustom: false,
    description: '2x large (48px)'
  },
  {
    name: '--space-3xl',
    value: 'var(--space-16)',
    category: 'spacing',
    isCustom: false,
    description: '3x large (64px)'
  },

  // ─── Typography: Font Sizes ───────────────────────────────────────────────────

  { name: '--text-xs', value: '12px', category: 'typography-size', isCustom: false },
  { name: '--text-sm', value: '14px', category: 'typography-size', isCustom: false },
  { name: '--text-base', value: '16px', category: 'typography-size', isCustom: false },
  { name: '--text-lg', value: '18px', category: 'typography-size', isCustom: false },
  { name: '--text-xl', value: '20px', category: 'typography-size', isCustom: false },
  { name: '--text-2xl', value: '24px', category: 'typography-size', isCustom: false },
  { name: '--text-3xl', value: '30px', category: 'typography-size', isCustom: false },
  { name: '--text-4xl', value: '36px', category: 'typography-size', isCustom: false },
  { name: '--text-5xl', value: '48px', category: 'typography-size', isCustom: false },
  { name: '--text-6xl', value: '60px', category: 'typography-size', isCustom: false },

  // ─── Typography: Font Weights ─────────────────────────────────────────────────

  { name: '--font-thin', value: '100', category: 'typography-weight', isCustom: false },
  { name: '--font-extralight', value: '200', category: 'typography-weight', isCustom: false },
  { name: '--font-light', value: '300', category: 'typography-weight', isCustom: false },
  { name: '--font-normal', value: '400', category: 'typography-weight', isCustom: false },
  { name: '--font-medium', value: '500', category: 'typography-weight', isCustom: false },
  { name: '--font-semibold', value: '600', category: 'typography-weight', isCustom: false },
  { name: '--font-bold', value: '700', category: 'typography-weight', isCustom: false },
  { name: '--font-extrabold', value: '800', category: 'typography-weight', isCustom: false },
  { name: '--font-black', value: '900', category: 'typography-weight', isCustom: false },

  // ─── Typography: Line Heights ─────────────────────────────────────────────────

  { name: '--leading-none', value: '1', category: 'typography-leading', isCustom: false },
  { name: '--leading-tight', value: '1.25', category: 'typography-leading', isCustom: false },
  { name: '--leading-snug', value: '1.375', category: 'typography-leading', isCustom: false },
  { name: '--leading-normal', value: '1.5', category: 'typography-leading', isCustom: false },
  { name: '--leading-relaxed', value: '1.625', category: 'typography-leading', isCustom: false },
  { name: '--leading-loose', value: '2', category: 'typography-leading', isCustom: false },

  // ─── Typography: Letter Spacing ───────────────────────────────────────────────

  { name: '--tracking-tighter', value: '-0.05em', category: 'typography-tracking', isCustom: false },
  { name: '--tracking-tight', value: '-0.025em', category: 'typography-tracking', isCustom: false },
  { name: '--tracking-normal', value: '0em', category: 'typography-tracking', isCustom: false },
  { name: '--tracking-wide', value: '0.025em', category: 'typography-tracking', isCustom: false },
  { name: '--tracking-wider', value: '0.05em', category: 'typography-tracking', isCustom: false },
  { name: '--tracking-widest', value: '0.1em', category: 'typography-tracking', isCustom: false },

  // ─── Typography: Font Families ────────────────────────────────────────────────

  {
    /*
     * POL-006 — Inter first, the platform stack behind it.
     *
     * Inter is bundled into every new project as `noodl_modules/inter/`, whose stylesheet the
     * module scanner injects into the preview and into a deploy alike, so this resolves to a real
     * face offline and with no request to fonts.googleapis.com. Naming it here rather than in the
     * three ElementConfigs keeps one place to change a project's font — which is the whole point
     * of the token.
     *
     * The rest of the stack is not decoration. A project that predates POL-006 has no Inter
     * module, and a browser that cannot find the family simply moves on to the next name; nothing
     * has to know whether the module is there.
     */
    name: '--font-sans',
    value: "Inter, ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'",
    category: 'typography-family',
    isCustom: false,
    description: 'Inter, falling back to the system sans-serif stack'
  },
  {
    name: '--font-serif',
    value: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
    category: 'typography-family',
    isCustom: false,
    description: 'System serif stack'
  },
  {
    name: '--font-mono',
    value: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    category: 'typography-family',
    isCustom: false,
    description: 'System monospace stack'
  },

  // ─── Border Radius ────────────────────────────────────────────────────────────

  { name: '--radius-none', value: '0px', category: 'border-radius', isCustom: false },
  { name: '--radius-sm', value: '4px', category: 'border-radius', isCustom: false },
  { name: '--radius-md', value: '8px', category: 'border-radius', isCustom: false },
  { name: '--radius-lg', value: '12px', category: 'border-radius', isCustom: false },
  { name: '--radius-xl', value: '16px', category: 'border-radius', isCustom: false },
  { name: '--radius-2xl', value: '24px', category: 'border-radius', isCustom: false },
  { name: '--radius-3xl', value: '32px', category: 'border-radius', isCustom: false },
  { name: '--radius-full', value: '9999px', category: 'border-radius', isCustom: false, description: 'Pill/circle' },

  // ─── Border Width ─────────────────────────────────────────────────────────────

  { name: '--border-0', value: '0px', category: 'border-width', isCustom: false },
  { name: '--border-1', value: '1px', category: 'border-width', isCustom: false },
  { name: '--border-2', value: '2px', category: 'border-width', isCustom: false },
  { name: '--border-4', value: '4px', category: 'border-width', isCustom: false },
  { name: '--border-8', value: '8px', category: 'border-width', isCustom: false },

  // ─── Shadows ──────────────────────────────────────────────────────────────────

  { name: '--shadow-none', value: 'none', category: 'shadow', isCustom: false },
  { name: '--shadow-sm', value: '0 1px 2px 0 rgb(0 0 0 / 0.05)', category: 'shadow', isCustom: false },
  {
    name: '--shadow-md',
    value: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    category: 'shadow',
    isCustom: false
  },
  {
    name: '--shadow-lg',
    value: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    category: 'shadow',
    isCustom: false
  },
  {
    name: '--shadow-xl',
    value: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    category: 'shadow',
    isCustom: false
  },
  { name: '--shadow-2xl', value: '0 25px 50px -12px rgb(0 0 0 / 0.25)', category: 'shadow', isCustom: false },
  { name: '--shadow-inner', value: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)', category: 'shadow', isCustom: false },

  // ─── Animation: Durations ─────────────────────────────────────────────────────

  { name: '--duration-75', value: '75ms', category: 'animation-duration', isCustom: false },
  { name: '--duration-100', value: '100ms', category: 'animation-duration', isCustom: false },
  { name: '--duration-150', value: '150ms', category: 'animation-duration', isCustom: false },
  { name: '--duration-200', value: '200ms', category: 'animation-duration', isCustom: false },
  { name: '--duration-300', value: '300ms', category: 'animation-duration', isCustom: false },
  { name: '--duration-500', value: '500ms', category: 'animation-duration', isCustom: false },
  { name: '--duration-700', value: '700ms', category: 'animation-duration', isCustom: false },
  { name: '--duration-1000', value: '1000ms', category: 'animation-duration', isCustom: false },

  // ─── Animation: Easing ───────────────────────────────────────────────────────

  { name: '--ease-linear', value: 'linear', category: 'animation-easing', isCustom: false },
  { name: '--ease-in', value: 'cubic-bezier(0.4, 0, 1, 1)', category: 'animation-easing', isCustom: false },
  { name: '--ease-out', value: 'cubic-bezier(0, 0, 0.2, 1)', category: 'animation-easing', isCustom: false },
  { name: '--ease-in-out', value: 'cubic-bezier(0.4, 0, 0.2, 1)', category: 'animation-easing', isCustom: false },
  {
    name: '--ease-bounce',
    value: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    category: 'animation-easing',
    isCustom: false,
    description: 'Bouncy animation curve'
  }
];

/**
 * Build a Map from the default tokens array for fast lookup by name.
 */
export function buildDefaultTokenMap(): Map<string, StyleTokenRecord> {
  const map = new Map<string, StyleTokenRecord>();
  for (const token of DEFAULT_TOKENS) {
    map.set(token.name, token);
  }
  return map;
}
