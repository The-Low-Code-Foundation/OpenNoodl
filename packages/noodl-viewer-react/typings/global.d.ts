import 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    'noodl-style-tag'?: string;
  }
}

type TSFixme = any;

type NodeConstructor = any;

type NodeContext = any;

type GraphModel = any;

type NodeRegister = any;

type GlobalNoodl = {
  getProjectSettings: TSFixme;
  getMetaData: TSFixme;
  Collection: TSFixme;
  Model: TSFixme;
  Variables: TSFixme;
  Events: TSFixme;
  Records: TSFixme;
  Users: TSFixme;
  CloudFunctions: TSFixme;
  Navigation: TSFixme;
  Files: TSFixme;
  /**
   * App Configuration - Immutable configuration values defined in App Setup.
   * Access app-wide settings like API keys, feature flags, and metadata.
   *
   * @example
   * ```typescript
   * // Access config values
   * const apiKey = Noodl.Config.apiKey;
   * const appName = Noodl.Config.appName;
   * const isFeatureEnabled = Noodl.Config.featureFlag;
   * ```
   */
  Config: Readonly<Record<string, unknown>>;
};

interface Window {
  Noodl: GlobalNoodl;
}
