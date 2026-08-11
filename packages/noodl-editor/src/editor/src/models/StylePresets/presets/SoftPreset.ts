import { StylePreset } from '../StylePresetTypes';

/**
 * Soft preset — gentle indigo tones, soft rounding, very light shadows.
 * Calming aesthetic with generous whitespace feel.
 */
export const SoftPreset: StylePreset = {
  id: 'soft',
  name: 'Soft',
  description: 'Gentle colors and soft shapes for a calming aesthetic',
  isBuiltIn: true,

  tokens: {
    // Primary — indigo
    '--primary': '#6366f1',
    '--primary-hover': '#4f46e5',
    '--primary-foreground': '#ffffff',
    // Secondary — light purple
    '--secondary': '#a78bfa',
    '--secondary-hover': '#8b5cf6',
    '--secondary-foreground': '#ffffff',
    // Destructive — soft rose
    '--destructive': '#fb7185',
    '--destructive-hover': '#f43f5e',
    '--destructive-foreground': '#ffffff',
    // Muted
    '--muted': '#f5f3ff',
    '--muted-foreground': '#6b7280',
    // Accent
    '--accent': '#ede9fe',
    '--accent-foreground': '#4c1d95',
    // Surfaces — off-white, warm
    '--background': '#fefefe',
    '--foreground': '#374151',
    '--surface': '#f9fafb',
    '--surface-raised': '#ffffff',
    // Borders — soft
    '--border': '#e5e7eb',
    '--border-subtle': '#f3f4f6',
    '--border-strong': '#d1d5db',
    '--border-control': '#6b7280',
    // Focus ring — indigo
    '--ring': '#6366f1',
    '--ring-offset': '#fefefe',
    // Font family
    '--font-sans': '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    // Border radius — soft rounded
    '--radius-sm': '6px',
    '--radius-md': '12px',
    '--radius-lg': '20px',
    '--radius-xl': '28px',
    '--radius-2xl': '36px',
    '--radius-3xl': '44px',
    // Shadows — very soft, barely there
    '--shadow-sm': '0 1px 3px rgb(0 0 0 / 0.02)',
    '--shadow-md': '0 4px 6px rgb(0 0 0 / 0.04)',
    '--shadow-lg': '0 8px 12px rgb(0 0 0 / 0.05)',
    '--shadow-xl': '0 16px 24px rgb(0 0 0 / 0.06)'
  },

  preview: {
    primaryColor: '#6366f1',
    backgroundColor: '#fefefe',
    surfaceColor: '#f9fafb',
    borderColor: '#e5e7eb',
    textColor: '#374151',
    mutedTextColor: '#6b7280',
    radiusMd: '12px'
  }
};
