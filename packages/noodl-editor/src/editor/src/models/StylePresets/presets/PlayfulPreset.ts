import { StylePreset } from '../StylePresetTypes';

/**
 * Playful preset — vibrant purple/pink palette, very rounded shapes, soft colored shadows.
 */
export const PlayfulPreset: StylePreset = {
  id: 'playful',
  name: 'Playful',
  description: 'Vibrant colors and rounded, friendly shapes',
  isBuiltIn: true,

  tokens: {
    // Primary — purple
    '--primary': '#8b5cf6',
    '--primary-hover': '#7c3aed',
    '--primary-foreground': '#ffffff',
    // Secondary — pink
    '--secondary': '#ec4899',
    '--secondary-hover': '#db2777',
    '--secondary-foreground': '#ffffff',
    // Destructive — rose
    '--destructive': '#f43f5e',
    '--destructive-hover': '#e11d48',
    '--destructive-foreground': '#ffffff',
    // Muted
    '--muted': '#faf5ff',
    '--muted-foreground': '#6b7280',
    // Accent — soft pink
    '--accent': '#fce7f3',
    '--accent-foreground': '#831843',
    // Surfaces
    '--background': '#ffffff',
    '--foreground': '#1e1b4b',
    '--surface': '#faf5ff',
    '--surface-raised': '#ffffff',
    // Borders
    '--border': '#e9d5ff',
    '--border-subtle': '#faf5ff',
    '--border-strong': '#d8b4fe',
    '--border-control': '#a855f7',
    // Focus ring — purple
    '--ring': '#8b5cf6',
    '--ring-offset': '#ffffff',
    // Font family — friendly rounded font with fallback
    '--font-sans': '"Nunito", "Quicksand", ui-sans-serif, sans-serif',
    // Border radius — very rounded
    '--radius-sm': '8px',
    '--radius-md': '16px',
    '--radius-lg': '24px',
    '--radius-xl': '32px',
    '--radius-2xl': '40px',
    '--radius-3xl': '48px',
    // Shadows — soft purple tinted
    '--shadow-sm': '0 1px 3px rgb(139 92 246 / 0.1)',
    '--shadow-md': '0 4px 12px rgb(139 92 246 / 0.15)',
    '--shadow-lg': '0 10px 20px rgb(139 92 246 / 0.15)',
    '--shadow-xl': '0 20px 30px rgb(139 92 246 / 0.12)'
  },

  preview: {
    primaryColor: '#8b5cf6',
    backgroundColor: '#ffffff',
    surfaceColor: '#faf5ff',
    borderColor: '#e9d5ff',
    textColor: '#1e1b4b',
    mutedTextColor: '#6b7280',
    radiusMd: '16px'
  }
};
