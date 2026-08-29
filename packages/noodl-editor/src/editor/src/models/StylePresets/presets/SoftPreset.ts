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
    // Primary — indigo. DEF-001: indigo-500 put white at 4.47:1 — it missed 4.5 by 0.03, which is
    // still a miss. One step to indigo-600 (6.29:1); hover follows to indigo-700.
    '--primary': '#4f46e5',
    '--primary-hover': '#4338ca',
    '--primary-foreground': '#ffffff',
    // Secondary — purple. DEF-001: violet-400 was 2.72:1 under white, the worst text pair in any
    // shipped preset. violet-600 is 5.70:1; hover follows to violet-700.
    '--secondary': '#7c3aed',
    '--secondary-hover': '#6d28d9',
    '--secondary-foreground': '#ffffff',
    // Destructive — rose. DEF-001: rose-400 was 2.69:1 under white, and the same value is the
    // TextInput `error` border at 2.67:1 against 1.4.11's 3. rose-600 clears both (4.70 / 4.66).
    '--destructive': '#e11d48',
    '--destructive-hover': '#be123c',
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
    '--ring': '#4f46e5',
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
    primaryColor: '#4f46e5',
    backgroundColor: '#fefefe',
    surfaceColor: '#f9fafb',
    borderColor: '#e5e7eb',
    textColor: '#374151',
    mutedTextColor: '#6b7280',
    radiusMd: '12px'
  }
};
