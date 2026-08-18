import { platform } from '@noodl/platform';
import { describeIncompatibilityFor, Incompatibility } from './moduleCompatibility';

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

/** Why this entry cannot be installed into the running editor, or null if it can. */
export function describeIncompatibility(module: IModule): Incompatibility | null {
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
    const incompatible = describeIncompatibility(module);
    if (incompatible) {
      throw { message: incompatible.full };
    }

    await this._install(await this.getModuleTemplateRoot(modulePath), {
      label: module?.label ?? 'module',
      kind: 'module',
      url: modulePath,
      onBeforePopup,
      onAfterPopup
    });
  }

  /** ✅ CN-016 AC3 — see `installModule` for why `module` is required. */
  async installPrefab(modulePath: string, onBeforePopup: (() => void) | undefined, onAfterPopup: (() => void) | undefined, module: IModule) {
    const incompatible = describeIncompatibility(module);
    if (incompatible) {
      throw { message: incompatible.full };
    }

    await this._install(await this.getModuleTemplateRoot(modulePath), {
      label: module?.label ?? 'prefab',
      kind: 'prefab',
      url: modulePath,
      onBeforePopup,
      onAfterPopup
    });
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
      onBeforePopup?: () => void;
      onAfterPopup?: () => void;
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
    // ⚠️ Held across the WHOLE install — see `_consentFor`. Two modals each
    // taking and releasing this would unblock the picker in the gap between them.
    options.onBeforePopup?.();
    try {
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
    } finally {
      options.onAfterPopup?.();
    }
  }

  /**
   * Ask for consent, translating a decline into this class's own cancellation
   * message so the two install branches report it identically.
   *
   * ⚠️ **No `onBeforePopup`/`onAfterPopup` here.** Those hooks block the node
   * picker behind a modal, and `_install` now holds them across the *whole*
   * install — consent and flow — rather than each modal taking and releasing
   * them. Per-modal hooks would unblock the picker in the gap between the
   * consent dialog closing and the flow opening, which is exactly the moment a
   * second click could start a second install.
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
