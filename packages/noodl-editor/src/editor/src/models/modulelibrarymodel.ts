import { platform } from '@noodl/platform';

import { addHashToUrl } from '@noodl-utils/addHashToUrl';
import FileSystem from '@noodl-utils/filesystem';
import getDocsEndpoint from '@noodl-utils/getDocsEndpoint';
import ProjectImporter from '@noodl-utils/import-engine/legacyAdapter';

import Model from '../../../shared/model';
import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import { ViewerConnection } from '../ViewerConnection';
import ImportPopup from '../views/importpopup';
import PopupLayer from '../views/popuplayer';
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
   * Throws (rejects) on network failure or a non-ok response — the caller
   * (loadModules) is responsible for turning that into loud UI state instead
   * of silently treating it as "zero entries".
   */
  async fetchModules(type: 'modules' | 'prefabs'): Promise<IModule[]> {
    const endpoint = getDocsEndpoint();
    const urlPath = addHashToUrl(`${endpoint}/library/${type}/index.json`);

    const response = await fetch(urlPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${type} library index: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async installModule(
    modulePath: string,
    onBeforePopup?: () => void,
    onAfterPopup?: () => void,
    module?: IModule
  ) {
    if (module && !isModuleCompatible(module)) {
      throw { message: `This module requires editor version ${module.minEditorVersion} or newer.` };
    }

    const moduleRootPath = await this.getModuleTemplateRoot(modulePath);

    const imports = await new Promise((resolve, reject) =>
      ProjectImporter.instance.listComponentsAndDependencies(moduleRootPath, resolve)
    );

    const collisions = await new Promise((resolve, reject) =>
      ProjectImporter.instance.checkForCollisions(imports, (result) =>
        result && result.message ? reject(result.message) : resolve(result)
      )
    );

    let componentsToImport = imports;

    // Show overwrite popup if collisions
    if (typeof collisions !== 'undefined') {
      componentsToImport = await this._showImportPopup({ imports, collisions, onBeforePopup, onAfterPopup });
    }

    await this._doImport(moduleRootPath, componentsToImport);
  }

  async installPrefab(
    modulePath: string,
    onBeforePopup?: () => void,
    onAfterPopup?: () => void,
    module?: IModule
  ) {
    if (module && !isModuleCompatible(module)) {
      throw { message: `This prefab requires editor version ${module.minEditorVersion} or newer.` };
    }

    const moduleRootPath = await this.getModuleTemplateRoot(modulePath);

    const imports = await new Promise<TSFixme>((resolve, reject) =>
      ProjectImporter.instance.listComponentsAndDependencies(moduleRootPath, resolve)
    );

    const collisions = await new Promise<TSFixme>((resolve, reject) =>
      ProjectImporter.instance.checkForCollisions(imports, (result) =>
        result && result.message ? reject(result.message) : resolve(result)
      )
    );

    let itemsToImport = imports;

    if (typeof collisions !== 'undefined') {
      const collisionsToImport = JSON.parse(JSON.stringify(collisions));

      //remove all collisions that aren't components since we shouldn't overwrite those
      collisionsToImport.styles = { colors: [], text: [] };
      collisionsToImport.resources = [];
      collisionsToImport.variants = [];
      collisionsToImport.modules = [];

      if (ProjectImporter.instance.hasCollisions(collisionsToImport)) {
        itemsToImport = await this._showImportPopup({
          imports,
          collisions: collisionsToImport,
          onBeforePopup,
          onAfterPopup
        });
      } else {
        //we have collisions in styles variants or resources. Let's remove those from the import
        function removeItemWithName(array, itemsToRemove) {
          for (const item of itemsToRemove) {
            array = array.filter((s) => s.name !== item.name);
          }
          return array;
        }

        itemsToImport.styles.colors = removeItemWithName(itemsToImport.styles.colors, collisions.styles.colors);
        itemsToImport.styles.text = removeItemWithName(itemsToImport.styles.text, collisions.styles.text);
        itemsToImport.variants = removeItemWithName(itemsToImport.variants, collisions.variants);
        itemsToImport.modules = removeItemWithName(itemsToImport.modules, collisions.modules);
      }
    }

    await this._doImport(moduleRootPath, itemsToImport);
  }

  async _doImport(moduleRootPath, imports) {
    ViewerConnection.instance.setWatchModelChangesEnabled(false);
    return new Promise((resolve, reject) => {
      ProjectImporter.instance.import(moduleRootPath, imports, (response) => {
        ViewerConnection.instance.setWatchModelChangesEnabled(true);

        if (response.result !== 'success') {
          reject({ message: response.message });
          PopupLayer.instance.hideAllModalsAndPopups();
        }

        EventDispatcher.instance.emit('viewer-refresh');
        EventDispatcher.instance.emit('ProjectModel.importComplete');

        resolve(true);
        PopupLayer.instance.hideAllModalsAndPopups();
      });
    });
  }

  async _showImportPopup({ imports, collisions, onBeforePopup, onAfterPopup }) {
    return new Promise((resolve, reject) => {
      const overwritePopup = new ImportPopup({
        variant: 'overwrite',
        imports: collisions,
        initAllAsImport: true,
        ignoreDependencies: true,
        onOk: () => {
          onAfterPopup && onAfterPopup();
          ProjectImporter.instance.filterImports(imports, { remove: overwritePopup.getUnselectedImports() });
          resolve(imports);
        },
        onCancel: () => {
          onAfterPopup && onAfterPopup();
          PopupLayer.instance.hideModal(undefined);
          reject({ message: 'Import cancelled' });
        }
      });

      overwritePopup.render();

      onBeforePopup && onBeforePopup();

      PopupLayer.instance.showModal({
        content: overwritePopup
      });
    });
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
