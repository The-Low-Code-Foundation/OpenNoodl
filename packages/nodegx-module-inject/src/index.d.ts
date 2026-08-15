/**
 * Hand-written declarations for `@nodegx/module-inject`.
 *
 * Hand-written on purpose: this package has **no build step** (see `src/index.js`),
 * which is the whole reason it exists — a plain-JS devtool must be able to
 * `require` it in a fresh checkout. That buys the devtool its injector and costs
 * this file: it is not generated, so it drifts if you change `index.js` without
 * changing it. `@nodegx/render-measure` makes the same trade for the same reason.
 *
 * These types are the ones `projectmodules.ts` used to declare itself, moved
 * verbatim so its public surface stays byte-identical.
 */

export interface ModuleBrowserManifest {
  head?: string[];
  styles?: string[];
  stylesheets?: (string | unknown)[];
}

/**
 * The on-disk `manifest.json` shape. Deliberately permissive
 * (`[key: string]: unknown`) — manifests carry extra, module-specific fields
 * (componentIndex, componentAnnotations, previews, …) that must survive.
 */
export interface ModuleManifest {
  name?: string;
  main?: string;
  type?: 'iconset';
  /**
   * Which of NDA-007 §1's icon kinds this set ships. Absent means `'font'`, which is what every
   * set predating NDA-007 §2 is — the field is what lets a set be something other than a font
   * without a second registration mechanism.
   */
  iconSource?: 'font' | 'sprite';
  /** `sprite` sets only: module-relative path to the sheet, e.g. `"icons/sprite.svg"`. */
  sprite?: string;
  icons?: string[];
  iconClass?: string;
  /**
   * Font sets where each glyph is its own class rather than a codepoint. Read by the icon picker
   * since long before NDA-007 and never declared here — `additionalProperties: true` is why it
   * worked.
   */
  codeAsClass?: boolean;
  dependencies?: string[];
  runtimes?: string[];
  browser?: ModuleBrowserManifest;
  componentAnnotations?: Record<string, Record<string, unknown>>;
  previews?: unknown[];
  /**
   * ERG-002. Which noodl_modules producer wrote this manifest. Only
   * `'external-library'` is written by `projectmodules.ts`'s `registerLibrary`;
   * every other value (including absent, e.g. hand-authored icon sets) is left
   * alone by `listRegisteredLibraries`/`removeLibrary` on purpose — those must
   * never touch a module they didn't create.
   */
  kind?: 'external-library' | string;
  /**
   * ERG-002. The `window`-attached global name this library is expected to
   * define, e.g. `"PocketBase"`. Not read by the injector (`injectIntoHtml`
   * only cares about `dependencies`/`browser`/`runtimes`) — it exists so the
   * editor can re-verify a library, surface it to the code editors and the AI
   * authoring loop's context, and warn when it's registered on an SSR/SSG
   * project (§3: a `window` global does not exist during server rendering).
   */
  global?: string;
  [key: string]: unknown;
}

/** One scanned module directory. `manifest` is null only for a hard failure. */
export interface ScannedModule {
  /** Directory name under noodl_modules/, e.g. "material-icons". */
  name: string;
  /** Project-relative path to the module dir, e.g. "noodl_modules/material-icons". */
  dirPath: string;
  /** Parsed manifest, or null when the manifest is missing / not valid JSON. */
  manifest: ModuleManifest | null;
  /** Human-readable diagnostics for this module (also emitted to console.warn). */
  warnings: string[];
}

/** The inject-shaped module the HTML injector consumes. */
export interface InjectModule {
  dependencies: string[];
  browser?: ModuleBrowserManifest;
  runtimes: string[];
  index?: string;
}

/** The two blobs `injectIntoTemplate` substitutes. */
export interface InjectionTags {
  /** `<script>`/`<link>`/`<style>` tags for dependencies, head entries and stylesheets. */
  dependencies: string;
  /** `<script>` tags for each module's own `main`. */
  modulesMain: string;
}

export declare const MANIFEST_SCHEMA: Record<string, unknown>;
export declare const DEPENDENCIES_PLACEHOLDER: '<%modules_dependencies%>';
export declare const MAIN_PLACEHOLDER: '<%modules_main%>';

export declare function scanModuleManifests(projectDirectory: string | undefined): Promise<ScannedModule[]>;
export declare function toInjectModules(scanned: ScannedModule[]): InjectModule[];
export declare function buildInjectionTags(modules: InjectModule[] | undefined, pathPrefix: string): InjectionTags;
export declare function injectIntoTemplate(template: string, tags: InjectionTags): string;
export declare function scanProjectModules(
  projectDirectory: string | undefined,
  callback: (modules?: InjectModule[]) => void
): void;
export declare function injectIntoHtml(
  projectDirectory: string | undefined,
  template: string,
  pathPrefix: string,
  callback: (injected: string) => void
): void;
