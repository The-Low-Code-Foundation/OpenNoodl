import { StylePreset } from '../StylePresetTypes';

/**
 * Modern preset — clean, professional with subtle depth.
 * This is the default: its token values match DefaultTokens.ts exactly,
 * so `tokens` is intentionally empty (no overrides needed).
 */
export const ModernPreset: StylePreset = {
  id: 'modern',
  name: 'Modern',
  description: 'Clean and professional with subtle depth',
  isBuiltIn: true,

  // Modern IS the defaults — no token overrides needed.
  tokens: {},

  preview: {
    primaryColor: '#3b82f6',
    backgroundColor: '#ffffff',
    surfaceColor: '#f8fafc',
    borderColor: '#e2e8f0',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    radiusMd: '8px'
  }
};
