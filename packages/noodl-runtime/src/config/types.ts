/**
 * App Configuration Types
 *
 * Defines the structure for app-wide configuration values accessible via Noodl.Config.
 * Config values are static and immutable at runtime.
 *
 * @module config/types
 */

export type ConfigType = 'string' | 'number' | 'boolean' | 'color' | 'array' | 'object';

export interface ConfigValidation {
  required?: boolean;
  pattern?: string; // Regex for strings
  min?: number; // For numbers
  max?: number; // For numbers
}

export interface ConfigVariable {
  key: string;
  type: ConfigType;
  value: unknown;
  description?: string;
  category?: string;
  validation?: ConfigValidation;
}

export interface AppIdentity {
  appName: string;
  description: string;
  coverImage?: string;
}

export interface AppSEO {
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  favicon?: string;
  themeColor?: string;
}

export interface AppPWA {
  enabled: boolean;
  shortName?: string;
  startUrl: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  backgroundColor?: string;
  sourceIcon?: string;
}

export interface AppConfig {
  identity: AppIdentity;
  seo: AppSEO;
  pwa?: AppPWA;
  variables: ConfigVariable[];
}

/**
 * Default app configuration used when no config is defined.
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  identity: {
    appName: 'My Noodl App',
    description: ''
  },
  seo: {},
  variables: []
};

/**
 * Reserved configuration keys that cannot be used for custom variables.
 * These are populated from identity, SEO, and PWA settings.
 */
export const RESERVED_CONFIG_KEYS = [
  // Identity
  'appName',
  'description',
  'coverImage',
  // SEO
  'ogTitle',
  'ogDescription',
  'ogImage',
  'favicon',
  'themeColor',
  // PWA
  'pwaEnabled',
  'pwaShortName',
  'pwaDisplay',
  'pwaStartUrl',
  'pwaBackgroundColor'
] as const;
