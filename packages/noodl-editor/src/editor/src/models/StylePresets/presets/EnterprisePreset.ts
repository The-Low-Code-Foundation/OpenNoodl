import { StylePreset } from '../StylePresetTypes';

/**
 * Enterprise preset — dark navy palette, conservative rounding, subtle shadows.
 * Professional and trustworthy for business applications.
 */
export const EnterprisePreset: StylePreset = {
  id: 'enterprise',
  name: 'Enterprise',
  description: 'Professional and trustworthy for business applications',
  isBuiltIn: true,

  tokens: {
    // Primary — dark navy
    '--primary': '#0f172a',
    '--primary-hover': '#1e293b',
    '--primary-foreground': '#ffffff',
    // Secondary — slate
    '--secondary': '#475569',
    '--secondary-hover': '#334155',
    '--secondary-foreground': '#ffffff',
    // Destructive — dark red
    '--destructive': '#b91c1c',
    '--destructive-hover': '#991b1b',
    '--destructive-foreground': '#ffffff',
    // Muted
    '--muted': '#f1f5f9',
    '--muted-foreground': '#475569',
    // Accent
    '--accent': '#e2e8f0',
    '--accent-foreground': '#0f172a',
    // Surfaces
    '--background': '#ffffff',
    '--foreground': '#0f172a',
    '--surface': '#f8fafc',
    '--surface-raised': '#ffffff',
    // Borders — slightly stronger than Modern
    '--border': '#cbd5e1',
    '--border-subtle': '#e2e8f0',
    '--border-strong': '#94a3b8',
    // Focus ring
    '--ring': '#0f172a',
    '--ring-offset': '#ffffff',
    // Font family — professional, slightly traditional
    '--font-sans': '"Source Sans Pro", "Segoe UI", ui-sans-serif, sans-serif',
    // Border radius — conservative
    '--radius-sm': '2px',
    '--radius-md': '4px',
    '--radius-lg': '6px',
    '--radius-xl': '8px',
    '--radius-2xl': '10px',
    '--radius-3xl': '12px',
    // Shadows — very subtle
    '--shadow-sm': '0 1px 2px rgb(0 0 0 / 0.05)',
    '--shadow-md': '0 2px 4px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04)',
    '--shadow-lg': '0 4px 8px rgb(0 0 0 / 0.06), 0 2px 4px rgb(0 0 0 / 0.04)',
    '--shadow-xl': '0 8px 16px rgb(0 0 0 / 0.08), 0 4px 6px rgb(0 0 0 / 0.05)'
  },

  preview: {
    primaryColor: '#0f172a',
    backgroundColor: '#ffffff',
    surfaceColor: '#f8fafc',
    borderColor: '#cbd5e1',
    textColor: '#0f172a',
    mutedTextColor: '#475569',
    radiusMd: '4px'
  }
};
