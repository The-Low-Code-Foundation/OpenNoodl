import { StylePreset } from '../StylePresetTypes';

/**
 * Minimal preset — ultra-clean, monochromatic, sharp edges, no shadows.
 */
export const MinimalPreset: StylePreset = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Ultra-clean with sharp edges and no shadows',
  isBuiltIn: true,

  tokens: {
    // Primary — near black
    '--primary': '#18181b',
    '--primary-hover': '#27272a',
    '--primary-foreground': '#ffffff',
    // Secondary
    '--secondary': '#71717a',
    '--secondary-hover': '#52525b',
    '--secondary-foreground': '#ffffff',
    // Destructive
    '--destructive': '#dc2626',
    '--destructive-hover': '#b91c1c',
    // Muted
    '--muted': '#f4f4f5',
    '--muted-foreground': '#71717a',
    // Accent
    '--accent': '#f4f4f5',
    '--accent-foreground': '#18181b',
    // Surfaces
    '--background': '#ffffff',
    '--foreground': '#18181b',
    '--surface': '#fafafa',
    '--surface-raised': '#ffffff',
    // Borders
    '--border': '#e4e4e7',
    '--border-subtle': '#f4f4f5',
    '--border-strong': '#d4d4d8',
    // Focus ring
    '--ring': '#18181b',
    '--ring-offset': '#ffffff',
    // Font family — system stack, no custom font
    '--font-sans': 'system-ui, -apple-system, sans-serif',
    // Border radius — sharp
    '--radius-sm': '2px',
    '--radius-md': '4px',
    '--radius-lg': '6px',
    '--radius-xl': '8px',
    '--radius-2xl': '10px',
    '--radius-3xl': '12px',
    // Shadows — none
    '--shadow-sm': 'none',
    '--shadow-md': 'none',
    '--shadow-lg': 'none',
    '--shadow-xl': 'none',
    '--shadow-2xl': 'none'
  },

  preview: {
    primaryColor: '#18181b',
    backgroundColor: '#ffffff',
    surfaceColor: '#fafafa',
    borderColor: '#e4e4e7',
    textColor: '#18181b',
    mutedTextColor: '#71717a',
    radiusMd: '4px'
  }
};
