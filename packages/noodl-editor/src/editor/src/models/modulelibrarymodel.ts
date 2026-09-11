import { platform } from '@noodl/platform';
import { CompatibilityCandidate, describeIncompatibilityFor, Incompatibility } from './moduleCompatibility';
import { dependencyInstallOrder, dependencyKind, IModuleDependency } from './moduleDependencies';
import { installWarningToast } from './installWarningToast';

import { addHashToUrl } from '@noodl-utils/addHashToUrl';
import FileSystem from '@noodl-utils/filesystem';
import getContentEndpoint from '@noodl-utils/getContentEndpoint';

import type { ImportOrigin } from '@noodl-utils/import-engine';

import Model from '../../../shared/model';
import {
  applyToProject,
  createTargetProject,
  ImportFlowCancelled,
  loadSource,
  openImportFlow,
  planSelection,
  requireDownloadConsent
} from '../views/ImportFlow';
import type { SelectionState } from '../views/ImportFlow/model/selection';
import { ToastLayer } from '../views/ToastLayer/ToastLayer';
import { ProjectModel } from './projectmodel';
import { unzipIntoDirectory } from './projectmodel.editor';

export interface IModule {
  label: string;
  desc: string;
  project: string;
  icon: string;
  docs: string;
  tags: string[];
  // LIB-001: additive/optional fields. Old index.json files (and old editors
  // reading a new index.json) simply won't have/won't use them.
  type?: 'prefab' | 'module';
  version?: string;
  minEditorVersion?: string;
  runtimeVersion?: string;
  /**
   * ✅ LBR-007. Entries this one does not work without, already resolved and
   * ordered dependency-first by `scripts/library/build.js`. Installing this
   * entry installs these first, in this order, in the same click. Absent on
   * every entry that needs nothing — and on every index published before the
   * field existed, which an old editor and a new one both read as "none".
   */
  dependencies?: IModuleDependency[];
}

/**
 * Fetch lifecycle for a library tab. `error` is distinct from an empty
 * `loaded` list — an empty grid because the index genuinely has zero entries
 * should never be confused with "the fetch failed" (LIB-001 step 0).
 */
export type LibraryFetchStatus = 'loading' | 'loaded' | 'error';

/**
 * ✅ CN-016 AC3. The rule itself lives in `./moduleCompatibility`, which imports
 * nothing, so a plain-Node spec can reach it — this module cannot be imported
 * outside a renderer. Re-exported here because `ModuleCard` and
 * `scripts/library/verify-dist.ts` both address it through this model.
 */
export { isVersionAtLeast } from './moduleCompatibility';
export type { Incompatibility } from './moduleCompatibility';

/**
 * ✅ LBR-007. Re-exported for the same reason `Incompatibility` is: `IModule`
 * names this type in a public field, so a consumer of `IModule` must be able to
 * name it from here rather than reaching into the leaf module.
 */
export type { IModuleDependency } from './moduleDependencies';

/**
 * Why this entry cannot be installed into the running editor, or null if it can.
 *
 * ✅ LBR-007 widened the parameter from `IModule` to the structural
 * `CompatibilityCandidate` the rule actually reads. A *dependency* row
 * (`IModuleDependency`) carries a `minEditorVersion` too and has to face the
 * same gate as the entry that pulled it in — an editor too old for the
 * dependency is an editor too old for the install — and it is not an `IModule`.
 * `IModule` is still assignable, so every existing caller is unchanged.
 */
export function describeIncompatibility(module: CompatibilityCandidate): Incompatibility | null {
  return describeIncompatibilityFor(platform.getVersion(), module);
}

/**
 * A library entry is compatible with this running editor when it declares no
 * `minEditorVersion` (older index entries, or entries that don't care) or
 * when the running editor's version meets it. Used to render incompatible
 * entries as such instead of letting install proceed into content the
 * running editor may not understand (LIB-001).
 *
 * Kept as a boolean because `ModuleCard` and `verify-dist` ask a yes/no
 * question; derived from `describeIncompatibility` so there is exactly one
 * rule rather than two that agree until they don't.
 */
export function isModuleCompatible(module: IModule): boolean {
  return describeIncompatibility(module) === null;
}

export class ModuleLibraryModel extends Model {
  public modules: IModule[];
  public prefabs: IModule[];

  public modulesStatus: LibraryFetchStatus = 'loading';
  public prefabsStatus: LibraryFetchStatus = 'loading';

  private static _instance: ModuleLibraryModel = undefined;
  public static get instance() {
    if (!this._instance) {
      this._instance = new ModuleLibraryModel();
    }
    return this._instance;
  }

  constructor() {
    super();

    this.loadModules('modules');
    this.loadModules('prefabs');

    this.notifyListeners('libraryUpdated');
  }

  /** (Re-)fetches a library index and updates status/data, notifying listeners either way. */
  private loadModules(type: 'modules' | 'prefabs') {
    if (type === 'modules') this.modulesStatus = 'loading';
    else this.prefabsStatus = 'loading';
    this.notifyListeners('libraryUpdated');

    this.fetchModules(type).then(
      (modules) => {
        if (type === 'modules') {
          this.modules = modules;
          this.modulesStatus = 'loaded';
        } else {
          this.prefabs = modules;
          this.prefabsStatus = 'loaded';
        }
        this.notifyListeners('libraryUpdated');
      },
      () => {
        // Loud failure (LIB-001 step 0): leave existing data alone (if any
        // was previously loaded) but flag the error so the UI can show an
        // explicit offline/error state instead of a silently-empty grid.
        if (type === 'modules') this.modulesStatus = 'error';
        else this.prefabsStatus = 'error';
        this.notifyListeners('libraryUpdated');
      }
    );
  }

  /** Re-attempts a failed (or any) fetch for a library tab. */
  retry(type: 'modules' | 'prefabs') {
    this.loadModules(type);
  }

  /**
   * Resolves with items for immidiate use, but
   * also sets them to this.modules for future use.
   *
   * Throws (rejects) on network failure, a non-ok response, unparseable JSON,
   * or JSON that is not an array — the caller (loadModules) is responsible for
   * turning that into loud UI state instead of silently treating it as "zero
   * entries".
   *
   * The array check is not belt-and-braces. A 200 carrying a JSON *object* —
   * a CDN/proxy error body, a half-published index — parses fine, so it would
   * reach `loadModules` as a success and set status `loaded` with a non-array
   * `modules`. The search view guards every branch on `Array.isArray`, so the
   * panel would then render no grid, no spinner and no error: the silently
   * blank library LIB-001 step 0 exists to abolish, with no Retry button to
   * escape it.
   */
  async fetchModules(type: 'modules' | 'prefabs'): Promise<IModule[]> {
    const endpoint = getContentEndpoint();
    const urlPath = addHashToUrl(`${endpoint}/library/${type}/index.json`);

    const response = await fetch(urlPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${type} library index: ${response.status} ${response.statusText}`);
    }

    const parsed = await response.json();
    if (!Array.isArray(parsed)) {
      throw new Error(`The ${type} library index is not a list of entries (got ${typeof parsed}).`);
    }
    return parsed;
  }

  /**
   * ✅ CN-016 AC3. `module` is **required**. It used to be optional, and the
   * compat refusal was written `if (module && ...)` — so any caller that omitted
   * it skipped the gate entirely and installed an entry this editor had already
   * decided it could not run. `ModuleCard` is the only caller and always passed
   * it, so the gate happened to hold; it held by convention, not by the
   * signature. Grepped for `.js`/`.jsx` callers before tightening this — there
   * are none, which is the check a type-level change needs here, because an
   * untyped caller is invisible to every gate but `test:ci`.
   */
  async installModule(modulePath: string, onBeforePopup: (() => void) | undefined, onAfterPopup: (() => void) | undefined, module: IModule) {
    await this._installWithDependencies(modulePath, 'module', module, onBeforePopup, onAfterPopup);
  }

  /** ✅ CN-016 AC3 — see `installModule` for why `module` is required. */
  async installPrefab(modulePath: string, onBeforePopup: (() => void) | undefined, onAfterPopup: (() => void) | undefined, module: IModule) {
    await this._installWithDependencies(modulePath, 'prefab', module, onBeforePopup, onAfterPopup);
  }

  /**
   * ✅ LBR-007 — install `module`'s dependencies, then `module`, under one
   * click and one picker block.
   *
   * ## The defect this exists to close
   *
   * `modules/pdf-viewer` is built around the `Custom HTML` node
   * (`module.inlineHtml`), which the standalone `modules/custom-html` entry
   * registers. Installing PDF Viewer installed PDF Viewer, the node came up as
   * a red dashed placeholder, and the runtime said
   * *"Can't find component model for module.inlineHtml"*. Nothing in the
   * product said what was missing: the entry's own `library.json` description
   * and README were the only place the requirement was written down, and prose
   * is not an installer. The library had a dependency and no mechanism, so the
   * two workarounds available were "tell the user to read the card" and "ship a
   * second copy of the module inside the entry" — and the second one had
   * already been tried and reverted, because two copies of
   * `custom-html-module` fight over `noodl_modules/custom-html-module/` in the
   * installing project.
   *
   * ## What is resolved where
   *
   * The graph work happens at BUILD time. `library.json` authors
   * `"dependencies": ["modules/custom-html"]`; `scripts/library/build.js`
   * resolves that against the entries on disk, refuses to build on an unknown
   * slug or a cycle, flattens the transitive closure dependency-first, and
   * publishes it into `index.json` as resolved descriptors. So this walks a
   * flat list in order and installs each one exactly the way a user's own click
   * would — same download, same consent, same collision flow.
   *
   * ## 🔴 Why the popup hooks moved up here
   *
   * `_install` used to take `onBeforePopup`/`onAfterPopup` and hold them across
   * its own body, for the reason `_consentFor` documents: two modals each taking
   * and releasing the block would unblock the node picker in the gap between
   * them, which is exactly when a second click can start a second install. A
   * dependency chain is that same gap, one level up — block, install Custom
   * HTML, unblock, block, install PDF Viewer — so the hooks now live here and
   * are held across the WHOLE chain. `_install` no longer takes them, which is
   * what stops the invariant being re-broken by the next caller.
   *
   * ## What a failing dependency does
   *
   * Aborts the whole install, naming the dependency and the entry that needed
   * it. Installing the dependent alone is not a degraded success — it is the
   * red dashed placeholder above, which is the state this field exists to
   * abolish.
   */
  private async _installWithDependencies(
    modulePath: string,
    kind: 'prefab' | 'module',
    module: IModule,
    onBeforePopup: (() => void) | undefined,
    onAfterPopup: (() => void) | undefined
  ) {
    // ✅ CN-016 AC3, unchanged: refuse an incompatible entry before anything is
    // downloaded — and before a dependency of it is downloaded either.
    const incompatible = describeIncompatibility(module);
    if (incompatible) {
      throw { message: incompatible.full };
    }

    const dependencies = dependencyInstallOrder(module);

    // ⚠️ Held across the whole chain — see this method's header.
    onBeforePopup?.();
    try {
      for (const dep of dependencies) {
        await this._installDependency(dep, module);
      }

      await this._install(await this.getModuleTemplateRoot(modulePath), {
        label: module?.label ?? kind,
        kind,
        url: modulePath
      });
    } finally {
      onAfterPopup?.();
    }
  }

  /**
   * ✅ LBR-007 — one resolved dependency, installed through the same `_install`
   * a click uses, with any failure re-thrown as a sentence that names both ends.
   *
   * The compat gate runs on the DEPENDENCY's own `minEditorVersion`, not the
   * dependent's: an editor old enough for PDF Viewer but too old for Custom
   * HTML is still an editor that cannot complete this install, and the refusal
   * should say which half is the problem rather than fail somewhere inside the
   * import flow.
   */
  private async _installDependency(dep: IModuleDependency, dependent: IModule) {
    const label = dep.label ?? dep.key ?? 'a required library entry';
    const dependentLabel = dependent?.label ?? 'the entry you are installing';

    const incompatible = describeIncompatibility(dep);
    if (incompatible) {
      throw { message: `${incompatible.full} ("${dependentLabel}" cannot be installed without it.)` };
    }

    // Same rule ModuleCard applies to an entry's own `project` path: absolute
    // URLs are taken verbatim, index-relative ones hang off the content endpoint.
    const url = dep.project.startsWith('http') ? dep.project : `${getContentEndpoint()}/${dep.project}`;

    try {
      await this._install(await this.getModuleTemplateRoot(url), {
        label,
        kind: dependencyKind(dep),
        url
      });
    } catch (err) {
      const reason = (err as { message?: string })?.message ?? String(err);
      throw { message: `Could not install "${label}", which "${dependentLabel}" depends on: ${reason}` };
    }
  }

  /**
   * Install a prefab or module.
   *
   * LIB-005 keeps the one-click case one click: with nothing colliding, this
   * plans the whole source and applies it without ever showing a dialog. When
   * something DOES collide the full flow opens, pre-selected, so the user
   * resolves it in the same surface as any other import.
   *
   * Prefabs used to silently drop colliding styles, variants, files and modules
   * — the user never learned their prefab had come in half-restyled. Those
   * collisions now open the flow pre-resolved to "keep yours": the same
   * outcome by default, but visible and changeable.
   */
  private async _install(
    moduleRootPath: string,
    options: {
      label: string;
      kind: 'prefab' | 'module';
      /** The library URL this was downloaded from — CN-017's provenance, verbatim. */
      url: string;
    }
  ) {
    const project = ProjectModel.instance;
    if (!project) throw { message: 'No project loaded, cannot import.' };

    /*
     * ── ✅ CN-017 D6 part 3: consent, BEFORE either branch below ────────────
     *
     * 🔴 **Above the `hasCollisions` fork on purpose.** LIB-005's one-click case
     * skips the import flow entirely, so a consent step hosted inside the flow
     * would be absent on the most common install — present in the code, absent in
     * practice, and passing any test that only asked whether a dialog can appear.
     *
     * ⚠️ Silent when the download carries no executable module: `requireDownloadConsent`
     * returns an empty consent list without a dialog, so a prefab of plain
     * components still installs in one click. A prompt for an icon set would train
     * people to click through the one that matters.
     *
     * ⚠️ **The cache means this is not "on download".** `getModuleTemplateRoot`
     * reuses a non-empty `getUserDataPath()/library/<name>` directory without
     * re-fetching, so a check inside the download branch would run on the first
     * install of a module and never again. This runs on the resolved root path,
     * every install.
     */
    // ⚠️ The picker block that used to be taken here now lives in
    // `_installWithDependencies`, one level up, so that it is held across a
    // whole dependency chain and not re-taken per entry — see there, and see
    // `_consentFor` for why two modals must not each take and release it.
    const origin = await this._consentFor(moduleRootPath, options);

    const source = await loadSource(moduleRootPath);
    const target = await createTargetProject(project);
    const everything: SelectionState = {
      requested: new Set(source.items.map((item) => item.key)),
      droppedLinks: new Set()
    };

    const dryRun = planSelection(source, target, everything, origin);

    if (!dryRun.hasCollisions) {
      const result = await applyToProject(dryRun, project);
      if (result.result !== 'success') throw { message: result.message };
      /*
       * ── ✅ CMP-008: this branch used to drop every warning ────────────────
       *
       * 🔴 **This is the COMMON install, and it has no result stage.** The
       * colliding branch below opens the flow, whose `ResultStage` renders
       * `summary.warnings`; this one returned, and `ModuleCard` put a green
       * *"Prefab X cloned"* on screen. Everything the engine had to say —
       * CMP-008's unresolved design tokens, a module that failed to copy,
       * CN-017's refusal to copy an unconsented kit — arrived in `result` and
       * went nowhere.
       *
       * Sticky on purpose. These warnings describe things that will NOT
       * announce themselves later: an unresolved `var(--token)` is an unset
       * property rather than an error, and a kit that was not copied is simply
       * absent. Six seconds is the wrong amount of time for a note whose whole
       * point is that nothing else will ever mention it.
       */
      const toast = installWarningToast(result.warnings, options.label);
      if (toast) ToastLayer.showWarning(toast.message, { title: toast.title, duration: Infinity });
      return;
    }

    try {
      const result = await openImportFlow({
        title: `Install ${options.label}`,
        subtitle: options.kind === 'prefab' ? 'Prefab' : 'Module',
        sourceDir: moduleRootPath,
        origin,
        initialSelection: 'all',
        keepExistingNonComponents: options.kind === 'prefab'
      });
      if (result.result !== 'success') throw { message: result.message };
    } catch (err) {
      if (err instanceof ImportFlowCancelled) throw { message: 'Import cancelled' };
      throw err;
    }
  }

  /**
   * Ask for consent, translating a decline into this class's own cancellation
   * message so the two install branches report it identically.
   *
   * ⚠️ **No `onBeforePopup`/`onAfterPopup` here.** Those hooks block the node
   * picker behind a modal, and `_installWithDependencies` holds them across the
   * *whole* install — every dependency, then the entry, consent and flow for
   * each — rather than each modal, or each entry, taking and releasing them.
   * Per-modal hooks would unblock the picker in the gap between the consent
   * dialog closing and the flow opening, which is exactly the moment a second
   * click could start a second install; per-entry hooks (which is where LBR-007
   * found them, on `_install`) would do the same in the gap between a
   * dependency finishing and its dependent starting.
   */
  private async _consentFor(moduleRootPath: string, options: { label: string; url: string }): Promise<ImportOrigin> {
    try {
      return await requireDownloadConsent({
        title: `Install ${options.label}`,
        url: options.url,
        sourceDir: moduleRootPath
      });
    } catch (err) {
      if (err instanceof ImportFlowCancelled) throw { message: 'Import cancelled' };
      throw err;
    }
  }

  private getModuleTemplateRoot(templateUrl: string) {
    return new Promise<string>((resolve, reject) => {
      function findProjectRoot(path) {
        // Find the folder containing a project.json (it may not be the root folder)
        let root;
        FileSystem.instance.forEachFileRecursive(path, (filename, path) => {
          if (filename === 'project.json') {
            root = path;
            resolve(path);
            return;
          }
        });

        if (!root) reject({ message: 'Not a valid component' });
      }

      const name = templateUrl.replace(/:/g, '-').replace(/\//g, '-').replace('/./g', '-');
      const path = platform.getUserDataPath() + '/library/' + name;

      FileSystem.instance.makeDirectory(path, (response) => {
        if (response.result !== 'success') {
          reject({ message: 'Failed to create template directory' });
          return;
        }

        FileSystem.instance.isDirectoryEmpty(path, (isEmpty) => {
          if (isEmpty) {
            unzipIntoDirectory(
              templateUrl,
              path,
              (response) => {
                if (response.result !== 'success') {
                  reject({ message: 'Failed to download component' });
                  return;
                }

                findProjectRoot(response.dirEntry);
              },
              { skipLoad: true }
            );
          } else findProjectRoot(path);
        });
      });
    });
  }
}
