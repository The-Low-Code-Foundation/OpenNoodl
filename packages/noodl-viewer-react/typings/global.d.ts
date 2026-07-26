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
  /** Alias of {@link Collection} — the same module object under its older name. */
  Array: TSFixme;
  /** Alias of {@link Model} — the same module object under its older name. */
  Object: TSFixme;
  /**
   * Proxies over {@link Array}/{@link Object} where *any* property name is a valid
   * id: reading `Noodl.Arrays.foo` is `Noodl.Array.get('foo')`, and assigning to it
   * calls `set`/`setAll`. That is why they are Proxies rather than plain objects.
   */
  Arrays: TSFixme;
  Objects: TSFixme;
  Variables: TSFixme;
  Events: TSFixme;
  /** The same emitter as {@link Events}, under its older name. */
  eventEmitter: TSFixme;
  /** Server-side-rendering head control. Created once and reused — see `noodl-js-api`. */
  SEO: TSFixme;
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

  /**
   * Deploy-time environment values, created empty by `createNoodlAPI` and filled in
   * by the deployed page's bootstrap. `BaseUrl` is the one the viewer itself reads —
   * `fontloader` prefixes generated `@font-face` `src` URLs with it so a project
   * served from a sub-path still finds its fonts.
   */
  Env: Record<string, string | undefined>;

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

declare global {
  /**
   * NOTE: this augmentation has to live *inside* `declare global`.
   *
   * This file opens with `import 'react'`, which makes it a module — so a
   * top-level `interface Window` declares a `Window` local to this module rather
   * than merging into `lib.dom`'s. It sat outside for as long as nothing in
   * TypeScript reached for `window.Noodl`; `noodl-js-api` is the first file that
   * does, and it found it immediately.
   */
  interface Window {
    Noodl: GlobalNoodl;
  }

  /** The same object as {@link Window.Noodl}, reached without the `window.` prefix. */
  const Noodl: GlobalNoodl;
}
