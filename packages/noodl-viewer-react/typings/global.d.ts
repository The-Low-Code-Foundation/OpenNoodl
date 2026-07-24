import 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    'noodl-style-tag'?: string;
  }
}

type TSFixme = any;

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

  /** Set by the deployed page's bootstrap — `static/deploy/index.js`. */
  deployed?: boolean;

  /**
   * @deprecated Nothing ever sets this. `runDeployed` is a *constructor argument*
   * to `NoodlRuntime`, not a member of this global; the flag the deploy bootstrap
   * sets is {@link deployed}. The Group and Text nodes test `Noodl.runDeployed`
   * to skip building their editor-only tooltips, so that skip never happens and
   * the tooltip HTML ships in deployed apps. Correcting it changes deployed
   * output, so it is recorded here rather than quietly fixed.
   */
  runDeployed?: boolean;
};

interface Window {
  Noodl: GlobalNoodl;
}

declare global {
  /** The same object as {@link Window.Noodl}, reached without the `window.` prefix. */
  const Noodl: GlobalNoodl;
}
