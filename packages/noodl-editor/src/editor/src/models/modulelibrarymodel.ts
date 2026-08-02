import { platform } from '@noodl/platform';

import { addHashToUrl } from '@noodl-utils/addHashToUrl';
import FileSystem from '@noodl-utils/filesystem';
import getDocsEndpoint from '@noodl-utils/getDocsEndpoint';

import Model from '../../../shared/model';
import {
  applyToProject,
  createTargetProject,
  ImportFlowCancelled,
  loadSource,
  openImportFlow,
  planSelection
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

/** Parses a "x.y.z" string into a comparable triple; missing/odd input sorts as 0.0.0. */
function parseVersion(v: string | undefined): [number, number, number] {
  const parts = (v || '').split('.').map((n) => parseInt(n, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/** true if `current` is >= `minRequired` (both "x.y.z"). No `minRequired` means always compatible. */
export function isVersionAtLeast(current: string, minRequired: string | undefined): boolean {
  if (!minRequired) return true;
  const a = parseVersion(current);
  const b = parseVersion(minRequired);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

/**
 * A library entry is compatible with this running editor when it declares no
 * `minEditorVersion` (older index entries, or entries that don't care) or
 * when the running editor's version meets it. Used to render incompatible
 * entries as such instead of letting install proceed into content the
 * running editor may not understand (LIB-001).
 */
export function isModuleCompatible(module: IModule): boolean {
  return isVersionAtLeast(platform.getVersion(), module.minEditorVersion);
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
    const endpoint = getDocsEndpoint();
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

  async installModule(modulePath: string, onBeforePopup?: () => void, onAfterPopup?: () => void, module?: IModule) {
    if (module && !isModuleCompatible(module)) {
      throw { message: `This module requires editor version ${module.minEditorVersion} or newer.` };
    }

    await this._install(await this.getModuleTemplateRoot(modulePath), {
      label: module?.label ?? 'module',
      kind: 'module',
      onBeforePopup,
      onAfterPopup
    });
  }

  async installPrefab(modulePath: string, onBeforePopup?: () => void, onAfterPopup?: () => void, module?: IModule) {
    if (module && !isModuleCompatible(module)) {
      throw { message: `This prefab requires editor version ${module.minEditorVersion} or newer.` };
    }

    await this._install(await this.getModuleTemplateRoot(modulePath), {
      label: module?.label ?? 'prefab',
      kind: 'prefab',
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
    options: { label: string; kind: 'prefab' | 'module'; onBeforePopup?: () => void; onAfterPopup?: () => void }
  ) {
    const project = ProjectModel.instance;
    if (!project) throw { message: 'No project loaded, cannot import.' };

    const source = await loadSource(moduleRootPath);
    const target = await createTargetProject(project);
    const everything: SelectionState = {
      requested: new Set(source.items.map((item) => item.key)),
      droppedLinks: new Set()
    };

    const dryRun = planSelection(source, target, everything);

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
        initialSelection: 'all',
        keepExistingNonComponents: options.kind === 'prefab',
        onBeforePopup: options.onBeforePopup,
        onAfterPopup: options.onAfterPopup
      });
      if (result.result !== 'success') throw { message: result.message };
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
