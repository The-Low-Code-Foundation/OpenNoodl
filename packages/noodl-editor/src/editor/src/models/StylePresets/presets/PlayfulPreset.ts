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
    // Primary — purple. DEF-001: violet-500 put white at 4.23:1, below 1.4.3's 4.5. One step to
    // violet-600 (5.70:1); hover follows to violet-700.
    '--primary': '#7c3aed',
    '--primary-hover': '#6d28d9',
    '--primary-foreground': '#ffffff',
    // Secondary — pink
    // DEF-001: pink-500 was 3.53:1 under white. pink-600 is 4.60:1; hover follows to pink-700.
    '--secondary': '#db2777',
    '--secondary-hover': '#be185d',
    '--secondary-foreground': '#ffffff',
    // Destructive — rose
    // DEF-001: rose-500 was 3.67:1 under white. rose-600 is 4.70:1; hover follows to rose-700.
    '--destructive': '#e11d48',
    '--destructive-hover': '#be123c',
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
    '--ring': '#7c3aed',
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
    primaryColor: '#7c3aed',
    backgroundColor: '#ffffff',
    surfaceColor: '#faf5ff',
    borderColor: '#e9d5ff',
    textColor: '#1e1b4b',
    mutedTextColor: '#6b7280',
    radiusMd: '16px'
  }
};
